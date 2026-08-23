-- Tests del esquema de PLATA: aislamiento entre usuarios, constraints que no se
-- pueden saltear, y la aritmética del saldo derivado.
--
--   bunx supabase test db
--
-- Cada test corre como el rol `authenticated` con los claims de un usuario, que
-- es exactamente el contexto en el que corre la app.

begin;
create extension if not exists pgtap with schema extensions;
create schema if not exists tests;
-- el helper se llama desde el rol authenticated, así que necesita permisos
grant usage on schema tests to authenticated, anon;
select plan(34);

-- ---------------------------------------------------------------------------
-- Dos usuarios de prueba
-- ---------------------------------------------------------------------------

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'max@test.local',  'x', now(), now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'otro@test.local', 'x', now(), now(), now());

create or replace function tests.act_as(uid uuid) returns void language sql as $$
  select
    set_config('role', 'authenticated', true),
    set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

create or replace function tests.act_as_owner() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

grant execute on function tests.act_as(uuid) to authenticated, anon;

-- Datos base, cargados como dueño de la base para no depender de las policies
select tests.act_as_owner();

insert into public.accounts (id, user_id, name, currency, kind, initial_balance) values
  ('acc-ars', '11111111-1111-1111-1111-111111111111', 'Galicia',  'ARS', 'bank', 100000),
  ('acc-usd', '11111111-1111-1111-1111-111111111111', 'Dólares',  'USD', 'savings', 500),
  ('acc-otro','22222222-2222-2222-2222-222222222222', 'Ajena',    'ARS', 'cash', 999);

-- ---------------------------------------------------------------------------
-- Aislamiento entre usuarios
-- ---------------------------------------------------------------------------

select tests.act_as('11111111-1111-1111-1111-111111111111');

select is(
  (select count(*)::int from public.accounts),
  2,
  'el dueño ve sólo sus dos cuentas'
);

select is(
  (select count(*)::int from public.accounts where id = 'acc-otro'),
  0,
  'las cuentas de otro usuario son invisibles'
);

select throws_ok(
  $$insert into public.accounts (user_id, name, currency, kind)
    values ('22222222-2222-2222-2222-222222222222', 'Robada', 'ARS', 'bank')$$,
  '42501',
  null,
  'no se puede crear una fila a nombre de otro usuario'
);

select is(
  (select count(*)::int from public.account_balances),
  2,
  'la vista de saldos respeta RLS (security_invoker)'
);

select tests.act_as('22222222-2222-2222-2222-222222222222');

select is(
  (select count(*)::int from public.accounts),
  1,
  'el otro usuario ve sólo la suya'
);

select is(
  (select count(*)::int from public.transactions),
  0,
  'no ve movimientos ajenos'
);

-- Un usuario no puede robarse una fila cambiándole el dueño
select tests.act_as('11111111-1111-1111-1111-111111111111');

select throws_ok(
  $$update public.accounts set user_id = '22222222-2222-2222-2222-222222222222'
     where id = 'acc-ars'$$,
  '42501',
  null,
  'reasignar una fila a otro usuario lo rechaza el with check'
);

-- ---------------------------------------------------------------------------
-- Constraints: forma de los datos
-- ---------------------------------------------------------------------------

select tests.act_as('11111111-1111-1111-1111-111111111111');

select throws_ok(
  $$insert into public.transactions (user_id, type, amount, account_id, currency, category, occurred_at)
    values ('11111111-1111-1111-1111-111111111111', 'expense', -50, 'acc-ars', 'ARS', 'Comida', now())$$,
  '23514',
  null,
  'monto negativo rechazado'
);

select throws_ok(
  $$insert into public.transactions (user_id, type, amount, account_id, currency, category, occurred_at)
    values ('11111111-1111-1111-1111-111111111111', 'expense', 0, 'acc-ars', 'ARS', 'Comida', now())$$,
  '23514',
  null,
  'monto cero rechazado'
);

select throws_ok(
  $$insert into public.transactions (user_id, type, amount, account_id, currency, category, occurred_at)
    values ('11111111-1111-1111-1111-111111111111', 'refund', 100, 'acc-ars', 'ARS', 'Comida', now())$$,
  '22P02',
  null,
  'tipo de movimiento desconocido rechazado'
);

select throws_ok(
  $$insert into public.transactions (user_id, type, amount, account_id, currency, category, occurred_at)
    values ('11111111-1111-1111-1111-111111111111', 'expense', 100, 'acc-ars', 'EUR', 'Comida', now())$$,
  '22P02',
  null,
  'moneda desconocida rechazada'
);

select throws_ok(
  $$insert into public.transactions (user_id, type, amount, account_id, currency, category, occurred_at)
    values ('11111111-1111-1111-1111-111111111111', 'transfer', 100, 'acc-ars', 'ARS', 'Transferencia', now())$$,
  '23514',
  null,
  'transferencia sin cuenta de destino rechazada'
);

select throws_ok(
  $$insert into public.transactions (user_id, type, amount, account_id, to_account_id, currency, category, occurred_at)
    values ('11111111-1111-1111-1111-111111111111', 'transfer', 100, 'acc-ars', 'acc-ars', 'ARS', 'Transferencia', now())$$,
  '23514',
  null,
  'transferencia a la misma cuenta rechazada'
);

select throws_ok(
  $$insert into public.accounts (user_id, name, currency, kind)
    values ('11111111-1111-1111-1111-111111111111', '   ', 'ARS', 'bank')$$,
  '23514',
  null,
  'nombre de cuenta en blanco rechazado'
);

select throws_ok(
  $$insert into public.accounts (user_id, name, currency, kind)
    values ('11111111-1111-1111-1111-111111111111', 'Colchón', 'ARS', 'mattress')$$,
  '22P02',
  null,
  'tipo de cuenta desconocido rechazado'
);

select throws_ok(
  $$insert into public.stock_trades (user_id, symbol, side, shares, price, occurred_at)
    values ('11111111-1111-1111-1111-111111111111', 'AAPL', 'buy', 0, 180.5, now())$$,
  '23514',
  null,
  'compra de 0 acciones rechazada'
);

select throws_ok(
  $$insert into public.due_items (user_id, title, category, amount, currency, due_date, frequency)
    values ('11111111-1111-1111-1111-111111111111', 'Luz', 'Servicios', 100, 'ARS', current_date, 'weekly')$$,
  '22P02',
  null,
  'frecuencia de vencimiento desconocida rechazada'
);

select lives_ok(
  $$insert into public.due_items (user_id, title, category, amount, currency, due_date, frequency)
    values ('11111111-1111-1111-1111-111111111111', 'Luz', 'Servicios', 15000, 'ARS', current_date, 'monthly')$$,
  'un vencimiento válido entra sin problemas'
);

-- ---------------------------------------------------------------------------
-- Saldo derivado
-- ---------------------------------------------------------------------------

select is(
  (select balance from public.account_balances where id = 'acc-ars'),
  100000::numeric,
  'sin movimientos, el saldo es el inicial'
);

insert into public.transactions (id, user_id, type, amount, account_id, currency, category, occurred_at)
values ('tx-1', '11111111-1111-1111-1111-111111111111', 'expense', 15000, 'acc-ars', 'ARS', 'Comida', now());

select is(
  (select balance from public.account_balances where id = 'acc-ars'),
  85000::numeric,
  'un gasto descuenta del saldo'
);

insert into public.transactions (id, user_id, type, amount, account_id, currency, category, occurred_at)
values ('tx-2', '11111111-1111-1111-1111-111111111111', 'income', 200000, 'acc-ars', 'ARS', 'Salario', now());

select is(
  (select balance from public.account_balances where id = 'acc-ars'),
  285000::numeric,
  'un ingreso suma al saldo'
);

-- Transferencia entre monedas: 65.000 ARS -> 50 USD
insert into public.transactions (id, user_id, type, amount, account_id, to_account_id, to_amount, exchange_rate, currency, category, occurred_at)
values ('tx-3', '11111111-1111-1111-1111-111111111111', 'transfer', 65000, 'acc-ars', 'acc-usd', 50, 1300, 'ARS', 'Transferencia', now());

select is(
  (select balance from public.account_balances where id = 'acc-ars'),
  220000::numeric,
  'la transferencia descuenta el monto de origen'
);

select is(
  (select balance from public.account_balances where id = 'acc-usd'),
  550::numeric,
  'la transferencia acredita to_amount en destino, no amount'
);

-- Editar un movimiento no requiere revertir nada a mano
update public.transactions set amount = 25000 where id = 'tx-1';

select is(
  (select balance from public.account_balances where id = 'acc-ars'),
  210000::numeric,
  'editar el monto de un gasto recalcula el saldo solo'
);

delete from public.transactions where id = 'tx-1';

select is(
  (select balance from public.account_balances where id = 'acc-ars'),
  235000::numeric,
  'borrar un gasto devuelve la plata sin código de reversión'
);

-- ---------------------------------------------------------------------------
-- Borrados en cadena: el comportamiento que costó los bugs #1 y #7 del audit
-- ---------------------------------------------------------------------------

insert into public.vehicles (id, user_id, name, type, odometer)
values ('veh-1', '11111111-1111-1111-1111-111111111111', 'Moto', 'motorcycle', 1000);

insert into public.transactions (id, user_id, type, amount, account_id, currency, category, occurred_at, vehicle_id)
values ('tx-veh', '11111111-1111-1111-1111-111111111111', 'expense', 30000, 'acc-ars', 'ARS', 'Transporte', now(), 'veh-1');

insert into public.vehicle_logs (id, user_id, vehicle_id, type, occurred_at, odometer, amount, account_id, transaction_id)
values ('vl-1', '11111111-1111-1111-1111-111111111111', 'veh-1', 'fuel', now(), 1200, 30000, 'acc-ars', 'tx-veh');

select is(
  (select balance from public.account_balances where id = 'acc-ars'),
  205000::numeric,
  'el gasto del vehículo descuenta del saldo'
);

delete from public.vehicles where id = 'veh-1';

select is(
  (select count(*)::int from public.vehicle_logs where vehicle_id = 'veh-1'),
  0,
  'borrar el vehículo borra sus registros (cascade)'
);

select is(
  (select count(*)::int from public.transactions where id = 'tx-veh'),
  1,
  'pero conserva el movimiento: es plata que salió de la cuenta'
);

select is(
  (select vehicle_id from public.transactions where id = 'tx-veh'),
  null,
  'el movimiento queda desvinculado del vehículo, no huérfano'
);

-- Borrar una cuenta conserva sus movimientos y su moneda
insert into public.accounts (id, user_id, name, currency, kind, initial_balance)
values ('acc-tmp', '11111111-1111-1111-1111-111111111111', 'Temporal', 'USD', 'wallet', 0);

insert into public.transactions (id, user_id, type, amount, account_id, currency, category, occurred_at)
values ('tx-tmp', '11111111-1111-1111-1111-111111111111', 'expense', 25, 'acc-tmp', 'USD', 'Otros', now());

delete from public.accounts where id = 'acc-tmp';

select is(
  (select currency::text from public.transactions where id = 'tx-tmp'),
  'USD',
  'un movimiento de una cuenta borrada conserva su moneda (bug #7 del audit)'
);

select is(
  (select account_id from public.transactions where id = 'tx-tmp'),
  null,
  'y queda sin cuenta en vez de apuntar a una que no existe'
);

-- ---------------------------------------------------------------------------
-- Posiciones derivadas
-- ---------------------------------------------------------------------------

insert into public.stock_trades (user_id, symbol, side, shares, price, occurred_at) values
  ('11111111-1111-1111-1111-111111111111', 'AAPL', 'buy',  10, 100, now() - interval '2 days'),
  ('11111111-1111-1111-1111-111111111111', 'AAPL', 'buy',  10, 200, now() - interval '1 day'),
  ('11111111-1111-1111-1111-111111111111', 'AAPL', 'sell',  5, 250, now());

select is(
  (select shares from public.stock_positions where symbol = 'AAPL'),
  15::numeric,
  'la posición sale de las operaciones (10 + 10 - 5)'
);

select is(
  (select avg_buy_price from public.stock_positions where symbol = 'AAPL'),
  150::numeric,
  'el precio promedio de compra es ponderado'
);

select is(
  (select count(*)::int from public.stock_positions where symbol = 'TSLA'),
  0,
  'una posición cerrada no aparece'
);

select * from finish();
rollback;
