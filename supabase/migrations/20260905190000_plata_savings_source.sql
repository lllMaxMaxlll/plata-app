-- El ahorro mensual quedaba en 0 hasta que el usuario lo escribiera a mano, y
-- un 0 hace que ninguna meta se alcance nunca: la página decía "no se alcanza
-- en 36 meses" para metas que con sus movimientos reales llegaban en 4.
--
-- Con esta columna el ahorro se calcula solo desde el historial de movimientos
-- mientras el usuario no lo fije. En cuanto edita el campo pasa a 'manual' y la
-- app deja de tocarlo.

alter table public.user_settings
  add column monthly_savings_source text not null default 'auto';

alter table public.user_settings
  add constraint user_settings_savings_source_valid
    check (monthly_savings_source in ('auto', 'manual'));
