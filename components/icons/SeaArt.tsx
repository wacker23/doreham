import type { ReactNode } from 'react';

/**
 * Illustrated sea icons (48 grid): the six levels, the badges and Doreham+.
 * Shown at 28–96 px. Same colour classes as <Icon> (globals.css .dh-ic).
 */

/** Sand-dollar medal edge, shared by every badge. */
const MEDAL =
  'M24 4.4A3.68 3.68 0 0 1 30.7 5.58 3.68 3.68 0 0 1 36.6 8.99 3.68 3.68 0 0 1 40.97 14.2 3.68 3.68 0 0 1 43.3 20.6 3.68 3.68 0 0 1 43.3 27.4 3.68 3.68 0 0 1 40.97 33.8 3.68 3.68 0 0 1 36.6 39.01 3.68 3.68 0 0 1 30.7 42.42 3.68 3.68 0 0 1 24 43.6 3.68 3.68 0 0 1 17.3 42.42 3.68 3.68 0 0 1 11.4 39.01 3.68 3.68 0 0 1 7.03 33.8 3.68 3.68 0 0 1 4.7 27.4 3.68 3.68 0 0 1 4.7 20.6 3.68 3.68 0 0 1 7.03 14.2 3.68 3.68 0 0 1 11.4 8.99 3.68 3.68 0 0 1 17.3 5.58 3.68 3.68 0 0 1 24 4.4Z';
const medal = (ring: 'lv' | 'pk' | 'q' | 'o', art: ReactNode) => (
  <>
    <path className={ring} d={MEDAL} />
    <circle className="c" cx="24" cy="24" r="15.5" />
    {art}
  </>
);
const WAVE_48 = 'M12.5 33c1.9-1.2 3.8-1.2 5.7 0s3.8 1.2 5.7 0 3.8-1.2 5.7 0 3.8 1.2 5.7 0';
/** The deeper the sea behind a level, the higher the level. */
const depth = (fill: string) => <circle className="ns" cx="24" cy="24" r="23" style={{ fill }} />;

export const ART = {
  level1: (
    <>
      {depth('#E6F4F4')}
      <circle className="c" cx="21" cy="27" r="10" />
      <path className="a" d="M14.6 24.6a6.8 6.8 0 0 1 3.8-4.5" />
      <circle className="c" cx="33.5" cy="15.5" r="4.5" />
      <circle className="c" cx="34.5" cy="29" r="2.5" />
      <circle className="c" cx="27" cy="10" r="1.8" />
    </>
  ),
  level2: (
    <>
      {depth('#D6EDF0')}
      <path className="pk" d="M18.5 35.5h11l1.5 4h-14z" />
      <path className="pk" d="M24 36 10.6 24.4A3.4 3.4 0 0 1 12.6 18.2 3.6 3.6 0 0 1 16.6 13.3 3.6 3.6 0 0 1 22 11.2 3.6 3.6 0 0 1 26 11.2 3.6 3.6 0 0 1 31.4 13.3 3.6 3.6 0 0 1 35.4 18.2 3.4 3.4 0 0 1 37.4 24.4z" />
      <path d="M24 36 14.6 17M24 36 21 12.5M24 36 27 12.5M24 36 33.4 17" />
      <path className="a" d="M13.8 21.2a10 10 0 0 1 2.6-4.4" />
    </>
  ),
  level3: (
    <>
      {depth('#C4E2EA')}
      <path className="c" d="M22 14.6c1.6-4.4 6-6.4 10.5-5-1.6 1.3-2.4 3-2.5 5" />
      <path className="c" d="M12 24 5.5 17.5c-1 4.3-1 8.7 0 13z" />
      <path className="c" d="M11 24c3.5-7 9.5-10.5 16-10.5 6.8 0 11.5 4 13.5 10.5-2 6.5-6.7 10.5-13.5 10.5-6.5 0-12.5-3.5-16-10.5z" />
      <path className="a" style={{ strokeWidth: 3 }} d="M20.8 15.4c-2 5.6-2 11.6 0 17.2M29.6 13.9c-1.7 6.6-1.7 13.6 0 20.2" />
      <circle className="n" cx="35.3" cy="21.5" r="1.6" />
      <circle className="c" cx="44" cy="15" r="1.7" />
      <circle className="c" cx="41.5" cy="9.5" r="1.2" />
    </>
  ),
  level4: (
    <>
      {depth('#AFD5E2')}
      <path d="M15 30c-1.8 3.6 1.8 6.4 0 10M20.5 30c1.8 4-1.8 7.2 0 11.5M27.5 30c-1.8 4 1.8 7.2 0 11.5M33 30c1.8 3.6-1.8 6.4 0 10" />
      <path className="lv" d="M8.5 27a15.5 15.5 0 0 1 31 0c0 2-1.5 3-3.5 3H12c-2 0-3.5-1-3.5-3z" />
      <circle className="n" cx="19" cy="21" r="1.7" />
      <circle className="n" cx="29" cy="21" r="1.7" />
      <path d="M21.6 25c1.5 1.3 3.3 1.3 4.8 0" />
      <circle className="af" cx="15" cy="24.5" r="1.7" style={{ opacity: 0.5 }} />
      <circle className="af" cx="33" cy="24.5" r="1.7" style={{ opacity: 0.5 }} />
      <path className="a" d="M13 18a12 12 0 0 1 4.4-5.2" />
    </>
  ),
  level5: (
    <>
      {depth('#93C2D6')}
      <path className="q" d="M23.5 11.3c1.2-2.6 3.4-4.4 6.4-5.2-.8 1.9-.9 3.6-.4 5.4" />
      <path className="q" d="M42.5 18.5c-1.6-.4-2.6-1.4-3.4-2.6C36 11.8 30.5 10.2 25 11 17.5 12 12 17.5 9.9 25.5l-.6 2.7-4.3 1.6 3.6 2 .4 4.2 2.8-3.4c2.4-5.7 7.2-10 13.4-10.6 4.5-.4 8.4.4 11.6 1.3 2.4.7 4.6.8 6.1-.1z" />
      <path className="q" d="M22 22.5c-.6 2.6.2 4.8 2.4 6.4-2.8-.2-4.8-1.6-5.8-4" />
      <circle className="n" cx="36" cy="16" r="1.3" />
      <path className="a" d="M17.5 16.5a13 13 0 0 1 5-4M7 41c2.4-1.6 4.8-1.6 7.2 0s4.8 1.6 7.2 0 4.8-1.6 7.2 0" />
      <circle className="c" cx="31" cy="34" r="1.3" />
      <circle className="c" cx="34.5" cy="31" r="1" />
    </>
  ),
  level6: (
    <>
      {depth('#76AECB')}
      <path className="bl" d="M5 27.5C5 19.5 12 14 21.5 14c9 0 15.3 5 17.5 11.5l4.2-6.3c1.3 3.6.7 7-1.6 9.4 1.8.4 3.4 1.3 4.4 2.8-3 .9-6 .4-8.2-.9-3.3 4.5-9.6 7.5-17 7.5C12.2 38 5 34 5 27.5z" />
      <path d="M6.5 30.5c5.5 3.6 14 4.6 22 2.4M11 33.5l.5-1.6M15.5 34.8l.3-1.7M20 35.3v-1.8M8.6 28.2c1.2.8 2.6.9 3.8.3" />
      <circle className="n" cx="13" cy="24.5" r="1.6" />
      <path className="a" d="M19.5 13.5V9M19.5 9.5c-.6-2-2-3.2-4-3.5M19.5 9.5c.6-2 2-3.2 4-3.5M10.5 19.8a12 12 0 0 1 5-3.4" />
      <circle className="af" cx="14.5" cy="7.5" r="1" />
      <circle className="af" cx="24.5" cy="7.5" r="1" />
    </>
  ),

  // ---- Badges ----
  first_quest: medal(
    'lv',
    <>
      <path className="a" d={WAVE_48} />
      <path className="c" d="M12.5 25.5h23l-4 5.5h-15z" />
      <path className="c" d="M24 12.5l7 13H17z" />
      <path d="M24 12.5v13" />
    </>,
  ),
  regular: medal(
    'lv',
    <>
      <path d="M33.5 21a10 10 0 0 0-18-3.8M14.5 27a10 10 0 0 0 18 3.8M15 12.6v4.8h4.8M33 35.4v-4.8h-4.8" />
      <path className="a" d="M18 24c2-1.5 4-1.5 6 0s4 1.5 6 0" />
    </>,
  ),
  adventurer: medal(
    'lv',
    <>
      <path d="M24 24V12.5M24 24l8.1-8.1M24 24h11.5M24 24l8.1 8.1M24 24v11.5M24 24l-8.1 8.1M24 24H12.5M24 24l-8.1-8.1" />
      <circle cx="24" cy="24" r="7.5" style={{ strokeWidth: 2.4 }} />
      <circle className="af" cx="24" cy="24" r="2.6" />
      <circle className="n" cx="24" cy="12.5" r="1.5" />
      <circle className="n" cx="32.1" cy="15.9" r="1.5" />
      <circle className="n" cx="35.5" cy="24" r="1.5" />
      <circle className="n" cx="32.1" cy="32.1" r="1.5" />
      <circle className="n" cx="24" cy="35.5" r="1.5" />
      <circle className="n" cx="15.9" cy="32.1" r="1.5" />
      <circle className="n" cx="12.5" cy="24" r="1.5" />
      <circle className="n" cx="15.9" cy="15.9" r="1.5" />
    </>,
  ),
  helper: medal(
    'pk',
    <>
      <path className="af" d="M24 23.5l-4.3-4c-2.5-2.4-.8-6.2 2.3-5.4.9.2 1.5.8 2 1.5.5-.7 1.1-1.3 2-1.5 3.1-.8 4.8 3 2.3 5.4z" />
      <path className="c" d="M12.5 24.5c2.8 0 5.2 1.5 6.6 3.8l1.5 2.4h6.8l1.5-2.4c1.4-2.3 3.8-3.8 6.6-3.8-.5 6.4-5.6 11-11.5 11s-11-4.6-11.5-11z" />
    </>,
  ),
  hero: medal(
    'pk',
    <>
      <path className="af" d="M15.5 24 12.5 34l4-1.6 2.6 2.2 2-2.6 2.9 2.6 2.9-2.6 2 2.6 2.6-2.2 4 1.6-3-10z" />
      <path className="lv" d="M14.5 24a9.5 9.5 0 0 1 19 0c0 1.3-1 2-2.2 2H16.7c-1.2 0-2.2-.7-2.2-2z" />
      <circle className="n" cx="20.5" cy="21" r="1.3" />
      <circle className="n" cx="27.5" cy="21" r="1.3" />
      <path className="af" d="M24 13.6l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z" />
    </>,
  ),
  host: medal(
    'pk',
    <>
      <rect className="c" x="20.5" y="11.5" width="7" height="13" rx="3.5" />
      <path d="M17 21.5a7 7 0 0 0 14 0M24 28.5v4M20.5 32.5h7" />
      <path className="a" d="M14 15.5c-1.2 1.5-1.2 4.5 0 6M34 15.5c1.2 1.5 1.2 4.5 0 6M22.5 15.5h3M22.5 18.5h3" />
    </>,
  ),
  builder: medal(
    'q',
    <>
      <path className="o" d="M12.5 34V23.5h2.5v2h2.5v-2H20V34z" />
      <path className="o" d="M28 34V23.5h2.5v2H33v-2h2.5V34z" />
      <path className="o" d="M18.5 34V17.5H21v2h2v-2h2v2h2v-2h2.5V34z" />
      <path d="M22 34v-3.5a2 2 0 0 1 4 0V34M11 34h26M24 17.5v-6" />
      <path className="af" d="M24 11.5h5l-1.5 1.8L29 15h-5z" />
    </>,
  ),
  warm: medal(
    'pk',
    <>
      <path className="o" d="M24 34.5s-11-6.4-11-14.2A6 6 0 0 1 24 16.8a6 6 0 0 1 11 3.5c0 7.8-11 14.2-11 14.2z" />
      <path d="M24 34.5V18.5M24 34.5l-5-15M24 34.5l5-15" />
      <path className="a" d="M16.4 20a3.6 3.6 0 0 1 2.6-2.5" />
    </>,
  ),
  reliable: medal(
    'q',
    <>
      <path className="o ns" d="M27 16.5l8-3v6.2zM21 16.5l-8-3v6.2z" />
      <path className="c" d="M20 34.5 21.5 19h5l1.5 15.5z" />
      <path className="c" d="M20.5 19h7l-1-4.5h-5z" />
      <path d="M22 14.5c0-1.6.9-2.5 2-2.5s2 .9 2 2.5M15.5 34.5h17" />
      <path className="a" d="M21 24.5h6M20.6 29.5h6.8" />
    </>,
  ),
  top10: medal(
    'o',
    <>
      <path className="c" d="M17.5 13.5h13v6.5a6.5 6.5 0 0 1-13 0z" />
      <path d="M17.5 15.5h-3v1.4a4 4 0 0 0 3.7 4M30.5 15.5h3v1.4a4 4 0 0 1-3.7 4M24 26.5v3.5" />
      <path className="c" d="M20.5 30h7l1 4.5h-9z" />
      <path className="a" d="M21.8 16.5v5" />
      <ellipse className="a" cx="26" cy="19" rx="1.6" ry="2.5" />
    </>,
  ),
  founding: medal(
    'o',
    <>
      <path className="o" d="M14.5 28a9.5 9.5 0 0 1 19 0z" />
      <path className="c" d="M15.5 30.5c1.5-2.8 4.8-4.5 8.5-4.5s7 1.7 8.5 4.5z" />
      <path d="M24 26V15.5" />
      <path className="af" d="M24 15.5h5.5L28 17.5l1.5 2H24z" />
      <path className="a" d={WAVE_48} />
    </>,
  ),

  /** Doreham+: a pearl in an open shell. */
  plus: (
    <>
      <path className="c" d="M7 29h34c-.8 7-7.8 12-17 12S7.8 36 7 29z" />
      <path className="pk" d="M24 27 10.4 17.4a4 4 0 0 1 4.8-5.6 4.2 4.2 0 0 1 6-2.6 4.2 4.2 0 0 1 5.6 0 4.2 4.2 0 0 1 6 2.6 4 4 0 0 1 4.8 5.6z" />
      <path d="M24 27 18.4 10M24 27V9M24 27l5.6-17" />
      <circle className="c" cx="24" cy="29" r="4.6" />
      <path className="a" d="M21.6 27.6a2.6 2.6 0 0 1 1.6-1.6" />
      <path className="af" d="M39 4c.5 3.2 1.7 4.4 4.9 4.9-3.2.5-4.4 1.7-4.9 4.9-.5-3.2-1.7-4.4-4.9-4.9C37.3 8.4 38.5 7.2 39 4z" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type ArtName = keyof typeof ART;

/** Level 1–6 → its art name. */
export function levelArt(n: number): ArtName {
  const k = `level${Math.min(6, Math.max(1, Math.round(n)))}`;
  return k as ArtName;
}

export function SeaArt({
  name,
  size = 48,
  label,
  locked,
  className,
}: {
  name: ArtName;
  size?: number;
  label?: string;
  /** Badge not earned yet: grey and faded. */
  locked?: boolean;
  className?: string;
}) {
  return (
    <svg
      className={`dh-ic dh-art${locked ? ' locked' : ''}${className ? ` ${className}` : ''}`}
      viewBox="0 0 48 48"
      width={size}
      height={size}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {ART[name]}
    </svg>
  );
}
