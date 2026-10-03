'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase/client';
import { askNow, disablePushForSignOut, getPushState, type PushState } from '@/lib/push';
import { DeleteAccountSection } from '@/components/DeleteAccountSection';
import { MembershipSection } from '@/components/MembershipSection';
import { useVolunteerPhotoConsent } from '@/components/PrivacyConsentsSection';
import { SITE_URL, SOCIAL_LINKS, SUPPORT_EMAIL } from '@/lib/social';

/**
 * Own profile → Settings: membership, then grouped rows like a phone app's settings screen
 * (the volunteer-photo consent sits under Legal documents).
 * Payment method and the social accounts are placeholders until Doreham's business
 * registration is done (fill the links in lib/social.ts when the accounts exist).
 */

type Lang = 'en' | 'ko';
type Panel = 'notifications' | 'payment' | 'legal' | 'delete' | null;

export function ProfileSettings({ lang, plusActive, canDelete }: { lang: Lang; plusActive: boolean; canDelete: boolean }) {
  const ko = lang === 'ko';
  const t = (en: string, k: string) => (ko ? k : en);
  const [push, setPush] = useState<PushState>('loading');
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState<'push' | 'logout' | null>(null);
  const [shared, setShared] = useState<'copied' | 'failed' | null>(null);
  const consent = useVolunteerPhotoConsent(lang);

  useEffect(() => {
    let cancelled = false;
    getPushState()
      .then((s) => !cancelled && setPush(s))
      .catch(() => !cancelled && setPush('unsupported'));
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (p: Exclude<Panel, null>) => setPanel((cur) => (cur === p ? null : p));

  async function onNotifications() {
    if (push === 'default' || push === 'off') {
      setBusy('push');
      setPush(await askNow(lang));
      setBusy(null);
      return;
    }
    if (push !== 'loading') toggle('notifications');
  }

  async function invite() {
    const text = t(
      'Join me on Doreham: meet new friends in Korea, in small groups.',
      '도레함에서 한국에 사는 새 친구들을 소그룹으로 만나 봐요!',
    );
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: t('Doreham', '도레함'), text, url: SITE_URL });
        return;
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return; // closed the share sheet
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${SITE_URL}`);
      setShared('copied');
    } catch {
      setShared('failed');
    }
    setTimeout(() => setShared(null), 4000);
  }

  async function logOut() {
    setBusy('logout');
    await disablePushForSignOut();
    await supabase.auth.signOut().catch(() => {});
    window.location.href = '/';
  }

  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);

  const pushRight =
    push === 'loading' ? (
      <Pill>…</Pill>
    ) : push === 'on' ? (
      <Pill tone="on">{t('On', '켜짐')}</Pill>
    ) : push === 'default' || push === 'off' ? (
      <Pill tone="go">{busy === 'push' ? '…' : t('Turn on', '켜기')}</Pill>
    ) : push === 'denied' ? (
      <Pill tone="warn">{t('Blocked', '차단됨')}</Pill>
    ) : push === 'ios-install' ? (
      <Pill tone="go">{t('Set up', '설정하기')}</Pill>
    ) : (
      <Pill>{t('Not available', '사용 불가')}</Pill>
    );

  const pushHelp =
    push === 'on'
      ? t(
          'Group invites, messages and quest reminders come to this device. To turn them off, change the notification setting for Doreham in your phone or browser settings.',
          '그룹 초대, 메시지, 퀘스트 알림이 이 기기로 와요. 끄려면 휴대폰이나 브라우저 설정에서 도레함 알림을 꺼 주세요.',
        )
      : push === 'denied'
      ? isAndroid
        ? t(
            'Notifications are blocked. Tap the icon left of the address bar → Permissions → Notifications → Allow. (Installed app: hold the Doreham icon → App info → Notifications.)',
            '알림이 차단되어 있어요. 주소창 왼쪽 아이콘 → 권한 → 알림 → 허용을 눌러 주세요. (앱으로 설치했다면: 도레함 아이콘을 길게 누름 → 앱 정보 → 알림)',
          )
        : t(
            'Notifications are blocked. Click the icon left of the address bar and allow notifications for doreham.co.kr.',
            '알림이 차단되어 있어요. 주소창 왼쪽 아이콘을 눌러 doreham.co.kr 알림을 허용해 주세요.',
          )
      : push === 'ios-install'
      ? t(
          'On iPhone, notifications work once Doreham is on your Home Screen: tap Share (square with an arrow) → "Add to Home Screen", then open Doreham from there.',
          '아이폰은 도레함을 홈 화면에 추가해야 알림을 받을 수 있어요. 공유 버튼(화살표가 있는 네모) → "홈 화면에 추가"를 누른 뒤, 홈 화면의 도레함에서 열어 주세요.',
        )
      : t(
          "This browser can't show notifications. Try Chrome or Samsung Internet, or Safari after adding Doreham to your Home Screen.",
          '이 브라우저는 알림을 지원하지 않아요. 크롬이나 삼성 인터넷, 또는 홈 화면에 추가한 사파리에서 열어 주세요.',
        );

  const social: { key: keyof typeof SOCIAL_LINKS; icon: ReactNode; en: string; ko: string }[] = [
    { key: 'instagram', icon: <IconCamera />, en: 'Instagram', ko: '인스타그램' },
    { key: 'x', icon: <IconAt />, en: 'X (Twitter)', ko: 'X (트위터)' },
    { key: 'tiktok', icon: <IconMusic />, en: 'TikTok', ko: '틱톡' },
  ];
  const soon = <Pill>{t('Coming soon', '준비 중')}</Pill>;

  return (
    <div className="ps">
      <h2 className="ps-title">{t('Settings', '설정')}</h2>

      <MembershipSection lang={lang} />

      <div className="ps-group" role="group" aria-label={t('Account', '계정')}>
        <h3 className="ps-head">{t('Account', '계정')}</h3>
        <div className="ps-card">
          <SettingsRow
            icon={<IconBell />}
            label={t('Notifications', '알림')}
            right={pushRight}
            onClick={onNotifications}
            expanded={panel === 'notifications'}
          />
          {panel === 'notifications' && <div className="ps-panel">{pushHelp}</div>}

          <SettingsRow
            icon={<IconUserPlus />}
            label={t('Invite friends', '친구 초대')}
            sub={
              shared === 'copied'
                ? t('Link copied. Paste it in a chat ✓', '링크를 복사했어요. 채팅에 붙여 넣으세요 ✓')
                : shared === 'failed'
                ? t('Share this link: doreham.co.kr', '이 링크를 공유해 주세요: doreham.co.kr')
                : t('Share Doreham with a friend', '친구에게 도레함 알려 주기')
            }
            onClick={invite}
          />

          <SettingsRow
            icon={<IconStar />}
            label={t('My subscription plan', '내 구독 플랜')}
            right={plusActive ? <Pill tone="plus">✨ Doreham+</Pill> : <Pill tone="plain">{t('Free', '무료')}</Pill>}
            href="/plus"
          />

          <SettingsRow
            icon={<IconCard />}
            label={t('Payment method', '결제 수단')}
            right={soon}
            onClick={() => toggle('payment')}
            expanded={panel === 'payment'}
          />
          {panel === 'payment' && (
            <div className="ps-panel">
              {t(
                "Online payment is being prepared. It opens once Doreham's business registration is complete, and we'll let you know.",
                '온라인 결제를 준비하고 있어요. 도레함 사업자 등록이 끝나면 열리고, 열리면 알려 드릴게요.',
              )}
            </div>
          )}
        </div>
      </div>

      <div className="ps-group" role="group" aria-label={t('Support & privacy', '고객 지원 · 개인정보')}>
        <h3 className="ps-head">{t('Support & privacy', '고객 지원 · 개인정보')}</h3>
        <div className="ps-card">
          <SettingsRow icon={<IconHelp />} label={t('Help & contact', '도움말 · 문의')} sub={SUPPORT_EMAIL} href={`mailto:${SUPPORT_EMAIL}`} />
          <SettingsRow
            icon={<IconFile />}
            label={t('Legal documents', '약관 및 정책')}
            onClick={() => toggle('legal')}
            expanded={panel === 'legal'}
          />
          {panel === 'legal' && (
            <div className="ps-panel ps-links">
              <a href="/legal/terms">{t('Terms of Service', '이용약관')} →</a>
              <a href="/legal/privacy">{t('Privacy Policy', '개인정보 처리방침')} →</a>
            </div>
          )}
          <SettingsRow
            icon={<IconShield />}
            label={t('Volunteer quest photos', '봉사 퀘스트 사진')}
            sub={consent.message ?? consent.status}
            right={
              consent.agreedAt === undefined ? undefined : consent.agreedAt ? (
                <Pill tone="warn">{consent.busy ? '…' : t('Withdraw', '철회')}</Pill>
              ) : (
                <Pill tone="go">{t('Review', '보기')}</Pill>
              )
            }
            onClick={consent.agreedAt === undefined || consent.busy ? undefined : consent.agreedAt ? consent.withdraw : consent.review}
          />
          {consent.modal}
        </div>
      </div>

      <div className="ps-group" role="group" aria-label={t('Follow us', '도레함 팔로우')}>
        <h3 className="ps-head">{t('Follow us', '도레함 팔로우')}</h3>
        <div className="ps-card">
          {social.map((s) =>
            SOCIAL_LINKS[s.key] ? (
              <SettingsRow key={s.key} icon={s.icon} label={ko ? s.ko : s.en} href={SOCIAL_LINKS[s.key]} external />
            ) : (
              <SettingsRow key={s.key} icon={s.icon} label={ko ? s.ko : s.en} right={soon} />
            ),
          )}
        </div>
      </div>

      <div className="ps-group" role="group" aria-label={t('Sign out', '로그아웃')}>
        <div className="ps-card">
          <SettingsRow
            icon={<IconLogOut />}
            label={busy === 'logout' ? t('Logging out…', '로그아웃 중…') : t('Log out', '로그아웃')}
            onClick={busy === 'logout' ? undefined : logOut}
            chevron={false}
          />
          {canDelete && (
            <SettingsRow
              icon={<IconTrash />}
              label={t('Delete account', '계정 삭제')}
              onClick={() => toggle('delete')}
              expanded={panel === 'delete'}
              danger
            />
          )}
          {canDelete && panel === 'delete' && <DeleteAccountSection lang={lang} embedded onCancel={() => setPanel(null)} />}
        </div>
      </div>

      <p className="ps-foot">
        Doreham 도레함 · <a href={SITE_URL}>doreham.co.kr</a>
      </p>

      <style jsx>{`
        .ps { margin-top: 28px; }
        .ps-title { font-family: var(--display); font-weight: 800; font-size: 22px; letter-spacing: -0.01em; margin: 0 0 14px; color: var(--ink); }
        .ps-group { margin-bottom: 18px; }
        .ps-head { font-size: 12.5px; font-weight: 700; color: var(--ink-60); text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 8px 6px; }
        .ps-card { background: #fff; border: 1px solid var(--ink-12); border-radius: 16px; overflow: hidden; box-shadow: 0 1px 2px rgba(30, 34, 48, 0.03); }
        .ps-card > :global(.sr-row:first-child) { border-top: 0; }
        .ps-panel { padding: 0 18px 16px 68px; font-size: 13.5px; line-height: 1.55; color: var(--ink-60); }
        .ps-links { display: flex; flex-direction: column; gap: 10px; }
        .ps-links a { color: var(--ink); font-weight: 700; text-decoration: none; font-size: 14.5px; }
        .ps-links a:hover { color: var(--persimmon); }
        .ps-foot { text-align: center; font-size: 12.5px; color: var(--ink-60); margin: 22px 0 0; }
        .ps-foot a { color: inherit; }
        @media (max-width: 420px) {
          .ps-panel { padding-left: 18px; }
        }
      `}</style>
    </div>
  );
}

/** Small status label on the right of a row. */
function Pill({ tone, children }: { tone?: 'on' | 'go' | 'warn' | 'plus' | 'plain'; children: ReactNode }) {
  return (
    <span className={`pill ${tone ?? ''}`}>
      {children}
      <style jsx>{`
        .pill { display: inline-block; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 999px; background: var(--paper); color: var(--ink-60); white-space: nowrap; line-height: 1.4; }
        .on { background: rgba(15, 157, 119, 0.12); color: var(--jade); }
        .go { background: rgba(255, 106, 61, 0.12); color: var(--persimmon); }
        .warn { background: rgba(214, 69, 69, 0.1); color: #c43c3c; }
        .plus { background: linear-gradient(135deg, rgba(255, 106, 61, 0.14), rgba(199, 184, 224, 0.35)); color: var(--persimmon); }
        .plain { background: transparent; padding: 0; font-size: 14px; font-weight: 600; }
      `}</style>
    </span>
  );
}

/** One settings row: round icon, label (and a smaller line), something on the right, chevron. */
function SettingsRow({
  icon,
  label,
  sub,
  right,
  href,
  external,
  onClick,
  expanded,
  danger,
  chevron = true,
}: {
  icon: ReactNode;
  label: string;
  sub?: string;
  right?: ReactNode;
  href?: string;
  external?: boolean;
  onClick?: () => void;
  expanded?: boolean;
  danger?: boolean;
  chevron?: boolean;
}) {
  const cls = `sr-row ${danger ? 'danger' : ''}`;
  const inner = <RowInner icon={icon} label={label} sub={sub} right={right} danger={danger} chevron={chevron && Boolean(href || onClick)} expanded={expanded} />;
  return (
    <>
      {href ? (
        <a className={cls} href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
          {inner}
        </a>
      ) : onClick ? (
        <button type="button" className={cls} onClick={onClick} aria-expanded={expanded}>
          {inner}
        </button>
      ) : (
        <div className={`${cls} static`}>{inner}</div>
      )}
      <style jsx>{`
        .sr-row {
          display: flex;
          align-items: center;
          gap: 14px;
          width: 100%;
          min-height: 62px;
          padding: 10px 16px 10px 14px;
          border: 0;
          border-top: 1px solid rgba(30, 34, 48, 0.07);
          background: #fff;
          color: var(--ink);
          font-family: var(--body);
          text-align: left;
          text-decoration: none;
          cursor: pointer;
          transition: background 0.12s;
          -webkit-tap-highlight-color: transparent;
        }
        .sr-row:hover { background: var(--paper-2); }
        .sr-row:active { background: var(--paper); }
        .sr-row:focus-visible { outline: 3px solid rgba(255, 106, 61, 0.3); outline-offset: -3px; }
        .sr-row.static { cursor: default; }
        .sr-row.static:hover, .sr-row.static:active { background: #fff; }
      `}</style>
    </>
  );
}

function RowInner({
  icon,
  label,
  sub,
  right,
  danger,
  chevron,
  expanded,
}: {
  icon: ReactNode;
  label: string;
  sub?: string;
  right?: ReactNode;
  danger?: boolean;
  chevron: boolean;
  expanded?: boolean;
}) {
  return (
    <>
      <span className={`ri-ic ${danger ? 'danger' : ''}`} aria-hidden="true">{icon}</span>
      <span className="ri-text">
        <span className={`ri-label ${danger ? 'danger' : ''}`}>{label}</span>
        {sub && <span className="ri-sub">{sub}</span>}
      </span>
      {right && <span className="ri-right">{right}</span>}
      {chevron && (
        <svg className={`ri-chev ${expanded ? 'open' : ''}`} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      <style jsx>{`
        .ri-ic { width: 38px; height: 38px; flex: none; border-radius: 50%; background: #f1efea; color: var(--ink); display: grid; place-items: center; }
        .ri-ic.danger { background: rgba(214, 69, 69, 0.1); color: #c43c3c; }
        .ri-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; word-break: keep-all; }
        .ri-label { font-size: 15.5px; font-weight: 600; color: var(--ink); line-height: 1.3; }
        .ri-label.danger { color: #c43c3c; }
        .ri-sub { font-size: 12.5px; color: var(--ink-60); line-height: 1.35; overflow-wrap: anywhere; }
        .ri-right { flex: none; display: flex; align-items: center; }
        .ri-chev { flex: none; color: rgba(30, 34, 48, 0.35); transition: transform 0.15s; }
        .ri-chev.open { transform: rotate(90deg); }
      `}</style>
    </>
  );
}

// ---- Line icons (20px, stroke) ------------------------------------------------------

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
const IconBell = () => (
  <Svg>
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </Svg>
);
const IconUserPlus = () => (
  <Svg>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M19 8v6M22 11h-6" />
  </Svg>
);
const IconStar = () => (
  <Svg>
    <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z" />
  </Svg>
);
const IconCard = () => (
  <Svg>
    <rect x="2" y="5" width="20" height="14" rx="2.5" />
    <path d="M2 10h20M6 15h4" />
  </Svg>
);
const IconHelp = () => (
  <Svg>
    <circle cx="12" cy="12" r="10" />
    <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01" />
  </Svg>
);
const IconFile = () => (
  <Svg>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6M16 13H8M16 17H8" />
  </Svg>
);
const IconShield = () => (
  <Svg>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M9 12l2 2 4-4" />
  </Svg>
);
const IconCamera = () => (
  <Svg>
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </Svg>
);
const IconAt = () => (
  <Svg>
    <circle cx="12" cy="12" r="4" />
    <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.9 7.9" />
  </Svg>
);
const IconMusic = () => (
  <Svg>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </Svg>
);
const IconLogOut = () => (
  <Svg>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </Svg>
);
const IconTrash = () => (
  <Svg>
    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
  </Svg>
);
