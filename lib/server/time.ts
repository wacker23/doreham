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

/** Human-friendly KST time for notification bodies. */
export function formatKst(iso: string, lang: 'ko' | 'en'): string {
  const d = new Date(iso);
  return d.toLocaleString(lang === 'ko' ? 'ko-KR' : 'en-US', {
    timeZone: 'Asia/Seoul',
    month: 'short',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}
