-- Synthetic fixtures only; all changes are rolled back, including on failure.
begin;
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at) values
 ('82e3c08d-6c22-4ff9-bb78-12426801b951','00000000-0000-0000-0000-000000000000','authenticated','authenticated','vehicle-audit-a@example.invalid','',now(),now(),now()),
 ('82e3c08d-6c22-4ff9-bb78-12426801b952','00000000-0000-0000-0000-000000000000','authenticated','authenticated','vehicle-audit-b@example.invalid','',now(),now(),now());
insert into public.accounts(id,user_id,name,currency,kind,initial_balance) values
 ('vehicle-audit-account','82e3c08d-6c22-4ff9-bb78-12426801b951','Audit','ARS','cash',1000);
insert into public.vehicles(id,user_id,name,type,odometer) values
 ('vehicle-audit-moto','82e3c08d-6c22-4ff9-bb78-12426801b951','Audit','motorcycle',1000);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"82e3c08d-6c22-4ff9-bb78-12426801b951","role":"authenticated"}',true);
do $$
declare original public.vehicle_logs; edited public.vehicle_logs; denied boolean := false;
begin
 original := public.create_vehicle_log('vehicle-audit-moto','service',now(),1000,100,'vehicle-audit-account',null,'{"next_service_odometer":2000}');
 edited := public.update_vehicle_log(original.id,'vehicle-audit-moto','service',now(),1100,200,'vehicle-audit-account',null,'{"next_service_odometer":3000}');
 assert edited.id = original.id, 'The event id must remain stable';
 assert edited.amount = 200 and edited.next_service_odometer = 3000, 'Edited fields must persist';
 assert (select balance from public.account_balances where id='vehicle-audit-account') = 800, 'Only the replacement expense must affect the balance';
 assert (select count(*) from public.transactions where vehicle_id='vehicle-audit-moto') = 1, 'No duplicate linked expense';
 begin
   perform public.update_vehicle_log(original.id,'vehicle-audit-moto','service',now(),1200,999999,'vehicle-audit-account');
 exception when check_violation then denied := true;
 end;
 assert denied, 'An overdraft must fail';
 assert (select amount from public.vehicle_logs where id=original.id) = 200, 'Failed edit must retain the original event';
 assert (select balance from public.account_balances where id='vehicle-audit-account') = 800, 'Failed edit must retain the balance';
 assert (select odometer from public.vehicles where id='vehicle-audit-moto') = 1100, 'Failed edit must retain the vehicle odometer';
 perform set_config('request.jwt.claims','{"sub":"82e3c08d-6c22-4ff9-bb78-12426801b952","role":"authenticated"}',true);
 denied := false;
 begin
   perform public.update_vehicle_log(original.id,'vehicle-audit-moto','service',now(),1200,0);
 exception when no_data_found then denied := true;
 end;
 assert denied, 'Another user must not edit the event';
 perform set_config('request.jwt.claims','{}',true);
 denied := false;
 begin
   perform public.update_vehicle_log(original.id,'vehicle-audit-moto','service',now(),1200,0);
 exception when insufficient_privilege then denied := true;
 end;
 assert denied, 'An absent uid must be rejected';
end $$;
reset role;
select 'vehicle-log update: stable id, balance, rollback, RLS and missing auth OK' as verification;
rollback;
