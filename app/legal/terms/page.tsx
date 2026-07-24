'use client';

import { useEffect, useState } from 'react';

export default function TermsPage() {
  const [lang, setLang] = useState<'en' | 'ko'>('en');

  useEffect(() => {
    document.body.setAttribute('data-lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <>
      <header className="legal-nav">
        <div className="wrap legal-nav-in">
          <a className="brand" href="/">
            Doreham <span className="ko-mark">도레함</span>
          </a>
          <div className="toggle">
            <button aria-pressed={lang === 'ko'} onClick={() => setLang('ko')}>한국어</button>
            <button aria-pressed={lang === 'en'} onClick={() => setLang('en')}>English</button>
          </div>
        </div>
      </header>

      <main className="wrap main-wrap">
        <a href="/" className="back-link">← {lang === 'ko' ? '홈으로' : 'Back home'}</a>

        <h1>{lang === 'ko' ? '이용 약관' : 'Terms of Service'}</h1>
        <p className="last-updated">
          {lang === 'ko' ? '최종 업데이트: 2026년 7월 25일' : 'Last updated: July 25, 2026'}
        </p>

        {/* Summary card */}
        <div className="summary-card">
          <h2>{lang === 'ko' ? '요약 (읽기 편한 버전)' : 'The Short Version'}</h2>
          {lang === 'ko' ? (
            <ul>
              <li>도레함은 진짜 오프라인 만남을 위한 매칭 서비스입니다.</li>
              <li>만 16세 이상만 이용 가능합니다.</li>
              <li>다른 사용자를 존중하고 안전하게 만나야 합니다.</li>
              <li>실제 있는 오프라인 만남에서 각자 안전에 대한 책임이 있습니다.</li>
              <li>사기, 괴롭힘, 부적절한 행동은 즉시 차단됩니다.</li>
              <li>초기 스타트업이므로 완벽하지 않을 수 있습니다. 이해와 피드백을 부탁드립니다.</li>
            </ul>
          ) : (
            <ul>
              <li>Doreham matches people for real offline meetups.</li>
              <li>You must be 16 or older to use the service.</li>
              <li>Respect other users and meet safely.</li>
              <li>You&apos;re responsible for your own safety at in-person meetups.</li>
              <li>Fraud, harassment, and inappropriate behavior result in immediate ban.</li>
              <li>We&apos;re an early-stage startup — imperfect. Your understanding and feedback matter.</li>
            </ul>
          )}
        </div>

        {lang === 'ko' ? (
          <>
            <h2>1. 서비스 소개</h2>
            <p>도레함(&ldquo;서비스&rdquo;)은 한국 거주 외국인 및 국제 거주자를 위한 친구 매칭 앱입니다. 성격, 관심사, 라이프스타일을 기반으로 2-3명의 소그룹을 매칭하고, 실제 파트너 가게에서의 활동(퀘스트)을 제안합니다.</p>

            <h2>2. 이용 자격</h2>
            <p>도레함을 이용하려면:</p>
            <ul>
              <li>만 16세 이상이어야 합니다</li>
              <li>본인의 실제 신원으로 가입해야 합니다</li>
              <li>한국에 거주하거나 방문 중이어야 합니다</li>
              <li>이 약관과 개인정보 처리방침에 동의해야 합니다</li>
            </ul>

            <h2>3. 계정 및 프로필</h2>
            <ul>
              <li>정확한 정보를 제공해주세요. 허위 정보는 계정 정지 사유가 됩니다.</li>
              <li>Google 계정을 통해 로그인합니다. 계정 보안은 본인이 책임집니다.</li>
              <li>사진은 실제 본인의 사진을 사용하시고 부적절한 이미지는 금지됩니다.</li>
              <li>한 사람당 하나의 계정만 허용됩니다.</li>
            </ul>

            <h2>4. 사용자 행동 규범</h2>
            <p>도레함은 안전하고 친근한 커뮤니티를 지향합니다. <strong>다음 행위는 금지됩니다:</strong></p>
            <ul>
              <li>괴롭힘, 차별, 혐오 발언</li>
              <li>성희롱, 원치 않는 성적 접근</li>
              <li>사기, 상업적 스팸, 다단계 홍보</li>
              <li>다른 사용자의 개인정보 무단 공유</li>
              <li>미성년자에 대한 부적절한 접근</li>
              <li>가짜 프로필 생성 또는 타인 사칭</li>
              <li>매칭된 만남 외 목적 (데이트 앱 아님)</li>
              <li>불법 활동 또는 위험한 행동 조장</li>
            </ul>
            <p>위반 시 <strong>경고 없이 계정이 즉시 정지 및 삭제</strong>될 수 있습니다.</p>

            <h2>5. 오프라인 만남과 안전</h2>
            <p><strong>중요:</strong> 도레함은 매칭과 소개 서비스만 제공합니다. 실제 오프라인 만남은 사용자 각자의 책임 하에 이루어집니다.</p>
            <ul>
              <li>공공 장소에서만 만나세요 (파트너 가게 권장)</li>
              <li>첫 만남은 절대 1:1이 아닌 그룹으로 진행됩니다</li>
              <li>불편함을 느끼면 언제든지 자리를 뜨셔도 됩니다</li>
              <li>비상 상황 발생 시 112 (한국 경찰)에 신고하세요</li>
              <li>매칭된 사람이 문제 있어 보이면 즉시 앱 내 신고 기능을 이용해주세요</li>
            </ul>

            <h2>6. 파트너 가게</h2>
            <p>도레함은 파트너 가게에서의 퀘스트를 제안하지만, 가게에서 제공하는 상품과 서비스에 대한 책임은 지지 않습니다. 문제 발생 시 가게에 직접 문의하시거나 도레함에 알려주세요.</p>

            <h2>7. 요금</h2>
            <p>현재 도레함의 기본 매칭 서비스는 무료입니다. 향후 프리미엄 기능이 추가될 경우 사전 공지합니다. 파트너 가게 방문 시 발생하는 비용은 사용자 부담입니다.</p>

            <h2>8. 지적 재산권</h2>
            <ul>
              <li>도레함 브랜드, 로고, 디자인은 Doreham의 자산입니다.</li>
              <li>사용자가 업로드한 콘텐츠(사진, 소개글)의 소유권은 사용자에게 있습니다.</li>
              <li>단, 도레함은 서비스 제공 목적으로 해당 콘텐츠를 사용할 수 있습니다.</li>
            </ul>

            <h2>9. 서비스 변경 및 종료</h2>
            <p>도레함은 초기 스타트업으로, 서비스가 변경되거나 일시적으로 중단될 수 있습니다. 중요한 변경 사항은 사전에 알려드립니다.</p>

            <h2>10. 면책 조항</h2>
            <p>서비스는 &ldquo;있는 그대로&rdquo; 제공됩니다. 오프라인 만남에서 발생한 모든 사건(신체적, 정서적, 재산상 피해 등)에 대해 도레함은 법적 책임을 지지 않습니다. 매칭이 반드시 좋은 관계로 이어질 것을 보장하지 않습니다.</p>

            <h2>11. 계정 삭제</h2>
            <p>언제든지 계정을 삭제할 수 있습니다. 삭제 요청은 <a href="mailto:support@doreham.co.kr">support@doreham.co.kr</a>로 보내주세요. 삭제된 데이터는 30일 이내에 완전히 제거됩니다.</p>

            <h2>12. 약관 변경</h2>
            <p>이 약관은 변경될 수 있으며, 중요한 변경 사항은 이메일로 통지합니다. 변경 후 계속 서비스를 이용하시면 새 약관에 동의한 것으로 간주됩니다.</p>

            <h2>13. 준거법</h2>
            <p>이 약관은 대한민국 법에 따라 해석되며, 분쟁 발생 시 서울중앙지방법원을 관할 법원으로 합니다.</p>

            <h2>14. 연락처</h2>
            <p>
              문의사항이 있으시면:<br />
              이메일: <a href="mailto:support@doreham.co.kr">support@doreham.co.kr</a><br />
              운영자: Sophia Mosalla (Doreham 창업자)
            </p>
          </>
        ) : (
          <>
            <h2>1. Service Description</h2>
            <p>Doreham (&ldquo;the Service&rdquo;) is a friendship-matching app for immigrants and international residents in Korea. We match small groups of 2-3 people based on personality, interests, and lifestyle, and suggest activities (quests) at real partner venues.</p>

            <h2>2. Eligibility</h2>
            <p>To use Doreham you must:</p>
            <ul>
              <li>Be 16 years or older</li>
              <li>Register with your real identity</li>
              <li>Reside in or be visiting Korea</li>
              <li>Agree to these Terms and our Privacy Policy</li>
            </ul>

            <h2>3. Account & Profile</h2>
            <ul>
              <li>Provide accurate information. False information may result in account suspension.</li>
              <li>You sign in via Google. You&apos;re responsible for your account security.</li>
              <li>Use your real photo. Inappropriate images are prohibited.</li>
              <li>One account per person.</li>
            </ul>

            <h2>4. Community Guidelines</h2>
            <p>Doreham aims to be a safe, friendly community. <strong>The following are prohibited:</strong></p>
            <ul>
              <li>Harassment, discrimination, or hate speech</li>
              <li>Sexual harassment or unwanted sexual advances</li>
              <li>Fraud, commercial spam, MLM promotion</li>
              <li>Sharing others&apos; private information without consent</li>
              <li>Inappropriate contact with minors</li>
              <li>Creating fake profiles or impersonating others</li>
              <li>Using matches for unintended purposes (Doreham is NOT a dating app)</li>
              <li>Promoting illegal activities or dangerous behavior</li>
            </ul>
            <p>Violations may result in <strong>immediate account suspension and deletion without warning</strong>.</p>

            <h2>5. Offline Meetings and Safety</h2>
            <p><strong>Important:</strong> Doreham provides matching and introduction services only. Actual offline meetings happen at your own responsibility.</p>
            <ul>
              <li>Meet only in public places (partner venues recommended)</li>
              <li>First meetings are ALWAYS groups, never one-on-one</li>
              <li>You can leave anytime if you feel uncomfortable</li>
              <li>In emergencies, call 112 (Korean police)</li>
              <li>If a matched person seems problematic, use the in-app report function immediately</li>
            </ul>

            <h2>6. Partner Venues</h2>
            <p>Doreham suggests quests at partner venues but takes no responsibility for products or services provided by venues. Contact the venue directly with issues, or let Doreham know.</p>

            <h2>7. Fees</h2>
            <p>Basic Doreham matching is currently free. Any future premium features will be announced in advance. Costs incurred at partner venues are your responsibility.</p>

            <h2>8. Intellectual Property</h2>
            <ul>
              <li>The Doreham brand, logo, and design are property of Doreham.</li>
              <li>Content you upload (photos, bio) remains yours.</li>
              <li>However, Doreham may use this content for service delivery purposes.</li>
            </ul>

            <h2>9. Service Changes and Termination</h2>
            <p>Doreham is an early-stage startup. Services may change or be temporarily interrupted. We&apos;ll notify you in advance of significant changes.</p>

            <h2>10. Disclaimer</h2>
            <p>The service is provided &ldquo;as is.&rdquo; Doreham is not legally liable for any incidents at offline meetings (physical, emotional, financial harm, etc.). We don&apos;t guarantee that matches will lead to good relationships.</p>

            <h2>11. Account Deletion</h2>
            <p>You can delete your account at any time. Send deletion requests to <a href="mailto:support@doreham.co.kr">support@doreham.co.kr</a>. Deleted data will be fully removed within 30 days.</p>

            <h2>12. Changes to Terms</h2>
            <p>These terms may change. We&apos;ll notify you by email of significant changes. Continued use after changes constitutes agreement to new terms.</p>

            <h2>13. Governing Law</h2>
            <p>These terms are governed by the laws of the Republic of Korea. Disputes will be handled by the Seoul Central District Court.</p>

            <h2>14. Contact</h2>
            <p>
              For questions:<br />
              Email: <a href="mailto:support@doreham.co.kr">support@doreham.co.kr</a><br />
              Operator: Sophia Mosalla (Doreham founder)
            </p>
          </>
        )}
      </main>

      <style jsx>{`
        .legal-nav { background: rgba(245, 242, 235, 0.9); border-bottom: 1px solid var(--ink-12); position: sticky; top: 0; z-index: 10; backdrop-filter: blur(8px); }
        .legal-nav-in { display: flex; align-items: center; justify-content: space-between; height: 68px; }
        .brand { display: flex; align-items: baseline; gap: 9px; font-family: var(--display); font-weight: 800; font-size: 20px; text-decoration: none; color: var(--ink); }
        .ko-mark { color: var(--ink-60); font-weight: 700; font-size: 17px; }
        .toggle { display: inline-flex; border: 1px solid var(--ink-12); border-radius: 999px; overflow: hidden; background: var(--paper-2); }
        .toggle button { border: 0; background: transparent; font-family: var(--body); font-weight: 600; font-size: 13px; padding: 7px 13px; cursor: pointer; color: var(--ink-60); }
        .toggle button[aria-pressed='true'] { background: var(--ink); color: var(--paper); }
        .main-wrap { padding: 32px 24px 80px; max-width: 780px; }
        .back-link { color: var(--ink-60); font-family: var(--body); font-weight: 600; font-size: 14px; text-decoration: none; display: inline-block; margin-bottom: 24px; }
        .back-link:hover { color: var(--ink); }
        h1 { font-family: var(--display); font-weight: 800; font-size: 40px; letter-spacing: -0.02em; margin: 0 0 8px; }
        .last-updated { color: var(--ink-60); font-size: 14px; margin: 0 0 40px; }
        .summary-card { background: linear-gradient(135deg, rgba(255, 106, 61, 0.05), rgba(15, 157, 119, 0.03)); border: 1px solid rgba(255, 106, 61, 0.15); border-radius: 20px; padding: 24px 28px; margin-bottom: 48px; }
        .summary-card h2 { font-family: var(--display); font-weight: 800; font-size: 18px; margin: 0 0 12px; color: var(--persimmon); }
        .summary-card ul { list-style: none; padding: 0; margin: 0; }
        .summary-card li { font-size: 15px; color: var(--ink); line-height: 1.6; padding-left: 24px; position: relative; margin-bottom: 8px; }
        .summary-card li:before { content: '✓'; position: absolute; left: 0; color: var(--jade); font-weight: 700; }
        h2 { font-family: var(--display); font-weight: 700; font-size: 22px; margin: 40px 0 12px; color: var(--ink); }
        p { font-size: 15px; line-height: 1.7; color: var(--ink); margin: 0 0 16px; }
        ul { padding-left: 24px; margin: 0 0 20px; }
        li { font-size: 15px; line-height: 1.7; color: var(--ink); margin-bottom: 8px; }
        a { color: var(--persimmon); text-decoration: underline; }
      `}</style>
    </>
  );
}