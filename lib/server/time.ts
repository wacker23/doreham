/**
 * Korea Standard Time helpers. Vercel functions run in UTC, but every
 * user-facing "day" and "evening" in Doreham is Korean time (UTC+9, no DST).
 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** YYYY-MM-DD of the given instant in KST. */
export function kstDateString(date: Date = new Date()): string {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Day-of-week (0=Sun) and hour (0-23) of an instant, in KST. */
export function kstDayHour(iso: string | Date): { day: number; hour: number } {
  const d = new Date(new Date(iso).getTime() + KST_OFFSET_MS);
  return { day: d.getUTCDay(), hour: d.getUTCHours() };
}

export function minutesFromNow(mins: number): string {
  return new Date(Date.now() + mins * 60 * 1000).toISOString();
}

export function hoursFromNow(hours: number): string {
  return minutesFromNow(hours * 60);
}

/** How long a venue meetup slot lasts (the app shows "4:00 – 6:00 PM"). */
export const MEETUP_SLOT_HOURS = 2;

const KO_WEEKDAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

/** Korean parts built by hand: some ICU builds print "PM 4:00" instead of "오후 4:00". */
function koParts(iso: string) {
  const d = new Date(new Date(iso).getTime() + KST_OFFSET_MS);
  const h = d.getUTCHours();
  const time = `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  return { month: d.getUTCMonth() + 1, day: d.getUTCDate(), weekday: KO_WEEKDAYS[d.getUTCDay()], time };
}

/**
 * "Sunday, October 5 · 4:00 PM – 6:00 PM" / "10월 5일 일요일 · 오후 4:00 – 오후 6:00", always in
 * Korea time. Without an end it shows the start only. Vercel runs in UTC, so a plain
 * toLocaleString() would print 7:00 AM for a 4 PM meetup.
 */
export function formatKstRange(startIso: string, endIso: string | null, lang: 'ko' | 'en'): string {
  if (lang === 'ko') {
    const s = koParts(startIso);
    return `${s.month}월 ${s.day}일 ${s.weekday} · ${s.time}${endIso ? ` – ${koParts(endIso).time}` : ''}`;
  }
  const day = new Date(startIso).toLocaleDateString('en-US', {
    timeZone: 'Asia/Seoul', weekday: 'long', month: 'long', day: 'numeric',
  });
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', { timeZone: 'Asia/Seoul', hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time(startIso)}${endIso ? ` – ${time(endIso)}` : ''}`;
}

/** Human-friendly KST time for notification bodies. */
export function formatKst(iso: string, lang: 'ko' | 'en'): string {
  if (lang === 'ko') {
    const k = koParts(iso);
    return `${k.month}월 ${k.day}일 (${k.weekday[0]}) ${k.time}`;
  }
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    timeZone: 'Asia/Seoul',
    month: 'short',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}
