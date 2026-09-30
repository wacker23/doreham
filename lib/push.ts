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

/** The language chosen in the app right now (it can change while a permission dialog is open). */
function currentLang(fallback: 'en' | 'ko'): 'en' | 'ko' {
  try {
    const v = localStorage.getItem('doreham_lang');
    if (v === 'en' || v === 'ko') return v;
  } catch {
    /* private mode */
  }
  return fallback;
}

async function saveOnServer(sub: PushSubscription, fallbackLang: 'en' | 'ko'): Promise<boolean> {
  const lang = currentLang(fallbackLang);
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
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
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
export async function syncPush(fallbackLang: 'en' | 'ko'): Promise<void> {
  if (!VAPID || !supported() || Notification.permission !== 'granted') return;
  const lang = currentLang(fallbackLang);
  const sub = await currentSubscription();
  if (!sub || lastSync === `${sub.endpoint}|${lang}`) return;
  lastSync = `${sub.endpoint}|${lang}`;
  await saveOnServer(sub, lang).catch(() => {
    lastSync = '';
  });
}

// ---- Asking once, like an app ------------------------------------------------------

const ASKED_KEY = 'doreham_push_asked'; // the permission question was answered or dismissed on this device
const OFF_KEY = 'doreham_push_off'; // the person turned notifications off in their profile

function getFlag(k: string): boolean {
  try {
    return localStorage.getItem(k) === '1';
  } catch {
    return false;
  }
}
function setFlag(k: string, on: boolean) {
  try {
    if (on) localStorage.setItem(k, '1');
    else localStorage.removeItem(k);
  } catch {
    /* private mode */
  }
}

let armed = false;
/** Safari and Firefox only show the permission dialog after a tap: ask on the first tap that isn't a link. */
function askOnFirstTap(lang: 'en' | 'ko') {
  if (armed) return;
  armed = true;
  const onTap = (e: Event) => {
    const target = e.target as Element | null;
    if (target?.closest?.('a[href]')) return; // a link would navigate away and cancel the dialog
    document.removeEventListener('click', onTap, true);
    armed = false;
    setFlag(ASKED_KEY, true);
    enablePush(lang).catch(() => {});
  };
  document.addEventListener('click', onTap, true);
}

/**
 * Run once per app page load, for a signed-in user:
 * - notifications on: refresh the server copy;
 * - allowed before (e.g. after signing out and in again) and not turned off: subscribe quietly;
 * - never asked on this device: show the browser's permission dialog (only once, ever).
 */
let autoRun: Promise<PushState> | null = null;
export function autoPush(lang: 'en' | 'ko'): Promise<PushState> {
  // One run at a time (the header can mount twice while a dialog is open).
  autoRun ??= runAutoPush(lang).finally(() => {
    autoRun = null;
  });
  return autoRun;
}

async function runAutoPush(lang: 'en' | 'ko'): Promise<PushState> {
  const state = await getPushState();
  if (state === 'on') {
    await syncPush(lang);
    return state;
  }
  if (state === 'off' && !getFlag(OFF_KEY)) return enablePush(lang).catch(() => state);
  if (state !== 'default' || getFlag(ASKED_KEY)) return state;

  const started = Date.now();
  const result = await enablePush(lang).catch(() => 'default' as PushState);
  // Answered, or the dialog was on screen long enough for a person to close it: don't ask again.
  if (result !== 'default' || Date.now() - started > 800) setFlag(ASKED_KEY, true);
  // Resolved instantly with no answer: this browser needs a tap first.
  else askOnFirstTap(lang);
  return result;
}

/** Profile switch. */
export async function turnPushOn(lang: 'en' | 'ko'): Promise<PushState> {
  setFlag(OFF_KEY, false);
  setFlag(ASKED_KEY, true);
  return enablePush(lang);
}
export async function turnPushOff(): Promise<void> {
  setFlag(OFF_KEY, true);
  await disablePush();
}

export function iosHintSeen(): boolean {
  return getFlag('doreham_push_ios_hint');
}
export function markIosHintSeen() {
  setFlag('doreham_push_ios_hint', true);
}
