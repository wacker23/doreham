import 'server-only';
import { Resend } from 'resend';

export const EMAIL_FROM_BRANDED = 'Doreham / 도레함 <noreply@doreham.co.kr>';
export const EMAIL_FROM_PLAIN = 'Doreham <noreply@doreham.co.kr>';
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://doreham.co.kr';

let resend: Resend | null = null;

/** Lazily constructed so a missing key fails at send time, not at build/import time. */
export function getResend(): Resend {
  if (!resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY is not set');
    resend = new Resend(key);
  }
  return resend;
}

export type EmailResult = { ok?: boolean; error?: string; status: number; [k: string]: unknown };

/** Mirrors the old NextResponse.json(body, { status }) shape so moved code stays unchanged. */
export function emailResult(body: Record<string, unknown>, init?: { status?: number }): EmailResult {
  return { ...body, status: init?.status ?? 200 };
}
