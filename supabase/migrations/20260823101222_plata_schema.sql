-- PLATA — esquema inicial, migrado desde Firestore.
--
-- Decisiones de diseño (ver el plan de migración):
--   1. Los ids son `text` y conservan los ids originales de Firestore, para no
--      tener que reescribir las referencias entre documentos al importar.
--      Los nuevos se generan solos con gen_random_uuid()::text.
--   2. El saldo de una cuenta NO se guarda: se deriva de sus movimientos en la
--      vista account_balances. Lo mismo con las posiciones de acciones.
--   3. La plata se guarda en numeric, nunca en float.
--   4. Borrar una cuenta conserva sus movimientos (on delete set null), que es
--      el comportamiento que la app ya tenía y por el que las transacciones
--      guardan su propia moneda.

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

create type public.currency         as enum ('ARS', 'USD');
create type public.transaction_type as enum ('income', 'expense', 'transfer');
create type public.account_kind     as enum ('bank', 'wallet', 'cash', 'crypto', 'savings');
create type public.category_type    as enum ('income', 'expense');
create type public.vehicle_type     as enum ('motorcycle', 'car', 'truck', 'other');
create type public.vehicle_log_type as enum ('fuel', 'service', 'part', 'gear', 'insurance', 'other');
create type public.due_frequency    as enum ('monthly', 'yearly', 'biweekly', 'one_time');
create type public.due_status       as enum ('pending', 'paid');
create type public.trade_side       as enum ('buy', 'sell');

-- ---------------------------------------------------------------------------
-- Cuentas
-- ---------------------------------------------------------------------------

create table public.accounts (
  id              text primary key default gen_random_uuid()::text,
  user_id         uuid not null references auth.users (id) on delete cascade,
  name            text not null,
  currency        public.currency not null,
  kind            public.account_kind not null,
  -- saldo de arranque; el saldo actual sale de account_balances
  initial_balance numeric(14, 2) not null default 0,
  created_at      timestamptz not null default now(),
  constraint accounts_name_not_blank check (length(btrim(name)) between 1 and 120)
);

create index accounts_user_id_idx on public.accounts (user_id);

-- ---------------------------------------------------------------------------
-- Vehículos (antes que transactions por la FK vehicle_id)
-- ---------------------------------------------------------------------------

create table public.vehicles (
  id            text primary key default gen_random_uuid()::text,
  user_id       uuid not null references auth.users (id) on delete cascade,
  name          text not null,
  type          public.vehicle_type not null,
  brand         text,
  model         text,
  year          smallint,
  plate         text,
  odometer      integer not null default 0,
  fuel_capacity numeric(8, 2),
  created_at    timestamptz not null default now(),
  constraint vehicles_name_not_blank check (length(btrim(name)) between 1 and 120),
  constraint vehicles_odometer_positive check (odometer >= 0),
  constraint vehicles_year_sane check (year is null or year between 1900 and 2200)
);

create index vehicles_user_id_idx on public.vehicles (user_id);

-- ---------------------------------------------------------------------------
-- Movimientos
-- ---------------------------------------------------------------------------

create table public.transactions (
  id            text primary key default gen_random_uuid()::text,
  user_id       uuid not null references auth.users (id) on delete cascade,
  type          public.transaction_type not null,
  amount        numeric(14, 2) not null,
  -- la cuenta puede desaparecer; el movimiento y su moneda sobreviven
  account_id    text references public.accounts (id) on delete set null,
  currency      public.currency not null,
  to_account_id text references public.accounts (id) on delete set null,
  to_amount     numeric(14, 2),
  exchange_rate numeric(14, 4),
  category      text not null,
  note          text,
  occurred_at   timestamptz not null,
  receipt_name  text,
  vehicle_id    text references public.vehicles (id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint transactions_amount_positive check (amount > 0),
  constraint transactions_to_amount_positive check (to_amount is null or to_amount > 0),
  constraint transactions_rate_positive check (exchange_rate is null or exchange_rate > 0),
  constraint transactions_transfer_needs_destination
    check (type <> 'transfer' or to_account_id is not null),
  constraint transactions_transfer_distinct_accounts
    check (to_account_id is null or to_account_id <> account_id)
);

create index transactions_user_occurred_idx on public.transactions (user_id, occurred_at desc);
create index transactions_account_id_idx on public.transactions (account_id);
create index transactions_to_account_id_idx on public.transactions (to_account_id);
create index transactions_vehicle_id_idx on public.transactions (vehicle_id);

-- ---------------------------------------------------------------------------
-- Categorías
-- ---------------------------------------------------------------------------

create table public.categories (
  id      text primary key default gen_random_uuid()::text,
  user_id uuid not null references auth.users (id) on delete cascade,
  name    text not null,
  type    public.category_type not null,
  color   text not null,
  constraint categories_name_not_blank check (length(btrim(name)) between 1 and 120)
);

create index categories_user_id_idx on public.categories (user_id);
create unique index categories_user_name_type_idx on public.categories (user_id, lower(name), type);

-- ---------------------------------------------------------------------------
-- Registros de vehículos
-- ---------------------------------------------------------------------------

create table public.vehicle_logs (
  id                    text primary key default gen_random_uuid()::text,
  user_id               uuid not null references auth.users (id) on delete cascade,
  vehicle_id            text not null references public.vehicles (id) on delete cascade,
  type                  public.vehicle_log_type not null,
  occurred_at           timestamptz not null,
  odometer              integer not null default 0,
  amount                numeric(14, 2) not null default 0,
  note                  text,
  account_id            text references public.accounts (id) on delete set null,
  -- si el gasto se borra, el registro queda pero deja de apuntar a la nada
  transaction_id        text references public.transactions (id) on delete set null,
  liters                numeric(8, 2),
  gas_station           text,
  price_per_liter       numeric(12, 2),
  is_full_tank          boolean,
  service_type          text,
  provider              text,
  next_service_odometer integer,
  next_service_date     date,
  item_name             text,
  constraint vehicle_logs_amount_positive check (amount >= 0),
  constraint vehicle_logs_odometer_positive check (odometer >= 0)
);

create index vehicle_logs_user_id_idx on public.vehicle_logs (user_id);
create index vehicle_logs_vehicle_id_idx on public.vehicle_logs (vehicle_id);
create index vehicle_logs_account_id_idx on public.vehicle_logs (account_id);
create index vehicle_logs_transaction_id_idx on public.vehicle_logs (transaction_id);

-- ---------------------------------------------------------------------------
-- Vencimientos
-- ---------------------------------------------------------------------------

create table public.due_items (
  id                  text primary key default gen_random_uuid()::text,
  user_id             uuid not null references auth.users (id) on delete cascade,
  title               text not null,
  category            text not null,
  amount              numeric(14, 2) not null,
  currency            public.currency not null,
  due_date            date not null,
  frequency           public.due_frequency not null,
  reminder_days_before smallint not null default 3,
  status              public.due_status not null default 'pending',
  auto_renew          boolean not null default false,
  account_id          text references public.accounts (id) on delete set null,
  paid_at             timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz,
  constraint due_items_title_not_blank check (length(btrim(title)) between 1 and 200),
  constraint due_items_amount_positive check (amount >= 0),
  constraint due_items_reminder_sane check (reminder_days_before between 0 and 60)
);

create index due_items_user_due_date_idx on public.due_items (user_id, due_date);
create index due_items_account_id_idx on public.due_items (account_id);

-- ---------------------------------------------------------------------------
-- Acciones
-- ---------------------------------------------------------------------------

create table public.stock_trades (
  id          text primary key default gen_random_uuid()::text,
  user_id     uuid not null references auth.users (id) on delete cascade,
  symbol      text not null,
  side        public.trade_side not null,
  shares      numeric(18, 8) not null,
  price       numeric(14, 4) not null,
  occurred_at timestamptz not null,
  account_id  text references public.accounts (id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint stock_trades_symbol_shape check (symbol ~ '^[A-Z0-9^.-]{1,15}$'),
  constraint stock_trades_shares_positive check (shares > 0),
  constraint stock_trades_price_positive check (price > 0)
);

create index stock_trades_user_occurred_idx on public.stock_trades (user_id, occurred_at desc);
create index stock_trades_account_id_idx on public.stock_trades (account_id);

create table public.watchlist (
  user_id  uuid not null references auth.users (id) on delete cascade,
  symbol   text not null,
  name     text not null,
  added_at timestamptz not null default now(),
  primary key (user_id, symbol),
  constraint watchlist_symbol_shape check (symbol ~ '^[A-Z0-9^.-]{1,15}$')
);

-- ---------------------------------------------------------------------------
-- Preferencias y push
-- ---------------------------------------------------------------------------

create table public.user_settings (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  exchange_rate      numeric(14, 4) not null default 1250,
  annual_inflation   numeric(6, 2) not null default 45,
  annual_devaluation numeric(6, 2) not null default 40,
  annual_return      numeric(6, 2) not null default 12,
  rates              jsonb,
  updated_at         timestamptz not null default now(),
  constraint user_settings_rate_positive check (exchange_rate > 0),
  constraint user_settings_percentages_sane check (
    annual_inflation between -100 and 10000
    and annual_devaluation between -100 and 10000
    and annual_return between -100 and 10000
  )
);

create table public.push_tokens (
  token      text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  user_agent text,
  updated_at timestamptz not null default now()
);

create index push_tokens_user_id_idx on public.push_tokens (user_id);

-- ---------------------------------------------------------------------------
-- Saldos y posiciones derivados
-- ---------------------------------------------------------------------------

-- security_invoker: sin esto la vista corre con los permisos de quien la creó y
-- se saltea las RLS de las tablas de abajo.
create view public.account_balances with (security_invoker = true) as
select
  a.id,
  a.user_id,
  a.name,
  a.currency,
  a.kind,
  a.initial_balance,
  a.initial_balance + coalesce(m.delta, 0) as balance
from public.accounts a
left join lateral (
  select
      coalesce(sum(
        case
          when t.account_id = a.id and t.type = 'income' then t.amount
          when t.account_id = a.id and t.type in ('expense', 'transfer') then -t.amount
          else 0
        end
      ), 0)
    + coalesce(sum(
        case
          when t.to_account_id = a.id and t.type = 'transfer'
          then coalesce(t.to_amount, t.amount)
          else 0
        end
      ), 0) as delta
  from public.transactions t
  where t.account_id = a.id or t.to_account_id = a.id
) m on true;

create view public.stock_positions with (security_invoker = true) as
select
  user_id,
  symbol,
  sum(case when side = 'buy' then shares else -shares end) as shares,
  -- costo promedio ponderado de las compras; alcanza para el P&L que muestra la app
  case
    when sum(case when side = 'buy' then shares else 0 end) > 0
    then sum(case when side = 'buy' then shares * price else 0 end)
         / sum(case when side = 'buy' then shares else 0 end)
    else 0
  end as avg_buy_price
from public.stock_trades
group by user_id, symbol
having sum(case when side = 'buy' then shares else -shares end) > 0;

-- ---------------------------------------------------------------------------
-- RLS
--
-- Patrón: `to authenticated` (rol) + predicado de propiedad (fila).
-- auth.uid() va envuelto en un select para que Postgres lo evalúe una sola vez
-- y no una vez por fila.
-- ---------------------------------------------------------------------------

alter table public.accounts      enable row level security;
alter table public.vehicles      enable row level security;
alter table public.transactions  enable row level security;
alter table public.categories    enable row level security;
alter table public.vehicle_logs  enable row level security;
alter table public.due_items     enable row level security;
alter table public.stock_trades  enable row level security;
alter table public.watchlist     enable row level security;
alter table public.user_settings enable row level security;
alter table public.push_tokens   enable row level security;

create policy "own accounts" on public.accounts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own vehicles" on public.vehicles
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own transactions" on public.transactions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own categories" on public.categories
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own vehicle logs" on public.vehicle_logs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own due items" on public.due_items
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own stock trades" on public.stock_trades
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own watchlist" on public.watchlist
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own settings" on public.user_settings
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own push tokens" on public.push_tokens
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Permisos de la Data API
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on
  public.accounts, public.vehicles, public.transactions, public.categories,
  public.vehicle_logs, public.due_items, public.stock_trades, public.watchlist,
  public.user_settings, public.push_tokens
to authenticated;

grant select on public.account_balances, public.stock_positions to authenticated;
