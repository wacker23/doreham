'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/hooks/useUser';

type Row = { id: string; display_name: string | null; email: string | null; plus: boolean; tier: string; expires_at: string | null };

/** Admin: give or remove Doreham+ by hand (until online payment exists). English only, like the other admin pages. */
export default function AdminPlusPage() {
  const router = useRouter();
  const { user, loading } = useUser();
  const [members, setMembers] = useState<Row[] | null>(null);
  const [results, setResults] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(
    async (query: string) => {
      const r = await fetch(`/api/admin/plus?q=${encodeURIComponent(query)}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status === 403) router.push('/');
        setError(j.error || 'load_failed');
        return;
      }
      setMembers(j.members ?? []);
      setResults(j.results ?? []);
    },
    [router],
  );

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/sign-in?return=/admin/plus');
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    load('');
  }, [user, loading, router, load]);

  async function set(userId: string, months: number | null) {
    if (months === 0 && !confirm('Remove Doreham+ from this person now?')) return;
    setBusy(`${userId}-${months}`);
    setError('');
    const r = await fetch('/api/admin/plus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, months }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setError(j.error || 'failed');
    await load(q);
    setBusy('');
  }

  if (loading || !user) return null;

  const until = (r: Row) =>
    r.tier !== 'plus' ? 'Free' : !r.expires_at ? 'Doreham+ · no end date' : `${r.plus ? 'Doreham+' : 'Expired'} · until ${new Date(r.expires_at).toLocaleDateString('en-US', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'short', day: 'numeric' })}`;

  const person = (r: Row) => (
    <div key={r.id} className="p-row">
      <div className="who">
        <a href={`/profile/${r.id}`} target="_blank" rel="noreferrer">{r.display_name || '(no name)'}</a>
        <div className="muted small">{r.email ?? r.id}</div>
        <div className={`st ${r.plus ? 'on' : ''}`}>{until(r)}</div>
      </div>
      <div className="acts">
        {[1, 3, 12].map((m) => (
          <button key={m} disabled={!!busy} onClick={() => set(r.id, m)}>
            +{m} mo
          </button>
        ))}
        <button disabled={!!busy} onClick={() => set(r.id, null)}>No end</button>
        {r.tier === 'plus' && (
          <button className="danger" disabled={!!busy} onClick={() => set(r.id, 0)}>
            Remove
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="admin-plus">
      <header className="a-nav">
        <div className="wrap a-nav-in">
          <a className="brand" href="/">
            Doreham <span className="ko-mark">도레함</span> · Doreham+
          </a>
          <nav className="a-links">
            <a href="/admin/matches">Matches</a>
            <a href="/admin/venues">Venues</a>
            <a href="/admin/events">Events</a>
          </nav>
        </div>
      </header>
      <main className="wrap a-wrap">
        <h1>Doreham+</h1>
        <p className="muted">
          Until online payment exists, give Doreham+ here. Giving months again extends from the current end date. The person gets a notification. Removing takes effect at once (their venues and requests stay).
        </p>
        {error && <div className="err">{error}</div>}

        <form
          className="search"
          onSubmit={(e) => {
            e.preventDefault();
            load(q);
          }}
        >
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" />
          <button type="submit">Search</button>
        </form>
        {q && results.length === 0 && <p className="muted">No one found.</p>}
        <div className="list">{results.map(person)}</div>

        <h2>Members ({members?.length ?? '…'})</h2>
        {members && members.length === 0 && <p className="muted">No one has Doreham+ yet.</p>}
        <div className="list">{members?.map(person)}</div>
      </main>

      <style jsx global>{`
        .admin-plus .a-nav { border-bottom: 1px solid var(--ink-12); background: var(--paper-2); }
        .admin-plus .a-nav-in { display: flex; align-items: center; justify-content: space-between; height: 60px; }
        .admin-plus .brand { font-family: var(--display); font-weight: 800; font-size: 18px; text-decoration: none; color: var(--ink); }
        .admin-plus .ko-mark { color: var(--ink-60); font-size: 15px; }
        .admin-plus .a-links { display: flex; gap: 14px; }
        .admin-plus .a-links a { color: var(--ink-60); font-weight: 600; font-size: 14px; text-decoration: none; }
        .admin-plus .a-wrap { max-width: 900px; padding-top: 24px; padding-bottom: 60px; }
        .admin-plus h1 { font-family: var(--display); font-weight: 800; font-size: 28px; margin: 0 0 6px; }
        .admin-plus h2 { font-family: var(--display); font-weight: 800; font-size: 19px; margin: 28px 0 10px; }
        .admin-plus .muted { color: var(--ink-60); font-size: 14px; }
        .admin-plus .small { font-size: 12.5px; }
        .admin-plus .err { background: rgba(255, 106, 61, 0.1); color: var(--persimmon); padding: 10px 14px; border-radius: 10px; margin: 12px 0; font-size: 14px; }
        .admin-plus .search { display: flex; gap: 8px; margin: 18px 0 10px; }
        .admin-plus .search input { flex: 1; border: 1px solid var(--ink-12); border-radius: 10px; padding: 10px 12px; font-size: 14px; font-family: var(--body); background: #fff; }
        .admin-plus .search button, .admin-plus .acts button { border: 1px solid var(--ink-12); background: #fff; border-radius: 999px; padding: 7px 12px; font-weight: 700; font-size: 13px; cursor: pointer; font-family: var(--body); }
        .admin-plus .acts button.danger { color: var(--persimmon); border-color: rgba(255, 106, 61, 0.4); }
        .admin-plus button:disabled { opacity: 0.5; }
        .admin-plus .list { display: grid; gap: 8px; }
        .admin-plus .p-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: #fff; border: 1px solid var(--ink-12); border-radius: 14px; padding: 12px 14px; flex-wrap: wrap; }
        .admin-plus .who a { font-weight: 800; color: var(--ink); text-decoration: none; }
        .admin-plus .st { font-size: 12.5px; font-weight: 700; color: var(--ink-60); margin-top: 3px; }
        .admin-plus .st.on { color: var(--persimmon); }
        .admin-plus .acts { display: flex; gap: 6px; flex-wrap: wrap; }
      `}</style>
    </div>
  );
}
