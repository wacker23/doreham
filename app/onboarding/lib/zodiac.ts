// Utility to compute zodiac sign from date of birth.
// Uses tropical (Western) zodiac dates.

export type ZodiacSign =
  | 'aries'      // Mar 21 - Apr 19
  | 'taurus'     // Apr 20 - May 20
  | 'gemini'     // May 21 - Jun 20
  | 'cancer'     // Jun 21 - Jul 22
  | 'leo'        // Jul 23 - Aug 22
  | 'virgo'      // Aug 23 - Sep 22
  | 'libra'      // Sep 23 - Oct 22
  | 'scorpio'    // Oct 23 - Nov 21
  | 'sagittarius'// Nov 22 - Dec 21
  | 'capricorn'  // Dec 22 - Jan 19
  | 'aquarius'   // Jan 20 - Feb 18
  | 'pisces';    // Feb 19 - Mar 20

/**
 * Compute zodiac sign from date of birth string ('YYYY-MM-DD').
 * Returns null if date is invalid.
 */
export function computeZodiacSign(dateOfBirth: string): ZodiacSign | null {
  const parts = dateOfBirth.split('-');
  if (parts.length !== 3) return null;
  
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  
  if (isNaN(month) || isNaN(day)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  // Zodiac boundaries: format is (month, day) — sign starts on this date
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'aries';
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'taurus';
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'gemini';
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'cancer';
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'leo';
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'virgo';
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'libra';
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'scorpio';
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'sagittarius';
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return 'capricorn';
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'aquarius';
  if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) return 'pisces';
  
  return null;  // shouldn't reach here but TypeScript wants it
}

// Display labels for each sign in English and Korean.
export const ZODIAC_LABELS: Record<ZodiacSign, { en: string; ko: string; symbol: string }> = {
  aries:       { en: 'Aries',       ko: '양자리',      symbol: '♈' },
  taurus:      { en: 'Taurus',      ko: '황소자리',    symbol: '♉' },
  gemini:      { en: 'Gemini',      ko: '쌍둥이자리',  symbol: '♊' },
  cancer:      { en: 'Cancer',      ko: '게자리',      symbol: '♋' },
  leo:         { en: 'Leo',         ko: '사자자리',    symbol: '♌' },
  virgo:       { en: 'Virgo',       ko: '처녀자리',    symbol: '♍' },
  libra:       { en: 'Libra',       ko: '천칭자리',    symbol: '♎' },
  scorpio:     { en: 'Scorpio',     ko: '전갈자리',    symbol: '♏' },
  sagittarius: { en: 'Sagittarius', ko: '궁수자리',    symbol: '♐' },
  capricorn:   { en: 'Capricorn',   ko: '염소자리',    symbol: '♑' },
  aquarius:    { en: 'Aquarius',    ko: '물병자리',    symbol: '♒' },
  pisces:      { en: 'Pisces',      ko: '물고기자리',  symbol: '♓' },
};