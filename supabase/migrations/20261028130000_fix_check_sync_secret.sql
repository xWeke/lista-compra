-- Corrige check_sync_secret: el parámetro se llama "secret" igual que una columna de vault.decrypted_secrets
-- (el secreto cifrado), y en SQL la columna gana: comparaba con el texto cifrado y nunca coincidía.
-- Ahora el parámetro se nombra con el prefijo de la función (check_sync_secret.secret).
create or replace function public.check_sync_secret(secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from vault.decrypted_secrets ds
     where ds.name = 'catalog_sync_secret'
       and ds.decrypted_secret = check_sync_secret.secret
  );
$$;

revoke execute on function public.check_sync_secret(text) from public, anon, authenticated;
grant execute on function public.check_sync_secret(text) to service_role;
