'use client';

import { useLang } from '@/lib/hooks/useLang';

/**
 * Privacy policy (개인정보 처리방침), Korean and English.
 * Structure follows the items 개인정보 보호법 제30조 asks for. Keep in sync with:
 *   - components/VolunteerConsentModal.tsx (volunteer photo consent)
 *   - lib/server/consents.ts (PROOF_RETENTION_DAYS)
 *   - app/api/quest-check-in (distance only, no coordinates)
 * Not reviewed by a lawyer yet.
 */

const UPDATED = { en: 'October 1, 2026', ko: '2026년 10월 1일' };
const PRIVACY_EMAIL = 'privacy@doreham.co.kr';

export default function PrivacyPage() {
  const [lang, setLang] = useLang();
  const ko = lang === 'ko';

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
        <a href="/" className="back-link">← {ko ? '홈으로' : 'Back home'}</a>

        <h1>{ko ? '개인정보 처리방침' : 'Privacy Policy'}</h1>
        <p className="last-updated">{ko ? `최종 업데이트: ${UPDATED.ko}` : `Last updated: ${UPDATED.en}`}</p>

        <div className="summary-card">
          <h2>{ko ? '요약' : 'The short version'}</h2>
          {ko ? (
            <ul>
              <li>개인정보는 소규모 그룹 매칭과 퀘스트 운영에만 사용해요.</li>
              <li>개인정보를 판매하거나 광고에 사용하지 않아요.</li>
              <li>프로필 상세, 채팅, 단체 사진은 같은 그룹 멤버만 볼 수 있어요.</li>
              <li>봉사 퀘스트 단체 사진은 90일 뒤 자동으로 삭제돼요.</li>
              <li>체크인 때는 장소와의 거리만 저장하고, 회원님의 위치 좌표는 저장하지 않아요.</li>
              <li>언제든 내 정보를 확인·수정·삭제하고 동의를 철회할 수 있어요.</li>
            </ul>
          ) : (
            <ul>
              <li>We use your data to match you with a small group and run your quests. Nothing else.</li>
              <li>We never sell your data or use it for advertising.</li>
              <li>Only people in your group see your profile details, your group chat and group photos.</li>
              <li>Volunteer quest group selfies are deleted automatically after 90 days.</li>
              <li>At check-in we keep only your distance from the venue, never your coordinates.</li>
              <li>You can see, fix or delete your data and withdraw consent at any time.</li>
            </ul>
          )}
        </div>

        {ko ? <Korean /> : <English />}
      </main>

      <style jsx global>{`
        .legal-nav { background: rgba(245, 242, 235, 0.9); border-bottom: 1px solid var(--ink-12); position: sticky; top: 0; z-index: 10; backdrop-filter: blur(8px); }
        .legal-nav-in { display: flex; align-items: center; justify-content: space-between; height: 68px; }
        .legal-nav .brand { display: flex; align-items: baseline; gap: 9px; font-family: var(--display); font-weight: 800; font-size: 20px; text-decoration: none; color: var(--ink); }
        .legal-nav .ko-mark { color: var(--ink-60); font-weight: 700; font-size: 17px; }
        .legal-nav .toggle { display: inline-flex; border: 1px solid var(--ink-12); border-radius: 999px; overflow: hidden; background: var(--paper-2); }
        .legal-nav .toggle button { border: 0; background: transparent; font-family: var(--body); font-weight: 600; font-size: 13px; padding: 7px 13px; cursor: pointer; color: var(--ink-60); }
        .legal-nav .toggle button[aria-pressed='true'] { background: var(--ink); color: var(--paper); }
        .main-wrap { padding: 32px 24px 80px; max-width: 780px; }
        .main-wrap .back-link { color: var(--ink-60); font-family: var(--body); font-weight: 600; font-size: 14px; text-decoration: none; display: inline-block; margin-bottom: 24px; }
        .main-wrap h1 { font-family: var(--display); font-weight: 800; font-size: 40px; letter-spacing: -0.02em; margin: 0 0 8px; }
        .main-wrap .last-updated { color: var(--ink-60); font-size: 14px; margin: 0 0 40px; }
        .main-wrap .summary-card { background: linear-gradient(135deg, rgba(255, 106, 61, 0.05), rgba(15, 157, 119, 0.03)); border: 1px solid rgba(255, 106, 61, 0.15); border-radius: 20px; padding: 24px 28px; margin-bottom: 48px; }
        .main-wrap .summary-card h2 { font-family: var(--display); font-weight: 800; font-size: 18px; margin: 0 0 12px; color: var(--persimmon); }
        .main-wrap .summary-card ul { list-style: none; padding: 0; margin: 0; }
        .main-wrap .summary-card li { padding-left: 24px; position: relative; }
        .main-wrap .summary-card li:before { content: '✓'; position: absolute; left: 0; color: var(--jade); font-weight: 700; }
        .main-wrap h2 { font-family: var(--display); font-weight: 700; font-size: 22px; margin: 40px 0 12px; color: var(--ink); }
        .main-wrap p, .main-wrap li { font-size: 15px; line-height: 1.7; color: var(--ink); }
        .main-wrap p { margin: 0 0 16px; }
        .main-wrap ul { padding-left: 24px; margin: 0 0 20px; }
        .main-wrap li { margin-bottom: 8px; }
        .main-wrap a { color: var(--persimmon); text-decoration: underline; }
        .main-wrap .table-wrap { overflow-x: auto; margin: 0 0 20px; }
        .main-wrap table { border-collapse: collapse; width: 100%; font-size: 14px; }
        .main-wrap th, .main-wrap td { border: 1px solid var(--ink-12); padding: 8px 10px; text-align: left; vertical-align: top; line-height: 1.55; }
        .main-wrap th { background: var(--paper-2); font-weight: 700; }
      `}</style>
    </>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{head.map((h) => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function English() {
  return (
    <>
      <h2>1. What we collect</h2>
      <Table
        head={['Kind', 'Items', 'Required?']}
        rows={[
          ['Account', 'Email address and Google account ID (sign-in with Google)', 'Required'],
          ['Profile', 'Name or nickname, date of birth, gender, spoken languages, home area (neighborhood level); photo, bio and job', 'Required, except photo, bio and job'],
          ['Personality and interests', 'Big Five test results, MBTI, activity interests', 'Required for matching'],
          ['Lifestyle', 'Exercise, education, drinking, smoking, children', 'Optional'],
          ['Matching and quests', 'Match requests (cities, group size, categories), groups, availability and votes, check-ins (time, distance from the venue, whether you were within 200 m), quest results, strikes, blocks, review tags you give and receive', 'Created as you use the service'],
          ['Messages', 'Group chat messages', 'Created as you use the service'],
          ['Events', 'Events you host (title, description, date and time, place, cost, size, and a poster or photo if you add one), events you join, your comments on events, and reports you send', 'Created as you use the service'],
          ['Points and ranking', 'Points history, level, badges, monthly rank, whether you appear on the leaderboard, and the venue perks you use', 'Created as you use the service'],
          ['Volunteer quests', 'The 1365 activity your group chose (public data), whether you confirmed signing up on 1365, group selfie photos and who is tagged in them, your 1365 certificate, your location when you upload a selfie', 'Photos: required to finish a volunteer quest (with your consent). Certificate and location: optional'],
          ['Venue owners', 'Business name, business registration number, address, contact details, menu, photos, opening hours', 'Required to list a venue'],
          ['Plan', 'Whether you have Doreham+ and until when, the history of your membership (when it started, was extended or ended), and how many match requests you made this month', 'Created as you use the service'],
          ['Push notifications', 'If you turn them on for a browser or phone: the push address your browser gives us for that device, its encryption keys, your language and your browser type', 'Optional'],
          ['Collected automatically', 'Sign-in cookie, your language choice (stored in your browser), server logs (IP address, browser, pages requested)', 'Required to run the service'],
        ]}
      />
      <p>We do not collect resident registration numbers, card numbers or your continuous location.</p>

      <h2>2. Why we use it</h2>
      <ul>
        <li>Matching you with compatible people and forming groups</li>
        <li>Running quests: scheduling, check-in, volunteer attendance, reviews</li>
        <li>Safety and fairness: strikes for no-shows, blocks, handling reports</li>
        <li>Showing community events in your city, and telling you about changes to events you host or join</li>
        <li>Points, levels, badges and the national leaderboard, and partner venue perks</li>
        <li>Notifications and emails about your matches, quests and events</li>
        <li>Fixing problems and improving the service</li>
        <li>Meeting legal obligations</li>
      </ul>

      <h2>3. How long we keep it</h2>
      <Table
        head={['Data', 'Kept until']}
        rows={[
          ['Account, profile, match and quest records', 'You delete your account. Then deleted within 30 days, including backups'],
          ['Group chat messages', 'You delete your account. Your messages are then anonymized so the group chat still makes sense to others'],
          ['Check-ins', 'Kept with the quest record. We store only your distance from the venue, not your coordinates'],
          ['Events you host, events you join, comments and reports', 'You delete your account (then deleted with it). You can delete a comment or cancel an event yourself at any time'],
          ['Points history and perk use', 'You delete your account (then deleted with it)'],
          ['Volunteer group selfies and 1365 certificates (and the location attached to a selfie)', '90 days after upload, then deleted automatically. Deleted sooner if you withdraw your consent'],
          ['Push notification addresses', 'You turn notifications off or sign out on that device, the push service tells us the address expired, or you delete your account'],
          ['Server logs', 'A short period, for security and fixing problems'],
        ]}
      />

      <h2>4. Who can see your information</h2>
      <p><strong>We do not sell your data.</strong> It is shared only as follows:</p>
      <ul>
        <li><strong>Your group</strong>: people in your matched group see your profile, your messages in the group chat and the group&apos;s photos. People who leave a group before it ends can no longer see its photos.</li>
        <li><strong>Partner venues</strong>: owners see how many people checked in and anonymous review tags. They do not see your profile.</li>
        <li><strong>Other members, for points</strong>: your name, photo, city, level and points appear on the national leaderboard, and your level, points and badges on your profile. You can hide yourself from the leaderboard any time (Ranking → My points); your points and perks stay.</li>
        <li><strong>Partner venues, for perks</strong>: when you use a perk, staff see your name, photo and level on your screen. The venue sees how many times each perk was used, not who used it.</li>
        <li><strong>Other members, for events</strong>: signed-in members can see events you host (with your name and photo as the host) and your comments on events. Who is going to an event is shown only to its host and to other people going. The host never sees who reported an event.</li>
        <li><strong>The law</strong>: when a court order or law requires it.</li>
        <li><strong>Service providers</strong>: listed in section 5. They process data only to run Doreham for us.</li>
      </ul>

      <h2>5. Service providers and transfers outside Korea</h2>
      <p>These companies process data for us. Data is sent over encrypted connections while you use the service.</p>
      <Table
        head={['Company (country)', 'What they do', 'Data']}
        rows={[
          ['Supabase Inc. (USA; data stored in the AWS Seoul region, Korea)', 'Database, file storage, sign-in', 'All account and app data, photos'],
          ['Vercel Inc. (USA; our servers run in Seoul)', 'Hosting and server functions; routes translation requests (Vercel AI Gateway)', 'Requests, IP addresses, server logs'],
          ['Resend Inc. (USA)', 'Sending email', 'Email address, name, email content'],
          ['Google LLC (USA)', 'Sign-in with Google', 'Google account ID, email, name'],
          ['Google LLC (USA); as backups when it is unavailable: Anthropic PBC, OpenAI (USA)', 'Automatic translation between Korean and English of public 1365 listings and of the events members post', 'Only the text being translated: listing text, and the title, description and place of an event. Never your name, account or contact details'],
          ['Kakao Corp. (Korea)', 'Address search when registering a venue; map links', 'The address you search'],
          ['The push service of your browser, only if you turn notifications on: Google (Chrome, Android), Apple (Safari, iPhone, Mac), Mozilla (Firefox), Microsoft (Edge) (USA)', 'Delivering notifications to your device', 'The notification text (for example an event title, a group member\'s name, or the start of a new group chat message) and the device\'s push address. The text is encrypted so only your device can read it'],
        ]}
      />
      <p>You can refuse these transfers by not using Doreham or by deleting your account, but we cannot run the service without them.</p>

      <h2>6. Location</h2>
      <ul>
        <li><strong>Check-in</strong>: when you tap check-in, your phone&apos;s location is compared with the venue&apos;s. We save only the distance and whether you were within 200 m.</li>
        <li><strong>Volunteer selfie</strong>: if you allow it, your location when you upload the selfie is saved with the photo and deleted with it.</li>
        <li>We never track your location in the background.</li>
      </ul>

      <h2>7. Photos in volunteer quests</h2>
      <p>
        A volunteer quest finishes with one group selfie taken at the activity. Before your first volunteer quest we ask for your consent.
        The photo is stored privately, shown only to your group through links that expire after an hour, and deleted automatically after 90 days.
        You can withdraw your consent on your profile page at any time. We then delete every group selfie and certificate you uploaded or appear in.
      </p>

      <h2>8. Your rights</h2>
      <ul>
        <li>See, correct or delete your information</li>
        <li>Ask us to stop processing it</li>
        <li>Withdraw a consent (profile page → Privacy)</li>
        <li>Get a copy of your data</li>
      </ul>
      <p>
        Edit your profile in the app, or email <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>. We reply within 10 days.
        You can also contact the Personal Information Infringement Report Center (privacy.kisa.or.kr, call 118) or the Personal Information Dispute Mediation Committee (kopico.go.kr, 1833-6972).
      </p>

      <h2>9. How we protect it</h2>
      <ul>
        <li>Encrypted connections (HTTPS) everywhere</li>
        <li>Database rules so each person can only read what they are allowed to (Row Level Security)</li>
        <li>Secret keys kept on the server only; photos in private storage</li>
        <li>Sign-in through Google, so we never store passwords</li>
        <li>Access to the database limited to the operator; regular security checks</li>
      </ul>

      <h2>10. Cookies and browser storage</h2>
      <p>We use one cookie to keep you signed in and store your language choice in your browser. If you turn on notifications, your browser also keeps a small service worker from doreham.co.kr that only shows our notifications. We do not use advertising or tracking cookies.</p>

      <h2>11. Minors</h2>
      <p>Doreham is not for anyone under 16. If we learn we collected information from someone under 16, we delete it.</p>

      <h2>12. How we delete data</h2>
      <p>Data past its retention period is deleted by automatic daily jobs. Deleted files and database records cannot be recovered.</p>

      <h2>13. Privacy officer</h2>
      <p>
        Sophia Mosalla, founder<br />
        Email: <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>
      </p>

      <h2>14. Changes</h2>
      <p>We will announce changes in the app or by email at least 7 days before they take effect (30 days for changes that reduce your rights).</p>
    </>
  );
}

function Korean() {
  return (
    <>
      <h2>1. 처리하는 개인정보 항목</h2>
      <Table
        head={['구분', '항목', '필수 여부']}
        rows={[
          ['계정', '이메일 주소, Google 계정 식별자 (Google 로그인)', '필수'],
          ['프로필', '이름 또는 닉네임, 생년월일, 성별, 사용 언어, 거주 지역(동네 수준); 사진, 자기소개, 직업', '필수 (사진·자기소개·직업은 선택)'],
          ['성격 및 관심사', 'Big Five 검사 결과, MBTI, 활동 관심사', '매칭에 필수'],
          ['생활 습관', '운동, 학력, 음주, 흡연, 자녀 여부', '선택'],
          ['매칭 및 퀘스트', '매칭 요청(도시, 인원, 카테고리), 그룹, 가능 시간 및 투표, 체크인(시각, 장소와의 거리, 200m 이내 여부), 퀘스트 결과, 경고, 차단, 주고받은 리뷰 태그', '서비스 이용 과정에서 생성'],
          ['메시지', '그룹 채팅 메시지', '서비스 이용 과정에서 생성'],
          ['이벤트', '주최한 이벤트(제목, 설명, 날짜·시간, 장소, 비용, 인원, 올린 경우 포스터나 사진), 참여한 이벤트, 이벤트 댓글, 보낸 신고', '서비스 이용 과정에서 생성'],
          ['포인트와 랭킹', '포인트 기록, 레벨, 배지, 월간 순위, 순위표 공개 여부, 사용한 제휴 가게 혜택', '서비스 이용 과정에서 생성'],
          ['봉사 퀘스트', '그룹이 고른 1365 봉사활동(공개 정보), 1365 신청 완료 여부, 단체 사진과 사진 속 멤버 표시, 1365 봉사활동 확인서, 사진을 올릴 때의 위치', '사진: 봉사 퀘스트 완료에 필요(동의 시). 확인서·위치: 선택'],
          ['제휴 장소 운영자', '상호, 사업자등록번호, 주소, 연락처, 메뉴, 사진, 영업시간', '장소 등록에 필수'],
          ['플랜', 'Doreham+ 이용 여부와 기간, 멤버십 기록(시작·연장·종료 일시), 이번 달 매칭 요청 횟수', '서비스 이용 과정에서 생성'],
          ['푸시 알림', '브라우저나 휴대폰에서 알림을 켠 경우: 브라우저가 그 기기에 발급한 푸시 주소, 암호화 키, 언어 설정, 브라우저 종류', '선택'],
          ['자동 수집', '로그인 쿠키, 언어 설정(브라우저에 저장), 서버 로그(IP 주소, 브라우저 정보, 요청한 페이지)', '서비스 운영에 필수'],
        ]}
      />
      <p>주민등록번호, 카드번호, 지속적인 위치 정보는 수집하지 않아요.</p>

      <h2>2. 처리 목적</h2>
      <ul>
        <li>잘 맞는 사람을 찾아 그룹을 만드는 매칭</li>
        <li>퀘스트 운영: 일정, 체크인, 봉사 참여 확인, 리뷰</li>
        <li>안전과 공정성: 불참 경고, 차단, 신고 처리</li>
        <li>내 도시의 커뮤니티 이벤트 보여주기, 주최하거나 참여한 이벤트의 변경 사항 알림</li>
        <li>포인트, 레벨, 배지, 전국 순위표, 제휴 가게 혜택 제공</li>
        <li>매칭·퀘스트·이벤트 관련 알림과 이메일 발송</li>
        <li>오류 수정 및 서비스 개선</li>
        <li>법령상 의무 이행</li>
      </ul>

      <h2>3. 보유 및 이용 기간</h2>
      <Table
        head={['정보', '보유 기간']}
        rows={[
          ['계정, 프로필, 매칭·퀘스트 기록', '회원 탈퇴 시까지. 탈퇴 후 백업을 포함해 30일 이내 삭제'],
          ['그룹 채팅 메시지', '회원 탈퇴 시까지. 탈퇴 후에는 다른 멤버의 대화 흐름을 위해 익명 처리'],
          ['체크인 기록', '퀘스트 기록과 함께 보관. 위치 좌표는 저장하지 않고 장소와의 거리만 저장'],
          ['주최·참여한 이벤트, 댓글, 신고', '회원 탈퇴 시까지(탈퇴하면 함께 삭제). 댓글 삭제와 이벤트 취소는 언제든 직접 할 수 있어요'],
          ['포인트 기록과 혜택 사용 기록', '회원 탈퇴 시까지(탈퇴하면 함께 삭제)'],
          ['봉사 단체 사진과 1365 확인서 (사진에 붙은 위치 포함)', '올린 날부터 90일 뒤 자동 삭제. 동의를 철회하면 즉시 삭제'],
          ['푸시 알림 주소', '해당 기기에서 알림을 끄거나 로그아웃할 때, 푸시 서비스가 주소 만료를 알릴 때, 또는 탈퇴할 때까지'],
          ['서버 로그', '보안과 오류 확인을 위한 짧은 기간'],
        ]}
      />

      <h2>4. 개인정보의 제공</h2>
      <p><strong>개인정보를 판매하지 않아요.</strong> 다음 경우에만 공유돼요:</p>
      <ul>
        <li><strong>같은 그룹 멤버</strong>: 프로필, 그룹 채팅 메시지, 그룹 사진을 볼 수 있어요. 그룹이 끝나기 전에 나간 사람은 그룹 사진을 볼 수 없어요.</li>
        <li><strong>제휴 장소</strong>: 운영자는 체크인 인원 수와 익명 리뷰 태그만 볼 수 있고, 회원님의 프로필은 볼 수 없어요.</li>
        <li><strong>포인트와 관련된 다른 회원</strong>: 전국 순위표에 이름, 사진, 도시, 레벨, 포인트가 보이고, 프로필에 레벨, 포인트, 배지가 보여요. 순위표에서는 언제든 숨길 수 있어요(랭킹 → 내 포인트). 숨겨도 포인트와 혜택은 그대로예요.</li>
        <li><strong>혜택을 제공하는 제휴 가게</strong>: 혜택을 사용할 때 직원이 화면에서 이름, 사진, 레벨을 봐요. 가게는 혜택별 사용 횟수만 볼 수 있고 누가 사용했는지는 볼 수 없어요.</li>
        <li><strong>이벤트의 다른 회원</strong>: 로그인한 회원은 회원님이 주최한 이벤트(주최자 이름과 사진 포함)와 이벤트 댓글을 볼 수 있어요. 누가 참여하는지는 주최자와 같은 이벤트 참여자에게만 보여요. 주최자는 누가 신고했는지 볼 수 없어요.</li>
        <li><strong>법령</strong>: 법원 명령 등 법령에 따른 요구가 있는 경우</li>
        <li><strong>처리 위탁</strong>: 아래 5항의 업체가 도레함 운영을 위해서만 처리해요.</li>
      </ul>

      <h2>5. 개인정보 처리 위탁 및 국외 이전</h2>
      <p>아래 업체가 서비스 운영을 위해 개인정보를 처리해요. 서비스를 이용할 때 암호화된 네트워크로 전송돼요.</p>
      <Table
        head={['업체 (국가)', '위탁 업무', '항목']}
        rows={[
          ['Supabase Inc. (미국; 데이터는 AWS 서울 리전에 저장)', '데이터베이스, 파일 저장, 로그인', '계정 및 앱의 모든 정보, 사진'],
          ['Vercel Inc. (미국; 서버는 서울에서 실행)', '호스팅 및 서버 기능, 번역 요청 전달(Vercel AI Gateway)', '요청 정보, IP 주소, 서버 로그'],
          ['Resend Inc. (미국)', '이메일 발송', '이메일 주소, 이름, 이메일 내용'],
          ['Google LLC (미국)', 'Google 로그인', 'Google 계정 식별자, 이메일, 이름'],
          ['Google LLC (미국); 장애 시 예비: Anthropic PBC, OpenAI (미국)', '공개된 1365 봉사활동 안내문과 회원이 올린 이벤트의 한국어↔영어 자동 번역', '번역할 글만 보냄: 안내문, 이벤트의 제목·설명·장소. 이름, 계정, 연락처는 보내지 않음'],
          ['(주)카카오 (한국)', '장소 등록 시 주소 검색, 지도 링크', '검색한 주소'],
          ['사용하는 브라우저의 푸시 서비스 (알림을 켠 경우에만): Google(Chrome, Android), Apple(Safari, iPhone, Mac), Mozilla(Firefox), Microsoft(Edge) (미국)', '기기로 알림 전달', '알림 내용(예: 이벤트 제목, 그룹 멤버 이름, 새 그룹 채팅 메시지의 앞부분)과 기기의 푸시 주소. 알림 내용은 암호화되어 회원님의 기기만 읽을 수 있음'],
        ]}
      />
      <p>국외 이전을 거부하려면 서비스 이용을 중단하거나 탈퇴하면 돼요. 다만 이 경우 서비스를 제공할 수 없어요.</p>

      <h2>6. 위치 정보</h2>
      <ul>
        <li><strong>체크인</strong>: 체크인 버튼을 누를 때 휴대폰 위치를 장소 위치와 비교하고, 거리와 200m 이내 여부만 저장해요.</li>
        <li><strong>봉사 단체 사진</strong>: 허용한 경우 사진을 올릴 때의 위치가 사진과 함께 저장되고, 사진과 함께 삭제돼요.</li>
        <li>백그라운드에서 위치를 추적하지 않아요.</li>
      </ul>

      <h2>7. 봉사 퀘스트 사진</h2>
      <p>
        봉사 퀘스트는 활동 장소에서 찍은 단체 사진 한 장으로 완료돼요. 첫 봉사 퀘스트 전에 동의를 받아요.
        사진은 비공개 저장소에 보관되고 1시간 동안만 유효한 링크로 우리 그룹에게만 보여지며, 90일 뒤 자동으로 삭제돼요.
        프로필 페이지에서 언제든 동의를 철회할 수 있고, 철회하면 회원님이 올렸거나 나온 단체 사진과 확인서를 모두 삭제해요.
      </p>

      <h2>8. 정보주체의 권리와 행사 방법</h2>
      <ul>
        <li>개인정보 열람, 정정, 삭제</li>
        <li>처리 정지 요구</li>
        <li>동의 철회 (프로필 → 개인정보)</li>
        <li>내 정보 사본 요청</li>
      </ul>
      <p>
        앱에서 프로필을 수정하거나 <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>로 요청해 주세요. 10일 이내에 답변드려요.
        개인정보침해신고센터(privacy.kisa.or.kr, 국번없이 118)나 개인정보분쟁조정위원회(kopico.go.kr, 1833-6972)에 문의할 수도 있어요.
      </p>

      <h2>9. 안전성 확보 조치</h2>
      <ul>
        <li>모든 통신 HTTPS 암호화</li>
        <li>데이터베이스 행 단위 접근 통제(RLS)로 허용된 정보만 조회</li>
        <li>비밀 키는 서버에만 보관, 사진은 비공개 저장소에 보관</li>
        <li>Google 로그인을 사용해 비밀번호를 저장하지 않음</li>
        <li>데이터베이스 접근은 운영자로 제한, 정기 보안 점검</li>
      </ul>

      <h2>10. 쿠키 및 브라우저 저장소</h2>
      <p>로그인 유지를 위한 쿠키 하나와 브라우저에 저장하는 언어 설정만 사용해요. 알림을 켜면 브라우저에 도레함 알림만 표시하는 작은 서비스 워커가 함께 저장돼요. 광고·추적 쿠키는 사용하지 않아요.</p>

      <h2>11. 미성년자</h2>
      <p>도레함은 만 16세 미만은 이용할 수 없어요. 만 16세 미만의 정보를 수집한 사실을 알게 되면 삭제해요.</p>

      <h2>12. 파기 절차 및 방법</h2>
      <p>보유 기간이 지난 정보는 매일 실행되는 자동 작업으로 삭제돼요. 삭제된 파일과 데이터베이스 기록은 복구할 수 없어요.</p>

      <h2>13. 개인정보 보호책임자</h2>
      <p>
        소피아 모살라 (대표)<br />
        이메일: <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>
      </p>

      <h2>14. 처리방침 변경</h2>
      <p>변경 사항은 시행 7일 전(회원님의 권리를 줄이는 변경은 30일 전)까지 앱이나 이메일로 알려드려요.</p>
    </>
  );
}
