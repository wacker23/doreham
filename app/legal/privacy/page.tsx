'use client';

import { useEffect, useState } from 'react';

export default function PrivacyPage() {
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

        <h1>{lang === 'ko' ? '개인정보 처리방침' : 'Privacy Policy'}</h1>
        <p className="last-updated">
          {lang === 'ko' ? '최종 업데이트: 2026년 7월 25일' : 'Last updated: July 25, 2026'}
        </p>

        {/* Summary card */}
        <div className="summary-card">
          <h2>{lang === 'ko' ? '요약 (읽기 편한 버전)' : 'The Short Version'}</h2>
          {lang === 'ko' ? (
            <ul>
              <li>사용자의 개인정보는 매칭과 서비스 제공에만 사용됩니다.</li>
              <li>제3자에게 판매하거나 광고에 사용하지 않습니다.</li>
              <li>같은 그룹에 매칭된 사용자만 서로의 프로필을 볼 수 있습니다.</li>
              <li>이메일, MBTI, 관심사, 생년월일 등을 수집하지만 신용카드 정보는 저장하지 않습니다.</li>
              <li>언제든지 계정을 삭제하고 데이터를 요청할 수 있습니다.</li>
              <li>도레함은 초기 스타트업입니다. 신뢰가 중요하므로 정직하게 운영하겠습니다.</li>
            </ul>
          ) : (
            <ul>
              <li>We use your data only for matching and providing the service.</li>
              <li>We never sell your data or use it for advertising.</li>
              <li>Only users in your matched group can see your profile.</li>
              <li>We collect email, MBTI, interests, DOB — never credit card info.</li>
              <li>You can delete your account and request your data anytime.</li>
              <li>Doreham is an early-stage startup. Trust matters — we&apos;ll be honest about how we handle your info.</li>
            </ul>
          )}
        </div>

        {lang === 'ko' ? (
          <>
            <h2>1. 수집하는 정보</h2>
            <p>도레함은 다음 정보를 수집합니다:</p>
            <ul>
              <li><strong>계정 정보</strong>: 이메일 주소 (Google OAuth를 통해)</li>
              <li><strong>프로필 정보</strong>: 이름/닉네임, 생년월일, 성별, 사진(선택), 자기소개, 직업</li>
              <li><strong>성격 및 관심사</strong>: MBTI, Big Five 성격 검사 결과, 활동 관심사</li>
              <li><strong>라이프스타일 정보</strong>: 운동 빈도, 학력, 음주/흡연 습관, 자녀 유무</li>
              <li><strong>위치 정보</strong>: 거주 지역 (구/동 수준)</li>
              <li><strong>커뮤니케이션</strong>: 그룹 채팅 메시지, 매칭 그룹 내 대화</li>
            </ul>

            <h2>2. 정보 사용 방법</h2>
            <p>수집된 정보는 다음 목적으로 사용됩니다:</p>
            <ul>
              <li>사용자 매칭 및 그룹 형성</li>
              <li>서비스 개선 및 오류 수정</li>
              <li>매칭 및 서비스 관련 알림 이메일 발송</li>
              <li>사용자 지원 및 안전 관리</li>
            </ul>

            <h2>3. 정보 공유</h2>
            <p><strong>정보를 제3자에게 판매하지 않습니다.</strong> 다음 경우에만 정보가 공유됩니다:</p>
            <ul>
              <li><strong>매칭된 그룹 멤버</strong>: 같은 그룹의 다른 사용자가 프로필을 볼 수 있습니다</li>
              <li><strong>파트너 가게</strong>: 방문 시 그룹 이름과 예약 정보가 공유될 수 있습니다</li>
              <li><strong>법적 요구</strong>: 법원 명령 등 법적 요구가 있을 경우</li>
              <li><strong>서비스 제공업체</strong>: Supabase (데이터베이스), Resend (이메일), Vercel (호스팅) 등</li>
            </ul>

            <h2>4. 데이터 보안</h2>
            <p>업계 표준 보안 조치를 사용하여 데이터를 보호합니다:</p>
            <ul>
              <li>HTTPS 암호화된 통신</li>
              <li>Row Level Security (데이터베이스 수준 접근 제어)</li>
              <li>비밀번호가 아닌 OAuth를 통한 인증</li>
              <li>정기적인 백업</li>
            </ul>

            <h2>5. 사용자 권리</h2>
            <p>귀하는 다음 권리를 가집니다:</p>
            <ul>
              <li>본인의 정보 열람 및 수정</li>
              <li>계정 삭제 및 관련 데이터 삭제</li>
              <li>본인 데이터의 사본 요청</li>
              <li>정보 처리에 대한 이의 제기</li>
            </ul>
            <p>이러한 권리를 행사하려면 <a href="mailto:privacy@doreham.co.kr">privacy@doreham.co.kr</a>로 연락해주세요.</p>

            <h2>6. 데이터 보관</h2>
            <p>계정을 삭제하면 프로필 정보는 즉시 삭제되며, 백업 로그는 30일 이내에 완전히 삭제됩니다. 그룹 채팅 메시지는 다른 그룹 멤버의 대화 이력을 보존하기 위해 익명화된 형태로 보관될 수 있습니다.</p>

            <h2>7. 쿠키</h2>
            <p>도레함은 로그인 상태 유지에 필요한 필수 쿠키만 사용합니다. 광고 트래킹 쿠키는 사용하지 않습니다.</p>

            <h2>8. 미성년자</h2>
            <p>도레함은 만 16세 미만 사용자의 서비스 이용을 허용하지 않습니다. 만 16세 미만 사용자의 정보를 실수로 수집한 것을 발견한 경우 즉시 삭제됩니다.</p>

            <h2>9. 변경 사항</h2>
            <p>이 개인정보 처리방침을 변경할 경우 이메일로 통지하며, 변경 후 계속 서비스를 이용하시면 새 방침에 동의한 것으로 간주됩니다.</p>

            <h2>10. 연락처</h2>
            <p>
              개인정보 관련 문의사항이 있으시면 아래로 연락해주세요:<br />
              이메일: <a href="mailto:privacy@doreham.co.kr">privacy@doreham.co.kr</a><br />
              운영자: Sophia Mosalla (Doreham 창업자)
            </p>
          </>
        ) : (
          <>
            <h2>1. Information We Collect</h2>
            <p>Doreham collects the following information:</p>
            <ul>
              <li><strong>Account info</strong>: Email address (via Google OAuth)</li>
              <li><strong>Profile info</strong>: Name/nickname, date of birth, gender, photo (optional), bio, job title</li>
              <li><strong>Personality & interests</strong>: MBTI, Big Five personality assessment results, activity interests</li>
              <li><strong>Lifestyle info</strong>: Exercise frequency, education level, drinking/smoking habits, children status</li>
              <li><strong>Location info</strong>: Home district (neighborhood level)</li>
              <li><strong>Communication</strong>: Group chat messages, conversations within matched groups</li>
            </ul>

            <h2>2. How We Use Information</h2>
            <p>We use collected information for:</p>
            <ul>
              <li>Matching users and forming groups</li>
              <li>Improving the service and fixing bugs</li>
              <li>Sending match and service-related notification emails</li>
              <li>User support and safety management</li>
            </ul>

            <h2>3. Information Sharing</h2>
            <p><strong>We do not sell your data to third parties.</strong> Information is shared only in these cases:</p>
            <ul>
              <li><strong>Matched group members</strong>: Other users in your group can view your profile</li>
              <li><strong>Partner venues</strong>: Group name and booking info may be shared when you visit</li>
              <li><strong>Legal requirements</strong>: If required by court order or law</li>
              <li><strong>Service providers</strong>: Supabase (database), Resend (email), Vercel (hosting), and similar</li>
            </ul>

            <h2>4. Data Security</h2>
            <p>We use industry-standard security measures to protect your data:</p>
            <ul>
              <li>HTTPS-encrypted communications</li>
              <li>Row Level Security (database-level access control)</li>
              <li>OAuth-based authentication instead of passwords</li>
              <li>Regular backups</li>
            </ul>

            <h2>5. Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
              <li>Access and correct your information</li>
              <li>Delete your account and associated data</li>
              <li>Request a copy of your data</li>
              <li>Object to information processing</li>
            </ul>
            <p>To exercise these rights, contact <a href="mailto:privacy@doreham.co.kr">privacy@doreham.co.kr</a>.</p>

            <h2>6. Data Retention</h2>
            <p>When you delete your account, your profile information is deleted immediately, and backup logs are fully removed within 30 days. Group chat messages may be retained in anonymized form to preserve conversation history for other group members.</p>

            <h2>7. Cookies</h2>
            <p>Doreham only uses essential cookies required to keep you signed in. We don&apos;t use advertising tracking cookies.</p>

            <h2>8. Minors</h2>
            <p>Doreham does not permit users under 16 years old. If we discover we&apos;ve accidentally collected information from someone under 16, it will be deleted immediately.</p>

            <h2>9. Changes to This Policy</h2>
            <p>If we change this privacy policy, we&apos;ll notify you by email. Continued use of the service after changes constitutes agreement to the new policy.</p>

            <h2>10. Contact</h2>
            <p>
              For privacy-related questions, contact us at:<br />
              Email: <a href="mailto:privacy@doreham.co.kr">privacy@doreham.co.kr</a><br />
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