'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KOREAN_CITIES } from '@/lib/cities';
import { EVENT_CATEGORIES } from '@/lib/eventCategories';
import { eventError, fromKstInputs, toKstInputs } from '@/lib/eventDisplay';
import type { EventBase, HostContext } from '@/lib/eventTypes';
import { resizeImage } from '@/lib/imageResize';

type HostAs = 'user' | 'venue' | 'admin';

type FormState = {
  host_as: HostAs;
  venue_id: string;
  title: string;
  category: string;
  city: string;
  place_name: string;
  address: string;
  date: string;
  start: string;
  end: string;
  capacity: string;
  fee_text: string;
  description: string;
  is_featured: boolean;
};

export type EditableEvent = EventBase & { venue_id: string | null };

type DaumPostcodeData = { roadAddress: string; jibunAddress: string; buildingName?: string; sido: string; sigungu: string };
type DaumWindow = { daum?: { Postcode: new (o: { oncomplete: (d: DaumPostcodeData) => void }) => { open: () => void } } };

/** Daum's 시/도 + 시/군/구 → our city slug ('' when it isn't one of ours). */
function cityFromAddress(sido: string, sigungu: string): string {
  const pairs: [string, string][] = [
    ['서울', 'seoul'], ['부산', 'busan'], ['인천', 'incheon'], ['대구', 'daegu'], ['대전', 'daejeon'],
    ['광주광역', 'gwangju'], ['울산', 'ulsan'], ['제주', 'jeju'],
  ];
  for (const [k, slug] of pairs) if (sido.includes(k)) return slug;
  const towns: [string, string][] = [['아산', 'asan'], ['천안', 'cheonan'], ['수원', 'suwon'], ['전주', 'jeonju']];
  for (const [k, slug] of towns) if (sigungu.includes(k)) return slug;
  return '';
}

function blankState(): FormState {
  const tomorrow = toKstInputs(new Date(Date.now() + 86_400_000).toISOString()).date;
  return {
    host_as: 'user',
    venue_id: '',
    title: '',
    category: '',
    city: '',
    place_name: '',
    address: '',
    date: tomorrow,
    start: '19:00',
    end: '',
    capacity: '',
    fee_text: '',
    description: '',
    is_featured: false,
  };
}

function fromEvent(e: EditableEvent): FormState {
  const s = toKstInputs(e.starts_at);
  return {
    host_as: e.host_kind,
    venue_id: e.venue_id ?? '',
    title: e.title,
    category: e.category,
    city: e.city,
    place_name: e.place_name,
    address: e.address ?? '',
    date: s.date,
    start: s.time,
    end: e.ends_at ? toKstInputs(e.ends_at).time : '',
    capacity: e.capacity ? String(e.capacity) : '',
    fee_text: e.fee_text ?? '',
    description: e.description,
    is_featured: e.is_featured,
  };
}

/** starts_at / ends_at from the form. An end time earlier than the start means it ends after midnight. */
function times(f: FormState): { starts_at: string; ends_at: string | null } | null {
  if (!f.date || !f.start) return null;
  const starts_at = fromKstInputs(f.date, f.start);
  if (!f.end) return { starts_at, ends_at: null };
  let end = new Date(fromKstInputs(f.date, f.end));
  if (end.getTime() <= new Date(starts_at).getTime()) end = new Date(end.getTime() + 86_400_000);
  return { starts_at, ends_at: end.toISOString() };
}

export function EventForm({ lang, initial }: { lang: 'en' | 'ko'; initial?: EditableEvent }) {
  const router = useRouter();
  const ko = lang === 'ko';
  const editing = !!initial;
  const [ctx, setCtx] = useState<HostContext | null>(null);
  const [f, setF] = useState<FormState>(() => (initial ? fromEvent(initial) : blankState()));
  const [saving, setSaving] = useState(false);
  // Poster: a new file to upload, or the existing one (edit), or removed.
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState<string | null>(initial?.poster_url ?? null);
  const [posterRemoved, setPosterRemoved] = useState(false);
  const [posterBusy, setPosterBusy] = useState(false);
  const posterInput = useRef<HTMLInputElement>(null);
  const [{ today, maxDate }] = useState(() => ({
    today: toKstInputs(new Date().toISOString()).date,
    maxDate: toKstInputs(new Date(Date.now() + 120 * 86_400_000).toISOString()).date,
  }));
  const [error, setError] = useState('');
  const errorRef = useRef<HTMLParagraphElement>(null);
  const start = useRef(initial ? fromEvent(initial) : null);

  useEffect(() => {
    fetch('/api/events/host-context')
      .then((r) => (r.ok ? r.json() : null))
      .then((c: HostContext | null) => {
        setCtx(c);
        if (!initial && c) {
          const home = (c.homeDistrict ?? '').toLowerCase();
          if (KOREAN_CITIES.some((x) => x.slug === home)) setF((p) => (p.city ? p : { ...p, city: home }));
          // "Host an event here" from My venues: start as that venue.
          const wanted = new URLSearchParams(window.location.search).get('venue');
          const v = wanted ? c.venues.find((x) => x.id === wanted) : undefined;
          if (v) {
            setF((p) => ({
              ...p,
              host_as: 'venue',
              venue_id: v.id,
              place_name: p.place_name || v.name,
              city: KOREAN_CITIES.some((x) => x.slug === v.city) ? v.city : p.city,
            }));
          }
        }
      })
      .catch(() => setCtx(null));
  }, [initial]);

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [error]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));

  function pickHost(value: string) {
    if (value === 'user' || value === 'admin') {
      setF((p) => ({ ...p, host_as: value, venue_id: '' }));
      return;
    }
    const v = ctx?.venues.find((x) => x.id === value);
    setF((p) => ({
      ...p,
      host_as: 'venue',
      venue_id: value,
      place_name: p.place_name || v?.name || '',
      city: v && KOREAN_CITIES.some((c) => c.slug === v.city) ? v.city : p.city,
    }));
  }

  function searchAddress() {
    const daum = (window as unknown as DaumWindow).daum;
    if (!daum?.Postcode) {
      setError(ko ? '주소 검색을 불러오는 중이에요. 잠시 후 다시 눌러 주세요.' : 'Address search is still loading. Try again in a moment.');
      return;
    }
    new daum.Postcode({
      oncomplete: (d) => {
        const city = cityFromAddress(d.sido, d.sigungu);
        setF((p) => ({
          ...p,
          address: d.roadAddress || d.jibunAddress,
          place_name: p.place_name || d.buildingName || '',
          city: city || p.city,
        }));
      },
    }).open();
  }

  async function pickPoster(file: File | undefined) {
    if (!file) return;
    setError('');
    setPosterBusy(true);
    try {
      const small = await resizeImage(file);
      if (posterPreview?.startsWith('blob:')) URL.revokeObjectURL(posterPreview);
      setPosterFile(small);
      setPosterPreview(URL.createObjectURL(small));
      setPosterRemoved(false);
    } catch (e: unknown) {
      setError(eventError(e instanceof Error ? e.message : 'poster_not_image', lang));
    } finally {
      setPosterBusy(false);
      if (posterInput.current) posterInput.current.value = '';
    }
  }

  function dropPoster() {
    if (posterPreview?.startsWith('blob:')) URL.revokeObjectURL(posterPreview);
    setPosterFile(null);
    setPosterPreview(null);
    setPosterRemoved(true);
  }

  /** After the event is saved: upload / remove the poster. Returns false when that part failed. */
  async function savePoster(eventId: string) {
    try {
      if (posterFile) {
        const fd = new FormData();
        fd.append('file', posterFile);
        const r = await fetch(`/api/events/${eventId}/poster`, { method: 'POST', body: fd });
        return r.ok;
      }
      if (posterRemoved && initial?.poster_url) {
        const r = await fetch(`/api/events/${eventId}/poster`, { method: 'DELETE' });
        return r.ok;
      }
      return true;
    } catch {
      return false;
    }
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setError('');
    const t = times(f);
    if (!t) return setError(eventError('bad_start', lang));
    if (!f.category) return setError(eventError('bad_category', lang));
    if (!f.city) return setError(eventError('bad_city', lang));

    const full: Record<string, unknown> = {
      title: f.title,
      description: f.description,
      category: f.category,
      city: f.city,
      place_name: f.place_name,
      address: f.address || null,
      capacity: f.capacity ? Number(f.capacity) : null,
      fee_text: f.fee_text || null,
      ...t,
    };

    let body: Record<string, unknown>;
    if (!editing) {
      body = { ...full, host_as: f.host_as, venue_id: f.venue_id || null, ...(ctx?.isAdmin ? { is_featured: f.is_featured } : {}) };
    } else {
      // Send only what changed, so a small fix close to the start time isn't blocked by the time rules.
      const was = start.current!;
      const wasT = times(was)!;
      body = {};
      for (const k of ['title', 'description', 'category', 'city', 'place_name'] as const) if (f[k] !== was[k]) body[k] = full[k];
      if (f.address !== was.address) body.address = full.address;
      if (f.capacity !== was.capacity) body.capacity = full.capacity;
      if (f.fee_text !== was.fee_text) body.fee_text = full.fee_text;
      if (t.starts_at !== wasT.starts_at || t.ends_at !== wasT.ends_at) Object.assign(body, t);
      if (ctx?.isAdmin && f.is_featured !== was.is_featured) body.is_featured = f.is_featured;
    }

    setSaving(true);
    try {
      let id = initial?.id ?? '';
      if (!editing || Object.keys(body).length > 0) {
        const r = await fetch(editing ? `/api/events/${initial!.id}` : '/api/events', {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'failed');
        id = j.id ?? id;
      }
      const posterOk = await savePoster(id);
      const qs = new URLSearchParams();
      if (!editing) qs.set('new', '1');
      if (!posterOk) qs.set('poster', 'failed');
      router.push(`/events/${id}${qs.toString() ? `?${qs}` : ''}`);
    } catch (e: unknown) {
      setError(eventError(e instanceof Error ? e.message : '', lang));
      setSaving(false);
    }
  }

  const blocked = ctx && ctx.frozen;
  const hostChoices = !editing && ctx && (ctx.venues.length > 0 || ctx.isAdmin);

  // Hosting a new event is a Doreham+ feature (editing your existing events stays open).
  if (!editing && ctx?.plusRequired) return <HostPlusLock lang={lang} />;

  return (
    <form className="evf" onSubmit={submit} noValidate>
      {blocked && (
        <div className="evf-block">
          {ko ? '계정이 일시 정지된 동안에는 이벤트를 열 수 없어요.' : "You can't host events while your account is paused."}
        </div>
      )}

      <div className="evf-field">
        <span className="evf-label">
          {ko ? '포스터 또는 사진' : 'Poster or photo'} <em>{ko ? '(선택)' : '(optional)'}</em>
        </span>
        <input
          ref={posterInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/*"
          className="evf-file"
          onChange={(e) => pickPoster(e.target.files?.[0])}
          aria-label={ko ? '포스터 선택' : 'Choose a poster'}
        />
        {posterPreview ? (
          <div className="evf-poster">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={posterPreview} alt={ko ? '포스터 미리보기' : 'Poster preview'} />
            <div className="evf-poster-acts">
              <button type="button" className="evf-ghost" onClick={() => posterInput.current?.click()} disabled={posterBusy}>
                {ko ? '바꾸기' : 'Change'}
              </button>
              <button type="button" className="evf-ghost danger" onClick={dropPoster} disabled={posterBusy}>
                {ko ? '삭제' : 'Remove'}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="evf-drop" onClick={() => posterInput.current?.click()} disabled={posterBusy}>
            <span className="evf-drop-icon" aria-hidden="true">🖼️</span>
            <strong>{posterBusy ? (ko ? '준비 중…' : 'Preparing…') : ko ? '포스터나 사진 추가' : 'Add a poster or photo'}</strong>
            <span>{ko ? '이벤트가 눈에 잘 띄어요. JPEG, PNG, WebP (자동으로 줄여서 올려요)' : 'Events with a picture get noticed. JPEG, PNG or WebP (we resize it for you)'}</span>
          </button>
        )}
      </div>

      {hostChoices && (
        <div className="evf-field">
          <label htmlFor="evf-host">{ko ? '주최' : 'Host as'}</label>
          <select id="evf-host" value={f.host_as === 'venue' ? f.venue_id : f.host_as} onChange={(e) => pickHost(e.target.value)}>
            <option value="user">{ko ? '나 (개인 모임)' : 'Me (personal meetup)'}</option>
            {ctx!.venues.map((v) => (
              <option key={v.id} value={v.id}>
                🏪 {v.name}
              </option>
            ))}
            {ctx!.isAdmin && <option value="admin">{ko ? '⭐ 도레함 공식' : '⭐ Doreham (official)'}</option>}
          </select>
        </div>
      )}

      <div className="evf-field">
        <label htmlFor="evf-title">{ko ? '제목' : 'Title'}</label>
        <input
          id="evf-title"
          value={f.title}
          maxLength={80}
          onChange={(e) => set('title', e.target.value)}
          placeholder={ko ? '예: 토요일 아침 곡교천 산책 + 커피' : 'e.g. Saturday morning walk + coffee by the river'}
        />
        <span className="evf-count">{f.title.length}/80</span>
      </div>

      <div className="evf-field">
        <span className="evf-label">{ko ? '카테고리' : 'Category'}</span>
        <div className="evf-chips" role="radiogroup" aria-label={ko ? '카테고리' : 'Category'}>
          {EVENT_CATEGORIES.map((c) => (
            <button
              type="button"
              key={c.slug}
              role="radio"
              aria-checked={f.category === c.slug}
              className={f.category === c.slug ? 'on' : ''}
              onClick={() => set('category', c.slug)}
            >
              {c.emoji} {ko ? c.label_ko : c.label_en}
            </button>
          ))}
        </div>
      </div>

      <div className="evf-row">
        <div className="evf-field">
          <label htmlFor="evf-date">{ko ? '날짜' : 'Date'}</label>
          <input id="evf-date" type="date" value={f.date} min={today} max={maxDate} onChange={(e) => set('date', e.target.value)} />
        </div>
        <div className="evf-field">
          <label htmlFor="evf-start">{ko ? '시작' : 'Starts'}</label>
          <input id="evf-start" type="time" value={f.start} step={300} onChange={(e) => set('start', e.target.value)} />
        </div>
        <div className="evf-field">
          <label htmlFor="evf-end">
            {ko ? '종료' : 'Ends'} <em>{ko ? '(선택)' : '(optional)'}</em>
          </label>
          <input id="evf-end" type="time" value={f.end} step={300} onChange={(e) => set('end', e.target.value)} />
        </div>
      </div>
      <p className="evf-hint">{ko ? '한국 시간 기준이에요. 종료 시간이 시작보다 이르면 다음 날로 계산해요.' : 'Korea time. An end time earlier than the start counts as the next day.'}</p>

      <div className="evf-row">
        <div className="evf-field">
          <label htmlFor="evf-city">{ko ? '도시' : 'City'}</label>
          <select id="evf-city" value={f.city} onChange={(e) => set('city', e.target.value)}>
            <option value="">{ko ? '도시 선택' : 'Pick a city'}</option>
            {KOREAN_CITIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.emoji} {ko ? c.name_ko : c.name_en}
              </option>
            ))}
          </select>
        </div>
        <div className="evf-field grow">
          <label htmlFor="evf-place">{ko ? '장소 이름' : 'Place'}</label>
          <input
            id="evf-place"
            value={f.place_name}
            maxLength={100}
            onChange={(e) => set('place_name', e.target.value)}
            placeholder={ko ? '예: 스타벅스 아산배방점, 곡교천 은행나무길' : 'e.g. Starbucks Asan Baebang, Gokgyocheon Ginkgo Road'}
          />
        </div>
      </div>

      <div className="evf-field">
        <label htmlFor="evf-address">
          {ko ? '주소' : 'Address'} <em>{ko ? '(선택)' : '(optional)'}</em>
        </label>
        <div className="evf-inline">
          <input
            id="evf-address"
            value={f.address}
            maxLength={200}
            onChange={(e) => set('address', e.target.value)}
            placeholder={ko ? '주소를 검색하거나 입력하세요' : 'Search or type the address'}
          />
          <button type="button" className="evf-ghost" onClick={searchAddress}>
            {ko ? '주소 검색' : 'Search'}
          </button>
        </div>
      </div>

      <div className="evf-row">
        <div className="evf-field">
          <label htmlFor="evf-cap">
            {ko ? '최대 인원' : 'Max people'} <em>{ko ? '(선택)' : '(optional)'}</em>
          </label>
          <input id="evf-cap" type="number" inputMode="numeric" min={2} max={500} value={f.capacity} onChange={(e) => set('capacity', e.target.value)} placeholder="8" />
        </div>
        <div className="evf-field grow">
          <label htmlFor="evf-fee">
            {ko ? '비용' : 'Cost'} <em>{ko ? '(선택)' : '(optional)'}</em>
          </label>
          <input
            id="evf-fee"
            value={f.fee_text}
            maxLength={60}
            onChange={(e) => set('fee_text', e.target.value)}
            placeholder={ko ? '예: 무료, 각자 음료 주문' : 'e.g. Free, or "buy your own drink"'}
          />
        </div>
      </div>

      <div className="evf-field">
        <label htmlFor="evf-desc">{ko ? '설명' : 'Description'}</label>
        <textarea
          id="evf-desc"
          rows={7}
          maxLength={2000}
          value={f.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder={
            ko
              ? '어떤 모임인가요? 누구에게 잘 맞나요? 만나는 방법(예: 입구 앞에서 노란 모자)과 준비물을 적어 주세요.'
              : "What's the plan? Who is it for? How will people find you (e.g. \"at the entrance, yellow cap\") and what should they bring?"
          }
        />
        <span className="evf-count">{f.description.length}/2000</span>
      </div>

      {ctx?.isAdmin && (
        <label className="evf-check">
          <input type="checkbox" checked={f.is_featured} onChange={(e) => set('is_featured', e.target.checked)} />
          {ko ? '추천 이벤트로 맨 위에 고정' : 'Feature this event at the top of the feed'}
        </label>
      )}

      <div className="evf-rules">
        <strong>{ko ? '이벤트 가이드' : 'Event guidelines'}</strong>
        <ul>
          <li>{ko ? '카페, 공원, 가게 같은 공개된 장소에서 만나요. 집 주소는 올리지 마세요.' : 'Meet in a public place: a café, a park, a venue. No home addresses.'}</li>
          <li>{ko ? '미리 돈을 보내 달라고 하지 마세요. 비용이 있다면 위에 적고 현장에서 각자 내요.' : "Don't ask anyone to send money in advance. If there's a cost, write it above and people pay on the spot."}</li>
          <li>{ko ? '판매, 다단계, 종교·정치 모집, 이성 만남 목적의 이벤트는 안 돼요.' : 'No selling, MLM, religious or political recruiting, and no dating events.'}</li>
          <li>{ko ? '한국어나 영어로 쓰면 자동으로 번역돼요.' : 'Write in English or Korean. We translate it automatically.'}</li>
          <li>{ko ? '여러 명이 신고한 이벤트는 검토할 때까지 숨겨져요.' : 'Events reported by several people are hidden until we review them.'}</li>
        </ul>
      </div>

      {error && (
        <p className="evf-error" ref={errorRef} role="alert">
          {error}
        </p>
      )}

      <div className="evf-actions">
        <button type="button" className="evf-ghost" onClick={() => router.back()} disabled={saving}>
          {ko ? '취소' : 'Back'}
        </button>
        <button type="submit" className="evf-submit" disabled={saving || !!blocked}>
          {saving ? (ko ? '저장 중…' : 'Saving…') : editing ? (ko ? '변경 저장' : 'Save changes') : ko ? '이벤트 올리기' : 'Post event'}
        </button>
      </div>

      <style jsx>{`
        .evf { display: flex; flex-direction: column; gap: 16px; }
        .evf-block { background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412; border-radius: 14px; padding: 12px 14px; font-size: 14px; }
        .evf-block a { color: var(--persimmon); font-weight: 700; }
        .evf-field { display: flex; flex-direction: column; gap: 6px; position: relative; min-width: 0; }
        .evf-field.grow { flex: 1; }
        .evf-row { display: flex; gap: 12px; flex-wrap: wrap; }
        .evf-row > .evf-field { flex: 1 1 140px; }
        .evf-row > .evf-field.grow { flex: 2 1 220px; }
        label, .evf-label { font-weight: 700; font-size: 14px; color: var(--ink); }
        label em, .evf-label em { font-style: normal; font-weight: 500; color: var(--ink-60); font-size: 12.5px; }
        input, select, textarea { font-family: var(--body); font-size: 15px; color: var(--ink); background: #fff; border: 1px solid var(--ink-12); border-radius: 12px; padding: 11px 13px; width: 100%; box-sizing: border-box; }
        input:focus, select:focus, textarea:focus { outline: 2px solid rgba(255, 106, 61, 0.35); border-color: var(--persimmon); }
        textarea { resize: vertical; line-height: 1.5; }
        .evf-count { position: absolute; right: 4px; top: 0; font-size: 12px; color: var(--ink-60); }
        .evf-hint { margin: -8px 0 0; font-size: 12.5px; color: var(--ink-60); }
        .evf-inline { display: flex; gap: 8px; }
        .evf-chips { display: flex; flex-wrap: wrap; gap: 8px; }
        .evf-chips button { border: 1px solid var(--ink-12); background: #fff; border-radius: 999px; padding: 8px 13px; font-family: var(--body); font-weight: 600; font-size: 13.5px; cursor: pointer; color: var(--ink); }
        .evf-chips button.on { background: var(--ink); color: var(--paper); border-color: var(--ink); }
        .evf-check { display: flex; align-items: center; gap: 8px; font-weight: 600; }
        .evf-file { display: none; }
        .evf-drop { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 100%; padding: 26px 16px; border: 2px dashed rgba(30, 34, 48, 0.18); border-radius: 16px; background: #fff; cursor: pointer; font-family: var(--body); color: var(--ink); text-align: center; }
        .evf-drop:hover { border-color: var(--persimmon); background: rgba(255, 106, 61, 0.04); }
        .evf-drop strong { font-size: 15px; }
        .evf-drop span { font-size: 12.5px; color: var(--ink-60); max-width: 360px; }
        .evf-drop .evf-drop-icon { font-size: 34px; line-height: 1; margin-bottom: 2px; }
        .evf-poster { position: relative; border-radius: 16px; overflow: hidden; border: 1px solid var(--ink-12); background: var(--paper-2); }
        .evf-poster img { display: block; width: 100%; max-height: 420px; object-fit: contain; }
        .evf-poster-acts { position: absolute; right: 10px; bottom: 10px; display: flex; gap: 6px; }
        .evf-ghost.danger { color: #b42318; }
        .evf-check input { width: auto; }
        .evf-rules { background: var(--paper-2); border: 1px solid var(--ink-12); border-radius: 14px; padding: 14px 16px; font-size: 13.5px; color: var(--ink); }
        .evf-rules ul { margin: 8px 0 0; padding-left: 18px; color: var(--ink-60); line-height: 1.55; }
        .evf-error { color: #b42318; background: #fef3f2; border-radius: 12px; padding: 10px 14px; font-size: 14px; margin: 0; }
        .evf-actions { display: flex; justify-content: flex-end; gap: 10px; }
        .evf-ghost { flex-shrink: 0; background: #fff; border: 1px solid var(--ink-12); border-radius: 999px; padding: 10px 16px; font-family: var(--body); font-weight: 700; font-size: 14px; color: var(--ink); cursor: pointer; }
        .evf-submit { background: var(--persimmon); color: #fff; border: 0; border-radius: 999px; padding: 12px 24px; font-family: var(--body); font-weight: 800; font-size: 15px; cursor: pointer; }
        .evf-submit:disabled, .evf-ghost:disabled { opacity: 0.55; cursor: not-allowed; }
      `}</style>
    </form>
  );
}

/** Shown instead of the form when hosting needs Doreham+. */
function HostPlusLock({ lang }: { lang: 'en' | 'ko' }) {
  const ko = lang === 'ko';
  return (
    <div className="hpl">
      <div className="hpl-ic" aria-hidden="true">✨</div>
      <h2>{ko ? '이벤트 열기는 Doreham+ 기능이에요' : 'Hosting events is part of Doreham+'}</h2>
      <p>
        {ko
          ? 'Doreham+ 회원은 직접 모임을 열거나 내 가게에서 이벤트를 열 수 있어요. 이벤트 보기와 참여는 누구나 무료예요.'
          : 'Doreham+ members can host their own meetups, or events at their venue. Seeing and joining events stays free for everyone.'}
      </p>
      <a className="hpl-btn" href="/plus">{ko ? 'Doreham+ 보기' : 'See Doreham+'}</a>
      <a className="hpl-back" href="/events">{ko ? '이벤트 둘러보기' : 'Browse events'}</a>
      <style jsx>{`
        .hpl { text-align: center; background: #fff; border: 1px solid var(--ink-12); border-radius: 20px; padding: 32px 24px; }
        .hpl-ic { font-size: 40px; margin-bottom: 8px; }
        h2 { font-family: var(--display); font-weight: 800; font-size: 22px; margin: 0 0 10px; color: var(--ink); }
        p { color: var(--ink-60); font-size: 15px; line-height: 1.55; margin: 0 auto 20px; max-width: 46ch; }
        .hpl-btn { display: inline-block; background: var(--persimmon); color: #fff; font-weight: 700; font-size: 15px; border-radius: 999px; padding: 12px 24px; text-decoration: none; }
        .hpl-back { display: block; margin-top: 14px; color: var(--ink-60); font-weight: 600; font-size: 14px; text-decoration: none; }
      `}</style>
    </div>
  );
}
