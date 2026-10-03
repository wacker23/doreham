import type { CSSProperties } from 'react';
import type { CategoryArt } from '@/lib/icons';
import { CATEGORY_ART } from './categoryArt';

/**
 * Sophia's category artwork as crisp vectors on the sea-icon grid (see categoryArt.tsx).
 * The line is a little lighter than the everyday icons (1.3 instead of 1.6) because these
 * drawings carry more detail, and lighter again at big sizes so empty states don't look heavy.
 */
export function CategoryIcon({
  art,
  size = 24,
  label,
  className,
}: {
  art: CategoryArt;
  size?: number;
  label?: string;
  className?: string;
}) {
  const style = { '--ic-sw': size > 56 ? 1.1 : 1.3 } as CSSProperties;
  return (
    <svg
      className={`dh-ic dh-cat${className ? ` ${className}` : ''}`}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      style={style}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {CATEGORY_ART[art] ?? CATEGORY_ART.other}
    </svg>
  );
}
