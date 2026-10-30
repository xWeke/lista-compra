// Avisos al móvil (Web Push) en ESTE dispositivo. El navegador da una "suscripción" (URL de su servicio de
// avisos + claves) que se guarda en Supabase; la Edge Function send-push la usa para mandar los avisos.
// En el iPhone solo funciona con la app abierta desde la pantalla de inicio (iOS 16.4+), no en Safari.
import { supabase } from '@/lib/supabase';

/** Clave pública VAPID (pareja de VAPID_PRIVATE_KEY, que vive solo en Supabase Secrets). Es pública por diseño:
 *  identifica a esta app ante el servicio de avisos; con ella nadie puede enviar avisos. */
const VAPID_PUBLIC_KEY = 'BBFqnMd7ViOSHspQe-3DOSXv7BbwhJjGMmXTDBAeu_WkZPHW8MRNnDo1dPArma4aHKtMG4qwnZBqfZbP9eelHaA';

/** unsupported = este navegador no puede; install = iPhone sin instalar la app; denied = bloqueados en Ajustes */
export type PushStatus = 'unsupported' | 'install' | 'denied' | 'off' | 'on';

const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches;

async function registration() {
  // En `npm run dev` no hay service worker (solo en la build): ready no acabaría nunca
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) throw new Error('Los avisos solo funcionan en la app publicada, no en el modo de desarrollo.');
  return navigator.serviceWorker.ready;
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return isIos() && !isStandalone() ? 'install' : 'unsupported';
  }
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

/** Pide permiso (tiene que llamarse al tocar un botón: si no, el navegador lo rechaza) y guarda la suscripción. */
export async function enablePush(): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Sin permiso no se pueden mandar avisos a este dispositivo.');
  const reg = await registration();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC_KEY }));
  const json = sub.toJSON();
  const { error } = await supabase.rpc('save_push_subscription', {
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? '',
    auth: json.keys?.auth ?? '',
  });
  if (error) throw error;
}

/** Deja de recibir avisos en este dispositivo (también al cerrar sesión, para que no le lleguen al siguiente). */
export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker?.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  const { error } = await supabase.rpc('delete_push_subscription', { endpoint: sub.endpoint });
  await sub.unsubscribe();
  if (error) throw error;
}
