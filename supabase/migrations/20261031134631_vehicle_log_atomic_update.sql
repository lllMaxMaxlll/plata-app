-- One RPC transaction: a failed replacement restores both the original event
-- and its associated expense. Keep the event id stable for callers/realtime.
create or replace function public.update_vehicle_log(
  p_id text,
  p_vehicle_id text,
  p_type public.vehicle_log_type,
  p_occurred_at timestamptz,
  p_odometer integer,
  p_amount numeric,
  p_account_id text default null,
  p_note text default null,
  p_extra jsonb default '{}'::jsonb
)
returns public.vehicle_logs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  original public.vehicle_logs;
  replacement public.vehicle_logs;
begin
  if (select auth.uid()) is null then
    raise exception 'Se requiere una sesión válida' using errcode = '42501';
  end if;
  select * into original from public.vehicle_logs
    where id = p_id and user_id = (select auth.uid()) for update;
  if not found then
    raise exception 'El registro no existe' using errcode = 'P0002';
  end if;
  if p_vehicle_id is distinct from original.vehicle_id then
    raise exception 'No se puede mover el registro a otro vehículo' using errcode = '23514';
  end if;
  perform public.lock_accounts(array[original.account_id, p_account_id]);
  perform public.delete_vehicle_log(p_id);
  replacement := public.create_vehicle_log(p_vehicle_id, p_type, p_occurred_at,
    p_odometer, p_amount, p_account_id, p_note, p_extra);
  update public.vehicle_logs set id = p_id where id = replacement.id returning * into replacement;
  return replacement;
end;
$$;

revoke all on function public.update_vehicle_log(text,text,public.vehicle_log_type,timestamptz,integer,numeric,text,text,jsonb) from public, anon;
grant execute on function public.update_vehicle_log(text,text,public.vehicle_log_type,timestamptz,integer,numeric,text,text,jsonb) to authenticated;
