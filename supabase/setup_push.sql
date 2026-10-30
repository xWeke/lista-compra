-- Programa el envío de avisos al móvil (Edge Function send-push). Se ejecuta UNA vez en el SQL Editor,
-- después de la migración 20261030000000_push_notifications.sql y de setup_catalog_sync.sql (que crea el
-- secreto catalog_sync_secret en Vault). No es una migración porque lleva la URL de este proyecto.
--
-- Cada 30 s: si hay avisos listos en la cola (push_events_ready), llama a la función; si no, no hace nada
-- (no gasta invocaciones de Edge Functions).
select cron.schedule(
  'send-push',
  '30 seconds',
  $$
  select net.http_post(
    url := 'https://wnpzgrnffjbmcpwxasgh.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'catalog_sync_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  )
  where public.push_events_ready();
  $$
);

-- Para ver si va: últimas respuestas de la función
--   select created, status_code, content from net._http_response order by created desc limit 5;
-- Pendientes en la cola:
--   select kind, item_name, created_at from public.push_events where sent_at is null;
