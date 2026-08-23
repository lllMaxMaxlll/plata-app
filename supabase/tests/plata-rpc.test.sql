-- Tests de las operaciones compuestas: las reglas de negocio que en la app vieja
-- vivían en el cliente y se podían saltear.
--
--   bunx supabase test db

begin;
create extension if not exists pgtap with schema extensions;
create schema if not exists tests;
grant usage on schema tests to authenticated, anon;
select plan(40);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'max@test.local', '', now(), now(), now());

create or replace function tests.act_as(uid uuid) returns void language sql as $$
  select
    set_config('role', 'authenticated', true),
    set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
grant execute on function tests.act_as(uuid) to authenticated, anon;

create or replace function tests.saldo(p_id text) returns numeric language sql as $$
  select balance from public.account_balances where id = p_id;
$$;
grant execute on function tests.saldo(text) to authenticated, anon;

insert into public.accounts (id, user_id, name, currency, kind, initial_balance) values
  ('ars', '11111111-1111-1111-1111-111111111111', 'Galicia', 'ARS', 'bank',    100000),
  ('ars2','11111111-1111-1111-1111-111111111111', 'Cash',    'ARS', 'cash',     20000),
  ('usd', '11111111-1111-1111-1111-111111111111', 'Dólares', 'USD', 'savings',   1000);

insert into public.vehicles (id, user_id, name, type, odometer)
values ('moto', '11111111-1111-1111-1111-111111111111', 'Moto', 'motorcycle', 1000);

select tests.act_as('11111111-1111-1111-1111-111111111111');

-- ---------------------------------------------------------------------------
-- create_transaction
-- ---------------------------------------------------------------------------

select lives_ok(
  $$select public.create_transaction('expense', 15000, 'ars', 'Comida', now())$$,
  'un gasto dentro del saldo se registra'
);

select is(tests.saldo('ars'), 85000::numeric, 'el gasto se descontó del saldo');

select is(
  (select currency::text from public.transactions where category = 'Comida'),
  'ARS',
  'la moneda la pone la función desde la cuenta, no el cliente'
);

select throws_ok(
  $$select public.create_transaction('expense', 999999, 'ars', 'Comida', now())$$,
  '23514',
  null,
  'un gasto mayor al saldo se rechaza en la base'
);

select is(tests.saldo('ars'), 85000::numeric, 'y el saldo no se movió');

select lives_ok(
  $$select public.create_transaction('income', 999999, 'ars', 'Salario', now())$$,
  'un ingreso no valida saldo'
);

select is(tests.saldo('ars'), 1084999::numeric, 'el ingreso sumó');

select lives_ok(
  $$select public.create_transaction('transfer', 4999, 'ars2', 'Transferencia', now(), 'ars')$$,
  'una transferencia dentro del saldo se registra'
);

select is(tests.saldo('ars2'), 15001::numeric, 'la transferencia salió del origen');
select is(tests.saldo('ars'), 1089998::numeric, 'y entró en el destino');

select throws_ok(
  $$select public.create_transaction('transfer', 999999, 'ars2', 'Transferencia', now(), 'ars')$$,
  '23514',
  null,
  'una transferencia sin fondos se rechaza'
);

select throws_ok(
  $$select public.create_transaction('expense', 100, 'no-existe', 'Comida', now())$$,
  'P0002',
  null,
  'una cuenta inexistente se rechaza'
);

-- ---------------------------------------------------------------------------
-- update_transaction
-- ---------------------------------------------------------------------------

select is(
  (select t.amount from public.update_transaction(
     (select id from public.transactions where category = 'Comida'),
     'expense', 25000, 'ars', 'Comida', now()) t),
  25000::numeric,
  'editar el monto de un movimiento devuelve la fila nueva'
);

select is(tests.saldo('ars'), 1079998::numeric, 'el saldo se recalculó solo tras la edición');

select throws_ok(
  format($$select public.update_transaction(%L, 'expense', 99999999, 'ars', 'Comida', now())$$,
         (select id from public.transactions where category = 'Comida')),
  '23514',
  null,
  'editar a un monto que deja la cuenta en negativo se rechaza'
);

select is(tests.saldo('ars'), 1079998::numeric, 'y la edición rechazada no dejó rastro');

-- ---------------------------------------------------------------------------
-- pay_due_item — el bug #2 del audit
-- ---------------------------------------------------------------------------

insert into public.due_items (id, user_id, title, category, amount, currency, due_date, frequency, auto_renew)
values
  ('luz',  '11111111-1111-1111-1111-111111111111', 'Luz',    'Servicios', 15000, 'ARS', date '2026-08-10', 'monthly', true),
  ('netflix','11111111-1111-1111-1111-111111111111', 'Netflix','Subscripciones', 10, 'USD', date '2026-08-15', 'one_time', false);

select throws_ok(
  $$select public.pay_due_item('luz', 'usd')$$,
  '23514',
  null,
  'pagar una factura en ARS desde una cuenta en USD se rechaza'
);

select is(
  (select status::text from public.due_items where id = 'luz'),
  'pending',
  'y el vencimiento sigue pendiente'
);

select lives_ok(
  $$select public.pay_due_item('luz', 'ars')$$,
  'pagarla desde una cuenta en ARS funciona'
);

select is(tests.saldo('ars'), 1064998::numeric, 'el pago descontó el importe');

select is(
  (select due_date from public.due_items where id = 'luz'),
  date '2026-09-10',
  'un vencimiento recurrente avanza al próximo período'
);

select is(
  (select status::text from public.due_items where id = 'luz'),
  'pending',
  'y vuelve a quedar pendiente, no pagado'
);

select lives_ok(
  $$select public.pay_due_item('netflix', 'usd')$$,
  'un vencimiento en USD se paga desde la cuenta en USD'
);

select is(
  (select status::text from public.due_items where id = 'netflix'),
  'paid',
  'uno no recurrente queda pagado'
);

-- ---------------------------------------------------------------------------
-- execute_stock_trade
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select public.execute_stock_trade('AAPL', 'buy', 1, 100, 'ars')$$,
  '23514',
  null,
  'operar desde una cuenta en pesos se rechaza'
);

select throws_ok(
  $$select public.execute_stock_trade('AAPL', 'sell', 1, 100, 'usd')$$,
  '23514',
  null,
  'vender acciones que no se tienen se rechaza'
);

select lives_ok(
  $$select public.execute_stock_trade('AAPL', 'buy', 2, 100, 'usd')$$,
  'una compra con fondos suficientes se registra'
);

select is(tests.saldo('usd'), 790::numeric, 'la compra descontó 200 (1000 - 10 de Netflix - 200)');

-- ---------------------------------------------------------------------------
-- Vehículos — el bug #1 del audit, que acá no puede existir
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select public.create_vehicle_log('moto', 'fuel', now(), 1500, 30000, 'ars2')$$,
  '23514',
  null,
  'un gasto de vehículo mayor al saldo se rechaza (la app vieja no lo validaba)'
);

select lives_ok(
  $$select public.create_vehicle_log('moto', 'fuel', now(), 1500, 10000, 'ars2')$$,
  'cargar combustible dentro del saldo funciona'
);

select is(tests.saldo('ars2'), 5001::numeric, 'el gasto del vehículo descontó de la cuenta');

select is(
  (select odometer from public.vehicles where id = 'moto'),
  1500,
  'el odómetro del vehículo avanzó'
);

select isnt(
  (select transaction_id from public.vehicle_logs limit 1),
  null,
  'el registro quedó vinculado a su gasto'
);

select lives_ok(
  $$select public.delete_vehicle_log((select id from public.vehicle_logs limit 1))$$,
  'borrar el registro funciona'
);

select is(tests.saldo('ars2'), 15001::numeric, 'y devuelve la plata a la cuenta');

-- Ahora el caso que costó el bug #1: borrar el vehículo entero
select lives_ok(
  $$select public.create_vehicle_log('moto', 'service', now(), 1600, 8000, 'ars2')$$,
  'otro gasto para el vehículo'
);

select lives_ok(
  $$select public.delete_vehicle('moto')$$,
  'borrar el vehículo funciona'
);

select is(
  tests.saldo('ars2'),
  15001::numeric,
  'borrar el vehículo devuelve el saldo de sus gastos (bug #1 del audit)'
);

select is(
  (select count(*)::int from public.vehicle_logs),
  0,
  'los registros del vehículo se fueron con él'
);

select is(
  (select count(*)::int from public.transactions where vehicle_id = 'moto'),
  0,
  'y sus gastos también'
);

select * from finish();
rollback;
