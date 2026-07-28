'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@/lib/hooks/useUser';
import { supabase } from '@/lib/supabase/client';

const ADMIN_USER_ID = 'dc511479-3d65-4dc4-a2da-55cbca7f9456';

type Message = {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  message_type: string;
  is_hidden: boolean;
  created_at: string;
  edited_at: string | null;
  reply_to_id: string | null;
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

  const [contextMenu, setContextMenu] = useState<{ message: Message; x: number; y: number } | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editText, setEditText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const groupId = params?.group_id as string;
  const isAdmin = user?.id === ADMIN_USER_ID;

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
    if (!canView || !user) return;

    const channel = supabase
      .channel(`messages:${groupId}:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `group_id=eq.${groupId}` },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `group_id=eq.${groupId}` },
        (payload) => {
          const updated = payload.new as Message;
          setMessages((prev) => prev.map((m) => m.id === updated.id ? updated : m));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [canView, user, groupId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!contextMenu) return;

    function handleClick() { setContextMenu(null); }

    const timer = setTimeout(() => {
      document.addEventListener('click', handleClick);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClick);
    };
  }, [contextMenu]);

  async function initChat() {
    setLoading(true);
    setError(null);

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

    await supabase
      .from('group_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('group_id', groupId)
      .eq('user_id', user!.id);

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

    const { data: initialMessages } = await supabase
      .from('messages')
      .select('id, group_id, sender_id, content, message_type, is_hidden, created_at, edited_at, reply_to_id')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });

    if (initialMessages) setMessages(initialMessages as Message[]);
    setLoading(false);
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

    const insertData: any = {
      group_id: groupId,
      sender_id: user!.id,
      content: trimmed,
      message_type: 'user_text',
    };

    if (replyingTo) {
      insertData.reply_to_id = replyingTo.id;
    }

    const { data, error: err } = await supabase
      .from('messages')
      .insert(insertData)
      .select('id, group_id, sender_id, content, message_type, is_hidden, created_at, edited_at, reply_to_id')
      .single();

    if (err) { setError(err.message); setSending(false); return; }

    if (data) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev;
        return [...prev, data as Message];
      });
    }

    setInputValue('');
    setReplyingTo(null);
    setSending(false);
    inputRef.current?.focus();
  }

  async function saveEdit() {
    if (!editingMessage) return;
    const trimmed = editText.trim();
    if (!trimmed) return;

    const { error: err } = await supabase
      .from('messages')
      .update({
        content: trimmed,
        edited_at: new Date().toISOString(),
      })
      .eq('id', editingMessage.id);

    if (err) { setError(err.message); return; }

    setEditingMessage(null);
    setEditText('');
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleMessageClick(e: React.MouseEvent, message: Message) {
    e.stopPropagation();
    if (message.is_hidden) return;
    if (editingMessage) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setContextMenu({
      message,
      x: rect.left,
      // anchor to the top of the message so the menu can appear above it
      y: rect.top,
    });
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString(lang === 'ko' ? 'ko-KR' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  function shouldShowSender(msg: Message, index: number): boolean {
    if (index === 0) return true;
    const prev = messages[index - 1];
    if (prev.sender_id !== msg.sender_id) return true;
    const gap = new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime();
    return gap > 5 * 60 * 1000;
  }

  function canEditMessage(msg: Message): boolean {
    if (msg.sender_id !== user?.id) return false;
    if (isAdmin) return true;
    const age = Date.now() - new Date(msg.created_at).getTime();
    return age < 15 * 60 * 1000;
  }

  function getReplyPreview(replyId: string): { sender: string; content: string } | null {
    const replied = messages.find((m) => m.id === replyId);
    if (!replied) return null;
    if (replied.is_hidden) {
      return { sender: '', content: lang === 'ko' ? '(삭제된 메시지)' : '(deleted)' };
    }
    const sender = members[replied.sender_id]?.display_name ?? '?';
    return { sender, content: replied.content.length > 80 ? replied.content.substring(0, 80) + '…' : replied.content };
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
          <button className="back-btn" onClick={() => router.push('/matches')}>←</button>
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
          <div className="header-count">{memberCount} {lang === 'ko' ? '명' : ''}</div>
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
              const isBeingEdited = editingMessage?.id === msg.id;
              const replyPreview = msg.reply_to_id ? getReplyPreview(msg.reply_to_id) : null;

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

                    {replyPreview && (
                      <div className={`reply-preview ${isMine ? 'mine' : 'theirs'}`}>
                        {replyPreview.sender && <div className="reply-sender">↩ {replyPreview.sender}</div>}
                        <div className="reply-content">{replyPreview.content}</div>
                      </div>
                    )}

                    {msg.is_hidden ? (
                      <div className={`msg-bubble ${isMine ? 'mine' : 'theirs'} deleted-bubble`}>
                        <em>{lang === 'ko' ? '삭제된 메시지' : 'Message deleted'}</em>
                      </div>
                    ) : isBeingEdited ? (
                      <div className={`msg-bubble ${isMine ? 'mine' : 'theirs'} editing`}>
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
                            if (e.key === 'Escape') { setEditingMessage(null); setEditText(''); }
                          }}
                          className="edit-textarea"
                          autoFocus
                          rows={2}
                        />
                        <div className="edit-actions">
                          <button className="edit-cancel" onClick={() => { setEditingMessage(null); setEditText(''); }}>
                            {lang === 'ko' ? '취소' : 'Cancel'}
                          </button>
                          <button className="edit-save" onClick={saveEdit}>
                            {lang === 'ko' ? '저장' : 'Save'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`msg-bubble ${isMine ? 'mine' : 'theirs'} clickable`}
                        onClick={(e) => handleMessageClick(e, msg)}
                      >
                        {msg.content}
                        {msg.edited_at && (
                          <span className="edited-tag"> ({lang === 'ko' ? '수정됨' : 'edited'})</span>
                        )}
                      </div>
                    )}

                    {showSender && !isBeingEdited && (
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
        {replyingTo && (
          <div className="reply-bar">
            <div className="reply-bar-info">
              <span className="reply-arrow">↩</span>
              <div>
                <div className="reply-bar-sender">
                  {lang === 'ko' ? '답장: ' : 'Replying to: '}
                  {members[replyingTo.sender_id]?.display_name ?? '?'}
                </div>
                <div className="reply-bar-content">
                  {replyingTo.content.length > 100 ? replyingTo.content.substring(0, 100) + '…' : replyingTo.content}
                </div>
              </div>
            </div>
            <button className="reply-cancel" onClick={() => setReplyingTo(null)}>×</button>
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

      {contextMenu && (
        <div
          className="context-menu"
          // position the menu above the message by using `bottom` calculated from the
          // viewport height and the message top coordinate we stored in `y`.
          style={{ left: Math.min(contextMenu.x, window.innerWidth - 180), bottom: window.innerHeight - contextMenu.y + 6 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="ctx-item"
            onClick={() => {
              setReplyingTo(contextMenu.message);
              setContextMenu(null);
              inputRef.current?.focus();
            }}
          >
            ↩ {lang === 'ko' ? '답장' : 'Reply'}
          </button>
          {canEditMessage(contextMenu.message) && (
            <button
              className="ctx-item"
              onClick={() => {
                setEditingMessage(contextMenu.message);
                setEditText(contextMenu.message.content);
                setContextMenu(null);
              }}
            >
              ✏ {lang === 'ko' ? '수정' : 'Edit'}
            </button>
          )}
        </div>
      )}

      <style jsx>{`
        .chat-app { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
        .c-nav { background: rgba(245, 242, 235, 0.95); border-bottom: 1px solid var(--ink-12); flex-shrink: 0; backdrop-filter: blur(8px); z-index: 10; }
        .c-nav-in { display: flex; align-items: center; gap: 12px; height: 68px; }
        .back-btn { background: transparent; border: 0; font-size: 24px; color: var(--ink); cursor: pointer; padding: 8px 12px; font-weight: 300; }
        .header-info { flex: 1; min-width: 0; }
        .header-title { font-family: var(--display); font-weight: 700; font-size: 16px; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .header-sub { display: block; font-size: 12px; color: var(--ink-60); text-decoration: none; margin-top: 2px; }
        .header-sub:hover { color: var(--persimmon); }
        .header-count { font-size: 13px; color: var(--ink-60); background: var(--paper-2); padding: 4px 10px; border-radius: 999px; font-weight: 600; }
        .messages-wrap { flex: 1; overflow-y: auto; background: var(--paper-2); padding: 20px 24px; }
        .empty-chat { text-align: center; padding: 80px 20px; color: var(--ink-60); }
        .empty-icon { font-size: 56px; margin-bottom: 16px; }
        .empty-chat p { font-size: 15px; max-width: 300px; margin: 0 auto; line-height: 1.5; }
        .messages-list { max-width: 700px; margin: 0 auto; display: flex; flex-direction: column; gap: 4px; }
        .msg-row { display: flex; gap: 8px; align-items: flex-end; }
        .msg-row.mine { flex-direction: row-reverse; }
        .msg-avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex-shrink: 0; margin-bottom: 4px; }
        .msg-avatar-fallback { background: var(--persimmon); color: #fff; display: grid; place-items: center; font-weight: 700; font-size: 13px; }
        .msg-avatar-spacer { width: 32px; flex-shrink: 0; }
        .msg-content { display: flex; flex-direction: column; max-width: 70%; }
        .msg-row.mine .msg-content { align-items: flex-end; }
        .msg-sender { font-size: 12px; font-weight: 600; color: var(--ink-60); margin-bottom: 4px; padding: 0 4px; }
        .reply-preview {
          background: rgba(30, 34, 48, 0.05);
          border-left: 3px solid var(--persimmon);
          padding: 6px 10px;
          border-radius: 8px 8px 0 0;
          font-size: 12px;
          max-width: 100%;
          margin-bottom: -2px;
        }
        .reply-preview.mine {
          background: rgba(192, 76, 76, 0.2);
          border-left-color: #fff;
        }
        .reply-preview .reply-sender {
          font-weight: 700;
          color: var(--persimmon);
          font-size: 11px;
          margin-bottom: 2px;
        }
        .reply-preview.mine .reply-sender { 
          color: #fff !important; 
        }
        .reply-preview .reply-content {
          color: var(--ink-60);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .reply-preview.mine .reply-content { 
          color: rgba(255, 255, 255, 0.9) !important; 
        }
        .msg-bubble { padding: 10px 14px; border-radius: 18px; font-size: 15px; line-height: 1.4; word-wrap: break-word; white-space: pre-wrap; max-width: 100%; }
        .msg-bubble.theirs { background: #fff; color: var(--ink); border: 1px solid var(--ink-12); border-bottom-left-radius: 6px; }
        .msg-bubble.mine { background: var(--persimmon); color: #fff; border-bottom-right-radius: 6px; }
        .msg-bubble.clickable { cursor: pointer; }
        .msg-bubble.clickable:hover { opacity: 0.9; }
        .msg-bubble.deleted-bubble { opacity: 0.6; font-style: italic; }
        .msg-bubble.editing { padding: 8px; }
        .edited-tag { font-size: 11px; opacity: 0.7; font-style: italic; }
        .edit-textarea {
          width: 100%;
          min-width: 220px;
          padding: 8px 12px;
          border: 1px solid rgba(255,255,255,0.3);
          border-radius: 8px;
          background: rgba(255,255,255,0.15);
          color: inherit;
          font-family: var(--body);
          font-size: 14px;
          resize: vertical;
          outline: none;
        }
        .msg-bubble.theirs .edit-textarea {
          background: #fff;
          border-color: var(--ink-12);
        }
        .edit-actions { display: flex; gap: 6px; justify-content: flex-end; margin-top: 6px; }
        .edit-cancel, .edit-save {
          padding: 4px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          border: 0;
        }
        .edit-cancel { background: rgba(0,0,0,0.15); color: inherit; }
        .msg-bubble.theirs .edit-cancel { background: var(--paper-2); color: var(--ink); }
        .edit-save { background: rgba(255,255,255,0.25); color: inherit; }
        .msg-bubble.theirs .edit-save { background: var(--jade); color: #fff; }
        .msg-time { font-size: 11px; color: var(--ink-60); margin-top: 2px; padding: 0 4px; }
        .input-bar { border-top: 1px solid var(--ink-12); background: #fff; flex-shrink: 0; }
        .input-error { background: rgba(255, 106, 61, 0.1); color: var(--persimmon); padding: 8px 16px; font-size: 13px; display: flex; justify-content: space-between; align-items: center; }
        .dismiss { background: transparent; border: 0; color: var(--persimmon); font-size: 20px; cursor: pointer; }
        .reply-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 16px;
          background: var(--paper-2);
          border-top: 1px solid var(--ink-12);
          max-width: 700px;
          margin: 0 auto;
        }
        .reply-bar-info { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
        .reply-arrow { color: var(--persimmon); font-size: 18px; flex-shrink: 0; }
        .reply-bar-sender { font-size: 12px; font-weight: 700; color: var(--persimmon); }
        .reply-bar-content { font-size: 13px; color: var(--ink-60); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .reply-cancel { background: transparent; border: 0; font-size: 24px; color: var(--ink-60); cursor: pointer; padding: 0 8px; }
        .reply-cancel:hover { color: var(--ink); }
        .input-row { display: flex; gap: 8px; padding: 12px 16px; max-width: 700px; margin: 0 auto; }
        .msg-input { flex: 1; padding: 12px 16px; border: 1px solid var(--ink-12); border-radius: 22px; font-family: var(--body); font-size: 15px; resize: none; outline: none; max-height: 120px; transition: border-color 0.15s; }
        .msg-input:focus { border-color: var(--persimmon); }
        .msg-input:disabled { opacity: 0.6; }
        .send-btn { background: var(--persimmon); color: #fff; border: 0; width: 44px; height: 44px; border-radius: 50%; cursor: pointer; font-size: 18px; display: grid; place-items: center; flex-shrink: 0; transition: transform 0.12s, opacity 0.12s; }
        .send-btn:hover:not(:disabled) { transform: scale(1.05); }
        .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .context-menu {
          position: fixed;
          background: #fff;
          border: 1px solid var(--ink-12);
          border-radius: 12px;
          box-shadow: 0 12px 28px rgba(0,0,0,0.15);
          padding: 6px;
          z-index: 200;
          min-width: 140px;
        }
        .ctx-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 10px 14px;
          background: transparent;
          border: 0;
          font-family: var(--body);
          font-size: 14px;
          font-weight: 500;
          color: var(--ink);
          cursor: pointer;
          text-align: left;
          border-radius: 8px;
        }
        .ctx-item:hover { background: var(--paper-2); }
        .ctx-item.danger { color: var(--persimmon); }
        .ctx-item.danger:hover { background: rgba(255, 106, 61, 0.08); }
      `}</style>
    </div>
  );
}