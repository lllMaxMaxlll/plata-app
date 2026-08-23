-- Realtime: la app se entera de los cambios sin recargar.
--
-- Las RLS siguen aplicando sobre el stream, así que cada usuario sólo recibe
-- eventos de sus propias filas.
--
-- account_balances y stock_positions son vistas y Postgres no publica vistas:
-- el cliente escucha las tablas que las alimentan (transactions, accounts,
-- stock_trades) y vuelve a leer las vistas cuando algo cambia.

alter publication supabase_realtime add table public.accounts;
alter publication supabase_realtime add table public.transactions;
alter publication supabase_realtime add table public.categories;
alter publication supabase_realtime add table public.vehicles;
alter publication supabase_realtime add table public.vehicle_logs;
alter publication supabase_realtime add table public.due_items;
alter publication supabase_realtime add table public.stock_trades;
alter publication supabase_realtime add table public.watchlist;
alter publication supabase_realtime add table public.user_settings;
