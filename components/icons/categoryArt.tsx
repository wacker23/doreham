import type { ReactNode } from 'react';
import type { CategoryArt } from '@/lib/icons';

/**
 * Sophia's category artwork, redrawn on the same 24 grid and line weight as the sea icons
 * (Icon.tsx) so it sits at the same visual size and crispness. Same drawings as the PNGs in
 * public/categories (the PNGs stay for the landing page). Classes: see globals.css (.dh-ic).
 */
export const CATEGORY_ART: Record<Exclude<CategoryArt, 'other'>, ReactNode> = {
  coffee: (
    <>
      <path d="M8.2 9.2c-1.1-.9-1-1.9 0-2.8s1.1-1.9 0-2.8" />
      <path className="af" d="M12.6 7.4 11.4 6.3c-.7-.7-.2-1.8.7-1.6.2.1.4.2.5.4.1-.2.3-.3.5-.4.9-.2 1.4.9.7 1.6z" />
      <path className="c" d="M17.5 13.4h.9a2.6 2.6 0 0 1 0 5.2h-1.6" />
      <path className="c" d="M2.8 11.8h15v1.8c0 3.6-2.9 6.4-6.4 6.4H9.2c-3.6 0-6.4-2.8-6.4-6.4z" />
      <ellipse className="c" cx="10.3" cy="11.8" rx="7.5" ry="1.5" />
      <ellipse className="af" cx="10.3" cy="12" rx="5.9" ry=".75" />
      <path d="M6.6 21.6h7.4" />
    </>
  ),
  food: (
    <>
      <path d="M6.2 5.1 21.4 2.6M6.4 7 21.6 4.5" />
      <path className="a" d="M19.2 4.9l2.4-.4" />
      <path d="M8.6 6.6v3.3M10.1 6.4v3.1M11.6 6.1v3.3" />
      <path className="c" d="M9.4 18.6v1.2c0 .5.4.9.9.9h3.4c.5 0 .9-.4.9-.9v-1.2" />
      <path className="c" d="M2.8 12.6h18.4c0 4.1-3.8 6.9-9.2 6.9s-9.2-2.8-9.2-6.9z" />
      <path d="M5.8 12.6a3 3 0 0 1 6 0M7.8 12.6a1 1 0 0 1 2 0M12.2 12.6a3 3 0 0 1 6 0M14.2 12.6a1 1 0 0 1 2 0" />
      <path className="a" d="M5.5 14.5c.3 1 .9 1.8 1.7 2.4" />
    </>
  ),
  books: (
    <>
      <path className="c" d="M4.4 14.4H20v5.6H4.4a2.8 2.8 0 0 1 0-5.6z" />
      <path d="M18.6 15.8v2.8M6.6 17.2h9.8" />
      <path className="c" d="M5.2 9.2h14.6v5.2H5.2a2.6 2.6 0 0 1 0-5.2z" />
      <path d="M18.5 10.5v2.6M6.4 10.8v2M8 10.8v2" />
      <path className="af" d="M14.4 9.2v4.3l1.2-1 1.2 1V9.2z" />
      <path className="c" d="M6.6 4h11.4v5.2H6.6a2.6 2.6 0 0 1 0-5.2z" />
      <path d="M16.7 5.3v2.6M7.8 6.6h7.2" />
    </>
  ),
  game: (
    <>
      <path className="c" d="M12 2.6 20.4 7.2V16.8L12 21.4 3.6 16.8V7.2z" />
      <path d="M3.6 7.2 12 11.8l8.4-4.6M12 11.8v9.6" />
      <ellipse className="af" cx="12" cy="7" rx="1.5" ry=".95" />
      <circle className="n" cx="5.9" cy="11.4" r=".95" />
      <circle className="n" cx="7.8" cy="14.3" r=".95" />
      <circle className="n" cx="9.7" cy="17.3" r=".95" />
      <circle className="n" cx="14.4" cy="13.6" r=".95" />
      <circle className="n" cx="18" cy="11.6" r=".95" />
      <circle className="n" cx="14.4" cy="17.6" r=".95" />
      <circle className="n" cx="18" cy="15.6" r=".95" />
    </>
  ),
  movie: (
    <>
      <rect className="c" x="3.4" y="9.8" width="17.2" height="10.8" rx="1.6" />
      <path d="M3.4 13.2h17.2M7.6 9.8l-1.5 3.4M11.6 9.8l-1.5 3.4M15.6 9.8l-1.5 3.4M19.6 9.8l-1.5 3.4" />
      <path className="c" d="M3.4 9.2 19.6 4.9l-.8-2.9L2.7 6.3c-.4.1-.6.5-.5.9z" />
      <path d="M6.9 5.4l2.1 2.7M10.9 4.3 13 7M14.9 3.3l2.1 2.7" />
      <circle className="af" cx="4.4" cy="7.9" r=".85" />
      <path className="a" d="M10.6 14.9v4.2l3.6-2.1z" />
    </>
  ),
  nature: (
    <>
      <path d="M11.4 21.4c-.4-3.8.4-7.3 2.5-10.3" />
      <path className="c" d="M13 13.4c-2-4.6.6-9.5 6.6-10.9 1 5.4-1.5 9.8-6.6 10.9z" />
      <path d="M13 13.4c1.4-3.3 3.3-6 5.8-8.2" />
      <path className="c" d="M11.6 17.4c-3.8.4-6.7-2.1-7-6.4 3.8-.4 6.6 2.1 7 6.4z" />
      <path d="M11.6 17.4c-1.6-2-3.5-3.6-5.6-4.9" />
      <path className="a" d="M15 15.2c-.9.5-1.5 1.1-1.9 2M12.8 18.9v.1" />
    </>
  ),
  adventure: (
    <>
      <path className="a" d="M4.6 7.4c-1.3-.5-2.3.1-2.3 1 0 .8.9 1.2 2.1 1.1" />
      <path className="c" d="M4.9 5.6c2-.7 4.1-1 6.2-1l2.3 8.1c2.6.2 4.6.6 6.2 1.3 1.1.5 1.7 1.2 1.7 2H3.9z" />
      <path d="M3.9 13c1.8.1 3.3 1.2 4.1 3M14.1 13.2c.9.7 1.4 1.7 1.5 2.8" />
      <path className="a" d="M10.9 5.6l1.6 1.2-1.6.9 2.1 1.2-1.5 1 2 1.1" />
      <circle className="n" cx="10.6" cy="7.7" r=".6" />
      <circle className="n" cx="11.2" cy="9.9" r=".6" />
      <path className="c" d="M3.9 16h17.4v1.4c0 .3-.2.5-.5.5H4.4c-.3 0-.5-.2-.5-.5z" />
      <path d="M5.4 17.9v.9M8 17.9v.9M10.6 17.9v.9M13.2 17.9v.9M15.8 17.9v.9M18.4 17.9v.9" />
    </>
  ),
  nightout: (
    <>
      <path d="M16.6 2.2v5.6" />
      <path className="af" d="M12.4 2.2c.2 1.2.7 1.7 1.9 1.9-1.2.2-1.7.7-1.9 1.9-.2-1.2-.7-1.7-1.9-1.9 1.2-.2 1.7-.7 1.9-1.9z" />
      <path className="a" d="M20.9 2.4v.5M20.9 5.7v.5M19.1 4.3h.5M22.2 4.3h.5" />
      <path className="c" d="M2.2 8.6h9.6L7 14.3z" />
      <path className="a" d="M4.9 10.3l.9 1.1M6.5 12.1v.1" />
      <path d="M7 14.3v6.2M4.8 20.8h4.4" />
      <circle className="c" cx="16.6" cy="12.8" r="5" />
      <path d="M11.9 11.1h9.4M11.9 14.5h9.4M16.6 7.8v10M14.9 8.1c-1 1.4-1.4 3-1.4 4.7s.4 3.3 1.4 4.7M18.3 8.1c1 1.4 1.4 3 1.4 4.7s-.4 3.3-1.4 4.7" />
    </>
  ),
  puzzle: (
    <>
      <path className="c" d="M4.1 6.85H8.8a2.1 2.1 0 1 1 2.6 0h4.7a1 1 0 0 1 1 1v4.7a2.1 2.1 0 1 1 0 2.6v4.7a1 1 0 0 1-1 1h-4.7a2.1 2.1 0 1 0-2.6 0H4.1a1 1 0 0 1-1-1v-4.15a2.1 2.1 0 1 0 0-2.6V7.85a1 1 0 0 1 1-1z" />
      <path className="a" d="M6.2 9.7c.3-.65.85-1.1 1.55-1.25M5 10.6v.1" />
    </>
  ),
  makethings: (
    <>
      <path className="c" d="M8.2 3C10.6 2.2 13.4 2.2 15.8 3 15.7 4.2 15.2 5.2 14.3 6 18.5 7.3 19.6 10 19.2 12.4 18.9 15 17.2 17.6 15.3 19.4L15.6 21H8.4L8.7 19.4C6.8 17.6 5.1 15 4.8 12.4 4.4 10 5.5 7.3 9.7 6 8.8 5.2 8.3 4.2 8.2 3z" />
      <path d="M8.2 3c2.4.8 5.2.8 7.6 0M8.7 19.4h6.6" />
      <path d="M12 16.8v-3" />
      <path d="M12 13.8c-.2-1.6-1.5-2.6-3.2-2.6.1 1.7 1.5 2.7 3.2 2.6zM12 13.8c.2-1.9 1.8-3.2 3.8-3.1-.2 2-1.7 3.2-3.8 3.1z" />
      <path className="a" d="M6.8 10.2c.4-.9 1.1-1.7 2-2.2" />
    </>
  ),
  network: (
    <>
      <path className="a" d="M12 3v1.6M9.4 3.7l.9 1.1M14.6 3.7l-.9 1.1" />
      <circle className="c" cx="4.8" cy="4.6" r="2" />
      <circle className="c" cx="19.2" cy="4.6" r="2" />
      <path className="c" d="M1.8 13.8v-3.4c0-1.8 1.4-3.2 3.2-3.2h.6c.9 0 1.7.4 2.2 1.1l2.5 2.7h1.9c.5 0 .9.4.9.9s-.4.9-.9.9H9.6c-.5 0-.9-.2-1.2-.6l-.5-.7v2.3z" />
      <path className="c" d="M22.2 13.8v-3.4c0-1.8-1.4-3.2-3.2-3.2h-.6c-.9 0-1.7.4-2.2 1.1l-2.5 2.7h-1.9c-.5 0-.9.4-.9.9s.4.9.9.9h2.8c.5 0 .9-.2 1.2-.6l.5-.7v2.3z" />
      <path d="M10.7 15.4v-.8c0-.4.3-.7.7-.7h1.2c.4 0 .7.3.7.7v.8" />
      <rect className="c" x="8.4" y="15.4" width="7.2" height="5.6" rx="1.1" />
      <path d="M11.2 17.8h1.6" />
      <path className="a" d="M14.3 18.9c0 .6-.3 1.1-.7 1.4" />
    </>
  ),
  help: (
    <>
      <path className="c a" d="M13.4 11.2 9.6 7.6C8.1 6.2 8 4 9.4 2.9c1.2-1 3-.8 4 .6 1-1.4 2.8-1.6 4-.6 1.4 1.1 1.3 3.3-.2 4.7z" />
      <path className="a" d="M10.6 4.6c.2-.5.6-.8 1.1-.9M10.5 6.1v.1" />
      <path className="c" d="M5.2 14.4h3c.8 0 1.5-.2 2.1-.6l.9-.5h3.9c.9 0 1.5.7 1.4 1.5l4-2.5c.7-.5 1.7-.3 2.1.4.4.7.2 1.6-.4 2.1l-5.6 4.3c-.9.7-2 1.1-3.1 1.1H5.4" />
      <path d="M10.3 16.4h5.1c.4 0 .8-.2 1-.6" />
      <path className="c" d="M2.3 13.6l2.5-.4c.4-.1.8.2.9.6l1 5.9c.1.4-.2.8-.6.9l-2.5.4c-.4.1-.8-.2-.9-.6l-1-5.9c-.1-.4.2-.8.6-.9z" />
    </>
  ),
  chat: (
    <>
      <path className="c" d="M5.4 2.8h7.4a3.4 3.4 0 0 1 3.4 3.4v3.4a3.4 3.4 0 0 1-3.4 3.4H8.6L5.2 15.4v-2.4a3.4 3.4 0 0 1-3.2-3.4V6.2a3.4 3.4 0 0 1 3.4-3.4z" />
      <circle className="af" cx="6.2" cy="7.9" r=".95" />
      <circle className="af" cx="9.1" cy="7.9" r=".95" />
      <circle className="af" cx="12" cy="7.9" r=".95" />
      <path className="c" d="M11.6 10.4h7.2a3.2 3.2 0 0 1 3.2 3.2v2.6a3.2 3.2 0 0 1-3 3.2v2.4l-3.2-2.4h-4.2a3.2 3.2 0 0 1-3.2-3.2v-2.6a3.2 3.2 0 0 1 3.2-3.2z" />
      <path className="a" d="M12 14.1h6.4M12 16.5h4.2" />
    </>
  ),
  venue: (
    <>
      <path className="c" d="M3.8 8.8h16v10.8h-16z" />
      <rect className="c" x="4.2" y="2.6" width="15.2" height="2.6" rx=".5" />
      <path className="c" d="M4.2 5.2H19.4L21 8.8a1.84 1.84 0 0 1-3.68 0a1.84 1.84 0 0 1-3.68 0a1.84 1.84 0 0 1-3.68 0a1.84 1.84 0 0 1-3.68 0a1.84 1.84 0 0 1-3.68 0z" />
      <path className="af" d="M7.24 5.2H10.28L9.96 8.8a1.84 1.84 0 0 1-3.68 0zM13.32 5.2H16.36L17.32 8.8a1.84 1.84 0 0 1-3.68 0z" />
      <path d="M4.2 5.2H19.4L21 8.8a1.84 1.84 0 0 1-3.68 0a1.84 1.84 0 0 1-3.68 0a1.84 1.84 0 0 1-3.68 0a1.84 1.84 0 0 1-3.68 0a1.84 1.84 0 0 1-3.68 0zM7.24 5.2 6.28 8.8M10.28 5.2 9.96 8.8M13.32 5.2l.32 3.6M16.36 5.2l.96 3.6" />
      <path d="M6 19.6v-6.8h3.2v6.8M2.6 19.6h15" />
      <circle className="n" cx="8.2" cy="16.3" r=".55" />
      <rect x="11" y="12.2" width="6.2" height="4.2" rx=".6" />
      <path className="a" d="M12.6 14.1h3M13.3 14.1v1.2M14.9 14.1v1.2" />
      <circle className="c" cx="19.4" cy="18.6" r="3.1" />
      <path className="af" d="M19.4 20.9c-.9-.9-1.6-1.8-1.6-2.8a1.6 1.6 0 0 1 3.2 0c0 1-.7 1.9-1.6 2.8z" />
      <circle className="c ns" cx="19.4" cy="18.1" r=".45" />
    </>
  ),
};

/**
 * "Other" keeps its original drawing (public/categories/other.svg) exactly as designed: its own
 * thinner line and bigger sparkles, cropped the way the PNG-era CategoryIcon showed it. Plain
 * attributes (no .dh-ic classes) so the global icon CSS doesn't restyle it.
 */
export const OTHER_ORIGINAL = {
  viewBox: '1.8 1.8 44.4 44.4',
  body: (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.3}>
      <path d="M24 38 10.6 26.4A3.4 3.4 0 0 1 12.6 20.2 3.6 3.6 0 0 1 16.6 15.3 3.6 3.6 0 0 1 22 13.2 3.6 3.6 0 0 1 26 13.2 3.6 3.6 0 0 1 31.4 15.3 3.6 3.6 0 0 1 35.4 20.2 3.4 3.4 0 0 1 37.4 26.4z" fill="#F8F3EB" stroke="#1B2838" />
      <path d="M19.5 37.5h9l1.3 3.3H18.2z" fill="#F8F3EB" stroke="#1B2838" />
      <path d="M24 38 14.6 19M24 38 21 14.5M24 38 27 14.5M24 38 33.4 19" stroke="#1B2838" />
      <path d="M13.8 23.2a10 10 0 0 1 2.6-4.4" stroke="#F05A28" />
      <path d="M39 5c.5 3.2 1.7 4.4 4.9 4.9-3.2.5-4.4 1.7-4.9 4.9-.5-3.2-1.7-4.4-4.9-4.9C37.3 9.4 38.5 8.2 39 5z" fill="#F05A28" />
      <path d="M8 6.5c.3 1.9 1 2.6 2.9 2.9-1.9.3-2.6 1-2.9 2.9-.3-1.9-1-2.6-2.9-2.9C7 9.1 7.7 8.4 8 6.5z" fill="#F05A28" />
      <circle cx="40" cy="34" r="2" stroke="#F05A28" />
    </g>
  ),
};
