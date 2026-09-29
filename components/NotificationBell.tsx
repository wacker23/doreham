'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/hooks/useUser';
import { supabase } from '@/lib/supabase/client';

type Notification = {
  id: string;
  type: string;
  title_en: string;
  title_ko: string;
  body_en: string | null;
  body_ko: string | null;
  action_url: string | null;
  is_important: boolean;
  read_at: string | null;
  created_at: string;
};

type Props = {
  lang: 'en' | 'ko';
};

const TYPE_ICONS: Record<string, string> = {
  match_invite: '🎉',
  match_activated: '✨',
  match_cancelled: '😔',
  match_found: '💌',
  no_match_found: '🔍',
  member_left: '👋',
  quest_scheduled: '📅',
  availability_reminder: '⏰',
  check_in_reminder: '📍',
  quest_day_reminder: '🗓️',
  review_reminder: '🌸',
  strike_issued: '⚠️',
  welcome: '👋',
  event_joined: '🙋',
  event_comment: '💬',
  event_updated: '📅',
  event_cancelled: '❌',
  event_reminder: '⏰',
};

export function NotificationBell({ lang }: Props) {
  const { user } = useUser();
  const userId = user?.id;
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch('/api/notifications?limit=20');
      const data = await resp.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unread_count ?? 0);
    } catch (e) {
      console.error('Load notifications failed:', e);
    }
    setLoading(false);
  }, [userId]);

  // Initial load + real-time subscription
  useEffect(() => {
    if (!userId) return;
    loadNotifications();

    // Real-time: new notifications, and read/dismiss changes made in another tab or device
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          loadNotifications();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        bellRef.current &&
        !bellRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function handleClickNotification(n: Notification) {
    // Mark as read
    if (!n.read_at) {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read', notification_id: n.id }),
      });
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    // Navigate
    if (n.action_url) {
      setOpen(false);
      router.push(n.action_url);
    }
  }

  async function handleMarkAllRead() {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_all_read' }),
    });
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })));
    setUnreadCount(0);
  }

  async function handleDismiss(e: React.MouseEvent, notificationId: string) {
    e.stopPropagation();
    // Deleting an unread notification must also take it off the badge.
    const wasUnread = notifications.some((n) => n.id === notificationId && !n.read_at);
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
    try {
      const resp = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss', notification_id: notificationId }),
      });
      if (!resp.ok) throw new Error(`dismiss failed: ${resp.status}`);
    } catch (err) {
      console.error(err);
      loadNotifications(); // re-sync list + badge with the server
    }
  }

  function timeAgo(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMin = Math.floor((now - then) / 60000);
    if (diffMin < 1) return lang === 'ko' ? '방금' : 'just now';
    if (diffMin < 60) return lang === 'ko' ? `${diffMin}분 전` : `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return lang === 'ko' ? `${diffHr}시간 전` : `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return lang === 'ko' ? `${diffDay}일 전` : `${diffDay}d ago`;
    return new Date(dateStr).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric' });
  }

  if (!userId) return null;

  return (
    <div className="bell-wrap">
      <button
        ref={bellRef}
        className="bell-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label={lang === 'ko' ? '알림' : 'Notifications'}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="unread-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div ref={dropdownRef} className="dropdown">
          <div className="dropdown-header">
            <div className="dropdown-title">{lang === 'ko' ? '알림' : 'Notifications'}</div>
            {unreadCount > 0 && (
              <button className="mark-all-btn" onClick={handleMarkAllRead}>
                {lang === 'ko' ? '모두 읽음' : 'Mark all read'}
              </button>
            )}
          </div>

          <div className="dropdown-body">
            {loading ? (
              <div className="dropdown-empty">
                <div className="mini-loader" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="dropdown-empty">
                <div className="empty-icon">🌸</div>
                <p>{lang === 'ko' ? '아직 알림이 없어요' : 'No notifications yet'}</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`notif-item ${n.read_at ? 'read' : 'unread'} ${n.is_important ? 'important' : ''}`}
                  onClick={() => handleClickNotification(n)}
                >
                  <div className="notif-icon">{TYPE_ICONS[n.type] ?? '🔔'}</div>
                  <div className="notif-content">
                    <div className="notif-title">{lang === 'ko' ? n.title_ko : n.title_en}</div>
                    {(lang === 'ko' ? n.body_ko : n.body_en) && (
                      <div className="notif-body">{lang === 'ko' ? n.body_ko : n.body_en}</div>
                    )}
                    <div className="notif-time">{timeAgo(n.created_at)}</div>
                  </div>
                  <button
                    className="dismiss-btn"
                    onClick={(e) => handleDismiss(e, n.id)}
                    aria-label={lang === 'ko' ? '삭제' : 'Dismiss'}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .bell-wrap { position: relative; display: inline-block; }
        .bell-btn { position: relative; background: transparent; border: 0; color: var(--ink); padding: 8px; border-radius: 50%; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: background 0.15s; }
        .bell-btn:hover { background: var(--paper-2); }
        .unread-badge { position: absolute; top: 2px; right: 2px; background: var(--persimmon); color: #fff; font-size: 10px; font-weight: 800; padding: 2px 5px; border-radius: 999px; min-width: 16px; text-align: center; line-height: 1.2; }
        .dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 360px; max-width: 90vw; background: #fff; border: 1px solid var(--ink-12); border-radius: 14px; box-shadow: 0 8px 32px rgba(0,0,0,0.12); z-index: 100; overflow: hidden; }
        .dropdown-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid var(--ink-12); }
        .dropdown-title { font-family: var(--display); font-weight: 800; font-size: 15px; color: var(--ink); }
        .mark-all-btn { background: transparent; border: 0; color: var(--persimmon); font-size: 12px; font-weight: 700; cursor: pointer; padding: 4px 8px; border-radius: 6px; }
        .mark-all-btn:hover { background: rgba(255, 106, 61, 0.08); }
        .dropdown-body { max-height: 480px; overflow-y: auto; }
        .dropdown-empty { padding: 40px 20px; text-align: center; color: var(--ink-60); }
        .empty-icon { font-size: 32px; margin-bottom: 8px; }
        .dropdown-empty p { margin: 0; font-size: 13px; }
        .mini-loader { width: 24px; height: 24px; border: 2px solid var(--ink-12); border-top-color: var(--persimmon); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .notif-item { display: flex; gap: 12px; padding: 12px 16px; cursor: pointer; border-bottom: 1px solid var(--ink-12); transition: background 0.12s; position: relative; }
        .notif-item:last-child { border-bottom: 0; }
        .notif-item:hover { background: var(--paper-2); }
        .notif-item.unread { background: rgba(255, 106, 61, 0.03); }
        .notif-item.unread::before { content: ''; position: absolute; left: 4px; top: 50%; transform: translateY(-50%); width: 6px; height: 6px; background: var(--persimmon); border-radius: 50%; }
        .notif-item.important .notif-title { color: var(--persimmon); }
        .notif-icon { font-size: 20px; flex-shrink: 0; }
        .notif-content { flex: 1; min-width: 0; }
        .notif-title { font-size: 13px; font-weight: 700; color: var(--ink); line-height: 1.3; margin-bottom: 2px; }
        .notif-body { font-size: 12px; color: var(--ink-60); line-height: 1.4; margin-bottom: 4px; }
        .notif-time { font-size: 11px; color: var(--ink-60); }
        .dismiss-btn { background: transparent; border: 0; color: var(--ink-60); font-size: 18px; cursor: pointer; padding: 0 4px; flex-shrink: 0; line-height: 1; align-self: flex-start; opacity: 0.5; transition: opacity 0.15s; }
        .dismiss-btn:hover { opacity: 1; }
      `}</style>
    </div>
  );
}