-- Programa el volcado nocturno de catálogos (Edge Function sync-mercadona). Se ejecuta UNA vez en el
-- SQL Editor, después de la migración 20261028120000_store_catalogs.sql. No es una migración porque
-- lleva la URL de este proyecto Supabase concreto.
--
-- Cómo funciona: pg_cron (el "cron" de Postgres) lanza cada noche una petición HTTP (pg_net) a la
-- Edge Function con un secreto. El secreto se genera aquí al azar y vive solo en Vault (cifrado en la BD):
-- no hay que copiarlo a ningún sitio y nadie lo ve.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 1. Secreto aleatorio en Vault (si ya existe, no se toca)
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'catalog_sync_secret',
                           'Secreto entre pg_cron y la Edge Function sync-mercadona')
 where not exists (select 1 from vault.secrets where name = 'catalog_sync_secret');

-- 2. Tarea diaria a las 05:15 (hora UTC; 06:15 / 07:15 en España)
select cron.schedule(
  'sync-mercadona',
  '15 5 * * *',
  $$
  select net.http_post(
    url := 'https://wnpzgrnffjbmcpwxasgh.supabase.co/functions/v1/sync-mercadona',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'catalog_sync_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 140000
  );
  $$
);

-- 3. Primer volcado ahora mismo (el mismo comando que lanzará la tarea cada noche).
--    Tarda ~30-60 s en segundo plano. Para ver el resultado, pasado un minuto:
--      select status_code, content from net._http_response order by created desc limit 1;
select net.http_post(
  url := 'https://wnpzgrnffjbmcpwxasgh.supabase.co/functions/v1/sync-mercadona',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'catalog_sync_secret')
  ),
  body := '{}'::jsonb,
  timeout_milliseconds := 140000
);

-- -----------------------------------------------------------------------------
-- Ahorramas (después de la migración 20261028150000_ahorramas_catalog.sql)
-- Cada 10 min de 04:00 a 06:50 UTC (05:00-07:50 / 06:00-08:50 en España). Cada ejecución descarga
-- ~45-90 s de categorías pendientes; si todo está al día, no hace nada.
-- -----------------------------------------------------------------------------
select cron.schedule(
  'sync-ahorramas',
  '*/10 4-6 * * *',
  $$
  select net.http_post(
    url := 'https://wnpzgrnffjbmcpwxasgh.supabase.co/functions/v1/sync-ahorramas',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'catalog_sync_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);
