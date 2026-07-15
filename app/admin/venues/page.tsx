'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/hooks/useUser';
import { supabase } from '@/lib/supabase/client';

const ADMIN_USER_ID = 'dc511479-3d65-4dc4-a2da-55cbca7f9456';

type Venue = {
  id: string;
  owner_id: string;
  business_name_display: string;
  business_name_legal: string;
  business_registration_number: string;
  category: string;
  address: string;
  city: string;
  district: string | null;
  business_opened_at: string | null;
  description: string | null;
  description_en: string | null;
  per_person_cost_won: number | null;
  discount_offer: string | null;
  discount_offer_en: string | null;
  photo_urls: string[];
  hours_json: Record<string, { closed: boolean; open?: string; close?: string }>;
  contact_email: string | null;
  contact_phone: string | null;
  contact_name: string | null;
  created_at: string;
};

type MenuItem = {
  id: string;
  venue_id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  price_won: number | null;
  photo_url: string | null;
  is_signature: boolean;
};

const CATEGORY_LABELS: Record<string, string> = {
  cafe: '☕ Café',
  restaurant: '🍜 Restaurant',
  board_game_cafe: '🎲 Board game café',
  escape_room: '🧩 Escape room',
  bookshop: '📚 Bookshop',
  workshop_creative: '🏺 Workshop',
  active_sports: '🥾 Sports',
  cultural_venue: '🎨 Cultural venue',
  nature_outdoor: '🌿 Nature/Outdoor',
  music_movie: '🎬 Music/Movie',
  other: '🏪 Other',
};

export default function AdminVenuesPage() {
  const router = useRouter();
  const { user, loading } = useUser();

  const [venues, setVenues] = useState<Venue[]>([]);
  const [menuItemsByVenue, setMenuItemsByVenue] = useState<Record<string, MenuItem[]>>({});
  const [loadingVenues, setLoadingVenues] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Auth + admin gate
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/sign-in?return=/admin/venues');
      return;
    }
    if (user.id !== ADMIN_USER_ID) {
      router.push('/');
      return;
    }
    loadVenues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, router]);

  async function loadVenues() {
    setLoadingVenues(true);
    setError(null);

    const { data: venuesData, error: venuesError } = await supabase
      .from('venues')
      .select('*')
      .eq('is_active', false)
      .is('deactivated_at', null)
      .order('created_at', { ascending: true });

    if (venuesError) {
      setError(venuesError.message);
      setLoadingVenues(false);
      return;
    }

    setVenues(venuesData ?? []);

    // Load menu items for all these venues
    if (venuesData && venuesData.length > 0) {
      const venueIds = venuesData.map((v) => v.id);
      const { data: menuData } = await supabase
        .from('venue_menu_items')
        .select('*')
        .in('venue_id', venueIds);

      if (menuData) {
        const grouped: Record<string, MenuItem[]> = {};
        for (const item of menuData) {
          if (!grouped[item.venue_id]) grouped[item.venue_id] = [];
          grouped[item.venue_id].push(item);
        }
        setMenuItemsByVenue(grouped);
      }
    }

    setLoadingVenues(false);
  }

  async function approveVenue(venue: Venue) {
    setProcessingId(venue.id);
    setError(null);

    const { error: updateError } = await supabase
      .from('venues')
      .update({
        is_active: true,
        claim_verified_at: new Date().toISOString(),
      })
      .eq('id', venue.id);

    if (updateError) {
      setError(`Approval failed: ${updateError.message}`);
      setProcessingId(null);
      return;
    }

    // Send approval email (fire and forget)
    if (venue.contact_email) {
      fetch('/api/emails/venue-approved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: venue.contact_email,
          venueName: venue.business_name_display,
          venueId: venue.id,
        }),
      }).catch((e) => console.error('Email failed (non-fatal):', e));
    }

    setSuccessMessage(`✓ ${venue.business_name_display} approved`);
    setProcessingId(null);

    // Remove from list
    setVenues((prev) => prev.filter((v) => v.id !== venue.id));

    setTimeout(() => setSuccessMessage(null), 4000);
  }

  async function confirmReject(venue: Venue) {
    if (!rejectReason.trim()) {
      setError('Please provide a reason.');
      return;
    }

    setProcessingId(venue.id);
    setError(null);

    // Send rejection email FIRST (before we delete, so we have the info)
    if (venue.contact_email) {
      try {
        await fetch('/api/emails/venue-rejected', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: venue.contact_email,
            venueName: venue.business_name_display,
            reason: rejectReason.trim(),
          }),
        });
      } catch (e) {
        console.error('Rejection email failed:', e);
      }
    }

    // Delete the venue (CASCADE removes menu items)
    const { error: deleteError } = await supabase
      .from('venues')
      .delete()
      .eq('id', venue.id);

    if (deleteError) {
      setError(`Rejection failed: ${deleteError.message}`);
      setProcessingId(null);
      return;
    }

    setSuccessMessage(`✗ ${venue.business_name_display} rejected and removed`);
    setProcessingId(null);
    setRejectingId(null);
    setRejectReason('');

    setVenues((prev) => prev.filter((v) => v.id !== venue.id));

    setTimeout(() => setSuccessMessage(null), 4000);
  }

  if (loading || (user && user.id !== ADMIN_USER_ID)) {
    return (
      <main className="loading-wrap">
        <div className="loader" />
        <style jsx>{`
          .loading-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; }
          .loader { width: 40px; height: 40px; border: 3px solid var(--ink-12); border-top-color: var(--persimmon); border-radius: 50%; animation: spin 0.8s linear infinite; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </main>
    );
  }

  if (!user) return null;

  return (
    <>
      <header className="a-nav">
        <div className="wrap a-nav-in">
          <a className="brand" href="/">
            Doreham <span className="ko-mark">도레함</span> · Admin
          </a>
          <a href="/" className="back-link">← Back to site</a>
        </div>
      </header>

      <main className="a-wrap">
        <div className="a-header">
          <h1>Pending venue approvals</h1>
          <p>{venues.length} venue{venues.length !== 1 ? 's' : ''} awaiting review</p>
        </div>

        {successMessage && (
          <div className="success-banner">{successMessage}</div>
        )}

        {error && (
          <div className="error-banner">{error}</div>
        )}

        {loadingVenues ? (
          <div className="loading-inline">Loading venues…</div>
        ) : venues.length === 0 ? (
          <div className="empty-state">
            <p>🎉 All caught up! No pending venues.</p>
          </div>
        ) : (
          <div className="venues-list">
            {venues.map((venue) => {
              const isExpanded = expandedId === venue.id;
              const isProcessing = processingId === venue.id;
              const isRejecting = rejectingId === venue.id;
              const menuItems = menuItemsByVenue[venue.id] ?? [];

              return (
                <div key={venue.id} className={`venue-card ${isExpanded ? 'expanded' : ''}`}>
                  <div
                    className="venue-header"
                    onClick={() => setExpandedId(isExpanded ? null : venue.id)}
                  >
                    <div className="venue-header-main">
                      {venue.photo_urls?.[0] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={venue.photo_urls[0]} alt="" className="thumb" />
                      )}
                      <div>
                        <h2>{venue.business_name_display}</h2>
                        <p className="venue-sub">
                          {CATEGORY_LABELS[venue.category] ?? venue.category} · {venue.city} · Submitted {new Date(venue.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="expand-icon">{isExpanded ? '−' : '+'}</div>
                  </div>

                  {isExpanded && (
                    <div className="venue-details">
                      <div className="detail-grid">
                        <Row label="Legal name" value={venue.business_name_legal} />
                        <Row label="BRN" value={venue.business_registration_number} />
                        <Row label="Address" value={venue.address} />
                        {venue.district && <Row label="District" value={venue.district} />}
                        {venue.business_opened_at && <Row label="Opened" value={venue.business_opened_at} />}
                        {venue.per_person_cost_won && <Row label="Per person" value={`₩${venue.per_person_cost_won.toLocaleString()}`} />}
                        <Row label="Contact email" value={venue.contact_email} />
                        <Row label="Contact phone" value={venue.contact_phone} />
                        {venue.contact_name && <Row label="Contact person" value={venue.contact_name} />}
                      </div>

                      {venue.description && (
                        <div className="detail-block">
                          <strong>Description (KO):</strong>
                          <p>{venue.description}</p>
                        </div>
                      )}
                      {venue.description_en && (
                        <div className="detail-block">
                          <strong>Description (EN):</strong>
                          <p>{venue.description_en}</p>
                        </div>
                      )}
                      {venue.discount_offer && (
                        <div className="detail-block">
                          <strong>Discount (KO):</strong>
                          <p>{venue.discount_offer}</p>
                        </div>
                      )}
                      {venue.discount_offer_en && (
                        <div className="detail-block">
                          <strong>Discount (EN):</strong>
                          <p>{venue.discount_offer_en}</p>
                        </div>
                      )}

                      {venue.photo_urls && venue.photo_urls.length > 0 && (
                        <div className="detail-block">
                          <strong>Photos ({venue.photo_urls.length}):</strong>
                          <div className="photos-preview">
                            {venue.photo_urls.map((url, i) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                <img src={url} alt={`Photo ${i + 1}`} className="thumb-lg" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {menuItems.length > 0 && (
                        <div className="detail-block">
                          <strong>Menu items ({menuItems.length}):</strong>
                          <div className="menu-list">
                            {menuItems.map((item) => (
                              <div key={item.id} className="menu-item">
                                {item.photo_url && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={item.photo_url} alt="" className="menu-thumb" />
                                )}
                                <div className="menu-info">
                                  <div className="menu-name">
                                    {item.name}
                                    {item.is_signature && ' ⭐'}
                                  </div>
                                  {item.name_en && <div className="menu-name-en">{item.name_en}</div>}
                                  {item.description && <p className="menu-desc">{item.description}</p>}
                                  {item.price_won && <div className="menu-price">₩{item.price_won.toLocaleString()}</div>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {isRejecting ? (
                        <div className="reject-form">
                          <label>Rejection reason (will be included in email to owner):</label>
                          <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="e.g. Business registration number not verifiable, missing required license, etc."
                            rows={3}
                          />
                          <div className="reject-actions">
                            <button
                              type="button"
                              className="btn-cancel"
                              onClick={() => {
                                setRejectingId(null);
                                setRejectReason('');
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="btn-reject-confirm"
                              onClick={() => confirmReject(venue)}
                              disabled={isProcessing || !rejectReason.trim()}
                            >
                              {isProcessing ? 'Rejecting…' : 'Confirm rejection'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="action-buttons">
                          <button
                            type="button"
                            className="btn-reject"
                            onClick={() => setRejectingId(venue.id)}
                            disabled={isProcessing}
                          >
                            ✗ Reject
                          </button>
                          <button
                            type="button"
                            className="btn-approve"
                            onClick={() => approveVenue(venue)}
                            disabled={isProcessing}
                          >
                            {isProcessing ? 'Approving…' : '✓ Approve'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <style jsx>{`
        .a-nav { background: rgba(245, 242, 235, 0.9); border-bottom: 1px solid var(--ink-12); position: sticky; top: 0; z-index: 10; backdrop-filter: blur(8px); }
        .a-nav-in { display: flex; align-items: center; justify-content: space-between; height: 68px; }
        .brand { font-family: var(--display); font-weight: 800; font-size: 18px; text-decoration: none; color: var(--ink); }
        .ko-mark { color: var(--ink-60); font-weight: 700; font-size: 15px; }
        .back-link { color: var(--ink-60); text-decoration: none; font-size: 14px; font-weight: 500; }
        .back-link:hover { color: var(--ink); }
        .a-wrap { max-width: 900px; margin: 0 auto; padding: 32px 24px 60px; }
        .a-header { margin-bottom: 24px; }
        .a-header h1 { font-family: var(--display); font-weight: 800; font-size: 32px; margin: 0 0 4px; letter-spacing: -0.02em; }
        .a-header p { color: var(--ink-60); margin: 0; }
        .success-banner { background: rgba(15, 157, 119, 0.1); color: var(--jade); border: 1px solid rgba(15, 157, 119, 0.25); padding: 12px 16px; border-radius: 12px; font-weight: 600; margin-bottom: 16px; }
        .error-banner { background: rgba(255, 106, 61, 0.1); color: var(--persimmon); border: 1px solid rgba(255, 106, 61, 0.25); padding: 12px 16px; border-radius: 12px; margin-bottom: 16px; }
        .loading-inline { text-align: center; padding: 60px 20px; color: var(--ink-60); }
        .empty-state { text-align: center; padding: 80px 20px; color: var(--ink-60); font-size: 18px; background: var(--paper-2); border-radius: 16px; }
        .venues-list { display: flex; flex-direction: column; gap: 12px; }
        .venue-card { background: #fff; border: 1px solid var(--ink-12); border-radius: 16px; overflow: hidden; }
        .venue-card.expanded { border-color: var(--persimmon); }
        .venue-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; cursor: pointer; user-select: none; }
        .venue-header:hover { background: var(--paper-2); }
        .venue-header-main { display: flex; align-items: center; gap: 14px; }
        .thumb { width: 60px; height: 60px; border-radius: 10px; object-fit: cover; }
        .venue-header h2 { font-family: var(--display); font-weight: 700; font-size: 18px; margin: 0 0 4px; }
        .venue-sub { color: var(--ink-60); font-size: 13px; margin: 0; }
        .expand-icon { font-size: 24px; color: var(--ink-60); font-weight: 300; }
        .venue-details { padding: 0 20px 20px; border-top: 1px solid var(--ink-12); }
        .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 16px 0; }
        .detail-block { margin: 16px 0; }
        .detail-block strong { display: block; margin-bottom: 6px; color: var(--ink); font-size: 13px; }
        .detail-block p { color: var(--ink-60); font-size: 14px; line-height: 1.5; margin: 0; }
        .photos-preview { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        .thumb-lg { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 8px; cursor: pointer; transition: transform 0.15s; }
        .thumb-lg:hover { transform: scale(1.02); }
        .menu-list { display: flex; flex-direction: column; gap: 8px; }
        .menu-item { display: flex; gap: 12px; padding: 10px; background: var(--paper-2); border-radius: 10px; }
        .menu-thumb { width: 50px; height: 50px; border-radius: 8px; object-fit: cover; }
        .menu-info { flex: 1; }
        .menu-name { font-weight: 700; font-size: 14px; color: var(--ink); }
        .menu-name-en { font-size: 12px; color: var(--ink-60); }
        .menu-desc { font-size: 12px; color: var(--ink-60); margin: 4px 0; }
        .menu-price { color: var(--jade); font-weight: 700; font-size: 13px; }
        .action-buttons { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--ink-12); }
        .btn-approve { background: var(--jade); color: #fff; border: 0; padding: 12px 24px; border-radius: 999px; font-weight: 700; font-size: 14px; cursor: pointer; transition: transform 0.12s, box-shadow 0.12s; }
        .btn-approve:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(15, 157, 119, 0.32); }
        .btn-approve:disabled { opacity: 0.55; cursor: not-allowed; }
        .btn-reject { background: transparent; color: var(--persimmon); border: 1px solid var(--persimmon); padding: 12px 24px; border-radius: 999px; font-weight: 700; font-size: 14px; cursor: pointer; transition: background 0.15s, color 0.15s; }
        .btn-reject:hover:not(:disabled) { background: var(--persimmon); color: #fff; }
        .btn-reject:disabled { opacity: 0.55; cursor: not-allowed; }
        .reject-form { margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--ink-12); }
        .reject-form label { display: block; font-weight: 600; font-size: 13px; margin-bottom: 8px; color: var(--ink); }
        .reject-form textarea { width: 100%; padding: 12px 16px; border: 1px solid var(--ink-12); border-radius: 12px; font-family: var(--body); font-size: 14px; resize: vertical; }
        .reject-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
        .btn-cancel { background: transparent; border: 1px solid var(--ink-12); padding: 10px 20px; border-radius: 999px; font-weight: 600; font-size: 13px; cursor: pointer; }
        .btn-cancel:hover { background: var(--ink); color: var(--paper); }
        .btn-reject-confirm { background: var(--persimmon); color: #fff; border: 0; padding: 10px 20px; border-radius: 999px; font-weight: 700; font-size: 13px; cursor: pointer; }
        .btn-reject-confirm:disabled { opacity: 0.55; cursor: not-allowed; }
        @media (max-width: 640px) {
          .detail-grid { grid-template-columns: 1fr; }
          .photos-preview { grid-template-columns: repeat(3, 1fr); }
        }
      `}</style>
    </>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="row">
      <span className="label">{label}</span>
      <span className="value">{value}</span>
      <style jsx>{`
        .row { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; padding: 2px 0; }
        .label { color: var(--ink-60); flex-shrink: 0; font-weight: 500; }
        .value { color: var(--ink); text-align: right; word-break: break-word; }
      `}</style>
    </div>
  );
}