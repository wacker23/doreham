// lib/emails/templates.ts
// Bilingual email templates (Korean + English) for Doreham venue notifications.

const BRAND_COLOR = '#FF6A3D';
const INK = '#1E2230';
const INK_60 = '#575D71';
const PAPER_2 = '#F5F2EB';

/**
 * Wraps content in a bilingual email HTML shell with Doreham branding.
 */
function wrapEmail({
  headerKo,
  headerEn,
  bodyKo,
  bodyEn,
  ctaText,
  ctaUrl,
}: {
  headerKo: string;
  headerEn: string;
  bodyKo: string;
  bodyEn: string;
  ctaText?: { ko: string; en: string };
  ctaUrl?: string;
}): string {
  const ctaBlock = ctaText && ctaUrl
    ? `
      <div style="text-align:center;padding:24px 0 32px;">
        <a href="${ctaUrl}"
           style="display:inline-block;background:${BRAND_COLOR};color:#fff;text-decoration:none;padding:14px 32px;border-radius:999px;font-weight:700;font-size:15px;">
          ${ctaText.ko} · ${ctaText.en}
        </a>
      </div>
    `
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Doreham</title>
</head>
<body style="margin:0;padding:0;background:${PAPER_2};font-family:'Pretendard','Noto Sans KR',-apple-system,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#fff;padding:40px 32px;">

    <!-- Header -->
    <div style="text-align:center;padding-bottom:24px;border-bottom:1px solid #eee;">
      <h1 style="margin:0;font-size:26px;font-weight:800;color:${INK};letter-spacing:-0.02em;">
        Doreham <span style="color:${INK_60};font-size:20px;">도레함</span>
      </h1>
    </div>

    <!-- Korean section -->
    <div style="padding:32px 0 16px;">
      <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:${INK};line-height:1.4;">
        ${headerKo}
      </h2>
      <div style="color:${INK};font-size:15px;line-height:1.7;">
        ${bodyKo}
      </div>
    </div>

    <div style="border-top:1px solid #eee;margin:24px 0;"></div>

    <!-- English section -->
    <div style="padding:8px 0 24px;">
      <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:${INK};line-height:1.4;">
        ${headerEn}
      </h2>
      <div style="color:${INK};font-size:15px;line-height:1.7;">
        ${bodyEn}
      </div>
    </div>

    ${ctaBlock}

    <!-- Footer -->
    <div style="text-align:center;padding-top:24px;border-top:1px solid #eee;color:${INK_60};font-size:13px;">
      <p style="margin:0 0 8px;">
        <strong>Doreham 도레함</strong> · Making friendship easier in Korea
      </p>
      <p style="margin:0 0 4px;">
        문의 · Questions: <a href="mailto:info@doreham.co.kr" style="color:${BRAND_COLOR};">info@doreham.co.kr</a>
      </p>
      <p style="margin:0;">
        <a href="https://doreham.co.kr" style="color:${INK_60};">doreham.co.kr</a>
      </p>
    </div>

  </div>
</body>
</html>`;
}

/**
 * "Your venue has been submitted for review" — sent immediately after submission.
 */
export function venueSubmittedEmail(venueName: string) {
  return {
    subject: `[Doreham] ${venueName} 등록 접수됨 · Registration received`,
    html: wrapEmail({
      headerKo: '가게 등록 요청이 접수되었습니다 ☕',
      headerEn: "We've received your venue registration ☕",
      bodyKo: `
        <p><strong>${venueName}</strong> 등록을 신청해 주셔서 감사합니다!</p>
        <p>도레함 팀에서 <strong>48시간 이내</strong>로 검토 후, 승인 결과를 이메일로 알려드립니다.</p>
        <p>검토 과정에서 추가 정보가 필요하면 이 이메일로 연락드리겠습니다.</p>
        <p>도레함과 함께해 주셔서 감사합니다!</p>
      `,
      bodyEn: `
        <p>Thank you for registering <strong>${venueName}</strong>!</p>
        <p>Our team will review your submission within <strong>48 hours</strong> and email you the decision.</p>
        <p>If we need any additional information, we'll reach out to this email.</p>
        <p>Welcome to Doreham!</p>
      `,
    }),
  };
}

/**
 * "Your venue is approved!" — sent when admin approves.
 */
export function venueApprovedEmail(venueName: string, venueId: string) {
  return {
    subject: `[Doreham] 🎉 ${venueName} 승인 완료 · Approved!`,
    html: wrapEmail({
      headerKo: '축하합니다! 가게가 승인되었습니다 🎉',
      headerEn: 'Congrats! Your venue is approved 🎉',
      bodyKo: `
        <p><strong>${venueName}</strong>이(가) 도레함에 정식으로 등록되었습니다!</p>
        <p>이제 도레함 매칭에서 여러분의 가게가 방문지로 추천될 수 있습니다.</p>
        <p>도레함 그룹이 방문하면 소중한 첫 손님이 되어주세요. 궁금한 점이나 도움이 필요하시면 언제든 info@doreham.co.kr로 연락 주세요!</p>
      `,
      bodyEn: `
        <p><strong>${venueName}</strong> is now officially listed on Doreham!</p>
        <p>Your venue can now be recommended as a visit destination for Doreham groups.</p>
        <p>When Doreham groups visit, they become your valued early customers. Any questions or need help? Reach out to info@doreham.co.kr anytime!</p>
      `,
      ctaText: { ko: '내 가게 보기', en: 'View my venue' },
      ctaUrl: `https://doreham.co.kr/venues/${venueId}`,
    }),
  };
}

/**
 * "Your venue was not approved" — sent when admin rejects.
 */
export function venueRejectedEmail(venueName: string, reason: string) {
  return {
    subject: `[Doreham] ${venueName} 등록 검토 결과 · Registration update`,
    html: wrapEmail({
      headerKo: '가게 등록 검토 결과',
      headerEn: 'Registration review result',
      bodyKo: `
        <p>안녕하세요,</p>
        <p><strong>${venueName}</strong> 등록 요청을 검토했지만, 현재로서는 승인이 어려운 상황입니다.</p>
        <p><strong>사유:</strong><br>${reason}</p>
        <p>추가 문의 사항이나 재신청 관련해서는 info@doreham.co.kr로 연락 주세요. 언제든 도와드리겠습니다.</p>
      `,
      bodyEn: `
        <p>Hello,</p>
        <p>We reviewed your registration for <strong>${venueName}</strong>, but we're unable to approve it at this time.</p>
        <p><strong>Reason:</strong><br>${reason}</p>
        <p>For questions or to resubmit, please reach out to info@doreham.co.kr. We're happy to help.</p>
      `,
    }),
  };
}

/**
 * "You've been matched!" — sent to each user when admin creates a match.
 */
export function matchCreatedEmail({
  recipientName,
  otherMemberNames,
  venueName,
  questTitle,
  questTitleEn,
  questDescription,
  questDescriptionEn,
  daysToComplete,
}: {
  recipientName: string;
  otherMemberNames: string[];       // Names of the OTHER 2 members
  venueName: string;
  questTitle: string;
  questTitleEn: string;
  questDescription: string;
  questDescriptionEn: string;
  daysToComplete: number;
}) {
  const otherNamesJoined = otherMemberNames.join(' & ');

  return {
    subject: `[Doreham] 🌸 새 그룹 매칭! · You've been matched!`,
    html: wrapEmail({
      headerKo: `${recipientName}님, 새 그룹에 매칭되셨어요! 🌸`,
      headerEn: `${recipientName}, you've been matched! 🌸`,
      bodyKo: `
        <p><strong>${otherNamesJoined}</strong>님과 함께 새 그룹에 매칭되셨습니다.</p>
        <div style="background:#F5F2EB;border-radius:12px;padding:16px;margin:20px 0;">
          <p style="margin:0 0 8px;font-weight:700;font-size:16px;color:#1E2230;">
            ${questTitle}
          </p>
          <p style="margin:0 0 12px;color:#575D71;font-size:14px;line-height:1.5;">
            ${questDescription}
          </p>
          <p style="margin:0;font-size:13px;color:#FF6A3D;font-weight:600;">
            📍 ${venueName}
          </p>
        </div>
        <p><strong>${daysToComplete}일 안에</strong> 함께 방문해서 이 퀘스트를 완료해보세요!</p>
        <p style="color:#575D71;font-size:13px;">
          그룹 채팅 기능이 곧 열립니다. 지금은 아래 버튼을 눌러 그룹 정보를 확인하세요.
        </p>
      `,
      bodyEn: `
        <p>You've been matched with <strong>${otherNamesJoined}</strong>.</p>
        <div style="background:#F5F2EB;border-radius:12px;padding:16px;margin:20px 0;">
          <p style="margin:0 0 8px;font-weight:700;font-size:16px;color:#1E2230;">
            ${questTitleEn}
          </p>
          <p style="margin:0 0 12px;color:#575D71;font-size:14px;line-height:1.5;">
            ${questDescriptionEn}
          </p>
          <p style="margin:0;font-size:13px;color:#FF6A3D;font-weight:600;">
            📍 ${venueName}
          </p>
        </div>
        <p>Visit together within <strong>${daysToComplete} days</strong> to complete your quest!</p>
        <p style="color:#575D71;font-size:13px;">
          Group chat is coming soon. For now, tap below to see your group details.
        </p>
      `,
      ctaText: { ko: '내 그룹 보기', en: 'See my group' },
      ctaUrl: `https://doreham.co.kr/matches`,
    }),
  };
}
