'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useUser } from '@/lib/hooks/useUser';
import { supabase } from '@/lib/supabase/client';

type Tag = {
  id: string;
  emoji: string;
  label_en: string;
  label_ko: string;
  category?: string;
};

type Member = {
  user_id: string;
  display_name: string;
  photo_url: string | null;
};

type PendingQuest = {
  quest_id: string;
  group_id: string;
  venue_id: string;
  venue_name: string;
  completed_at: string;
  unreviewed_members: Member[];
  venue_reviewed: boolean;
};

type ReviewInput = {
  compliment_tags: Set<string>;
  vibe_tags: Set<string>;
  concern_tags: Set<string>;
};

type VenueReviewInput = {
  compliment_tags: Set<string>;
  concern_tags: Set<string>;
  short_text: string;
};

export default function ReviewQuestPage() {
  const router = useRouter();
  const { user, loading } = useUser();
  const params = useParams();
  const questId = params?.quest_id as string;

  const [lang, setLang] = useState<'en' | 'ko'>('en');
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [pending, setPending] = useState<PendingQuest | null>(null);
  const [complimentTags, setComplimentTags] = useState<Tag[]>([]);
  const [vibeTags, setVibeTags] = useState<Tag[]>([]);
  const [concernTags, setConcernTags] = useState<Tag[]>([]);
  const [venueComplimentTags, setVenueComplimentTags] = useState<Tag[]>([]);
  const [venueConcernTags, setVenueConcernTags] = useState<Tag[]>([]);

  const [reviews, setReviews] = useState<Record<string, ReviewInput>>({});
  const [venueReview, setVenueReview] = useState<VenueReviewInput>({
    compliment_tags: new Set(),
    concern_tags: new Set(),
    short_text: '',
  });

  useEffect(() => {
    setLang((document.body.dataset.lang as 'en' | 'ko') ?? 'en');
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push(`/sign-in?return=/matches/review/${questId}`); return; }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, questId]);

  async function loadData() {
    setLoadingData(true);
    setError(null);

    try {
      const [pendingRes, tagsRes] = await Promise.all([
        fetch(`/api/pending-reviews?user_id=${user!.id}`),
        Promise.all([
          supabase.from('review_compliment_tags').select('*').order('display_order'),
          supabase.from('review_vibe_tags').select('*').order('display_order'),
          supabase.from('review_concern_tags').select('*').order('display_order'),
          supabase.from('venue_compliment_tags').select('*').order('display_order'),
          supabase.from('venue_concern_tags').select('*').order('display_order'),
        ]),
      ]);

      const pendingData = await pendingRes.json();
      const targetQuest = (pendingData.pending ?? []).find((p: PendingQuest) => p.quest_id === questId);

      if (!targetQuest) {
        setError(lang === 'ko' ? '리뷰할 퀘스트가 없어요.' : 'No pending review for this quest.');
        setLoadingData(false);
        return;
      }

      const [cRes, vRes, coRes, vcRes, vcoRes] = tagsRes;
      setComplimentTags(cRes.data ?? []);
      setVibeTags(vRes.data ?? []);
      setConcernTags(coRes.data ?? []);
      setVenueComplimentTags(vcRes.data ?? []);
      setVenueConcernTags(vcoRes.data ?? []);

      // Init empty reviews for each unreviewed member
      const initialReviews: Record<string, ReviewInput> = {};
      for (const m of targetQuest.unreviewed_members) {
        initialReviews[m.user_id] = {
          compliment_tags: new Set(),
          vibe_tags: new Set(),
          concern_tags: new Set(),
        };
      }
      setReviews(initialReviews);
      setPending(targetQuest);
      setLoadingData(false);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load');
      setLoadingData(false);
    }
  }

  function toggleTag(userId: string, kind: 'compliment_tags' | 'vibe_tags' | 'concern_tags', tagId: string) {
    setReviews((prev) => {
      const next = { ...prev };
      const userReview = { ...next[userId] };
      const set = new Set(userReview[kind]);
      if (set.has(tagId)) set.delete(tagId);
      else set.add(tagId);
      userReview[kind] = set;
      next[userId] = userReview;
      return next;
    });
  }

  function toggleVenueTag(kind: 'compliment_tags' | 'concern_tags', tagId: string) {
    setVenueReview((prev) => {
      const set = new Set(prev[kind]);
      if (set.has(tagId)) set.delete(tagId);
      else set.add(tagId);
      return { ...prev, [kind]: set };
    });
  }

  async function handleSubmit() {
    if (!pending) return;
    setSubmitting(true);
    setError(null);

    const personReviews = Object.entries(reviews).map(([userId, r]) => ({
      reviewed_user_id: userId,
      compliment_tags: [...r.compliment_tags],
      vibe_tags: [...r.vibe_tags],
      concern_tags: [...r.concern_tags],
    })).filter((r) => r.compliment_tags.length > 0 || r.vibe_tags.length > 0 || r.concern_tags.length > 0);

    const venueReviewPayload = (
      venueReview.compliment_tags.size > 0 ||
      venueReview.concern_tags.size > 0 ||
      venueReview.short_text.trim().length > 0
    ) ? {
      compliment_tags: [...venueReview.compliment_tags],
      concern_tags: [...venueReview.concern_tags],
      short_text: venueReview.short_text.trim() || null,
    } : null;

    try {
      const resp = await fetch('/api/submit-quest-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quest_id: pending.quest_id,
          reviewer_id: user!.id,
          person_reviews: personReviews,
          venue_review: venueReviewPayload,
        }),
      });
      const result = await resp.json();
      if (result.error) throw new Error(result.error);
      setSuccess(true);
      setSubmitting(false);
      setTimeout(() => router.push('/matches'), 2000);
    } catch (e: any) {
      setError(e.message ?? 'Submission failed');
      setSubmitting(false);
    }
  }

  if (loading || loadingData) {
    return (
      <main className="loading-wrap">
        <div className="loader" />
        <style jsx>{`
          .loading-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; }
          .loader { width: 40px; height: 40px; border: 3px solid var(--ink-12); border-top-color: var(--persimmon); border-radius: 50%; animation: spin 0.8s linear infinite; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </main>
    );
  }

  if (error && !pending) {
    return (
      <main className="err-wrap">
        <div className="err-icon">⚠️</div>
        <h1>{lang === 'ko' ? '리뷰할 수 없어요' : "Can't review"}</h1>
        <p>{error}</p>
        <a href="/matches" className="btn-back">{lang === 'ko' ? '돌아가기' : 'Back to matches'}</a>
        <style jsx>{`
          .err-wrap { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px; text-align: center; }
          .err-icon { font-size: 48px; margin-bottom: 16px; }
          h1 { font-family: var(--display); font-weight: 800; font-size: 24px; margin: 0 0 8px; }
          p { color: var(--ink-60); margin: 0 0 24px; }
          .btn-back { background: var(--ink); color: var(--paper); text-decoration: none; padding: 12px 24px; border-radius: 999px; font-weight: 600; }
        `}</style>
      </main>
    );
  }

  if (success) {
    return (
      <main className="success-wrap">
        <div className="success-icon">🌸</div>
        <h1>{lang === 'ko' ? '리뷰 감사합니다!' : 'Thanks for your review!'}</h1>
        <p>{lang === 'ko' ? '커뮤니티를 더 좋게 만드는 데 도움이 돼요.' : 'This helps make the community better.'}</p>
        <style jsx>{`
          .success-wrap { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px; text-align: center; background: linear-gradient(180deg, rgba(255, 106, 61, 0.06), transparent); }
          .success-icon { font-size: 72px; margin-bottom: 16px; }
          h1 { font-family: var(--display); font-weight: 800; font-size: 26px; margin: 0 0 8px; color: var(--persimmon); }
          p { color: var(--ink); font-size: 15px; margin: 0; }
        `}</style>
      </main>
    );
  }

  if (!pending) return null;

  // Group compliment tags by category
  const complimentsByCategory: Record<string, Tag[]> = {};
  for (const t of complimentTags) {
    const cat = t.category ?? 'other';
    if (!complimentsByCategory[cat]) complimentsByCategory[cat] = [];
    complimentsByCategory[cat].push(t);
  }
  const categoryLabels: Record<string, { en: string; ko: string }> = {
    reliability:   { en: 'Reliability',   ko: '신뢰' },
    communication: { en: 'Communication', ko: '소통' },
    warmth:        { en: 'Warmth',        ko: '태도' },
  };

  const concernsByCategory: Record<string, Tag[]> = {};
  for (const t of concernTags) {
    const cat = t.category ?? 'other';
    if (!concernsByCategory[cat]) concernsByCategory[cat] = [];
    concernsByCategory[cat].push(t);
  }

  return (
    <main className="review-wrap">
      <header className="review-header">
        <a href="/matches" className="back-btn">←</a>
        <div className="header-title">
          {lang === 'ko' ? '리뷰 작성' : 'Write reviews'}
        </div>
      </header>

      <div className="content">
        <div className="intro">
          <div className="quest-summary">
            <div className="quest-label">
              {lang === 'ko' ? '완료한 퀘스트' : 'Completed quest'}
            </div>
            <div className="quest-venue">📍 {pending.venue_name}</div>
            <div className="quest-date">
              {new Date(pending.completed_at).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', {
                weekday: 'short', month: 'short', day: 'numeric',
              })}
            </div>
          </div>
          <p className="privacy-note">
            {lang === 'ko'
              ? '🔒 모든 리뷰는 익명입니다. 걱정거리는 비공개로 처리되며 프로필에 표시되지 않아요.'
              : '🔒 All reviews are anonymous. Concerns stay private and are never shown on profiles.'}
          </p>
        </div>

        {/* Venue review */}
        {!pending.venue_reviewed && (
          <section className="review-section venue-section">
            <h2>
              📍 {pending.venue_name}
              <span className="opt-tag">{lang === 'ko' ? '선택' : 'Optional'}</span>
            </h2>

            <div className="tag-group">
              <div className="tag-group-title">{lang === 'ko' ? '👍 좋았던 점' : '👍 What went well'}</div>
              <div className="tags-grid">
                {venueComplimentTags.map((t) => {
                  const active = venueReview.compliment_tags.has(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`tag-btn ${active ? 'active' : ''}`}
                      onClick={() => toggleVenueTag('compliment_tags', t.id)}
                    >
                      {t.emoji} {lang === 'ko' ? t.label_ko : t.label_en}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="tag-group">
              <div className="tag-group-title concern-title">
                {lang === 'ko' ? '⚠️ 아쉬웠던 점 (비공개)' : '⚠️ What could be better (private)'}
              </div>
              <div className="tags-grid">
                {venueConcernTags.map((t) => {
                  const active = venueReview.concern_tags.has(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`tag-btn concern ${active ? 'active' : ''}`}
                      onClick={() => toggleVenueTag('concern_tags', t.id)}
                    >
                      {t.emoji} {lang === 'ko' ? t.label_ko : t.label_en}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="tag-group">
              <div className="tag-group-title">
                {lang === 'ko' ? '💬 한 줄 후기 (선택, 30-100자)' : '💬 Short review (optional, 30-100 chars)'}
              </div>
              <textarea
                value={venueReview.short_text}
                onChange={(e) => setVenueReview({ ...venueReview, short_text: e.target.value.slice(0, 100) })}
                placeholder={lang === 'ko' ? '이 장소는 어땠나요?' : "How was the venue?"}
                rows={2}
                maxLength={100}
              />
              <div className="char-count">
                {venueReview.short_text.length}/100
              </div>
            </div>
          </section>
        )}

        {/* Person reviews */}
        {pending.unreviewed_members.map((member) => {
          const review = reviews[member.user_id];
          if (!review) return null;

          return (
            <section key={member.user_id} className="review-section person-section">
              <div className="person-header">
                {member.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={member.photo_url} alt="" className="person-avatar" />
                ) : (
                  <div className="person-avatar person-fallback">
                    {member.display_name[0]?.toUpperCase()}
                  </div>
                )}
                <h2>{member.display_name}</h2>
              </div>

              {/* Compliments grouped by category */}
              <div className="tag-group">
                <div className="tag-group-title">{lang === 'ko' ? '🌟 칭찬' : '🌟 Compliments'}</div>
                {Object.entries(complimentsByCategory).map(([cat, tags]) => (
                  <div key={cat} className="category-block">
                    <div className="cat-label">
                      {categoryLabels[cat]?.[lang] ?? cat}
                    </div>
                    <div className="tags-grid">
                      {tags.map((t) => {
                        const active = review.compliment_tags.has(t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            className={`tag-btn ${active ? 'active' : ''}`}
                            onClick={() => toggleTag(member.user_id, 'compliment_tags', t.id)}
                          >
                            {t.emoji} {lang === 'ko' ? t.label_ko : t.label_en}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Vibe stickers */}
              <div className="tag-group">
                <div className="tag-group-title">{lang === 'ko' ? '✨ 분위기 스티커' : '✨ Vibe stickers'}</div>
                <div className="tags-grid">
                  {vibeTags.map((t) => {
                    const active = review.vibe_tags.has(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        className={`tag-btn vibe ${active ? 'active' : ''}`}
                        onClick={() => toggleTag(member.user_id, 'vibe_tags', t.id)}
                      >
                        {t.emoji} {lang === 'ko' ? t.label_ko : t.label_en}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Concerns (private) */}
              <div className="tag-group">
                <div className="tag-group-title concern-title">
                  {lang === 'ko' ? '⚠️ 걱정거리 (비공개, 신뢰도만)' : '⚠️ Concerns (private, for trust only)'}
                </div>
                {Object.entries(concernsByCategory).map(([cat, tags]) => (
                  <div key={cat} className="category-block">
                    <div className="cat-label">
                      {categoryLabels[cat]?.[lang] ?? cat}
                    </div>
                    <div className="tags-grid">
                      {tags.map((t) => {
                        const active = review.concern_tags.has(t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            className={`tag-btn concern ${active ? 'active' : ''}`}
                            onClick={() => toggleTag(member.user_id, 'concern_tags', t.id)}
                          >
                            {t.emoji} {lang === 'ko' ? t.label_ko : t.label_en}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        {error && <div className="error-banner">{error}</div>}

        <div className="submit-bar">
          <a href="/matches" className="btn-skip">
            {lang === 'ko' ? '나중에' : 'Later'}
          </a>
          <button
            type="button"
            className="btn-submit"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting
              ? (lang === 'ko' ? '제출 중...' : 'Submitting...')
              : (lang === 'ko' ? '리뷰 제출' : 'Submit reviews')}
          </button>
        </div>
      </div>

      <style jsx>{`
        .review-wrap { min-height: 100vh; background: var(--paper); padding-bottom: 80px; }
        .review-header { display: flex; align-items: center; gap: 12px; padding: 14px 20px; background: rgba(245, 242, 235, 0.9); border-bottom: 1px solid var(--ink-12); position: sticky; top: 0; z-index: 10; backdrop-filter: blur(8px); }
        .back-btn { text-decoration: none; color: var(--ink); font-size: 20px; }
        .header-title { font-family: var(--display); font-weight: 800; font-size: 17px; }
        .content { max-width: 560px; margin: 0 auto; padding: 20px; }
        .intro { margin-bottom: 20px; }
        .quest-summary { background: #fff; border: 1px solid var(--ink-12); border-radius: 14px; padding: 16px 18px; margin-bottom: 12px; }
        .quest-label { font-size: 11px; color: var(--ink-60); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; font-weight: 700; }
        .quest-venue { font-family: var(--display); font-weight: 800; font-size: 18px; color: var(--ink); margin-bottom: 2px; }
        .quest-date { font-size: 13px; color: var(--ink-60); }
        .privacy-note { font-size: 12px; color: var(--ink-60); background: rgba(15, 157, 119, 0.06); border: 1px solid rgba(15, 157, 119, 0.15); padding: 10px 14px; border-radius: 10px; line-height: 1.5; margin: 0; }
        .review-section { background: #fff; border: 1px solid var(--ink-12); border-radius: 16px; padding: 20px; margin-bottom: 16px; }
        .review-section h2 { font-family: var(--display); font-weight: 800; font-size: 19px; margin: 0 0 16px; color: var(--ink); display: flex; align-items: center; gap: 8px; }
        .opt-tag { background: var(--paper-2); color: var(--ink-60); font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.05em; }
        .person-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
        .person-avatar { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; }
        .person-fallback { background: var(--persimmon); color: #fff; display: grid; place-items: center; font-weight: 700; font-size: 18px; }
        .person-header h2 { margin: 0; }
        .tag-group { margin-bottom: 20px; }
        .tag-group:last-child { margin-bottom: 0; }
        .tag-group-title { font-size: 13px; font-weight: 700; color: var(--ink); margin-bottom: 10px; }
        .tag-group-title.concern-title { color: var(--ink-60); }
        .category-block { margin-bottom: 12px; }
        .cat-label { font-size: 11px; color: var(--ink-60); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; font-weight: 600; }
        .tags-grid { display: flex; flex-wrap: wrap; gap: 6px; }
        .tag-btn { background: var(--paper-2); border: 1.5px solid transparent; padding: 8px 14px; border-radius: 999px; font-size: 13px; font-weight: 600; color: var(--ink); cursor: pointer; transition: all 0.15s; font-family: var(--body); }
        .tag-btn:hover:not(.active) { border-color: var(--ink-12); }
        .tag-btn.active { background: rgba(255, 106, 61, 0.12); border-color: var(--persimmon); color: var(--persimmon); }
        .tag-btn.vibe.active { background: rgba(122, 88, 168, 0.12); border-color: #7A58A8; color: #7A58A8; }
        .tag-btn.concern.active { background: rgba(232, 169, 63, 0.15); border-color: #a86720; color: #a86720; }
        textarea { width: 100%; padding: 10px 14px; border: 1px solid var(--ink-12); border-radius: 10px; font-family: var(--body); font-size: 14px; resize: vertical; box-sizing: border-box; margin-top: 4px; outline: none; }
        textarea:focus { border-color: var(--persimmon); }
        .char-count { font-size: 11px; color: var(--ink-60); text-align: right; margin-top: 2px; }
        .error-banner { background: rgba(255, 106, 61, 0.1); border: 1px solid rgba(255, 106, 61, 0.25); color: var(--persimmon); padding: 12px 16px; border-radius: 12px; margin-bottom: 12px; }
        .submit-bar { display: flex; gap: 10px; padding-top: 8px; position: sticky; bottom: 0; background: var(--paper); padding-bottom: 12px; }
        .btn-skip { flex: 0 0 auto; background: transparent; border: 1.5px solid var(--ink-12); color: var(--ink-60); text-decoration: none; padding: 14px 22px; border-radius: 999px; font-weight: 600; font-size: 14px; display: inline-flex; align-items: center; justify-content: center; }
        .btn-submit { flex: 1; background: var(--persimmon); color: #fff; border: 0; padding: 14px 22px; border-radius: 999px; font-weight: 800; font-size: 15px; cursor: pointer; }
        .btn-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(255, 106, 61, 0.32); }
        .btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </main>
  );
}