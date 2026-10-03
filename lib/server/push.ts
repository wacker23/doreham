import 'server-only';
import webpush from 'web-push';
import { getAdmin } from '@/lib/server/supabaseAdmin';

/**
 * Web push (browser / installed-app notifications).
 * Needs NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY (and optionally VAPID_SUBJECT).
 * Without them every function here is a no-op, so nothing breaks before the keys are set.
 */

export type PushMessage = {
  user_id: string;
  type: string;
  title_en: string;
  title_ko: string;
  body_en?: string | null;
  body_ko?: string | null;
  action_url?: string | null;
  /** Same tag = the new notification replaces the old one on the device (used per chat). */
  tag?: string | null;
  urgency?: 'normal' | 'high';
};

type SubRow = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string; lang: string; failure_count: number };

const MAX_FAILURES = 5; // transient errors in a row before we drop a subscription
const SEND_TIMEOUT_MS = 6000;

let configured: boolean | null = null;
export function pushConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (configured = false);
  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:support@doreham.co.kr', pub, priv);
    configured = true;
  } catch (e) {
    console.error('push: bad VAPID keys', e instanceof Error ? e.message : e);
    configured = false;
  }
  return configured;
}

/**
 * Push services we accept subscriptions for (the server POSTs to this URL, so never
 * accept an arbitrary host): Google FCM (Chrome, Android browsers, Samsung, Opera; some
 * Chromium builds use jmtNN.google.com), Apple (Safari,
 * iOS home-screen apps), Mozilla (Firefox), Microsoft (Edge on Windows).
 */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^jmt\d+\.google\.com$/, /^(.+\.)?push\.apple\.com$/, /^(.+\.)?push\.services\.mozilla\.com$/, /^(.+\.)?notify\.windows\.com$/];
export function isPushEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && !u.port && PUSH_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

/**
 * Only same-site paths are opened from a notification tap. Resolving against a dummy origin
 * catches tricks like "/\\evil.com" or "/\t/evil.com", which browsers treat as another site.
 */
export function safeUrl(u: string | null | undefined): string {
  if (!u || !u.startsWith('/')) return '/matches';
  try {
    const base = 'https://doreham.invalid';
    const t = new URL(u, base);
    return t.origin === base ? t.pathname + t.search + t.hash : '/matches';
  } catch {
    return '/matches';
  }
}

export function buildPayload(m: PushMessage, lang: string) {
  const ko = lang === 'ko';
  return {
    title: (ko ? m.title_ko : m.title_en) || m.title_en || m.title_ko,
    body: (ko ? m.body_ko : m.body_en) ?? '',
    url: safeUrl(m.action_url),
    tag: m.tag ?? null,
  };
}

/** Send each message to every device its user turned notifications on for. Never throws. */
export async function sendPush(messages: PushMessage[]): Promise<{ sent: number; failed: number; removed: number }> {
  const out = { sent: 0, failed: 0, removed: 0 };
  if (messages.length === 0 || !pushConfigured()) return out;
  try {
    const admin = getAdmin();
    const userIds = [...new Set(messages.map((m) => m.user_id))];
    const { data, error } = await admin
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth, lang, failure_count')
      .in('user_id', userIds);
    if (error || !data?.length) return out;
    const subs = data as SubRow[];

    const jobs: Promise<void>[] = [];
    for (const m of messages) {
      for (const s of subs.filter((x) => x.user_id === m.user_id)) {
        jobs.push(
          webpush
            .sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              JSON.stringify(buildPayload(m, s.lang)),
              { TTL: 60 * 60 * 24, urgency: m.urgency ?? 'normal', timeout: SEND_TIMEOUT_MS },
            )
            .then(async () => {
              out.sent++;
              await admin
                .from('push_subscriptions')
                .update({ last_success_at: new Date().toISOString(), failure_count: 0 })
                .eq('id', s.id);
            })
            .catch(async (e: unknown) => {
              out.failed++;
              const status = (e as { statusCode?: number })?.statusCode;
              // 404/410: the browser dropped this subscription. 403: it was made with other VAPID keys.
              const gone = status === 404 || status === 410 || status === 403;
              if (gone || s.failure_count + 1 >= MAX_FAILURES) {
                out.removed++;
                await admin.from('push_subscriptions').delete().eq('id', s.id);
              } else {
                s.failure_count++;
                await admin.from('push_subscriptions').update({ failure_count: s.failure_count }).eq('id', s.id);
              }
              if (!gone) console.error('push send failed', status ?? (e instanceof Error ? e.message : e));
            }),
        );
      }
    }
    await Promise.allSettled(jobs);
  } catch (e) {
    console.error('sendPush exception:', e instanceof Error ? e.message : e);
  }
  return out;
}
