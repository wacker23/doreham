import type { CSSProperties, ReactNode } from 'react';

/**
 * Doreham sea icons, everyday size (24 grid). Replaces the emoji the app used to show.
 * Line = ink, `c` = shell-cream fill, `a` = persimmon accent line, `af` = accent fill, `n` = ink fill.
 * Colours and line weight live in globals.css (.dh-ic). Design: "Doreham Sea Icons" canvas.
 *
 *   <Icon name="location" />            20 px, decorative
 *   <Icon name="bell" size={24} label="Notifications" />
 *   <Icon name="matches" tone="on" />   tab bar: active (coral fill) / "off" (grey outline)
 */

const HEART_SMALL = 'M12 5.6 10.6 4.3c-.8-.8-.2-2 .8-1.7.3.1.5.3.6.5.1-.2.3-.4.6-.5 1-.3 1.6.9.8 1.7z';
const STAR = 'M12 3.8 14.35 9.36 20.37 9.88 15.8 13.84 17.17 19.72 12 16.6 6.83 19.72 8.2 13.84 3.63 9.88 9.65 9.36Z';
const JELLY_BELL = 'M4.5 12a7.5 7.5 0 0 1 15 0c0 1-.7 1.5-1.6 1.5H6.1c-.9 0-1.6-.5-1.6-1.5z';
const JELLY_LEGS = 'M7.5 13.5c-.7 1.6.7 2.8 0 5M12 13.5c.7 1.8-.7 3.2 0 6M16.5 13.5c-.7 1.6.7 2.8 0 5';
const ZODIAC_RING = (
  <>
    <circle className="c" cx="12" cy="12" r="10" />
  </>
);
const ZODIAC_SHINE = <path className="a" d="M4.6 9a8 8 0 0 1 2.6-3.6" />;
const WAVE_LINE = 'M2.5 21.5h19';
const BIG_WAVE =
  'M3 19.5c2.5 0 3.8-2 4.6-4.8C9 10 11.6 5.5 16.5 5.5c2.8 0 4.5 1.8 4.5 3.8 0 1.6-1.2 2.8-2.7 2.8-1.6 0-2.5-1.1-2.3-2.4-2.2.3-3.5 2.6-4 5.3-.5 2.8.2 4.5 2.2 4.5z';
const CAP = (
  <>
    <path className="c" d="M6.5 11v4.5c1.6 1.6 3.4 2.4 5.5 2.4s3.9-.8 5.5-2.4V11" />
    <path className="c" d="M2.5 9 12 4.5 21.5 9 12 13.5z" />
    <path className="a" d="M21.5 9v5" />
    <circle className="af" cx="21.5" cy="15" r="1" />
  </>
);

export const ICONS = {
  // ---- App tabs ----
  matches: (
    <>
      <path className="c" d="M2.5 11.2a4.6 4.6 0 0 1 9.2 0c0 .7-.5 1-1.2 1H3.7c-.7 0-1.2-.3-1.2-1z" />
      <path d="M4.6 12.2c-.5 1.4.5 2.4 0 4M7.1 12.2c.5 1.6-.5 2.8 0 5M9.6 12.2c-.5 1.4.5 2.4 0 4" />
      <path className="c" d="M12.3 11.2a4.6 4.6 0 0 1 9.2 0c0 .7-.5 1-1.2 1h-6.8c-.7 0-1.2-.3-1.2-1z" />
      <path d="M14.4 12.2c-.5 1.4.5 2.4 0 4M16.9 12.2c.5 1.6-.5 2.8 0 5M19.4 12.2c-.5 1.4.5 2.4 0 4" />
      <path className="af" d={HEART_SMALL} />
    </>
  ),
  events: (
    <>
      <path className="c" d="M3.5 20.5 7 10a5 5 0 0 1 7 7z" />
      <path d="M5.3 15.2l3.5 3.5M6.4 12.1l5.5 5.5" />
      <path className="a" d="M13.5 8.5c.8-1.6 2.4-2.2 4-1.6M15.5 13.5c1.4-.6 3-.2 4 1M15.8 2.6v1.8M14.9 3.5h1.8" />
      <circle className="af" cx="11.5" cy="4.5" r="1" />
      <circle className="af" cx="19.3" cy="4.8" r="1" />
      <circle className="af" cx="20.5" cy="10" r=".9" />
    </>
  ),
  ranking: (
    <>
      <path className="c" d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M7 5.5H4.5v1.2A3.3 3.3 0 0 0 7.6 10M17 5.5h2.5v1.2a3.3 3.3 0 0 1-3.1 3.3M12 14v3" />
      <path className="c" d="M9.8 17h4.4l.8 3.5H9z" />
      <path className="a" d="M7.4 8c1-.8 2-.8 3 0s2 .8 3 0 2-.8 3.2-.2" />
    </>
  ),
  me: (
    <>
      <path className="c" d={JELLY_BELL} />
      <path d={JELLY_LEGS} />
      <circle className="n" cx="9.6" cy="9.8" r=".9" />
      <circle className="n" cx="14.4" cy="9.8" r=".9" />
      <path className="a" d="M7.2 8.3a5.6 5.6 0 0 1 2.2-2.4" />
    </>
  ),
  venue: (
    <>
      <path className="c" d="M5 11V20h14v-9" />
      <path className="c" d="M4 8.5 5.5 4h13L20 8.5z" />
      <path className="c" d="M4 8.5a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0" />
      <path className="a" d="M10 4.2l-.5 4.3M14 4.2l.5 4.3" />
      <path d="M10 20v-4.5h4V20M3 20h18" />
    </>
  ),

  // ---- Where & when ----
  location: (
    <>
      <path className="c" d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11z" />
      <path className="a" d="M9 10c1-.8 2-.8 3 0s2 .8 3 0" />
    </>
  ),
  date: (
    <>
      <rect className="c" x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
      <path className="a" d="M7 14.8c1.2-1 2.5-1 3.7 0s2.5 1 3.7 0 1.9-.8 2.6-.4" />
    </>
  ),
  time: (
    <>
      <circle className="c" cx="12" cy="12" r="8.5" />
      <path d="M12 7.2V12" />
      <path className="a" d="M12 12l3.2 2.2" />
    </>
  ),
  reminder: (
    <>
      <circle className="c" cx="12" cy="13" r="7.5" />
      <path d="M12 9.2V13l2.6 1.8M7.2 19.4 6 21M16.8 19.4 18 21" />
      <path className="a" d="M3.6 6.2 6.4 3.6M20.4 6.2 17.6 3.6" />
    </>
  ),
  online: (
    <>
      <circle className="c" cx="12" cy="12" r="8.5" />
      <path d="M12 3.5c-2.8 2.6-2.8 14.4 0 17M12 3.5c2.8 2.6 2.8 14.4 0 17" />
      <path className="a" d="M4 9.3c2.7-1.2 5.3-1.2 8 0s5.3 1.2 8 0M4 14.7c2.7-1.2 5.3-1.2 8 0s5.3 1.2 8 0" />
    </>
  ),
  price: (
    <>
      <circle className="c" cx="12" cy="12" r="8.5" />
      <path d="M8.3 8.5 9.9 15.5 12 10l2.1 5.5 1.6-7" />
      <path className="a" d="M7.5 11.6h9" />
    </>
  ),
  map: (
    <>
      <path className="c" d="M3.5 6.3 8.7 4.5l6.6 2 5.2-1.8v13.2l-5.2 1.8-6.6-2-5.2 1.8z" />
      <path d="M8.7 4.5v13.2M15.3 6.5v13.2" />
      <path className="a" d="M5.5 14.5c1.3-2 2.3-2.8 4.6-1.4s3.8.6 5.2-1.6 2.3-2.4 3.2-2.1" strokeDasharray="1.4 1.9" />
    </>
  ),
  people: (
    <>
      <circle className="c" cx="9" cy="8" r="3.3" />
      <path className="c" d="M3.3 20a5.7 5.7 0 0 1 11.4 0z" />
      <path className="a" d="M15.3 4.9a3.3 3.3 0 0 1 0 6.3M17.3 13.9a5.7 5.7 0 0 1 3.4 6.1" />
    </>
  ),

  // ---- People & groups ----
  chat: (
    <>
      <path className="c" d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5h-7l-4.2 3.8V16h-.1A2.5 2.5 0 0 1 4 13.5z" />
      <circle className="af" cx="8.6" cy="10" r="1" />
      <circle className="af" cx="12" cy="10" r="1" />
      <circle className="af" cx="15.4" cy="10" r="1" />
    </>
  ),
  hello: (
    <>
      <path className="c" d="M4 12.5a6.5 6.5 0 0 1 13 0c0 .9-.6 1.3-1.4 1.3H5.4c-.8 0-1.4-.4-1.4-1.3z" />
      <path d="M6.8 13.8c-.6 1.5.6 2.6 0 4.6M10.5 13.8c.6 1.7-.6 3 0 5.2M14.2 13.8c1.8.2 3.4-.6 4.6-2.6.6-1.1.9-2.4.8-3.6" />
      <path className="a" d="M21.4 5.2c.5.6.8 1.3.8 2.1M20.2 3.4c.4.2.8.5 1 .9" />
      <circle className="n" cx="8.6" cy="10.2" r=".8" />
      <circle className="n" cx="12.4" cy="10.2" r=".8" />
    </>
  ),
  join: (
    <>
      <circle className="c" cx="10" cy="8" r="3.4" />
      <path className="c" d="M4 20a6 6 0 0 1 12 0z" />
      <path className="a" d="M18.5 8.5v5M16 11h5" />
    </>
  ),
  matchFound: (
    <>
      <path className="c" d="M10 6V3.5h4V6l1.6 2.3c.4.5.6 1.2.6 1.8V19a2 2 0 0 1-2 2h-4.4a2 2 0 0 1-2-2v-8.9c0-.6.2-1.3.6-1.8z" />
      <path d="M9.6 3.5h4.8" />
      <path className="af" d="M12 17 10.6 15.7c-.8-.8-.2-2 .8-1.7.3.1.5.3.6.5.1-.2.3-.4.6-.5 1-.3 1.6.9.8 1.7z" />
      <path className="a" d="M8.4 11.3h7.2" />
    </>
  ),
  sad: (
    <>
      <path className="c" d={JELLY_BELL} />
      <path d="M7.5 13.5c-.4 2 .4 3.4 0 5.5M12 13.5c.3 2.2-.3 3.8 0 6.3M16.5 13.5c.4 2-.4 3.4 0 5.5M10.4 12c1-.6 2.2-.6 3.2 0" />
      <circle className="n" cx="9.6" cy="9.4" r=".9" />
      <circle className="n" cx="14.4" cy="9.4" r=".9" />
      <path className="af" d="M16.4 10.2c.5.8.8 1.3.8 1.7a.8.8 0 0 1-1.6 0c0-.4.3-.9.8-1.7z" />
    </>
  ),
  volunteer: (
    <>
      <path className="af" d="M12 11.6 9.4 9.2c-1.6-1.5-.5-3.8 1.4-3.3.5.1.9.5 1.2.9.3-.4.7-.8 1.2-.9 1.9-.5 3 1.8 1.4 3.3z" />
      <path className="c" d="M2.5 12.5c1.8 0 3.3 1 4.3 2.6L8.3 17.5h7.4l1.5-2.4c1-1.6 2.5-2.6 4.3-2.6-.3 4.6-4 8-9.5 8s-9.2-3.4-9.5-8z" />
    </>
  ),
  heart: (
    <>
      <path className="c" d="M12 20s-7.5-4.6-7.5-10A4.25 4.25 0 0 1 12 7.4 4.25 4.25 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" />
      <path className="a" d="M7.4 9.6a2.2 2.2 0 0 1 1.8-1.8" />
    </>
  ),
  helpful: (
    <>
      <path className="c" d="M7.5 10.5v10h-3a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z" />
      <path className="c" d="M7.5 10.5l3.6-6.3c.3-.5.8-.7 1.3-.7 1.2 0 2 1.1 1.8 2.2l-.6 3.3h5a2 2 0 0 1 2 2.4l-1.3 6.4a2 2 0 0 1-2 1.7H7.5z" />
      <circle className="af" cx="5.5" cy="17.5" r=".8" />
    </>
  ),
  host: (
    <>
      <rect className="c" x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.8 11a6.2 6.2 0 0 0 12.4 0M12 17.2v3.3M9 20.5h6" />
      <path className="a" d="M10.8 6.5h2.4M10.8 9h2.4" />
    </>
  ),
  icebreaker: (
    <>
      <path className="c" d="M4.5 14 9 6.5l2.6 3 2.2-2.2L19.5 14z" />
      <path d="M6 16.5l2.5 4h7l2.5-4" strokeDasharray="1.6 2.2" />
      <path className="a" d="M2.5 14c1.6-.9 3.2-.9 4.8 0s3.2.9 4.8 0 3.2-.9 4.8 0 3.2.9 4.8 0" />
    </>
  ),
  vote: (
    <>
      <path className="c" d="M8.5 12V4.5h7V12" />
      <path className="a" d="M10.5 8.2l1.2 1.2 2.3-2.4" />
      <path className="c" d="M3.5 12h17v7a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19z" />
      <path d="M7.5 15.5h9" />
    </>
  ),
  bowl: (
    <>
      <path className="c" d="M3.5 12h17c-.3 4.5-3.8 8-8.5 8s-8.2-3.5-8.5-8z" />
      <path d="M9 20h6" />
      <path className="a" d="M13.5 10.5 19.5 3.5M16 10.5l5-4.5M7 9.5c-.6-.8-.6-1.6 0-2.4s.6-1.6 0-2.4M10 9.5c-.6-.8-.6-1.6 0-2.4" />
    </>
  ),
  goal: (
    <>
      <circle className="c" cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="5" />
      <circle className="af" cx="12" cy="12" r="1.8" />
    </>
  ),

  // ---- Status ----
  done: (
    <>
      <circle className="c" cx="12" cy="12" r="8.5" />
      <path className="a" d="M8 12.4l2.7 2.7L16.2 9.5" style={{ strokeWidth: 2 }} />
    </>
  ),
  pending: (
    <>
      <path d="M6.5 3.5h11M6.5 20.5h11" />
      <path className="c" d="M8 3.5v2.3c0 1.6.8 3 2.1 3.8L12 10.8l1.9-1.2C15.2 8.8 16 7.4 16 5.8V3.5z" />
      <path className="c" d="M8 20.5v-2.3c0-1.6.8-3 2.1-3.8L12 13.2l1.9 1.2c1.3.8 2.1 2.2 2.1 3.8v2.3z" />
      <circle className="af" cx="12" cy="18.4" r="1.2" />
      <circle className="af" cx="10.4" cy="16.6" r=".6" />
      <circle className="af" cx="13.3" cy="15.8" r=".55" />
    </>
  ),
  cancelled: (
    <>
      <circle className="c" cx="12" cy="12" r="8.5" />
      <path className="a" d="M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6" />
    </>
  ),
  warning: (
    <>
      <path className="c" d="M10.3 4.6a2 2 0 0 1 3.4 0l7.2 12.5a2 2 0 0 1-1.7 3H4.8a2 2 0 0 1-1.7-3z" />
      <path className="a" d="M12 9.5v4.2" />
      <circle className="af" cx="12" cy="16.6" r="1" />
    </>
  ),
  levelUp: (
    <>
      <path d="M12 20.5V5M6.5 10.5 12 5l5.5 5.5" />
      <circle className="a" cx="17.5" cy="17" r="1.6" />
      <circle className="a" cx="6.5" cy="16" r="1.1" />
      <circle className="a" cx="18.8" cy="12.8" r=".7" />
    </>
  ),
  lock: (
    <>
      <rect className="c" x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
      <circle className="af" cx="12" cy="14.6" r="1.3" />
      <path className="a" d="M12 15.5v2" />
    </>
  ),
  sparkle: (
    <>
      <path className="c" d="M11 3c.7 4.4 2.2 5.9 6.6 6.6-4.4.7-5.9 2.2-6.6 6.6-.7-4.4-2.2-5.9-6.6-6.6C8.8 8.9 10.3 7.4 11 3z" />
      <path className="a" d="M18 15v4M16 17h4" />
      <circle className="af" cx="6" cy="18.8" r="1" />
    </>
  ),
  star: (
    <>
      <path className="c" d={STAR} />
      <circle className="af" cx="12" cy="12.4" r="1" />
    </>
  ),
  starFilled: (
    <>
      <path className="af" d={STAR} />
      <path d={STAR} />
    </>
  ),
  priority: (
    <>
      <path className="c" d="M13.2 3 5.5 13.3h5.6L10.2 21l8.3-10.8h-5.8z" />
      <path className="a" d="M8.4 11.3l2.6-3.4" />
    </>
  ),
  explore: (
    <>
      <circle className="c" cx="12" cy="12" r="8.5" />
      <path className="af" d="M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z" />
      <circle className="n" cx="12" cy="12" r=".9" />
    </>
  ),
  perk: (
    <>
      <path className="c" d="M3.5 14.5h17c-.4 3.5-4 6-8.5 6s-8.1-2.5-8.5-6z" />
      <path className="pk" d="M12 13 5.2 8.2A2 2 0 0 1 7.6 5.4 2.1 2.1 0 0 1 10.6 4.1 2.1 2.1 0 0 1 13.4 4.1 2.1 2.1 0 0 1 16.4 5.4 2 2 0 0 1 18.8 8.2z" />
      <path d="M12 13 9.3 4.6M12 13V4M12 13l2.7-8.4" />
      <circle className="c" cx="12" cy="14.6" r="2.3" />
      <path className="a" d="M10.8 13.9a1.2 1.2 0 0 1 .8-.8" />
    </>
  ),
  tag: (
    <>
      <path className="c" d="M3.5 4.8v6.1c0 .5.2 1 .6 1.4l7.7 7.7a2 2 0 0 0 2.8 0l5.4-5.4a2 2 0 0 0 0-2.8L12.3 4.1c-.4-.4-.9-.6-1.4-.6H4.8c-.7 0-1.3.6-1.3 1.3z" />
      <circle className="af" cx="8" cy="8" r="1.4" />
    </>
  ),

  // ---- Actions & things ----
  camera: (
    <>
      <path className="c" d="M3.5 8.7a2 2 0 0 1 2-2h2.3l1.6-2.2h5.2l1.6 2.2h2.3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="13" r="3.4" />
      <circle className="af" cx="17.4" cy="9.6" r=".9" />
    </>
  ),
  image: (
    <>
      <rect className="c" x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path d="M3.8 16.5c2.6-2.4 5.2-2.4 7.8 0s5.2 2.4 8.6-.6" />
      <circle className="af" cx="15.5" cy="9" r="1.7" />
    </>
  ),
  search: (
    <>
      <circle className="c" cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5.2 5.2" />
      <circle className="a" cx="8.7" cy="9" r="1.3" />
      <circle className="a" cx="11.6" cy="12" r=".7" />
    </>
  ),
  edit: (
    <>
      <path className="c" d="M15.6 4.4a2 2 0 0 1 2.8 0l1.2 1.2a2 2 0 0 1 0 2.8L9 19H5v-4z" />
      <path d="M13.5 6.5l4 4" />
      <path className="a" d="M5.2 15.2l3.6 3.6" />
    </>
  ),
  trash: (
    <>
      <path d="M4 6.5h16M9.5 6.5V4.5h5v2" />
      <path className="c" d="M6 6.5l1 13a1.6 1.6 0 0 0 1.6 1.5h6.8a1.6 1.6 0 0 0 1.6-1.5l1-13z" />
      <path className="a" d="M10 10.5v6M14 10.5v6" />
    </>
  ),
  external: (
    <>
      <path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
      <path className="a" d="M14 4h6v6M20 4l-8.5 8.5" />
    </>
  ),
  send: (
    <>
      <path className="c" d="M20.5 3.5 3.5 10.6l6.8 3.1 3.1 6.8z" />
      <path className="a" d="M20.5 3.5l-10.2 10.2" />
    </>
  ),
  qr: (
    <>
      <rect className="c" x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect className="c" x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect className="c" x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect className="n" x="6" y="6" width="2" height="2" rx=".5" />
      <rect className="n" x="16" y="6" width="2" height="2" rx=".5" />
      <rect className="n" x="6" y="16" width="2" height="2" rx=".5" />
      <path className="a" d="M14 14h2.5v2.5M20 14v.01M14 20h.01M17.5 18.5H20V20" />
    </>
  ),
  print: (
    <>
      <path d="M7 9V3.5h10V9" />
      <rect className="c" x="3.5" y="9" width="17" height="8" rx="2" />
      <rect className="c" x="7" y="14" width="10" height="6.5" rx="1" />
      <circle className="af" cx="17" cy="11.8" r=".9" />
    </>
  ),
  stats: (
    <>
      <path d="M4 20.5h16" />
      <rect className="c" x="5" y="13" width="3" height="7.5" rx="1" />
      <rect className="c" x="10.5" y="9.5" width="3" height="11" rx="1" />
      <rect className="c" x="16" y="11.5" width="3" height="9" rx="1" />
      <path className="a" d="M3.5 7c2-1.8 4-1.8 6 0s4 1.8 6 0 3.4-1.6 5-.6" />
    </>
  ),
  tip: (
    <>
      <path className="c" d="M12 3.5a6 6 0 0 0-3.6 10.8c.4.3.6.8.6 1.3v1.9h6v-1.9c0-.5.2-1 .6-1.3A6 6 0 0 0 12 3.5z" />
      <path d="M9.5 20.5h5" />
      <path className="a" d="M10.6 14.5c-.5-1-.5-2 0-3M13.4 14.5c.5-1 .5-2 0-3" />
    </>
  ),
  announce: (
    <>
      <path className="c" d="M4 10v4.2a1 1 0 0 0 1 1h2.5l8.5 4.3V4.5L7.5 8.8H5a1 1 0 0 0-1 1.2z" />
      <path d="M8.5 15.2l1 4.3" />
      <path className="a" d="M18.6 9.2c.9.7 1.4 1.7 1.4 2.8s-.5 2.1-1.4 2.8" />
    </>
  ),
  doc: (
    <>
      <path className="c" d="M6 3.5h8.5l4 4v12a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 6 3.5z" />
      <path d="M14.5 3.5v4h4M8 12h7M8 15.5h4" />
      <circle className="af" cx="15.5" cy="17.5" r="1.5" />
    </>
  ),
  key: (
    <>
      <circle className="c" cx="8" cy="8.5" r="4.5" />
      <path d="M11.2 11.7l8.3 8.3M16.2 16.7l2-2M18.5 19l1.6-1.6" />
      <circle className="af" cx="7" cy="7.5" r="1.1" />
    </>
  ),
  study: CAP,
  work: (
    <>
      <rect className="c" x="3.5" y="7" width="17" height="12.5" rx="2.5" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17" />
      <rect className="af" x="10.5" y="11.2" width="3" height="2.6" rx=".6" />
    </>
  ),
  bell: (
    <>
      <path className="c" d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.6 2H4.4z" />
      <path d="M10 20.8a2.1 2.1 0 0 0 4 0" />
      <path className="a" d="M19.6 4.8a6.5 6.5 0 0 1 1.7 3.6M4.4 4.8a6.5 6.5 0 0 0-1.7 3.6" />
    </>
  ),
  plus: (
    <>
      <circle className="c" cx="11" cy="13" r="7" />
      <path className="a" d="M7.8 11a3.6 3.6 0 0 1 2.6-2.3" />
      <path className="af" d="M18.5 2.2c.3 1.9 1 2.6 2.9 2.9-1.9.3-2.6 1-2.9 2.9-.3-1.9-1-2.6-2.9-2.9 1.9-.3 2.6-1 2.9-2.9z" />
    </>
  ),
  card: (
    <>
      <rect className="c" x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 9.5h19" />
      <path className="a" d="M6 15h4" />
    </>
  ),
  shield: (
    <>
      <path className="c" d="M12 21s7.5-3.6 7.5-9.5V5.6L12 3 4.5 5.6v5.9C4.5 17.4 12 21 12 21z" />
      <path className="a" d="M8.7 12l2.3 2.3 4.4-4.6" />
    </>
  ),
  help: (
    <>
      <circle className="c" cx="12" cy="12" r="8.5" />
      <path d="M9.4 9.4a2.7 2.7 0 0 1 5.2.9c0 1.8-2.6 2.4-2.6 4" />
      <circle className="af" cx="12" cy="17" r="1" />
    </>
  ),
  logout: (
    <>
      <path d="M13.5 20.5h-7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h7" />
      <path className="a" d="M10.5 12h10M17 8.5l3.5 3.5-3.5 3.5" />
    </>
  ),
  at: (
    <>
      <circle cx="12" cy="12" r="3.6" />
      <path d="M15.6 8.5v4.4a2.6 2.6 0 0 0 5.2 0V12a8.8 8.8 0 1 0-3.5 7" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V5.5l11-2V16" />
      <circle className="c" cx="6.5" cy="18" r="2.5" />
      <circle className="c" cx="17.5" cy="16" r="2.5" />
      <path className="a" d="M9 9.5l11-2" />
    </>
  ),
  admin: (
    <>
      <path className="c" d="M12 21s7.5-3.6 7.5-9.5V5.6L12 3 4.5 5.6v5.9C4.5 17.4 12 21 12 21z" />
      <path className="af" d="M12.6 7 9 12.6h2.6L11 17l3.8-5.8h-2.7z" />
    </>
  ),

  // ---- Personality ----
  energizer: (
    <>
      <path className="c" d="M6.5 13.5a5.5 5.5 0 0 1 11 0c0 .7-.5 1.1-1.2 1.1H7.7c-.7 0-1.2-.4-1.2-1.1z" />
      <path d="M9 14.6c-.5 1.3.5 2.3 0 4M12 14.6c.5 1.5-.5 2.7 0 4.9M15 14.6c-.5 1.3.5 2.3 0 4" />
      <path className="a" d="M12 3v2.2M5.4 5.8l1.5 1.5M18.6 5.8l-1.5 1.5M3 12h2M19 12h2" />
    </>
  ),
  observer: (
    <>
      <path className="c" d="M14 3.5a6.5 6.5 0 1 0 5.4 10A5.2 5.2 0 0 1 14 3.5z" />
      <path className="a" d="M3 18.5c1.5-.8 3-.8 4.5 0s3 .8 4.5 0 3-.8 4.5 0 3 .8 4.5 0" />
      <path d="M8 21.5h8" />
    </>
  ),
  explorer: (
    <>
      <path d="M10.5 10.5V7.5h4v3M12.5 7.5V4.5h3" />
      <path className="c" d="M3 15a4.5 4.5 0 0 1 4.5-4.5h8.5a4.5 4.5 0 0 1 0 9H7.5A4.5 4.5 0 0 1 3 15z" />
      <circle className="af" cx="8.5" cy="15" r="1.2" />
      <circle className="af" cx="12.5" cy="15" r="1.2" />
      <path className="a" d="M20.5 13v4" />
      <circle className="c" cx="5" cy="5.5" r="1.4" />
    </>
  ),
  anchor: (
    <>
      <circle className="c" cx="12" cy="5" r="2" />
      <path d="M12 7v13.5M8.5 10.5h7M4.5 13.5c0 4 3.4 7 7.5 7s7.5-3 7.5-7" />
      <path className="a" d="M3 15.2l1.5-1.7 1.7 1.5M17.8 15l1.7-1.5 1.5 1.7" />
    </>
  ),
  warmth: (
    <>
      <circle className="c" cx="12" cy="12" r="4.8" />
      <path className="a" d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4" />
      <path d="M10.2 12.8c1 .9 2.6.9 3.6 0" />
    </>
  ),
  direct: (
    <>
      <circle className="c" cx="11" cy="13" r="7.5" />
      <circle cx="11" cy="13" r="3.8" />
      <circle className="af" cx="11" cy="13" r="1.3" />
      <path className="a" d="M11 13l9-9M16.2 3.8H20v3.8" />
    </>
  ),
  planner: (
    <>
      <rect className="c" x="3.5" y="4" width="17" height="16" rx="2" />
      <path className="a" d="M6.5 16.5c2-3.5 4-1 6-3.5s2.5-4.5 3.5-5" strokeDasharray="1.4 1.8" />
      <path d="M15.5 6l2.2 2.2M17.7 6l-2.2 2.2" />
      <circle className="n" cx="6.5" cy="16.5" r="1" />
    </>
  ),
  freeSpirit: (
    <>
      <path d="M5 9c1.8-1.6 3.8-1.6 5 .6.5-.8 1.2-1.3 2-1.3s1.5.5 2 1.3c1.2-2.2 3.2-2.2 5-.6" />
      <path className="a" d="M13 4.5c.9-.8 1.9-.8 2.5.3.3-.4.6-.6 1-.6s.7.2 1 .6c.6-1.1 1.6-1.1 2.5-.3" />
      <path className="c" d="M7 20a2.5 2.5 0 0 1-.3-5A3.6 3.6 0 0 1 13.5 14a2.9 2.9 0 1 1 1.8 6z" />
    </>
  ),
  deepFeeler: (
    <>
      <path className="c" d={BIG_WAVE} />
      <path className="a" d={WAVE_LINE} />
    </>
  ),
  steady: (
    <>
      <path className="c" d="M5.5 18c0-1.8 2.9-3 6.5-3s6.5 1.2 6.5 3-2.9 2.5-6.5 2.5-6.5-.7-6.5-2.5z" />
      <path className="c" d="M7.5 12.6c0-1.5 2-2.6 4.5-2.6s4.5 1.1 4.5 2.6-2 2.4-4.5 2.4-4.5-.9-4.5-2.4z" />
      <path className="c" d="M9.5 7.5c0-1.2 1.1-2.1 2.5-2.1s2.5.9 2.5 2.1-1.1 2.3-2.5 2.3-2.5-1-2.5-2.3z" />
      <path className="a" d={WAVE_LINE} />
    </>
  ),

  // ---- Lifestyle ----
  exNever: (
    <>
      <path className="a" d="M2.5 16.5h19" />
      <circle className="c" cx="12" cy="12.5" r="5.5" />
      <circle cx="12" cy="12.5" r="2.2" />
      <path className="a" d="M8.2 8.7l1.6 1.6M15.8 16.3l-1.6-1.6M15.8 8.7l-1.6 1.6M8.2 16.3l1.6-1.6" />
    </>
  ),
  exSometimes: (
    <>
      <ellipse cx="12" cy="16" rx="8.5" ry="3" />
      <ellipse className="a" cx="12" cy="16" rx="4.2" ry="1.4" />
      <path className="af" d="M12 5c1.4 2 2.1 3.2 2.1 4.1a2.1 2.1 0 0 1-4.2 0c0-.9.7-2.1 2.1-4.1z" />
    </>
  ),
  exWeekly: (
    <>
      <path className="a" d="M3 17c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0 3 1.5 4.5 0" />
      <path d="M3 12.5c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0 3 1.5 4.5 0" />
    </>
  ),
  exOften: (
    <>
      <path d="M3 9c1.5-1.4 3-1.4 4.5 0s3 1.4 4.5 0 3-1.4 4.5 0 3 1.4 4.5 0" />
      <path className="a" d="M3 13.5c1.5-1.8 3-1.8 4.5 0s3 1.8 4.5 0 3-1.8 4.5 0 3 1.8 4.5 0" />
      <path d="M3 18c1.5-2.2 3-2.2 4.5 0s3 2.2 4.5 0 3-2.2 4.5 0 3 2.2 4.5 0" />
    </>
  ),
  exDaily: (
    <>
      <path className="c" d={BIG_WAVE} />
      <ellipse className="af" cx="9.2" cy="9.6" rx="4.4" ry="1.2" transform="rotate(-38 9.2 9.6)" />
      <path className="a" d={WAVE_LINE} />
    </>
  ),
  school: (
    <>
      <path className="c" d="M4 10.5 12 6l8 4.5V20H4z" />
      <path d="M10 20v-4.5h4V20M12 6V2.5M3 20h18" />
      <path className="af" d="M12 2.5h3.5l-.8 1.2.8 1.3H12z" />
      <path className="a" d="M7 13h1.5M15.5 13H17" />
    </>
  ),
  college: (
    <>
      <path className="c" d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5c-3.5-.5-6.5 0-8.5 1.5z" />
      <path d="M12 6.5v13" />
      <path className="a" d="M6 9c1.5-.2 2.8 0 4 .5M14 9.5c1.2-.5 2.5-.7 4-.5" />
    </>
  ),
  bachelor: CAP,
  master: (
    <>
      <path className="c" d="M6.5 10v4.5c1.6 1.6 3.4 2.4 5.5 2.4s3.9-.8 5.5-2.4V10" />
      <path className="c" d="M2.5 8 12 3.5 21.5 8 12 12.5z" />
      <path className="a" d="M21.5 8v5" />
      <circle className="af" cx="21.5" cy="14" r="1" />
      <path className="af" d="M12 17.8l.8 1.6 1.8.3-1.3 1.2.3 1.8-1.6-.8-1.6.8.3-1.8-1.3-1.2 1.8-.3z" />
    </>
  ),
  doctor: (
    <>
      <path d="M5 20.5h14M8.5 17.5h6" />
      <path className="c" d="M9.6 3.3l3 1.7-3.6 6.2-3-1.7z" />
      <path d="M11.2 8.6c2.6.6 4.3 2.8 4.3 5.4a5.5 5.5 0 0 1-2.5 3.5M12.3 4.9l1.7 1" />
      <circle className="af" cx="7.5" cy="12.4" r="1" />
    </>
  ),
  noDrink: (
    <>
      <path className="c" d="M7 4h10l-1.3 15a1.5 1.5 0 0 1-1.5 1.4H9.8a1.5 1.5 0 0 1-1.5-1.4z" />
      <path className="a" d="M4.5 4.5l15 15" />
    </>
  ),
  wine: (
    <>
      <path className="c" d="M7.5 3.5h9c0 4.6-1.6 7.6-4.5 7.6S7.5 8.1 7.5 3.5z" />
      <path d="M12 11.1v8.4M8.5 20.5h7" />
      <path className="a" d="M8 6.5h8" />
    </>
  ),
  cheers: (
    <>
      <path className="c" d="M4.5 4.5h5l-.5 5.5a2 2 0 0 1-4 0z" />
      <path d="M7 12v7M5 19.5h4" />
      <path className="c" d="M14.5 4.5h5l-.5 5.5a2 2 0 0 1-4 0z" />
      <path d="M17 12v7M15 19.5h4" />
      <path className="a" d="M12 2.5v2M10.6 6.2l-1-.6M13.4 6.2l1-.6" />
    </>
  ),
  beer: (
    <>
      <path className="c" d="M5 7h10v12.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 5 19.5z" />
      <path d="M15 9.5h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2M8.5 11v6.5M11.5 11v6.5" />
      <path className="o" d="M5 7c0-1.7 1.3-2.8 2.8-2.3.6-1 1.7-1.4 2.8-1 1-1.1 3.2-.7 3.6.9 1.2.1 1.8 1.2 1.8 2.4z" />
    </>
  ),
  noSmoke: (
    <>
      <rect className="c" x="3" y="11" width="15" height="3.5" rx=".8" />
      <path d="M14.5 11v3.5" />
      <path className="a" d="M4 5l16 14" />
    </>
  ),
  smoke: (
    <>
      <rect className="c" x="2.5" y="14" width="15" height="3.5" rx=".8" />
      <path d="M14 14v3.5M20.5 17.5V14" />
      <path className="a" d="M17.5 11c0-1.5 1.5-1.5 1.5-3s-1.5-1.5-1.5-3M20.5 11c0-1.5 1.5-1.5 1.5-3" />
    </>
  ),
  exSmoker: (
    <>
      <path className="c" d="M2.5 13h7l-1 3.5h-6z" />
      <path className="c" d="M12 13h8.5v3.5h-9.5z" />
      <path d="M17 13v3.5" />
      <path className="a" d="M10.2 10.5l.8-2M12.6 10.8l1.6-1.4" />
    </>
  ),
  vape: (
    <>
      <rect className="c" x="3" y="13" width="10" height="4" rx="2" />
      <path d="M13 15h2" />
      <path className="c" d="M15.5 13.5a2.2 2.2 0 0 1 .5-4.3 3.2 3.2 0 0 1 6 .8 1.8 1.8 0 0 1-.6 3.5z" />
      <circle className="af" cx="5" cy="15" r=".8" />
    </>
  ),
  noKids: (
    <>
      <path className="c" d={JELLY_BELL} />
      <path d={JELLY_LEGS} />
      <circle className="n" cx="9.6" cy="9.8" r=".9" />
      <circle className="n" cx="14.4" cy="9.8" r=".9" />
    </>
  ),
  kids: (
    <>
      <path className="c" d="M2.5 11a6 6 0 0 1 12 0c0 .8-.6 1.2-1.3 1.2H3.8c-.7 0-1.3-.4-1.3-1.2z" />
      <path d="M5 12.2c-.6 1.4.6 2.5 0 4.4M8.5 12.2c.6 1.6-.6 2.8 0 5M12 12.2c-.6 1.4.6 2.5 0 4.4" />
      <path className="pk" d="M14.5 15a3.7 3.7 0 0 1 7.4 0c0 .5-.4.8-.9.8h-5.6c-.5 0-.9-.3-.9-.8z" />
      <path d="M16.3 15.8c-.4.9.4 1.6 0 2.8M18.2 15.8c.4 1-.4 1.8 0 3.2M20.1 15.8c-.4.9.4 1.6 0 2.8" />
    </>
  ),
  expecting: (
    <>
      <path className="c" d={JELLY_BELL} />
      <path d={JELLY_LEGS} />
      <circle className="pk" cx="12" cy="9.5" r="2.4" />
      <path className="a" d="M11.2 8.6a1 1 0 0 1 .8-.6" />
    </>
  ),
  female: (
    <>
      <circle className="c" cx="12" cy="9" r="5" />
      <path d="M12 14v7M9 18h6" />
    </>
  ),
  male: (
    <>
      <circle className="c" cx="10" cy="14" r="5" />
      <path d="M13.6 10.4 19.5 4.5M15 4.5h4.5V9" />
    </>
  ),
  nonbinary: (
    <>
      <circle className="c" cx="12" cy="15" r="5" />
      <path d="M12 10V3M9.4 4.4l5.2 3M14.6 4.4l-5.2 3" />
    </>
  ),
  noAnswer: (
    <>
      <circle className="c" cx="12" cy="12" r="8.5" />
      <path className="a" d="M8.5 12h7" />
    </>
  ),

  // ---- Cities ----
  seoul: (
    <>
      <path className="c" d="M3 20.5c2-3.5 5.2-5.5 9-5.5s7 2 9 5.5z" />
      <path d="M12 15V9.5M12 6V2.5" />
      <path className="c" d="M9.8 9.5h4.4l-.6-3.5h-3.2z" />
      <path className="a" d="M10.4 11.8h3.2" />
    </>
  ),
  busan: (
    <>
      <path d="M3 14.5h18M7.5 14.5V5.5M16.5 14.5V5.5M3 18.5c1.5-1 3-1 4.5 0s3 1 4.5 0 3-1 4.5 0 3 1 4.5 0" />
      <path className="a" d="M3 8.5c2 2.6 3.4 2.4 4.5-3M7.5 5.5c1.4 4.4 2.9 6.5 4.5 6.5s3.1-2.1 4.5-6.5M16.5 5.5c1.1 5.4 2.5 5.6 4.5 3" />
    </>
  ),
  incheon: (
    <>
      <path className="c" d="M20.6 3.4c-.8-.8-2.1-.7-2.9.1l-3.5 3.7-8.5-2.4-1.6 1.6 7 4-3.4 3.6-2.6-.5-1.1 1.1 3.2 1.9 1.9 3.2 1.1-1.1-.5-2.6 3.6-3.4 4 7 1.6-1.6-2.4-8.5 3.7-3.5c.8-.8.9-2.1.1-2.9z" />
      <path className="a" d="M3 21c1.5-.9 3-.9 4.5 0" />
    </>
  ),
  daegu: (
    <>
      <path className="c" d="M2.5 19.5 9 9l4 6 2.5-3.5 6 8z" />
      <circle className="af" cx="17.5" cy="6" r="2" />
      <path className="a" d="M7.2 12l1.8 1.3 1.3-1.4" />
    </>
  ),
  daejeon: (
    <>
      <ellipse cx="12" cy="12" rx="9" ry="3.6" />
      <ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)" />
      <ellipse className="a" cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)" />
      <circle className="af" cx="12" cy="12" r="1.7" />
    </>
  ),
  gwangju: (
    <>
      <path className="c" d="M12 3.5a8.5 8.5 0 0 0 0 17c1.4 0 2-1 1.6-2.2-.5-1.4.3-2.8 1.8-2.8h2.1a3 3 0 0 0 3-3c0-5-3.8-9-8.5-9z" />
      <circle className="af" cx="8" cy="10.5" r="1.2" />
      <circle className="n" cx="11.5" cy="7.3" r="1.1" />
      <circle className="af" cx="15.5" cy="8.5" r="1.1" />
      <circle className="n" cx="7.8" cy="14.5" r="1.1" />
    </>
  ),
  suwon: (
    <>
      <path className="c" d="M3.5 20.5V13h17v7.5z" />
      <path d="M9.5 20.5v-3a2.5 2.5 0 0 1 5 0v3" />
      <path className="c" d="M5.5 13 6.5 9.5h11l1 3.5z" />
      <path className="a" d="M3 9.5c3-.5 5.5-2.5 6.5-4.5h5c1 2 3.5 4 6.5 4.5" />
    </>
  ),
  asan: (
    <>
      <path className="c" d="M3.5 15.5c0 3 3.8 5 8.5 5s8.5-2 8.5-5c0-1.2-.8-2-2-2.5H5.5c-1.2.5-2 1.3-2 2.5z" />
      <path className="a" d="M8 11c-1-1.2-1-2.3 0-3.5s1-2.3 0-3.5M12 11c-1-1.2-1-2.3 0-3.5s1-2.3 0-3.5M16 11c-1-1.2-1-2.3 0-3.5s1-2.3 0-3.5" />
    </>
  ),
  cheonan: (
    <>
      <path className="o" d="M12 3.8c2.2 0 3.4 1.1 4.6 1.6 1.6.7 3.4 1.6 3.4 4.4 0 1.4-.6 2.3-.6 3.3 0 1.4.6 2.2.6 3.6 0 2.8-2.6 3.6-4.6 3.9-1.2.2-2.2.6-3.4.6s-2.2-.4-3.4-.6c-2-.3-4.6-1.1-4.6-3.9 0-1.4.6-2.2.6-3.6 0-1-.6-1.9-.6-3.3 0-2.8 1.8-3.7 3.4-4.4C8.6 4.9 9.8 3.8 12 3.8z" />
      <path d="M12 3.8v17.4" />
      <path className="a" d="M8 8c1.3.9 1.3 2.4 0 3.3s-1.3 2.4 0 3.3M16 8c-1.3.9-1.3 2.4 0 3.3s1.3 2.4 0 3.3" />
    </>
  ),
  ulsan: (
    <>
      <path className="c" d="M11.2 13.5c-.4 2.6-.1 4.8.5 6.5h.6c.6-1.7.9-3.9.5-6.5z" />
      <path className="c" d="M12 14.2C10.2 11.8 6.6 12 3.5 9c3-.6 5.8-.1 7.2 1.6.4-.9.8-1.6 1.3-2.1.5.5.9 1.2 1.3 2.1 1.4-1.7 4.2-2.2 7.2-1.6-3.1 3-6.7 2.8-8.5 5.2z" />
      <path className="a" d="M3 20.5c1.5-1 3-1 4.5 0s3 1 4.5 0 3-1 4.5 0 3 1 4.5 0" />
      <circle className="af" cx="5.5" cy="5.5" r=".8" />
      <circle className="af" cx="18.5" cy="5.5" r=".8" />
    </>
  ),
  jeonju: (
    <>
      <path className="c" d="M5 12h14v8.5H5z" />
      <path className="c" d="M2.5 12c2 0 3.5-1 5-3l1-1.5h7l1 1.5c1.5 2 3 3 5 3z" />
      <path d="M10 20.5v-4.5h4v4.5M3.5 20.5h17" />
      <path className="a" d="M7.5 9.8h9" />
    </>
  ),
  jeju: (
    <>
      <circle className="o" cx="12" cy="13.5" r="7" />
      <path className="af" d="M12 6.5c.3-1.8 1.8-3 4-3-.2 2-1.7 3.3-4 3z" />
      <path d="M12 6.5V4.8" />
      <path className="a" d="M8.2 12.2a4 4 0 0 1 2-2.4" />
    </>
  ),

  // ---- Zodiac (in a bubble) ----
  aries: (<>{ZODIAC_RING}<path d="M12 18V10.5M12 10.5c0-2.5-1.3-4-3-4s-2.7 1.4-2.3 3M12 10.5c0-2.5 1.3-4 3-4s2.7 1.4 2.3 3" />{ZODIAC_SHINE}</>),
  taurus: (<>{ZODIAC_RING}<circle cx="12" cy="14.2" r="3.4" /><path d="M7 6.8c.6 2.4 2.6 3.7 5 3.7s4.4-1.3 5-3.7" />{ZODIAC_SHINE}</>),
  gemini: (<>{ZODIAC_RING}<path d="M7.5 7c3 .9 6 .9 9 0M7.5 17c3-.9 6-.9 9 0M10 7.6v8.8M14 7.6v8.8" />{ZODIAC_SHINE}</>),
  cancer: (<>{ZODIAC_RING}<circle cx="8.6" cy="10" r="1.8" /><circle cx="15.4" cy="14" r="1.8" /><path d="M8.6 8.2c2.5-1.3 5.7-.9 8 1.1M15.4 15.8c-2.5 1.3-5.7.9-8-1.1" />{ZODIAC_SHINE}</>),
  leo: (<>{ZODIAC_RING}<circle cx="9" cy="14.2" r="2.2" /><path d="M11.2 14.2c0-2.8-.8-4.4-.8-5.6a2.9 2.9 0 0 1 5.8 0c0 2.2-1.8 3.8-1.8 6.1 0 1.3.7 2.2 2.1 2.2" />{ZODIAC_SHINE}</>),
  virgo: (<>{ZODIAC_RING}<path d="M6.8 8v8.5M6.8 9.4c0-.9.7-1.5 1.6-1.5s1.6.6 1.6 1.5v7.1M10 9.4c0-.9.7-1.5 1.6-1.5s1.6.6 1.6 1.5v5.6c0 1.8 1.1 2.6 2.7 2.1M13.2 12.8c1.4-1.2 3.2-.9 3.6.3.4 1.5-1 3-3.6 3.1" />{ZODIAC_SHINE}</>),
  libra: (<>{ZODIAC_RING}<path d="M6.5 17.5h11M6.5 14.5h3.2a2.9 2.9 0 1 1 4.6 0h3.2" />{ZODIAC_SHINE}</>),
  scorpio: (<>{ZODIAC_RING}<path d="M6.3 8v8.5M6.3 9.4c0-.9.7-1.5 1.6-1.5s1.6.6 1.6 1.5v7.1M9.5 9.4c0-.9.7-1.5 1.6-1.5s1.6.6 1.6 1.5v5.6c0 1 .7 1.5 1.6 1.5h2.9M16 15.4l1.3 1.1-1.3 1.1" />{ZODIAC_SHINE}</>),
  sagittarius: (<>{ZODIAC_RING}<path d="M7.5 16.5l9-9M12 7.5h4.5V12M9 11.5l3.5 3.5" />{ZODIAC_SHINE}</>),
  capricorn: (<>{ZODIAC_RING}<path d="M6.5 8l2.4 7.2L11 9c.6-1.5 2.6-1.4 2.8.4.2 2.4-.7 4.8-2.2 6.7M12.6 14.8c.9-1.4 2.6-2 3.7-.9 1.1 1.1.4 2.9-1.3 2.9-1 0-1.8-.5-2.4-1.4" />{ZODIAC_SHINE}</>),
  aquarius: (<>{ZODIAC_RING}<path d="M6 10.6c1-.9 2-.9 3 0s2 .9 3 0 2-.9 3 0 2 .9 3 0M6 14.4c1-.9 2-.9 3 0s2 .9 3 0 2-.9 3 0 2 .9 3 0" />{ZODIAC_SHINE}</>),
  pisces: (<>{ZODIAC_RING}<path d="M8 6.5c2 3 2 8 0 11M16 6.5c-2 3-2 8 0 11M9.2 12h5.6" />{ZODIAC_SHINE}</>),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICONS;

export function isIconName(x: string): x is IconName {
  return Object.prototype.hasOwnProperty.call(ICONS, x);
}

export function Icon({
  name,
  size = 20,
  label,
  tone,
  className,
  style,
}: {
  name: IconName;
  size?: number;
  /** Give a label only when the icon is the only content (an icon button); otherwise it's decorative. */
  label?: string;
  /** "on": active tab (coral fill). "off": inactive (grey outline). "light": white lines for dark buttons. */
  tone?: 'on' | 'off' | 'light';
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      className={`dh-ic${tone ? ` ${tone}` : ''}${className ? ` ${className}` : ''}`}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      style={style}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {ICONS[name]}
    </svg>
  );
}
