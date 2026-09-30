'use client';

/**
 * Browser side of push notifications: register the service worker, ask permission,
 * subscribe, and keep the server copy in sync.
 */

export type PushState =
  | 'loading'
  | 'unconfigured' // no VAPID public key in this build
  | 'unsupported' // browser can't do web push
  | 'ios-install' // iPhone/iPad Safari: must add to Home Screen first
  | 'denied' // blocked in browser settings
  | 'default' // never asked
  | 'off' // allowed, but this browser has no subscription (turned off, or signed out)
  | 'on';

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function supported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

let regPromise: Promise<ServiceWorkerRegistration> | null = null;
function registration(): Promise<ServiceWorkerRegistration> {
  regPromise ??= navigator.serviceWorker
    .register('/sw.js', { scope: '/', updateViaCache: 'none' })
    .then(() => navigator.serviceWorker.ready);
  return regPromise;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  try {
    return await (await registration()).pushManager.getSubscription();
  } catch {
    return null;
  }
}

export async function getPushState(): Promise<PushState> {
  if (typeof window === 'undefined') return 'loading';
  if (!VAPID) return 'unconfigured';
  if (!supported()) return isIOS() && !isStandalone() ? 'ios-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'default') return 'default';
  return (await currentSubscription()) ? 'on' : 'off';
}

async function saveOnServer(sub: PushSubscription, lang: 'en' | 'ko'): Promise<boolean> {
  const r = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON(), lang }),
  });
  return r.ok;
}

/** Ask permission (must run from a tap) and subscribe. Returns the new state. */
export async function enablePush(lang: 'en' | 'ko'): Promise<PushState> {
  if (!VAPID || !supported()) return getPushState();
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'default';
  const reg = await registration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID) });
  if (!(await saveOnServer(sub, lang))) throw new Error('save_failed');
  return 'on';
}

/** Stop push on this browser (the permission itself stays; only the browser can reset that). */
export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await fetch('/api/push/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

/** Before signing out: stop this browser getting the old account's notifications. Never hangs sign-out. */
export async function disablePushForSignOut(): Promise<void> {
  if (typeof window === 'undefined' || !supported()) return;
  await Promise.race([disablePush().catch(() => {}), new Promise((r) => setTimeout(r, 2500))]);
}

let lastSync = '';
/** On app load: if this browser is subscribed, refresh the server copy (owner + language). */
export async function syncPush(lang: 'en' | 'ko'): Promise<void> {
  if (!VAPID || !supported() || Notification.permission !== 'granted') return;
  const sub = await currentSubscription();
  if (!sub || lastSync === `${sub.endpoint}|${lang}`) return;
  lastSync = `${sub.endpoint}|${lang}`;
  await saveOnServer(sub, lang).catch(() => {
    lastSync = '';
  });
}

export async function sendTestPush(): Promise<boolean> {
  const r = await fetch('/api/push/test', { method: 'POST' }).catch(() => null);
  return !!r?.ok;
}
