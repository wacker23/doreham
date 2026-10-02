/** Client-safe helpers for showing events in the viewer's language. */

export type EventText = {
  title: string;
  description?: string;
  place_name: string;
  source_lang: string | null;
  translated_to: string | null;
  title_tr: string | null;
  description_tr?: string | null;
  place_name_tr: string | null;
};

/** Use the translation when the event was written in another language and we have one for this viewer. */
export function eventText(e: EventText, lang: 'en' | 'ko', showOriginal = false) {
  const translated = !showOriginal && e.translated_to === lang && e.source_lang !== lang && !!e.title_tr;
  return {
    translated,
    canToggle: e.translated_to === lang && e.source_lang !== lang && !!e.title_tr,
    title: translated ? e.title_tr! : e.title,
    description: translated ? (e.description_tr || e.description || '') : (e.description ?? ''),
    place: translated ? (e.place_name_tr || e.place_name) : e.place_name,
    sourceLangName:
      e.source_lang === 'ko' ? (lang === 'ko' ? '한국어' : 'Korean')
      : e.source_lang === 'en' ? (lang === 'ko' ? '영어' : 'English')
      : lang === 'ko' ? '다른 언어' : 'another language',
  };
}

export function kstParts(iso: string, lang: 'en' | 'ko') {
  const d = new Date(iso);
  const loc = lang === 'ko' ? 'ko-KR' : 'en-US';
  const opt = (o: Intl.DateTimeFormatOptions) => d.toLocaleString(loc, { timeZone: 'Asia/Seoul', ...o });
  return {
    month: opt({ month: 'short' }),
    day: opt({ day: 'numeric' }).replace(/[^0-9]/g, ''),
    weekday: opt({ weekday: 'short' }),
    time: opt({ hour: 'numeric', minute: '2-digit' }),
    full: opt({ weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
  };
}

/** "2026-10-03" and "19:30" in Korea time, for <input type=date/time>. */
export function toKstInputs(iso: string) {
  const d = new Date(new Date(iso).getTime() + 9 * 3_600_000);
  return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16) };
}

export function fromKstInputs(date: string, time: string): string {
  return new Date(`${date}T${time || '00:00'}:00+09:00`).toISOString();
}

/** "Today" / "Tomorrow" / "Sat, Oct 3" in Korea time. */
export function dayLabel(iso: string, lang: 'en' | 'ko') {
  const key = toKstInputs(iso).date;
  const today = toKstInputs(new Date().toISOString()).date;
  const tomorrow = toKstInputs(new Date(Date.now() + 86_400_000).toISOString()).date;
  if (key === today) return lang === 'ko' ? '오늘' : 'Today';
  if (key === tomorrow) return lang === 'ko' ? '내일' : 'Tomorrow';
  return new Date(iso).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', {
    timeZone: 'Asia/Seoul',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** "7:30 PM – 10:00 PM" (Korea time); the end is left out when there isn't one. */
export function timeRange(startIso: string, endIso: string | null, lang: 'en' | 'ko') {
  const start = kstParts(startIso, lang).time;
  if (!endIso) return start;
  const sameDay = toKstInputs(startIso).date === toKstInputs(endIso).date;
  const end = sameDay ? kstParts(endIso, lang).time : kstParts(endIso, lang).full;
  return `${start} – ${end}`;
}

export function relativeTime(iso: string, lang: 'en' | 'ko') {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return lang === 'ko' ? '방금' : 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return lang === 'ko' ? `${m}분 전` : `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return lang === 'ko' ? `${h}시간 전` : `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return lang === 'ko' ? `${d}일 전` : `${d}d ago`;
  return new Date(iso).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', { timeZone: 'Asia/Seoul', month: 'short', day: 'numeric' });
}

export const EVENT_ERRORS: Record<string, { en: string; ko: string }> = {
  title_too_short: { en: 'Give your event a title (at least 3 characters).', ko: '제목을 3자 이상 입력해 주세요.' },
  description_too_short: { en: 'Describe the event in a sentence or two (at least 10 characters).', ko: '이벤트 설명을 10자 이상 입력해 주세요.' },
  bad_category: { en: 'Pick a category.', ko: '카테고리를 선택해 주세요.' },
  bad_city: { en: 'Pick a city.', ko: '도시를 선택해 주세요.' },
  place_required: { en: 'Where is it? Add a place name.', ko: '장소 이름을 입력해 주세요.' },
  bad_capacity: { en: 'Capacity must be between 2 and 500 (or leave it empty).', ko: '인원은 2~500명 사이로 입력하거나 비워 두세요.' },
  bad_start: { en: 'Pick a start date and time.', ko: '시작 날짜와 시간을 선택해 주세요.' },
  start_too_soon: { en: 'The event must start at least 30 minutes from now.', ko: '이벤트는 지금부터 30분 뒤 이후에 시작해야 해요.' },
  start_too_far: { en: 'Events can be at most 4 months ahead.', ko: '이벤트는 최대 4개월 뒤까지 만들 수 있어요.' },
  bad_end: { en: 'The end time must be after the start.', ko: '종료 시간은 시작 시간 이후여야 해요.' },
  too_long: { en: 'Events can last at most 24 hours.', ko: '이벤트는 최대 24시간까지 가능해요.' },
  too_many_events: { en: "You've reached the limit of open events (it goes up with your level). Wait until one has happened or cancel one.", ko: '동시에 열 수 있는 이벤트 수를 넘었어요(레벨이 오르면 늘어나요). 기존 이벤트가 끝나거나 취소한 뒤 다시 시도해 주세요.' },
  plus_required: { en: 'Hosting events is part of Doreham+.', ko: '이벤트 열기는 Doreham+ 기능이에요.' },
  finish_onboarding: { en: 'Make your friend profile first to join or comment on events.', ko: '이벤트에 참여하거나 댓글을 달려면 먼저 친구 프로필을 만들어 주세요.' },
  account_frozen: { en: 'Your account is paused right now.', ko: '현재 계정이 일시 정지되어 있어요.' },
  cannot_host: { en: "You can't host events right now.", ko: '지금은 이벤트를 열 수 없어요.' },
  not_your_venue: { en: 'You can only host for your own approved venue.', ko: '승인된 내 가게로만 이벤트를 열 수 있어요.' },
  not_admin: { en: 'Admins only.', ko: '관리자만 가능해요.' },
  not_allowed: { en: "You can't do that.", ko: '권한이 없어요.' },
  not_found: { en: 'This event is not available.', ko: '볼 수 없는 이벤트예요.' },
  event_cancelled: { en: 'This event was cancelled.', ko: '취소된 이벤트예요.' },
  event_hidden: { en: 'This event is under review.', ko: '검토 중인 이벤트예요.' },
  event_started: { en: 'This event has already started.', ko: '이미 시작한 이벤트예요.' },
  event_full: { en: 'This event is full.', ko: '인원이 다 찼어요.' },
  host_cannot_leave: { en: "You're the host. Cancel the event instead.", ko: '주최자는 나갈 수 없어요. 이벤트를 취소해 주세요.' },
  empty_comment: { en: 'Write something first.', ko: '내용을 입력해 주세요.' },
  too_many_comments: { en: "You've commented a lot on this event.", ko: '이 이벤트에 댓글을 너무 많이 남겼어요.' },
  bad_reason: { en: 'Pick a reason.', ko: '신고 사유를 선택해 주세요.' },
  poster_too_large: { en: 'That image is too big. Try a smaller one.', ko: '이미지가 너무 커요. 더 작은 이미지를 골라 주세요.' },
  poster_not_image: { en: 'The poster must be a JPEG, PNG or WebP image.', ko: '포스터는 JPEG, PNG, WebP 이미지여야 해요.' },
  poster_required: { en: 'Pick an image.', ko: '이미지를 선택해 주세요.' },
  poster_failed: { en: "The event was saved, but the poster didn't upload. Try adding it again from Edit.", ko: '이벤트는 저장됐지만 포스터를 올리지 못했어요. 수정에서 다시 추가해 주세요.' },
};

export function eventError(code: string, lang: 'en' | 'ko') {
  const m = EVENT_ERRORS[code];
  return m ? (lang === 'ko' ? m.ko : m.en) : lang === 'ko' ? '문제가 생겼어요. 다시 시도해 주세요.' : 'Something went wrong. Please try again.';
}
