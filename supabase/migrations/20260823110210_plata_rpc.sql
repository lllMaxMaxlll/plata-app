-- PLATA — operaciones compuestas.
--
-- Reemplazan los runTransaction del provider. Sólo van acá las operaciones que
-- tocan más de una tabla o que necesitan validar contra el estado de la base;
-- las altas y bajas simples (cuentas, categorías, watchlist, vencimientos) las
-- hace el cliente con insert/update/delete normales, protegidas por RLS.
--
-- Tres reglas comunes a todas:
--
--   1. `security invoker`: corren como el usuario que las llama, así que las RLS
--      siguen aplicando adentro. Nada de security definer.
--   2. `set search_path = ''`: nombres siempre calificados, para que nadie pueda
--      secuestrar una llamada con un schema propio.
--   3. Se bloquean las cuentas involucradas con `for update` ANTES de escribir.
--      El saldo es derivado, así que dos débitos simultáneos verían cada uno su
--      propio snapshot y ambos pasarían el control; el lock sobre la fila de la
--      cuenta los serializa.
--
-- El control de saldo se hace DESPUÉS de escribir, mirando el saldo derivado:
-- como todo corre dentro de una transacción, un raise deshace la escritura. Eso
-- cubre altas, ediciones, cambios de cuenta y de tipo con una sola regla, en vez
-- de replicar la aritmética de cada caso.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Bloquea las cuentas indicadas en orden estable (evita deadlocks entre llamadas
-- que tocan el mismo par de cuentas en sentidos opuestos).
create or replace function public.lock_accounts(p_ids text[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  ignorado text;
begin
  select a.id into ignorado
    from public.accounts a
   where a.id = any(p_ids)
   order by a.id
     for update;
end $$;

-- Aborta si alguna de las cuentas quedó en negativo.
create or replace function public.assert_no_overdraft(p_ids text[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  descubierto record;
begin
  select b.name, b.balance, b.currency into descubierto
    from public.account_balances b
   where b.id = any(p_ids) and b.balance < 0
   order by b.balance
   limit 1;

  if found then
    raise exception 'Saldo insuficiente en "%": te faltan % %',
      descubierto.name, to_char(-descubierto.balance, 'FM999999990.00'), descubierto.currency
      using errcode = 'check_violation';
  end if;
end $$;

create or replace function public.next_due_date(p_date date, p_frequency public.due_frequency)
returns date
language sql
immutable
security invoker
set search_path = ''
as $$
  select case p_frequency
    when 'monthly'  then (p_date + interval '1 month')::date
    when 'yearly'   then (p_date + interval '1 year')::date
    when 'biweekly' then (p_date + interval '14 days')::date
    else p_date
  end;
$$;

-- ---------------------------------------------------------------------------
-- Movimientos
-- ---------------------------------------------------------------------------

create or replace function public.create_transaction(
  p_type          public.transaction_type,
  p_amount        numeric,
  p_account_id    text,
  p_category      text,
  p_occurred_at   timestamptz default now(),
  p_to_account_id text default null,
  p_to_amount     numeric default null,
  p_exchange_rate numeric default null,
  p_note          text default null,
  p_receipt_name  text default null,
  p_vehicle_id    text default null
)
returns public.transactions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  origen public.accounts;
  nueva  public.transactions;
begin
  perform public.lock_accounts(array_remove(array[p_account_id, p_to_account_id], null));

  select * into origen from public.accounts where id = p_account_id;
  if not found then
    raise exception 'La cuenta de origen no existe' using errcode = 'no_data_found';
  end if;

  insert into public.transactions (
    user_id, type, amount, account_id, currency, to_account_id, to_amount,
    exchange_rate, category, note, occurred_at, receipt_name, vehicle_id
  ) values (
    (select auth.uid()), p_type, p_amount, p_account_id, origen.currency, p_to_account_id,
    p_to_amount, p_exchange_rate, p_category, p_note, p_occurred_at, p_receipt_name, p_vehicle_id
  )
  returning * into nueva;

  if p_type <> 'income' then
    perform public.assert_no_overdraft(array[p_account_id]);
  end if;

  return nueva;
end $$;

create or replace function public.update_transaction(
  p_id            text,
  p_type          public.transaction_type,
  p_amount        numeric,
  p_account_id    text,
  p_category      text,
  p_occurred_at   timestamptz,
  p_to_account_id text default null,
  p_to_amount     numeric default null,
  p_exchange_rate numeric default null,
  p_note          text default null,
  p_receipt_name  text default null,
  p_vehicle_id    text default null
)
returns public.transactions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  anterior   public.transactions;
  origen     public.accounts;
  afectadas  text[];
  editada    public.transactions;
begin
  select * into anterior from public.transactions where id = p_id;
  if not found then
    raise exception 'El movimiento no existe' using errcode = 'no_data_found';
  end if;

  -- Las cuentas de antes y las de después: editar puede sacar plata de una
  -- cuenta y devolvérsela a otra.
  afectadas := array_remove(
    array[anterior.account_id, anterior.to_account_id, p_account_id, p_to_account_id], null);
  perform public.lock_accounts(afectadas);

  select * into origen from public.accounts where id = p_account_id;
  if not found then
    raise exception 'La cuenta de origen no existe' using errcode = 'no_data_found';
  end if;

  update public.transactions set
    type          = p_type,
    amount        = p_amount,
    account_id    = p_account_id,
    currency      = origen.currency,
    to_account_id = p_to_account_id,
    to_amount     = p_to_amount,
    exchange_rate = p_exchange_rate,
    category      = p_category,
    note          = p_note,
    occurred_at   = p_occurred_at,
    receipt_name  = p_receipt_name,
    vehicle_id    = p_vehicle_id
  where id = p_id
  returning * into editada;

  perform public.assert_no_overdraft(afectadas);

  return editada;
end $$;

-- ---------------------------------------------------------------------------
-- Vencimientos
-- ---------------------------------------------------------------------------

create or replace function public.pay_due_item(
  p_id         text,
  p_account_id text default null,
  p_amount     numeric default null,
  p_category   text default null,
  p_note       text default null
)
returns public.due_items
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item      public.due_items;
  cuenta    public.accounts;
  importe   numeric(14,2);
  recurrente boolean;
  resultado public.due_items;
begin
  if p_account_id is not null then
    perform public.lock_accounts(array[p_account_id]);
  end if;

  select * into item from public.due_items where id = p_id for update;
  if not found then
    raise exception 'El vencimiento no existe' using errcode = 'no_data_found';
  end if;
  if item.status = 'paid' then
    raise exception 'El vencimiento ya fue pagado' using errcode = 'check_violation';
  end if;

  if p_account_id is not null then
    select * into cuenta from public.accounts where id = p_account_id;
    if not found then
      raise exception 'La cuenta seleccionada no existe' using errcode = 'no_data_found';
    end if;

    -- Pagar una factura en pesos desde una cuenta en dólares descontaría el
    -- importe en dólares. Nunca implícito.
    if cuenta.currency <> item.currency then
      raise exception 'El vencimiento está en % y la cuenta seleccionada es en %. Elegí una cuenta en %',
        item.currency, cuenta.currency, item.currency using errcode = 'check_violation';
    end if;

    importe := coalesce(p_amount, item.amount);
    if importe is null or importe <= 0 then
      raise exception 'El importe no es válido' using errcode = 'check_violation';
    end if;

    insert into public.transactions (
      user_id, type, amount, account_id, currency, category, note, occurred_at
    ) values (
      (select auth.uid()), 'expense', importe, p_account_id, cuenta.currency,
      coalesce(p_category, item.category, 'Servicios'),
      coalesce(p_note, 'Pago de vencimiento: ' || item.title),
      now()
    );

    perform public.assert_no_overdraft(array[p_account_id]);
  end if;

  recurrente := item.auto_renew and item.frequency <> 'one_time';

  update public.due_items set
    due_date   = case when recurrente then public.next_due_date(item.due_date, item.frequency) else due_date end,
    status     = case when recurrente then 'pending'::public.due_status else 'paid'::public.due_status end,
    paid_at    = now(),
    updated_at = now()
  where id = p_id
  returning * into resultado;

  return resultado;
end $$;

-- ---------------------------------------------------------------------------
-- Acciones
-- ---------------------------------------------------------------------------

create or replace function public.execute_stock_trade(
  p_symbol      text,
  p_side        public.trade_side,
  p_shares      numeric,
  p_price       numeric,
  p_account_id  text,
  p_occurred_at timestamptz default now()
)
returns public.stock_trades
language plpgsql
security invoker
set search_path = ''
as $$
declare
  cuenta    public.accounts;
  simbolo   text := upper(btrim(p_symbol));
  total     numeric(14,2) := round(p_shares * p_price, 2);
  en_cartera numeric(18,8);
  operacion public.stock_trades;
begin
  perform public.lock_accounts(array[p_account_id]);

  select * into cuenta from public.accounts where id = p_account_id;
  if not found then
    raise exception 'La cuenta seleccionada no existe' using errcode = 'no_data_found';
  end if;
  if cuenta.currency <> 'USD' then
    raise exception 'Las operaciones bursátiles requieren una cuenta en USD'
      using errcode = 'check_violation';
  end if;

  if p_side = 'sell' then
    select coalesce(shares, 0) into en_cartera
      from public.stock_positions where symbol = simbolo;
    if coalesce(en_cartera, 0) < p_shares then
      raise exception 'No tenés suficientes acciones de % para vender (tenés %)',
        simbolo, coalesce(en_cartera, 0) using errcode = 'check_violation';
    end if;
  end if;

  insert into public.stock_trades (user_id, symbol, side, shares, price, occurred_at, account_id)
  values ((select auth.uid()), simbolo, p_side, p_shares, p_price, p_occurred_at, p_account_id)
  returning * into operacion;

  -- El movimiento espejo: la operación mueve plata de la cuenta, así que tiene
  -- que verse en el historial y pesar en el saldo.
  insert into public.transactions (
    user_id, type, amount, account_id, currency, category, note, occurred_at
  ) values (
    (select auth.uid()),
    case when p_side = 'buy' then 'expense'::public.transaction_type
         else 'income'::public.transaction_type end,
    total, p_account_id, 'USD', 'Inversiones',
    case when p_side = 'buy' then 'Compra' else 'Venta' end
      || ' de ' || p_shares || ' acciones de ' || simbolo || ' @ $' || p_price,
    p_occurred_at
  );

  if p_side = 'buy' then
    perform public.assert_no_overdraft(array[p_account_id]);
  end if;

  return operacion;
end $$;

-- ---------------------------------------------------------------------------
-- Vehículos
-- ---------------------------------------------------------------------------

create or replace function public.create_vehicle_log(
  p_vehicle_id text,
  p_type       public.vehicle_log_type,
  p_occurred_at timestamptz,
  p_odometer   integer,
  p_amount     numeric,
  p_account_id text default null,
  p_note       text default null,
  p_extra      jsonb default '{}'::jsonb
)
returns public.vehicle_logs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  vehiculo public.vehicles;
  cuenta   public.accounts;
  tx_id    text := null;
  registro public.vehicle_logs;
begin
  if p_account_id is not null then
    perform public.lock_accounts(array[p_account_id]);
  end if;

  select * into vehiculo from public.vehicles where id = p_vehicle_id for update;
  if not found then
    raise exception 'El vehículo no existe' using errcode = 'no_data_found';
  end if;

  -- Gasto sincronizado con una cuenta
  if p_account_id is not null and p_amount > 0 then
    select * into cuenta from public.accounts where id = p_account_id;
    if not found then
      raise exception 'La cuenta seleccionada no existe' using errcode = 'no_data_found';
    end if;

    insert into public.transactions (
      user_id, type, amount, account_id, currency, category, note, occurred_at, vehicle_id
    ) values (
      (select auth.uid()), 'expense', p_amount, p_account_id, cuenta.currency, 'Transporte',
      '[' || vehiculo.name || '] ' || coalesce(p_note, initcap(p_type::text)),
      p_occurred_at, p_vehicle_id
    )
    returning id into tx_id;
  end if;

  insert into public.vehicle_logs (
    user_id, vehicle_id, type, occurred_at, odometer, amount, note, account_id, transaction_id,
    liters, gas_station, price_per_liter, is_full_tank, service_type, provider,
    next_service_odometer, next_service_date, item_name
  ) values (
    (select auth.uid()), p_vehicle_id, p_type, p_occurred_at, p_odometer, p_amount, p_note,
    p_account_id, tx_id,
    (p_extra->>'liters')::numeric, p_extra->>'gas_station', (p_extra->>'price_per_liter')::numeric,
    (p_extra->>'is_full_tank')::boolean, p_extra->>'service_type', p_extra->>'provider',
    (p_extra->>'next_service_odometer')::integer, (p_extra->>'next_service_date')::date,
    p_extra->>'item_name'
  )
  returning * into registro;

  -- El odómetro del vehículo sólo avanza
  if p_odometer > vehiculo.odometer then
    update public.vehicles set odometer = p_odometer where id = p_vehicle_id;
  end if;

  if tx_id is not null then
    perform public.assert_no_overdraft(array[p_account_id]);
  end if;

  return registro;
end $$;

-- Borra el registro junto con el gasto que generó: el saldo vuelve solo, porque
-- es derivado. Este es el bug #1 del audit, que acá no puede existir.
create or replace function public.delete_vehicle_log(p_id text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  registro public.vehicle_logs;
begin
  select * into registro from public.vehicle_logs where id = p_id;
  if not found then
    raise exception 'El registro no existe' using errcode = 'no_data_found';
  end if;

  delete from public.vehicle_logs where id = p_id;

  if registro.transaction_id is not null then
    delete from public.transactions where id = registro.transaction_id;
  end if;
end $$;

-- Borra el vehículo, sus registros y los gastos que esos registros generaron,
-- que es lo que la app le promete al usuario en el diálogo de confirmación.
create or replace function public.delete_vehicle(p_id text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from public.vehicles where id = p_id) then
    raise exception 'El vehículo no existe' using errcode = 'no_data_found';
  end if;

  delete from public.transactions t
   where t.id in (select vl.transaction_id from public.vehicle_logs vl
                   where vl.vehicle_id = p_id and vl.transaction_id is not null);

  -- los registros se van por el on delete cascade
  delete from public.vehicles where id = p_id;
end $$;

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------

-- Postgres le da EXECUTE a PUBLIC por defecto: se lo sacamos y se lo damos sólo
-- a usuarios autenticados. Igual son security invoker, así que las RLS mandan.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as firma
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         'lock_accounts', 'assert_no_overdraft', 'next_due_date',
         'create_transaction', 'update_transaction', 'pay_due_item',
         'execute_stock_trade', 'create_vehicle_log', 'delete_vehicle_log', 'delete_vehicle')
  loop
    execute format('revoke execute on function %s from public, anon', fn.firma);
    execute format('grant execute on function %s to authenticated', fn.firma);
  end loop;
end $$;
