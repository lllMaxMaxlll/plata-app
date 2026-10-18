-- La cuenta con la que arranca cada carga. Sin esto el formulario elegía la
-- primera con saldo, y el usuario la cambiaba a mano en cada movimiento.
--
-- Una por moneda porque la moneda la pone la cuenta: Anotar elige la de USD
-- cuando el texto dice "usd" o "dólares", y el cambio de moneda usa las dos.
--
-- `on delete set null`: borrar la cuenta vuelve al comportamiento de siempre
-- en vez de dejar un id que no apunta a nada.

alter table public.user_settings
  add column default_account_ars text references public.accounts (id) on delete set null,
  add column default_account_usd text references public.accounts (id) on delete set null;
