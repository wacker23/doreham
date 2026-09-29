'use client';

/** Round profile photo, or initials on a soft background. */
export function Avatar({ name, url, size = 36 }: { name: string; url: string | null; size?: number }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';
  return (
    <span className="av" style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.36)) }} aria-hidden="true">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" />
      ) : (
        initials
      )}
      <style jsx>{`
        .av { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; border-radius: 50%; overflow: hidden; background: var(--lav); color: var(--ink); font-weight: 800; }
        .av img { width: 100%; height: 100%; object-fit: cover; }
      `}</style>
    </span>
  );
}
