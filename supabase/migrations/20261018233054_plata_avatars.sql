-- Fotos de perfil. El cliente las recorta y comprime antes de subirlas (un
-- cuadrado de 256 px en WebP o JPEG pesa unos pocos KB), así que el límite de
-- 512 KB sólo frena a quien llame a la API a mano.
--
-- El bucket es público para leer: la foto se muestra con una URL fija, sin
-- firmar una por carga. Escribir sí está restringido: cada usuario sólo toca
-- su carpeta, `<uid>/`. Reemplazar la foto es un upsert, que necesita
-- INSERT, SELECT y UPDATE.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 524288, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

create policy "avatars: subir a la carpeta propia"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars: ver la carpeta propia"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars: reemplazar en la carpeta propia"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars: borrar de la carpeta propia"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
