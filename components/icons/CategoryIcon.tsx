import { categoryArtSrc, type CategoryArt } from '@/lib/icons';

/**
 * Sophia's category artwork (public/categories). The files have wide margins, so at small
 * sizes the picture is zoomed to fill the box; pass `crop={false}` to show the whole file.
 */
export function CategoryIcon({
  art,
  size = 24,
  crop = true,
  label,
  className,
}: {
  art: CategoryArt;
  size?: number;
  crop?: boolean;
  label?: string;
  className?: string;
}) {
  const inner = crop ? Math.round(size * 1.6) : size;
  return (
    <span
      className={`dh-cat${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={categoryArtSrc(art)} alt="" width={inner} height={inner} loading="lazy" decoding="async" />
    </span>
  );
}
