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
  if (typeof window === 'undefined') return;
  forgetPushAsks();
  if (!supported()) return;
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

// ---- Ask until allowed ---------------------------------------------------------------
// Every time someone opens the app (a new browser session) or signs in, and notifications
// aren't allowed yet, the browser's permission dialog is shown again.

// Flags from the earlier "ask once" version: forget them so everyone is asked again.
function clearOldFlags() {
  try {
    for (const k of ['doreham_push_asked', 'doreham_push_off', 'doreham_push_ios_hint', 'doreham_push_prompt_dismissed_at']) {
      localStorage.removeItem(k);
    }
  } catch {
    /* private mode */
  }
}

function sessionFlag(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}
function setSessionFlag(key: string, on: boolean) {
  try {
    if (on) sessionStorage.setItem(key, '1');
    else sessionStorage.removeItem(key);
  } catch {
    /* private mode */
  }
}

const askedKey = (userId: string) => `doreham_push_asked_${userId}`;
const BANNER_KEY = 'doreham_push_banner_closed';

let armedTap: ((e: Event) => void) | null = null;
function disarmTap() {
  if (armedTap) document.removeEventListener('click', armedTap, true);
  armedTap = null;
}
/** Safari and Firefox only show the permission dialog after a tap: ask on the next tap that isn't a link. */
function askOnFirstTap(lang: 'en' | 'ko') {
  if (armedTap) return;
  armedTap = (e: Event) => {
    const target = e.target as Element | null;
    if (target?.closest?.('a[href]')) return; // a link would navigate away and cancel the dialog
    if (target?.closest?.('.pp-on')) return; // the reminder's own button asks by itself
    disarmTap();
    enablePush(lang).catch(() => {});
  };
  document.addEventListener('click', armedTap, true);
}

/**
 * Run on every app page for a signed-in user:
 * - notifications on: refresh the server copy (owner + language);
 * - allowed already (e.g. after signing out and in again): subscribe quietly;
 * - not allowed yet: show the browser's permission dialog, once per visit / sign-in.
 * Returns the state afterwards, so the page can show a hint when it's still not on.
 */
let autoRun: Promise<PushState> | null = null;
export function autoPush(lang: 'en' | 'ko', userId: string): Promise<PushState> {
  // One run at a time (the header can mount twice while a dialog is open).
  autoRun ??= runAutoPush(lang, userId).finally(() => {
    autoRun = null;
  });
  return autoRun;
}

async function runAutoPush(lang: 'en' | 'ko', userId: string): Promise<PushState> {
  clearOldFlags();
  const state = await getPushState();
  if (state === 'on') {
    await syncPush(lang);
    return state;
  }
  if (state === 'off') return enablePush(lang).catch(() => state);
  if (state !== 'default') return state;
  if (sessionFlag(askedKey(userId))) return state;

  setSessionFlag(askedKey(userId), true);
  const started = Date.now();
  const result = await enablePush(lang).catch(() => 'default' as PushState);
  // Resolved at once with no answer: this browser shows the dialog only after a tap.
  if (result === 'default' && Date.now() - started < 800) askOnFirstTap(lang);
  return result;
}

/** From the reminder banner's button (a tap, so every browser can show the dialog). */
export function askNow(lang: 'en' | 'ko'): Promise<PushState> {
  disarmTap();
  return enablePush(lang).catch(() => 'default' as PushState);
}

/** Signing out: the next account on this browser is asked again. */
export function forgetPushAsks() {
  try {
    for (const k of Object.keys(sessionStorage)) if (k.startsWith('doreham_push_')) sessionStorage.removeItem(k);
  } catch {
    /* private mode */
  }
}

export function bannerClosedThisVisit(): boolean {
  return sessionFlag(BANNER_KEY);
}
export function closeBannerThisVisit() {
  setSessionFlag(BANNER_KEY, true);
}
