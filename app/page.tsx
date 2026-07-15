'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { DoroSvg, HamiSvg } from '@/components/jellyfish';
import { UserMenu } from '@/components/UserMenu';

type Lang = 'en' | 'ko';
type Status = { kind: 'idle' } | { kind: 'ok' } | { kind: 'err'; msg: string };

export default function HomePage() {
  const [lang, setLang] = useState<Lang>('en');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  useEffect(() => {
    document.body.setAttribute('data-lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.14 }
    );
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ kind: 'idle' });

    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus({
        kind: 'err',
        msg: lang === 'ko'
          ? '올바른 이메일 주소를 입력해주세요.'
          : 'Please enter a valid email address.',
      });
      return;
    }

    setBusy(true);
    const { error } = await supabase.from('waitlist').insert({
      email: trimmed,
      source: 'homepage',
      primary_language: lang,
    });
    setBusy(false);

    if (error) {
      if (error.code === '23505') {
        setStatus({ kind: 'ok' });
        setEmail('');
        return;
      }
      setStatus({
        kind: 'err',
        msg: lang === 'ko'
          ? '문제가 발생했습니다. 잠시 후 다시 시도해주세요.'
          : 'Something went wrong. Please try again in a moment.',
      });
      return;
    }

    setStatus({ kind: 'ok' });
    setEmail('');
  }

  return (
    <>
      {/* NAV */}
      <header className="nav">
        <div className="wrap nav-in">
          <a className="brand" href="#top">
            Doreham <span className="ko-mark">도레함</span>
          </a>
          <nav className="nav-links">
            <a href="#how"><span className="en">How it works</span><span className="ko lang-ko">이용 방법</span></a>
            <a href="#scenes"><span className="en">What you do</span><span className="ko lang-ko">무엇을 하나요</span></a>
            <a href="#why"><span className="en">Why it works</span><span className="ko lang-ko">왜 도레함인가</span></a>
            <a href="#venues"><span className="en">For venues</span><span className="ko lang-ko">가게 파트너</span></a>
          </nav>
          <div className="nav-right">
            <div className="toggle" role="group" aria-label="Language">
              <button aria-pressed={lang === 'ko'} onClick={() => setLang('ko')}>한국어</button>
              <button aria-pressed={lang === 'en'} onClick={() => setLang('en')}>English</button>
            </div>
            <UserMenu lang={lang} />
          </div>
        </div>
      </header>

      <main id="top">
        {/* HERO */}
        <section className="hero">
          <div className="wrap hero-grid">
            <div className="hero-copy">
              <span className="eyebrow">
                <span className="dot"></span>
                <span className="en">Small adventures, real friends</span>
                <span className="ko lang-ko">작은 모험, 진짜 친구</span>
              </span>
              <h1 className="hero-h">
                <span className="en">
                  A world full of connections,<br />
                  <span className="soft">but less and less connected.</span>
                </span>
                <span className="ko lang-ko">
                  연결된 세상,<br />
                  <span className="soft">그러나 더 외로워진 사람들.</span>
                </span>
              </h1>
              <p className="hero-sub">
                <span className="en">Doreham gives you a reason to leave the house — a real activity at a real place with a small, well-matched group. The friendship happens sideways.</span>
                <span className="ko lang-ko">도레함은 집을 나설 이유를 줍니다 — 잘 맞는 작은 그룹과 함께, 진짜 장소에서의 진짜 활동. 우정은 그 곁에서 자연스럽게 생깁니다.</span>
              </p>
              <div className="hero-cta">
                <a href="#join" className="btn btn-primary">
                  <span className="en">Join the beta</span>
                  <span className="ko lang-ko">베타 신청하기</span>
                </a>
                <a href="#how" className="btn btn-ghost">
                  <span className="en">See how it works</span>
                  <span className="ko lang-ko">이용 방법 보기</span>
                </a>
              </div>
              <p className="etym">
                <span className="persian">دورهمی</span>
                <span>
                  <span className="en"><b>Doreham</b> — from Persian <i>dorehami</i>, the warm gathering of friends sitting around together. The name is the product.</span>
                  <span className="ko lang-ko"><b>도레함</b> — 페르시아어 <i>도레하미</i>, 친구들이 둘러앉아 함께하는 따뜻한 모임. 이름이 곧 제품입니다.</span>
                </span>
              </p>
            </div>
            <div className="stage" aria-hidden="true">
              <div className="blob b1"></div>
              <div className="blob b2"></div>
              <div className="duo">
                <DoroSvg />
                <HamiSvg />
              </div>
            </div>
          </div>
        </section>

        {/* Venue owner CTA section */}
        <section className="venue-cta">
          <div className="wrap venue-cta-in">
            <div className="cta-content">
              <div className="cta-emoji">🏪</div>
              <h2><span className="en">Own a business?</span><span className="ko lang-ko">사업자이신가요?</span></h2>
              <p>
                <span className="en">Join Doreham as a venue partner and welcome friendly groups of internationals to your space.</span>
                <span className="ko lang-ko">도레함 파트너 가게가 되어 국제 친구 그룹을 환영해주세요.</span>
              </p>
              <a href="/venues" className="cta-btn">
                <span className="en">Register your venue →</span>
                <span className="ko lang-ko">가게 등록하기 →</span>
              </a>
            </div>
          </div>

          <style jsx>{`
            .venue-cta { background: linear-gradient(135deg, rgba(255, 106, 61, 0.06), rgba(15, 157, 119, 0.04)); padding: 80px 0; border-top: 1px solid var(--ink-12); border-bottom: 1px solid var(--ink-12); }
            .venue-cta-in { text-align: center; max-width: 640px; margin: 0 auto; padding: 0 24px; }
            .cta-emoji { font-size: 56px; margin-bottom: 16px; }
            .venue-cta h2 { font-family: var(--display); font-weight: 800; font-size: 32px; letter-spacing: -0.02em; margin: 0 0 16px; color: var(--ink); }
            .venue-cta p { color: var(--ink-60); font-size: 16px; line-height: 1.6; margin: 0 0 32px; }
            .cta-btn { display: inline-block; background: var(--persimmon); color: #fff; padding: 16px 36px; border-radius: 999px; text-decoration: none; font-weight: 700; font-size: 15px; transition: transform 0.12s, box-shadow 0.12s; }
            .cta-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(255, 106, 61, 0.32); }
          `}</style>
        </section>

        {/* SECOND REASON */}
        <section className="band" id="reason">
          <div className="wrap reveal">
            <div className="sec-label">
              <span className="en">Why this exists</span>
              <span className="ko lang-ko">왜 시작되었나</span>
            </div>
            <p className="quote">
              <span className="en">As an introvert, I needed a second reason to talk to a stranger. A class. A hike. Something to <i>do</i> together. <span className="accent">Doreham is that second reason.</span></span>
              <span className="ko lang-ko">내향적인 저에게는 낯선 사람에게 다가갈 &lsquo;다른 이유&rsquo;가 필요했습니다. 수업, 산책, 함께 <i>할 일</i>. <span className="accent">도레함이 그 이유입니다.</span></span>
            </p>
            <p className="quote-by">— Sophia, founder</p>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how">
          <div className="wrap">
            <div className="reveal">
              <div className="sec-label">
                <span className="en">How it works</span>
                <span className="ko lang-ko">이용 방법</span>
              </div>
              <h2 className="sec-h">
                <span className="en">Three steps. The quest is the cover; the connection is what happens.</span>
                <span className="ko lang-ko">세 단계. 퀘스트는 명분이고, 진짜로 일어나는 건 연결입니다.</span>
              </h2>
            </div>
            <div className="steps">
              <div className="step reveal">
                <div className="num">1</div>
                <h3><span className="en">Get matched</span><span className="ko lang-ko">매칭받기</span></h3>
                <p>
                  <span className="en">A small group of 2–3 near you, matched on interests, personality, and pace — so there&apos;s always an easy conversation in the room.</span>
                  <span className="ko lang-ko">관심사·성격·생활 반경으로 맞춘 2–3명의 작은 그룹. 언제나 대화를 여는 사람이 한 명은 있습니다.</span>
                </p>
              </div>
              <div className="step reveal">
                <div className="num">2</div>
                <h3><span className="en">Accept a quest</span><span className="ko lang-ko">퀘스트 수락</span></h3>
                <p>
                  <span className="en">The app picks a real licensed venue and a small activity, valid for 14 days. Your group chooses the day.</span>
                  <span className="ko lang-ko">앱이 실제 등록된 가게와 작은 활동을 제안합니다. 14일 안에, 그룹이 함께 날짜를 정합니다.</span>
                </p>
              </div>
              <div className="step reveal">
                <div className="num">3</div>
                <h3><span className="en">Show up &amp; meet</span><span className="ko lang-ko">만나기</span></h3>
                <p>
                  <span className="en">Do the quest together, scan the venue QR, earn points. High-fit groups can keep going — friendship forms through repetition.</span>
                  <span className="ko lang-ko">함께 퀘스트를 완료하고 QR을 스캔, 포인트를 얻습니다. 잘 맞은 그룹은 계속 이어집니다 — 우정은 반복에서 자랍니다.</span>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SCENES */}
        <section id="scenes" style={{ background: 'var(--paper-2)', borderTop: '1px solid var(--ink-12)', borderBottom: '1px solid var(--ink-12)' }}>
          <div className="wrap">
            <div className="reveal">
              <div className="sec-label">
                <span className="en">What you do</span>
                <span className="ko lang-ko">무엇을 하나요</span>
              </div>
              <h2 className="sec-h">
                <span className="en">Whatever the shared interest, Doreham helps it take shape.</span>
                <span className="ko lang-ko">어떤 관심사든, 도레함은 그것이 모양을 갖추도록 돕습니다.</span>
              </h2>
              <p className="sec-lead">
                <span className="en">Doro and Hami show you the way — coffee, making things, the outdoors, games, good food and more. Same two friends, every kind of day.</span>
                <span className="ko lang-ko">도로와 하미가 안내합니다 — 커피, 만들기, 바깥 공기, 게임, 맛있는 음식까지. 같은 두 친구, 모든 종류의 하루.</span>
              </p>
            </div>
            <div className="scenes">
              <div className="scene s1 reveal">
                <span className="ic" style={{ fontSize: 32 }}>☕</span>
                <h3><span className="en">Coffee &amp; talk</span><span className="ko lang-ko">커피와 대화</span></h3>
                <p><span className="en">Cafés, quiet hangouts, deep talks.</span><span className="ko lang-ko">카페, 편안한 만남, 깊은 이야기.</span></p>
              </div>
              <div className="scene s2 reveal">
                <span className="ic" style={{ fontSize: 32 }}>🏺</span>
                <h3><span className="en">Make something</span><span className="ko lang-ko">함께 만들기</span></h3>
                <p><span className="en">Pottery, baking, craft workshops.</span><span className="ko lang-ko">도자기, 베이킹, 공예 클래스.</span></p>
              </div>
              <div className="scene s3 reveal">
                <span className="ic" style={{ fontSize: 32 }}>🥾</span>
                <h3><span className="en">Outdoors</span><span className="ko lang-ko">바깥으로</span></h3>
                <p><span className="en">Hikes, walks, easy trails together.</span><span className="ko lang-ko">등산, 산책, 가벼운 트레킹.</span></p>
              </div>
              <div className="scene s4 reveal">
                <span className="ic" style={{ fontSize: 32 }}>📚</span>
                <h3><span className="en">Hidden bookshops</span><span className="ko lang-ko">숨은 서점</span></h3>
                <p><span className="en">Pick a book, share why, discover a place.</span><span className="ko lang-ko">책 한 권 고르고, 이유를 나누기.</span></p>
              </div>
              <div className="scene s5 reveal">
                <span className="ic" style={{ fontSize: 32 }}>🎲</span>
                <h3><span className="en">Games &amp; fun</span><span className="ko lang-ko">보드게임 · 놀이</span></h3>
                <p><span className="en">Board game cafés, mafia nights, casual play.</span><span className="ko lang-ko">보드게임 카페, 마피아, 가벼운 게임.</span></p>
              </div>
              <div className="scene s6 reveal">
                <span className="ic" style={{ fontSize: 32 }}>🍜</span>
                <h3><span className="en">Food &amp; dining</span><span className="ko lang-ko">맛집 · 식사</span></h3>
                <p><span className="en">Local restaurants, food tours, shared tables.</span><span className="ko lang-ko">동네 맛집, 푸드 투어, 함께하는 식탁.</span></p>
              </div>
              <div className="scene s7 reveal">
                <span className="ic" style={{ fontSize: 32 }}>🌿</span>
                <h3><span className="en">Nature &amp; calm</span><span className="ko lang-ko">자연 · 산책</span></h3>
                <p><span className="en">Parks, gardens, slow walks, picnics.</span><span className="ko lang-ko">공원, 정원, 느긋한 산책, 소풍.</span></p>
              </div>
              <div className="scene s8 reveal">
                <span className="ic" style={{ fontSize: 32 }}>🧩</span>
                <h3><span className="en">Escape &amp; puzzles</span><span className="ko lang-ko">방탈출 · 퍼즐</span></h3>
                <p><span className="en">Escape rooms, puzzle cafés, mystery games.</span><span className="ko lang-ko">방탈출, 퍼즐 카페, 미스터리 게임.</span></p>
              </div>
            </div>
          </div>
        </section>

        {/* WHY IT WORKS */}
        <section id="why">
          <div className="wrap">
            <div className="reveal">
              <div className="sec-label"><span className="en">Why it works</span><span className="ko lang-ko">왜 도레함인가</span></div>
              <h2 className="sec-h">
                <span className="en">A few things we believe, deeply.</span>
                <span className="ko lang-ko">저희가 깊이 믿는 몇 가지.</span>
              </h2>
            </div>
            <div className="beliefs">
              <div className="belief reveal">
                <h3>
                  <span className="mk">·</span>
                  <span className="en">True connection still wins</span>
                  <span className="ko lang-ko">진짜 연결이 이깁니다</span>
                </h3>
                <p>
                  <span className="en">No algorithm replaces a real conversation. No follower count replaces a friend who knows your name.</span>
                  <span className="ko lang-ko">어떤 알고리즘도 진짜 대화를 대신하지 못합니다. 팔로워 수가 내 이름을 아는 친구 하나를 대신할 수 없습니다.</span>
                </p>
              </div>
              <div className="belief reveal">
                <h3>
                  <span className="mk">·</span>
                  <span className="en">Ideas grow together</span>
                  <span className="ko lang-ko">아이디어는 함께 자랍니다</span>
                </h3>
                <p>
                  <span className="en">Most of what&apos;s interesting in the world happened because two or three people met and kept talking.</span>
                  <span className="ko lang-ko">세상의 흥미로운 일 대부분은 두세 명이 만나 계속 이야기했기 때문에 일어났습니다.</span>
                </p>
              </div>
              <div className="belief reveal">
                <h3>
                  <span className="mk">·</span>
                  <span className="en">Shared starts last longer</span>
                  <span className="ko lang-ko">함께한 시작이 오래갑니다</span>
                </h3>
                <p>
                  <span className="en">Friendship needs real, repeated interaction. We build the reason to keep showing up.</span>
                  <span className="ko lang-ko">우정에는 진짜 반복된 만남이 필요합니다. 저희는 계속 나올 이유를 만듭니다.</span>
                </p>
              </div>
              <div className="belief hero-belief reveal">
                <h3>
                  <span className="en">Think about how you made friends at school.</span>
                  <span className="ko lang-ko">학창 시절 친구를 어떻게 사귀었는지 떠올려 보세요.</span>
                </h3>
                <p>
                  <span className="en">You didn&apos;t choose to — you were thrown together, day after day, doing the same things. And somehow the closest friendships of your life formed there. We can&apos;t put you back in a classroom, but we can give you the next best thing.</span>
                  <span className="ko lang-ko">의도해서 사귄 게 아닙니다 — 매일 같은 자리에서 같은 일을 하다 보니, 어느새 인생에서 가장 가까운 친구가 되어 있었습니다. 교실을 다시 만들어 드릴 순 없지만, 그 다음으로 가까운 것은 드릴 수 있습니다.</span>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* GEMS + SAFETY */}
        <section id="venues" className="dream" style={{ paddingBottom: 84 }}>
          <div className="wrap split">
            <div className="card gem reveal">
              <span className="badge gem-b">
                ◆ <span className="en">Hidden Gem</span>
                <span className="ko lang-ko">숨은 명소</span>
              </span>
              <h3>
                <span className="en">Discover Korea before everyone else does.</span>
                <span className="ko lang-ko">남들보다 먼저 발견하는 한국.</span>
              </h3>
              <p>
                <span className="en">Doreham quietly surfaces small, independent, genuinely good venues — new, well-rated, under-the-radar — and sends groups who actually fit. Real foot traffic when they need it most.</span>
                <span className="ko lang-ko">도레함은 작고 독립적이면서 진짜 좋은 가게를 조용히 띄웁니다 — 새롭고, 평점 좋고, 아직 덜 알려진 곳. 잘 맞는 그룹을 보내, 가장 필요한 시기에 손님을 만듭니다.</span>
              </p>
              <div className="ticks">
                <div className="tick">
                  ✓ <span className="en">Fit always comes first — paid boosts never override a good match.</span>
                  <span className="ko lang-ko">매칭 품질이 항상 우선 — 유료 노출이 좋은 매칭을 덮지 않습니다.</span>
                </div>
                <div className="tick">
                  ✓ <span className="en">60% of quests stay under ₩10,000 per person.</span>
                  <span className="ko lang-ko">퀘스트의 60%는 1인 1만원 미만으로 유지됩니다.</span>
                </div>
              </div>
            </div>
            <div className="card safe reveal">
              <span className="badge safe-b">
                🛡 <span className="en">Built safe</span>
                <span className="ko lang-ko">안전하게 설계됨</span>
              </span>
              <h3>
                <span className="en">Designed for a first meeting that feels okay.</span>
                <span className="ko lang-ko">첫 만남이 편안하도록 설계.</span>
              </h3>
              <div className="ticks">
                <div className="tick">
                  <svg width="18" height="18" viewBox="0 0 18 18"><path d="M4 9l3 3 7-7" stroke="#0F9D77" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <span className="en">Small groups, never one-on-one for a first meet.</span>
                  <span className="ko lang-ko">작은 그룹으로 — 첫 만남은 절대 1:1이 아닙니다.</span>
                </div>
                <div className="tick">
                  <svg width="18" height="18" viewBox="0 0 18 18"><path d="M4 9l3 3 7-7" stroke="#0F9D77" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <span className="en">Public, licensed venues only — never private homes.</span>
                  <span className="ko lang-ko">공개된 등록 가게에서만 — 개인 공간은 없습니다.</span>
                </div>
                <div className="tick">
                  <svg width="18" height="18" viewBox="0 0 18 18"><path d="M4 9l3 3 7-7" stroke="#0F9D77" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <span className="en">Verified identities, optional photo verification, safety check-ins.</span>
                  <span className="ko lang-ko">본인 인증, 선택적 사진 인증, 안전 체크인.</span>
                </div>
                <div className="tick">
                  <svg width="18" height="18" viewBox="0 0 18 18"><path d="M4 9l3 3 7-7" stroke="#0F9D77" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <span className="en">After every meet-up, members tag each other with structured reviews. Kind tags build a reputation you can see before you go — the way you trust a place with lots of good reviews. Concern flags stay private and go straight to safety, so no one can be review-bombed.</span>
                  <span className="ko lang-ko">매 만남이 끝나면 서로를 구조화된 태그로 남깁니다. 좋은 태그는 미리 볼 수 있는 평판이 됩니다 — 리뷰 많은 가게를 믿고 가듯, 누구를 만나는지 알 수 있죠. 우려 신호는 비공개로 안전팀에만 전달되어, 악의적 평점 폭격은 불가능합니다.</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* THE DREAM */}
        <section className="dream" style={{ paddingTop: 24 }}>
          <div className="wrap reveal">
            <div className="sec-label"><span className="en">Our dream</span><span className="ko lang-ko">우리의 꿈</span></div>
            <h2 className="sec-h">
              <span className="en">A city where no interest is left alone.</span>
              <span className="ko lang-ko">어떤 관심사도 혼자 남겨지지 않는 도시.</span>
            </h2>
            <p className="sec-lead">
              <span className="en">Where cultures meet and grow stronger for it — and where no one in Korea feels like an <span className="alien">alien</span> on their own registration card. We hope to make every place we reach a little less lonely, and a little more alive.</span>
              <span className="ko lang-ko">서로 다른 문화가 만나 더 강해지는 곳 — 그리고 한국에 사는 누구도 <span className="alien">외국인</span>이라는 단어에서 외로움을 느끼지 않는 곳. 저희가 닿는 모든 곳이 조금 덜 외롭고, 조금 더 살아 있기를 바랍니다.</span>
            </p>
          </div>
        </section>

        {/* FINAL CTA with working waitlist */}
        <section className="final" id="join">
          <div className="wrap reveal">
            <h2>
              <span className="en">Find your people. Discover Korea together.</span>
              <span className="ko lang-ko">당신의 사람들을 찾으세요. 함께 한국을 발견하세요.</span>
            </h2>
            <p>
              <span className="en">Doreham is opening soon. Join the beta and be among the first small adventures.</span>
              <span className="ko lang-ko">도레함이 곧 시작됩니다. 베타에 참여해 첫 모험의 시작을 함께하세요.</span>
            </p>
            <div className="waitlist">
              <form onSubmit={handleJoin} className="waitlist-form" noValidate>
                <input
                  type="email"
                  className="waitlist-input"
                  placeholder={lang === 'ko' ? '이메일 주소' : 'your@email.com'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                  aria-label={lang === 'ko' ? '이메일 주소' : 'Email address'}
                  required
                />
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy
                    ? (lang === 'ko' ? '신청 중…' : 'Joining…')
                    : (<>
                        <span className="en">Get early access →</span>
                        <span className="ko lang-ko">사전 신청하기 →</span>
                      </>)
                  }
                </button>
              </form>
              {status.kind === 'ok' && (
                <div className="waitlist-status success" role="status">
                  <span className="en">Thank you — you&apos;re on the list. We&apos;ll be in touch when we launch.</span>
                  <span className="ko lang-ko">감사합니다 — 사전 신청이 완료되었습니다. 출시 시 다시 연락드리겠습니다.</span>
                </div>
              )}
              {status.kind === 'err' && (
                <div className="waitlist-status error" role="alert">{status.msg}</div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer>
        <div className="wrap foot">
          <div>
            © 2026 Doreham 도레함 ·{' '}
            <span className="en">Persian for the gatherings where friendships are made.</span>
            <span className="ko lang-ko">우정이 만들어지는 모임, 페르시아어로 도레함.</span>
          </div>
          <div style={{ display: 'flex', gap: 18 }}>
            <a href="#how"><span className="en">How it works</span><span className="ko lang-ko">이용 방법</span></a>
            <a href="#venues"><span className="en">For venues</span><span className="ko lang-ko">가게 파트너</span></a>
            <a href="#join"><span className="en">Join</span><span className="ko lang-ko">신청</span></a>
          </div>
        </div>
      </footer>
    </>
  );
}