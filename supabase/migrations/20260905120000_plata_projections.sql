-- PLATA — persistencia del planificador de proyecciones.
--
-- Hasta acá la página de Proyecciones no guardaba nada: las metas, el ahorro
-- mensual y los parámetros de la simulación vivían en useState y se perdían al
-- recargar, con dos metas de demo hardcodeadas en el componente. Lo único que
-- persistía eran los supuestos macro, en user_settings.
--
-- Decisiones:
--   1. Los ids siguen el patrón del esquema inicial: text con
--      gen_random_uuid()::text, no uuid, para no partir en dos la convención.
--   2. `priority` NO lleva índice único. Reordenar metas intercambia dos filas
--      y un unique (user_id, priority) no diferible haría fallar el UPDATE del
--      medio. El orden se resuelve con (priority, created_at) y la app se
--      encarga de mantener las prioridades densas.
--   3. Los parámetros de la simulación son uno por usuario, así que van como
--      columnas de user_settings y no en una tabla aparte.

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

create type public.goal_kind as enum ('reserve', 'purchase');

-- ---------------------------------------------------------------------------
-- Metas secuenciales del planificador
-- ---------------------------------------------------------------------------

create table public.goals (
  id          text primary key default gen_random_uuid()::text,
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  amount      numeric(18, 2) not null,
  currency    public.currency not null,
  kind        public.goal_kind not null,
  priority    integer not null,
  achieved_at date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz,
  constraint goals_name_not_blank check (length(btrim(name)) between 1 and 120),
  constraint goals_amount_positive check (amount > 0),
  constraint goals_priority_positive check (priority > 0)
);

-- Cubre a la vez el predicado de la RLS (user_id) y el orden con el que la app
-- lee siempre la tabla.
create index goals_user_priority_idx on public.goals (user_id, priority, created_at);

-- ---------------------------------------------------------------------------
-- Parámetros del simulador
-- ---------------------------------------------------------------------------

alter table public.user_settings
  add column projection_horizon_months integer not null default 36,
  add column projection_display_currency public.currency not null default 'USD',
  add column projection_real_terms boolean not null default true,
  add column projection_use_real_accounts boolean not null default true,
  add column monthly_savings_ars numeric(18, 2) not null default 0,
  add column monthly_savings_usd numeric(18, 2) not null default 0,
  add column manual_initial_ars numeric(18, 2),
  add column manual_initial_usd numeric(18, 2),
  -- El motor aplicaba un único rendimiento a los pesos y a los dólares. Un
  -- plazo fijo en pesos y un ETF en dólares no rinden ni parecido.
  add column annual_return_ars numeric(6, 2) not null default 45,
  add column annual_return_usd numeric(6, 2) not null default 8;

-- El rendimiento único que existía se usaba como tasa en dólares (default 12%).
-- Lo conservamos ahí para no cambiarle los supuestos por debajo a quien ya los
-- había ajustado; annual_return_ars arranca en su default.
update public.user_settings set annual_return_usd = annual_return;

alter table public.user_settings
  add constraint user_settings_horizon_valid
    check (projection_horizon_months in (12, 24, 36, 60)),
  add constraint user_settings_savings_not_negative
    check (monthly_savings_ars >= 0 and monthly_savings_usd >= 0),
  add constraint user_settings_manual_initial_not_negative
    check (
      (manual_initial_ars is null or manual_initial_ars >= 0)
      and (manual_initial_usd is null or manual_initial_usd >= 0)
    ),
  add constraint user_settings_returns_sane
    check (
      annual_return_ars between -100 and 10000
      and annual_return_usd between -100 and 10000
    );

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.goals enable row level security;

create policy "own goals" on public.goals
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Permisos de la Data API
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.goals to authenticated;
