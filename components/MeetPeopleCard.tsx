'use client';

import { MEET_PEOPLE_HREF } from '@/lib/accountType';
import { Icon } from '@/components/icons/Icon';

/**
 * For venue-only accounts: an invitation (not a nag) to make the friend profile and use
 * matching, groups and events like any member. Their venues and events stay as they are.
 */
export function MeetPeopleCard({ lang }: { lang: 'en' | 'ko' }) {
  const ko = lang === 'ko';
  return (
    <div className="mp-card">
      <div className="mp-ic" aria-hidden="true"><Icon name="hello" size={28} /></div>
      <div className="mp-text">
        <div className="mp-title">{ko ? '사람들도 만나 보고 싶으세요?' : 'Want to meet people too?'}</div>
        <div className="mp-sub">
          {ko
            ? '친구 프로필(약 5분)을 만들면 매칭 그룹, 이벤트 참여, 봉사 퀘스트를 이용할 수 있어요. 가게와 이벤트는 그대로예요.'
            : 'Make a friend profile (about 5 minutes) to get matched into groups, join events and do 봉사 volunteer quests. Your venue and events stay as they are.'}
        </div>
        <a className="mp-btn" href={MEET_PEOPLE_HREF}>
          {ko ? '친구 프로필 만들기 →' : 'Make my friend profile →'}
        </a>
      </div>
      <style jsx>{`
        .mp-card { display: flex; gap: 14px; align-items: flex-start; background: linear-gradient(135deg, rgba(255, 106, 61, 0.07), rgba(199, 184, 224, 0.16)); border: 1px solid rgba(255, 106, 61, 0.25); border-radius: 18px; padding: 18px 20px; margin: 0 0 14px; }
        .mp-ic { width: 44px; height: 44px; flex: none; border-radius: 14px; background: #fff; display: grid; place-items: center; font-size: 22px; }
        .mp-text { flex: 1; min-width: 0; }
        .mp-title { font-family: var(--display); font-weight: 800; font-size: 17px; color: var(--ink); }
        .mp-sub { font-size: 14px; color: var(--ink-60); line-height: 1.5; margin: 4px 0 12px; }
        .mp-btn { display: inline-block; background: var(--persimmon); color: #fff; font-weight: 700; font-size: 14px; border-radius: 999px; padding: 10px 18px; text-decoration: none; }
        .mp-btn:hover { transform: translateY(-1px); }
      `}</style>
    </div>
  );
}
