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
          {lang === 'ko' ? '최종 업데이트: 2026년 10월 2일' : 'Last updated: October 2, 2026'}
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
              <li>가게 사장님은 친구 프로필 없이 &lsquo;가게 계정&rsquo;으로 가입할 수 있습니다. 가게 계정은 매칭과 그룹에 참여하지 않으며, 친구 프로필을 만들면 일반 회원과 똑같이 이용할 수 있습니다.</li>
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

            <h3>퀘스트 규칙과 경고</h3>
            <ul>
              <li>매칭 요청은 최대 24시간 동안 그룹을 찾고, 찾지 못하면 알려 드려요.</li>
              <li>장소 퀘스트는 체크인 시간 안에 QR 체크인으로, 봉사 퀘스트는 활동 장소에서 찍은 단체 사진으로 참여를 확인해요.</li>
              <li>체크인 시간이 끝났을 때 다른 멤버가 참여를 확인했는데 본인이 체크인하지 않았거나 어떤 단체 사진에도 없으면 불참 경고 1회가 부과돼요. 아무도 참여를 확인하지 않은 경우에는 경고가 없어요.</li>
              <li>확정된 그룹에서 나가면 경고 1회가 부과돼요. 1365 봉사활동 자리가 없어 나가는 경우에는 경고가 없어요.</li>
              <li>경고 3회는 48시간, 4회 이상은 1주일 동안 매칭이 정지돼요.</li>
            </ul>

            <h3>이벤트</h3>
            <ul>
              <li>회원과 파트너 가게가 올린 이벤트는 주최자가 기획하고 책임져요. 도레함은 &apos;도레함 공식&apos; 표시가 있는 이벤트만 직접 주최해요.</li>
              <li>이벤트는 공개된 장소에서 열어야 해요. 판매, 다단계, 종교·정치 모집, 이성 만남 목적의 이벤트는 올릴 수 없어요.</li>
              <li>미리 돈을 보내 달라고 요구하면 안 돼요. 비용이 있다면 이벤트에 적고 현장에서 받아요. 도레함은 이벤트 참여에 돈을 받지 않아요.</li>
              <li>규칙에 맞지 않거나 여러 회원이 신고한 이벤트와 댓글은 숨기거나 삭제할 수 있고, 반복되면 계정 이용을 제한할 수 있어요.</li>
            </ul>

            <h3>포인트, 레벨, 혜택</h3>
            <ul>
              <li>포인트는 앱에 안내된 규칙에 따라 확인된 활동(퀘스트 참여, 봉사, 리뷰, 이벤트 주최)에만 쌓이고, 경고를 받으면 줄어들어요. 규칙은 바뀔 수 있어요.</li>
              <li>포인트와 레벨은 현금 가치가 없고, 다른 사람에게 넘기거나 팔거나 바꿀 수 없어요.</li>
              <li>가짜 계정, 가짜 이벤트, 담합 등 부정한 방법으로 얻은 포인트와 레벨은 회수하거나 초기화할 수 있어요.</li>
              <li>제휴 가게 혜택은 각 가게가 제공하고 책임져요. 가게는 혜택을 바꾸거나 멈출 수 있어요.</li>
            </ul>

            <h2>6. 파트너 가게</h2>
            <p>도레함은 파트너 가게에서의 퀘스트를 제안하지만, 가게에서 제공하는 상품과 서비스에 대한 책임은 지지 않습니다. 문제 발생 시 가게에 직접 문의하시거나 도레함에 알려주세요.</p>

            <h2>7. 요금</h2>
            <p>도레함은 무료 플랜과 유료 플랜 <strong>Doreham+</strong>(월 ₩4,900 또는 연 ₩39,000)를 운영합니다.</p>
            <ul>
              <li><strong>무료 플랜</strong>: 한 달(한국 시간 기준)에 매칭 요청 2번, 그룹에 매칭되기, 봉사 퀘스트(무제한), 이벤트 보기·참여, 채팅·알림·안전 기능. 매칭되지 않고 끝나거나 취소된 요청, 그룹이 성사되지 않은 요청은 횟수에 포함되지 않습니다. 무료 플랜의 그룹 인원은 랜덤(2–5명)이고 카테고리는 선택할 수 없습니다.</li>
              <li><strong>Doreham+</strong>: 무제한 매칭 요청, 인원·카테고리 선택, 이벤트 열기(개인 모임 또는 가게 이벤트, 동시에 열 수 있는 수는 레벨에 따라 달라짐), 가게 등록, 프로필 배지.</li>
              <li>온라인 결제는 아직 열리지 않았으며, 그 전까지 도레함이 초기 회원과 제휴 가게에 Doreham+를 무료로 제공할 수 있습니다. 무료 제공이 끝나기 전에 알려드리며, 회원님의 별도 동의 없이 유료로 전환하거나 결제하지 않습니다.</li>
              <li>결제가 시작되면 가격, 자동 갱신 여부와 날짜를 결제 전에 안내하고, 언제든 한 번의 절차로 해지할 수 있게 하며, 청약철회와 환불은 전자상거래법 등 관련 법령에 따릅니다. 요금이 오르는 경우 적용 30일 전에 알리고 다시 동의를 받습니다.</li>
              <li>Doreham+가 끝나도 이미 등록한 가게, 이미 올린 이벤트와 진행 중인 매칭은 그대로 유지됩니다.</li>
              <li>테스트 기간에는 플랜 제한을 끄고 모든 기능을 모두에게 무료로 제공할 수 있습니다. 제한을 다시 적용하기 전에 앱에서 미리 알려드립니다.</li>
            </ul>
            <p>파트너 가게 방문 시 발생하는 비용은 사용자 부담입니다.</p>

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
              <li>Venue owners can sign up with a venue account, without a friend profile. Venue accounts are not matched or added to groups; making a friend profile lets you use Doreham like any member.</li>
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

            <h3>Quest rules and strikes</h3>
            <ul>
              <li>A match request looks for a group for up to 24 hours, then lets you know if none was found.</li>
              <li>Venue quests are confirmed by QR check-in during the check-in window; volunteer quests by a group selfie at the activity.</li>
              <li>When the check-in window ends, if someone else in your group showed up and you did not check in (or are not in any group selfie), you get a no-show strike. If nobody showed up, nobody gets a strike.</li>
              <li>Leaving a confirmed group gives you a strike. Leaving a volunteer group because you couldn&apos;t get a 1365 spot does not.</li>
              <li>3 strikes: matching is paused for 48 hours. 4 or more: 1 week.</li>
            </ul>

            <h3>Events</h3>
            <ul>
              <li>Events posted by members and partner venues are organized by, and the responsibility of, their host. Doreham hosts only the events marked &quot;Official&quot;.</li>
              <li>Events must be in public places. No selling, MLM, religious or political recruiting, and no dating events.</li>
              <li>Hosts must not ask for money in advance. If there is a cost, write it on the event and collect it on the spot. Doreham never charges to join an event.</li>
              <li>We may hide or remove events and comments that break these rules or that several members report, and limit accounts that do it repeatedly.</li>
            </ul>

            <h3>Points, levels and perks</h3>
            <ul>
              <li>Points are earned only for verified activity (showing up to quests, volunteering, reviews, hosting events) under the rules shown in the app, and are lost for strikes. The rules may change.</li>
              <li>Points and levels have no cash value and cannot be transferred, sold or exchanged.</li>
              <li>We may remove or reset points and levels gained by abuse, such as fake accounts, fake events or collusion.</li>
              <li>Partner venue perks are offered and honored by each venue, which may change or pause them.</li>
            </ul>

            <h2>6. Partner Venues</h2>
            <p>Doreham suggests quests at partner venues but takes no responsibility for products or services provided by venues. Contact the venue directly with issues, or let Doreham know.</p>

            <h2>7. Fees</h2>
            <p>Doreham has a free plan and one paid plan, <strong>Doreham+</strong> (₩4,900 a month or ₩39,000 a year).</p>
            <ul>
              <li><strong>Free plan</strong>: 2 match requests per calendar month (Korea time), being matched into groups, 봉사 volunteer quests (unlimited), seeing and joining events, chat, notifications and safety tools. Requests that end with no match, that you cancel, or whose group doesn't come together don't count. On the free plan your group size is random (2–5) and you can't choose categories.</li>
              <li><strong>Doreham+</strong>: unlimited match requests, choosing group size and categories, hosting events (your own meetups or events at your venue; how many can be open at once depends on your level), registering a venue, and a profile badge.</li>
              <li>Online payment is not open yet. Until it is, Doreham may give Doreham+ for free to early members and partner venues. We will tell you before a free period ends, and we will never switch you to a paid plan or charge you without your separate consent.</li>
              <li>When payment opens, we will show the price, whether it renews automatically and when, before you pay; you can cancel any time in one step; withdrawals and refunds follow Korean law, including the E-Commerce Act. If the price goes up, we will tell you 30 days before and ask for your consent again.</li>
              <li>If Doreham+ ends, venues you already registered, events you already posted and matches in progress stay as they are.</li>
              <li>During a test period we may switch the plan limits off so every feature is free for everyone. We will tell you in the app before the limits apply again.</li>
            </ul>
            <p>Costs incurred at partner venues are your responsibility.</p>

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
        h3 { font-family: var(--display); font-weight: 700; font-size: 17px; margin: 24px 0 10px; color: var(--ink); }
        p { font-size: 15px; line-height: 1.7; color: var(--ink); margin: 0 0 16px; }
        ul { padding-left: 24px; margin: 0 0 20px; }
        li { font-size: 15px; line-height: 1.7; color: var(--ink); margin-bottom: 8px; }
        a { color: var(--persimmon); text-decoration: underline; }
      `}</style>
    </>
  );
}