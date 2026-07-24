'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@/lib/hooks/useUser';
import { supabase } from '@/lib/supabase/client';

type Message = {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  message_type: string;
  is_hidden: boolean;
  created_at: string;
  edited_at: string | null;
};

type GroupMember = {
  user_id: string;
  display_name: string;
  photo_url: string | null;
};

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useUser();
  const [lang, setLang] = useState<'en' | 'ko'>('en');

  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Record<string, GroupMember>>({});
  const [groupInfo, setGroupInfo] = useState<{ venue_name: string; venue_id: string } | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canView, setCanView] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const groupId = params?.group_id as string;

  useEffect(() => {
    document.body.setAttribute('data-lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push(`/sign-in?return=/matches/${groupId}/chat`);
      return;
    }
    initChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, groupId]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function initChat() {
    setLoading(true);
    setError(null);

    // Check access — is user a member of this group?
    const { data: myMembership } = await supabase
      .from('group_members')
      .select('user_id, accepted_at, left_at')
      .eq('group_id', groupId)
      .eq('user_id', user!.id)
      .maybeSingle();

    if (!myMembership || !myMembership.accepted_at || myMembership.left_at) {
      setError(lang === 'ko' ? '이 채팅에 접근할 수 없습니다.' : "You don't have access to this chat.");
      setLoading(false);
      return;
    }

    setCanView(true);

    // Mark as read now that user opened the chat
    await supabase
      .from('group_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('group_id', groupId)
      .eq('user_id', user!.id);

    // Load group members (for display names)
    const { data: membersData } = await supabase
      .from('group_members')
      .select('user_id, profiles:profiles!inner(display_name, photo_url)')
      .eq('group_id', groupId)
      .is('left_at', null);

    if (membersData) {
      const membersMap: Record<string, GroupMember> = {};
      for (const m of membersData as any[]) {
        membersMap[m.user_id] = {
          user_id: m.user_id,
          display_name: m.profiles?.display_name ?? 'Unknown',
          photo_url: m.profiles?.photo_url ?? null,
        };
      }
      setMembers(membersMap);
    }

    // Load quest/venue info for header
    const { data: questData } = await supabase
      .from('quests')
      .select('venue_id, venue:venues!inner(business_name_display)')
      .eq('group_id', groupId)
      .maybeSingle();

    if (questData) {
      setGroupInfo({
        venue_id: questData.venue_id,
        venue_name: (questData as any).venue?.business_name_display ?? '',
      });
    }

    // Load initial messages
    const { data: initialMessages } = await supabase
      .from('messages')
      .select('id, group_id, sender_id, content, message_type, is_hidden, created_at, edited_at')
      .eq('group_id', groupId)
      .eq('is_hidden', false)
      .order('created_at', { ascending: true });

    if (initialMessages) {
      setMessages(initialMessages as Message[]);
    }

    setLoading(false);

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`messages:${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          if (!newMsg.is_hidden) {
            setMessages((prev) => {
              // Prevent duplicates (in case our optimistic update already added it)
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
        }
      )
      .subscribe();

    // Cleanup on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }

  async function sendMessage() {
    const trimmed = inputValue.trim();
    if (!trimmed || sending) return;
    if (trimmed.length > 2000) {
      setError(lang === 'ko' ? '메시지는 2000자 이하여야 합니다.' : 'Message must be under 2000 characters.');
      return;
    }

    setSending(true);
    setError(null);

    const { data, error: err } = await supabase
      .from('messages')
      .insert({
        group_id: groupId,
        sender_id: user!.id,
        content: trimmed,
        message_type: 'user_text',
      })
      .select('id, group_id, sender_id, content, message_type, is_hidden, created_at, edited_at')
      .single();

    if (err) {
      setError(err.message);
      setSending(false);
      return;
    }

    if (data) {
      // Optimistically add — realtime will filter dupes
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev;
        return [...prev, data as Message];
      });
    }

    setInputValue('');
    setSending(false);
    inputRef.current?.focus();
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter to send, Shift+Enter for newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString(lang === 'ko' ? 'ko-KR' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function shouldShowSender(msg: Message, index: number): boolean {
    // Show sender name if it's the first message or the previous message was from a different sender
    if (index === 0) return true;
    const prev = messages[index - 1];
    if (prev.sender_id !== msg.sender_id) return true;
    // Also show if more than 5 min gap
    const gap = new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime();
    return gap > 5 * 60 * 1000;
  }

  if (authLoading || loading) {
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

  if (error && !canView) {
    return (
      <>
        <header className="c-nav">
          <div className="wrap c-nav-in">
            <a className="brand" href="/">Doreham <span className="ko-mark">도레함</span></a>
          </div>
        </header>
        <main className="wrap main-wrap">
          <div className="error-state">
            <div className="error-icon">🔒</div>
            <h2>{error}</h2>
            <button onClick={() => router.push('/matches')} className="btn-primary">
              {lang === 'ko' ? '← 내 그룹으로' : '← Back to matches'}
            </button>
          </div>
        </main>
        <style jsx>{`
          .c-nav { background: rgba(245, 242, 235, 0.9); border-bottom: 1px solid var(--ink-12); }
          .c-nav-in { display: flex; align-items: center; height: 68px; }
          .brand { display: flex; align-items: baseline; gap: 9px; font-family: var(--display); font-weight: 800; font-size: 20px; text-decoration: none; color: var(--ink); }
          .ko-mark { color: var(--ink-60); font-weight: 700; font-size: 17px; }
          .main-wrap { padding: 60px 24px; max-width: 500px; }
          .error-state { text-align: center; padding: 60px 20px; background: var(--paper-2); border-radius: 24px; }
          .error-icon { font-size: 56px; margin-bottom: 20px; }
          .error-state h2 { font-family: var(--display); font-weight: 700; font-size: 24px; margin: 0 0 24px; }
          .btn-primary { background: var(--persimmon); color: #fff; border: 0; padding: 12px 24px; border-radius: 999px; font-weight: 700; font-size: 14px; cursor: pointer; }
        `}</style>
      </>
    );
  }

  const memberCount = Object.keys(members).length;
  const otherMembers = Object.values(members).filter((m) => m.user_id !== user!.id);

  return (
    <div className="chat-app">
      <header className="c-nav">
        <div className="wrap c-nav-in">
          <button className="back-btn" onClick={() => router.push('/matches')}>
            ←
          </button>
          <div className="header-info">
            <div className="header-title">
              {otherMembers.map((m) => m.display_name).join(' · ')}
            </div>
            {groupInfo && (
              <a href={`/venues/${groupInfo.venue_id}`} className="header-sub">
                📍 {groupInfo.venue_name}
              </a>
            )}
          </div>
          <div className="header-count">
            {memberCount} {lang === 'ko' ? '명' : ''}
          </div>
        </div>
      </header>

      <main className="messages-wrap">
        {messages.length === 0 ? (
          <div className="empty-chat">
            <div className="empty-icon">💬</div>
            <p>
              {lang === 'ko'
                ? '아직 메시지가 없어요. 첫 인사를 보내보세요!'
                : "No messages yet. Say hi and get things started!"}
            </p>
          </div>
        ) : (
          <div className="messages-list">
            {messages.map((msg, i) => {
              const isMine = msg.sender_id === user!.id;
              const sender = members[msg.sender_id];
              const showSender = shouldShowSender(msg, i);

              return (
                <div key={msg.id} className={`msg-row ${isMine ? 'mine' : 'theirs'}`}>
                  {!isMine && showSender && sender?.photo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sender.photo_url} alt="" className="msg-avatar" />
                  )}
                  {!isMine && showSender && !sender?.photo_url && (
                    <div className="msg-avatar msg-avatar-fallback">
                      {sender?.display_name[0]?.toUpperCase() ?? '?'}
                    </div>
                  )}
                  {!isMine && !showSender && <div className="msg-avatar-spacer" />}

                  <div className="msg-content">
                    {!isMine && showSender && (
                      <div className="msg-sender">{sender?.display_name ?? '?'}</div>
                    )}
                    <div className={`msg-bubble ${isMine ? 'mine' : 'theirs'}`}>
                      {msg.content}
                    </div>
                    {showSender && (
                      <div className="msg-time">{formatTime(msg.created_at)}</div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      <footer className="input-bar">
        {error && canView && (
          <div className="input-error">
            {error}
            <button onClick={() => setError(null)} className="dismiss">×</button>
          </div>
        )}
        <div className="input-row">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={lang === 'ko' ? '메시지 입력…' : 'Type a message…'}
            rows={1}
            className="msg-input"
            disabled={sending}
          />
          <button
            onClick={sendMessage}
            disabled={sending || !inputValue.trim()}
            className="send-btn"
            aria-label={lang === 'ko' ? '전송' : 'Send'}
          >
            {sending ? '…' : '➤'}
          </button>
        </div>
      </footer>

      <style jsx>{`
        .chat-app {
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow: hidden;
        }
        .c-nav {
          background: rgba(245, 242, 235, 0.95);
          border-bottom: 1px solid var(--ink-12);
          flex-shrink: 0;
          backdrop-filter: blur(8px);
          z-index: 10;
        }
        .c-nav-in {
          display: flex;
          align-items: center;
          gap: 12px;
          height: 68px;
        }
        .back-btn {
          background: transparent;
          border: 0;
          font-size: 24px;
          color: var(--ink);
          cursor: pointer;
          padding: 8px 12px;
          font-weight: 300;
        }
        .header-info {
          flex: 1;
          min-width: 0;
        }
        .header-title {
          font-family: var(--display);
          font-weight: 700;
          font-size: 16px;
          color: var(--ink);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .header-sub {
          display: block;
          font-size: 12px;
          color: var(--ink-60);
          text-decoration: none;
          margin-top: 2px;
        }
        .header-sub:hover {
          color: var(--persimmon);
        }
        .header-count {
          font-size: 13px;
          color: var(--ink-60);
          background: var(--paper-2);
          padding: 4px 10px;
          border-radius: 999px;
          font-weight: 600;
        }
        .messages-wrap {
          flex: 1;
          overflow-y: auto;
          background: var(--paper-2);
          padding: 20px 24px;
        }
        .empty-chat {
          text-align: center;
          padding: 80px 20px;
          color: var(--ink-60);
        }
        .empty-icon {
          font-size: 56px;
          margin-bottom: 16px;
        }
        .empty-chat p {
          font-size: 15px;
          max-width: 300px;
          margin: 0 auto;
          line-height: 1.5;
        }
        .messages-list {
          max-width: 700px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .msg-row {
          display: flex;
          gap: 8px;
          align-items: flex-end;
        }
        .msg-row.mine {
          flex-direction: row-reverse;
        }
        .msg-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          object-fit: cover;
          flex-shrink: 0;
          margin-bottom: 4px;
        }
        .msg-avatar-fallback {
          background: var(--persimmon);
          color: #fff;
          display: grid;
          place-items: center;
          font-weight: 700;
          font-size: 13px;
        }
        .msg-avatar-spacer {
          width: 32px;
          flex-shrink: 0;
        }
        .msg-content {
          display: flex;
          flex-direction: column;
          max-width: 70%;
        }
        .msg-row.mine .msg-content {
          align-items: flex-end;
        }
        .msg-sender {
          font-size: 12px;
          font-weight: 600;
          color: var(--ink-60);
          margin-bottom: 4px;
          padding: 0 4px;
        }
        .msg-bubble {
          padding: 10px 14px;
          border-radius: 18px;
          font-size: 15px;
          line-height: 1.4;
          word-wrap: break-word;
          white-space: pre-wrap;
          max-width: 100%;
        }
        .msg-bubble.theirs {
          background: #fff;
          color: var(--ink);
          border: 1px solid var(--ink-12);
          border-bottom-left-radius: 6px;
        }
        .msg-bubble.mine {
          background: var(--persimmon);
          color: #fff;
          border-bottom-right-radius: 6px;
        }
        .msg-time {
          font-size: 11px;
          color: var(--ink-60);
          margin-top: 2px;
          padding: 0 4px;
        }
        .input-bar {
          border-top: 1px solid var(--ink-12);
          background: #fff;
          flex-shrink: 0;
        }
        .input-error {
          background: rgba(255, 106, 61, 0.1);
          color: var(--persimmon);
          padding: 8px 16px;
          font-size: 13px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .dismiss {
          background: transparent;
          border: 0;
          color: var(--persimmon);
          font-size: 20px;
          cursor: pointer;
        }
        .input-row {
          display: flex;
          gap: 8px;
          padding: 12px 16px;
          max-width: 700px;
          margin: 0 auto;
        }
        .msg-input {
          flex: 1;
          padding: 12px 16px;
          border: 1px solid var(--ink-12);
          border-radius: 22px;
          font-family: var(--body);
          font-size: 15px;
          resize: none;
          outline: none;
          max-height: 120px;
          transition: border-color 0.15s;
        }
        .msg-input:focus {
          border-color: var(--persimmon);
        }
        .msg-input:disabled {
          opacity: 0.6;
        }
        .send-btn {
          background: var(--persimmon);
          color: #fff;
          border: 0;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 18px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          transition: transform 0.12s, opacity 0.12s;
        }
        .send-btn:hover:not(:disabled) {
          transform: scale(1.05);
        }
        .send-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
