// Edge Function "send-push": envía los avisos al móvil (Web Push) que están en la cola public.push_events.
// La lanza pg_cron cada 30 s solo si hay algo listo (supabase/setup_push.sql); claim_push_batches() agrupa
// los eventos, los marca como enviados y dice a quién mandar cada aviso.
//
// Web Push: cada navegador da una URL de su servicio de avisos (Apple, Google, Mozilla) y unas claves; el
// aviso va cifrado con ellas y firmado con nuestras claves VAPID (así el servicio sabe que es de esta app).
// Secrets en Supabase (Edge Functions → Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY. La pública también
// está en la app (src/features/push/api.ts): es pública por diseño.
//
// Seguridad: igual que los volcados de catálogo, solo con la cabecera x-sync-secret correcta (Vault).
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const APP_URL = 'https://xweke.github.io/lista-compra/';
const NAMES_SHOWN = 3; // "leche, pan, huevos y 4 más"

type Batch = {
  kind: 'added' | 'shopping';
  list_id: string;
  list_name: string;
  actor_name: string;
  item_names: string[] | null;
  recipients: string[];
};

function message(b: Batch) {
  if (b.kind === 'shopping') {
    return { title: `${b.actor_name} está haciendo la compra`, body: `${b.list_name} · si falta algo, añádelo ya` };
  }
  const names = b.item_names ?? [];
  const shown = names.slice(0, NAMES_SHOWN);
  const rest = names.length - shown.length;
  const what =
    rest > 0
      ? `${shown.join(', ')} y ${rest} más`
      : shown.length > 1
        ? `${shown.slice(0, -1).join(', ')} y ${shown.at(-1)}`
        : shown[0];
  return { title: `${b.actor_name} ha añadido ${what}`, body: b.list_name };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Método no permitido', { status: 405 });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const { data: authorized, error: authError } = await admin.rpc('check_sync_secret', {
    secret: req.headers.get('x-sync-secret') ?? '',
  });
  if (authError) {
    console.error('check_sync_secret falló', authError.message);
    return Response.json({ ok: false, error: `Comprobando el secreto: ${authError.message}` }, { status: 500 });
  }
  if (authorized !== true) return new Response('No autorizado', { status: 401 });

  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!publicKey || !privateKey) {
    return Response.json(
      { ok: false, error: 'Faltan los secrets VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY' },
      { status: 500 },
    );
  }
  // El "subject" es un contacto para el servicio de avisos: la URL de la app (así no hace falta un email)
  webpush.setVapidDetails(APP_URL, publicKey, privateKey);

  const { data: batches, error } = await admin.rpc('claim_push_batches');
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  if (!batches?.length) return Response.json({ ok: true, sent: 0 });

  const userIds = [...new Set((batches as Batch[]).flatMap((b) => b.recipients))];
  const { data: subs, error: subsError } = await admin
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', userIds);
  if (subsError) return Response.json({ ok: false, error: subsError.message }, { status: 500 });

  let sent = 0;
  const gone: string[] = [];
  const failed: string[] = [];
  for (const b of batches as Batch[]) {
    const { title, body } = message(b);
    // tag = la lista: un aviso nuevo de la misma lista sustituye al anterior en vez de apilarse
    const payload = JSON.stringify({ title, body, tag: `list-${b.list_id}`, url: `${APP_URL}#/listas/${b.list_id}` });
    for (const s of subs.filter((s) => b.recipients.includes(s.user_id))) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
          TTL: 6 * 3600, // si el móvil está apagado, el aviso se descarta pasadas 6 h
          urgency: 'high',
        });
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // 404/410 = el navegador ya no quiere avisos (desinstaló la app, quitó el permiso…): se borra
        if (status === 404 || status === 410) gone.push(s.id);
        else failed.push(`${status ?? '?'} ${(e as Error).message}`);
      }
    }
  }
  if (gone.length) await admin.from('push_subscriptions').delete().in('id', gone);
  if (failed.length) console.error('Avisos fallidos', failed);

  return Response.json({ ok: true, batches: batches.length, sent, removed: gone.length, failed });
});
