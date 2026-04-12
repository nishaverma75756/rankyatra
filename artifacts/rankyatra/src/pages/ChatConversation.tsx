import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, Send, Check, CheckCheck, MoreVertical, UserX, UserCheck, Flag, BellOff, Bell, Share2, ExternalLink, Pencil, Trash2, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getAuthToken } from "@/lib/auth";

function authFetch(url: string, options?: RequestInit) {
  const token = getAuthToken();
  return fetch(url, {
    ...options,
    headers: { ...(options?.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
}

interface Message {
  id: number;
  conversationId: number;
  senderId: number;
  content: string;
  isRead: boolean;
  deliveredAt: string | null;
  readAt: string | null;
  createdAt: string;
  editedAt: string | null;
  isDeletedForEveryone: boolean;
}

interface ConvInfo {
  id: number;
  otherUser: { id: number; name: string; avatarUrl: string | null };
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function formatDateLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function Avatar({ user, size = 36 }: { user: { name: string; avatarUrl: string | null } }) {
  const initials = user.name?.slice(0, 2).toUpperCase() ?? "??";
  if (user.avatarUrl) {
    return <img src={user.avatarUrl} alt={user.name} className="rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <div className="rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary" style={{ width: size, height: size, fontSize: size * 0.33 }}>
      {initials}
    </div>
  );
}

export default function ChatConversation() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user: me, isAuthenticated, isLoading: authLoading } = useAuth();
  const convId = Number(id);

  const [messages, setMessages] = useState<Message[]>([]);
  const [convInfo, setConvInfo] = useState<ConvInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [typingVisible, setTypingVisible] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("harassment");
  const [reportDetails, setReportDetails] = useState("");
  const [msgMenuId, setMsgMenuId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);
  const otherUserIdRef = useRef<number | null>(null);
  const lastTypingSentRef = useRef<number>(0);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) { navigate("/login"); return; }
  }, [isAuthenticated, authLoading, navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const markRead = useCallback(async () => {
    try { await authFetch(`/api/chat/conversations/${convId}/read`, { method: "POST" }); } catch {}
  }, [convId]);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await authFetch(`/api/chat/conversations/${convId}/messages`);
      if (res.ok) {
        const data: Message[] = await res.json();
        if (isMounted.current) setMessages(data);
      }
    } catch {}
    if (isMounted.current) setLoading(false);
    markRead();
  }, [convId, markRead]);

  const fetchConvInfo = useCallback(async () => {
    try {
      const res = await authFetch("/api/chat/conversations");
      if (res.ok) {
        const convs = await res.json();
        const found = convs.find((c: any) => c.id === convId);
        if (found && isMounted.current) setConvInfo({ id: found.id, otherUser: found.otherUser });
      }
    } catch {}
  }, [convId]);

  const fetchOnlineStatus = useCallback(async () => {
    if (!convInfo?.otherUser?.id) return;
    try {
      const res = await authFetch(`/api/chat/online/${convInfo.otherUser.id}`);
      if (res.ok) {
        const d = await res.json();
        if (isMounted.current) { setOtherOnline(d.online); setLastSeen(d.lastSeen); }
      }
    } catch {}
  }, [convInfo?.otherUser?.id]);

  useEffect(() => { fetchConvInfo(); fetchMessages(); }, [fetchConvInfo, fetchMessages]);
  useEffect(() => { otherUserIdRef.current = convInfo?.otherUser?.id ?? null; }, [convInfo?.otherUser?.id]);

  const fetchBlockStatus = useCallback(async () => {
    try {
      const res = await authFetch("/api/me/blocked-users");
      if (res.ok && convInfo?.otherUser?.id) {
        const list: { id: number }[] = await res.json();
        if (isMounted.current) setIsBlocked(list.some((u) => u.id === convInfo.otherUser.id));
      }
    } catch {}
  }, [convInfo?.otherUser?.id]);

  useEffect(() => { fetchBlockStatus(); }, [fetchBlockStatus]);

  const handleDeleteConversation = async () => {
    const name = convInfo?.otherUser?.name ?? "this chat";
    if (!window.confirm(`Delete your chat with ${name}? This is only for you, they won't be notified.`)) return;
    try {
      const token = getAuthToken();
      await fetch(`/api/chat/conversations/${convId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      navigate("/chat");
    } catch {
      alert("Failed to delete chat. Please try again.");
    }
  };

  const handleBlockToggle = async () => {
    const name = convInfo?.otherUser?.name ?? "this user";
    if (isBlocked) {
      if (!window.confirm(`Unblock ${name}?`)) return;
      await authFetch(`/api/users/${convInfo!.otherUser.id}/block`, { method: "DELETE" });
      setIsBlocked(false);
    } else {
      if (!window.confirm(`Block ${name}? They won't be able to message you.`)) return;
      await authFetch(`/api/users/${convInfo!.otherUser.id}/block`, { method: "POST" });
      setIsBlocked(true);
    }
    setMenuOpen(false);
  };

  const fetchMuteStatus = useCallback(async () => {
    if (!convId) return;
    try {
      const res = await authFetch(`/api/chat/conversations/${convId}/mute`);
      if (res.ok) {
        const d = await res.json();
        if (isMounted.current) setIsMuted(d.muted);
      }
    } catch {}
  }, [convId]);

  useEffect(() => { fetchMuteStatus(); }, [fetchMuteStatus]);

  const handleMuteToggle = async () => {
    if (isMuted) {
      await authFetch(`/api/chat/conversations/${convId}/mute`, { method: "DELETE" });
      setIsMuted(false);
    } else {
      await authFetch(`/api/chat/conversations/${convId}/mute`, { method: "POST" });
      setIsMuted(true);
    }
    setMenuOpen(false);
  };

  const handleReport = async () => {
    if (!convInfo?.otherUser?.id) return;
    try {
      await authFetch(`/api/users/${convInfo.otherUser.id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reportReason, details: reportDetails, conversationId: convId }),
      });
      setReportOpen(false);
      setReportDetails("");
      alert("Report submitted. Our team will review it.");
    } catch {
      alert("Failed to submit report. Please try again.");
    }
  };

  const handleShareProfile = () => {
    if (!convInfo?.otherUser?.id) return;
    const url = `${window.location.origin}/user/${convInfo.otherUser.id}`;
    navigator.clipboard.writeText(url).then(() => alert("Profile link copied!")).catch(() => alert(url));
    setMenuOpen(false);
  };
  // Poll online status every 5 seconds
  useEffect(() => {
    fetchOnlineStatus();
    const id = setInterval(fetchOnlineStatus, 5000);
    return () => clearInterval(id);
  }, [fetchOnlineStatus]);

  // WebSocket for real-time
  useEffect(() => {
    const token = localStorage.getItem("rankyatra_token");
    if (!token) return;

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws`);
    wsRef.current = ws;

    let pingInterval: ReturnType<typeof setInterval> | null = null;
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "auth", token }));
      setWsConnected(true);
      pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
      }, 30_000);
    };
    ws.onclose = () => {
      setWsConnected(false);
      if (pingInterval) clearInterval(pingInterval);
    };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "new_message" && msg.message.conversationId === convId) {
          setMessages((prev) => {
            if (prev.find((m) => m.id === msg.message.id)) return prev;
            return [...prev, msg.message];
          });
          markRead();
        }
        if (msg.type === "messages_read" && msg.conversationId === convId) {
          setMessages((prev) => prev.map((m) =>
            m.senderId === (me as any)?.id ? { ...m, isRead: true, readAt: new Date().toISOString() } : m
          ));
        }
        if (msg.type === "typing" && msg.conversationId === convId && msg.userId !== (me as any)?.id) {
          setTypingVisible(true);
          if (typingTimer.current) clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() => setTypingVisible(false), 3000);
        }
        if (msg.type === "message_edited") {
          setMessages((prev) => prev.map((m) => m.id === msg.message.id ? { ...m, content: msg.message.content, editedAt: msg.message.editedAt } : m));
        }
        if (msg.type === "message_deleted") {
          if (msg.mode === "everyone") {
            setMessages((prev) => prev.map((m) => m.id === msg.messageId ? { ...m, isDeletedForEveryone: true, content: "This message was deleted" } : m));
          } else {
            setMessages((prev) => prev.filter((m) => m.id !== msg.messageId));
          }
        }
        // Real-time online/offline status from server push
        if (msg.type === "online_status" && msg.userId === otherUserIdRef.current) {
          if (isMounted.current) {
            setOtherOnline(msg.online);
            if (!msg.online && msg.lastSeen) setLastSeen(msg.lastSeen);
            if (msg.online) setLastSeen(null);
          }
        }
      } catch {}
    };
    ws.onerror = () => ws.close();

    return () => { ws.close(); setWsConnected(false); };
  }, [convId, markRead, me]);

  // Poll messages as fallback when WebSocket is not connected
  useEffect(() => {
    if (wsConnected) return;
    const id = setInterval(fetchMessages, 3000);
    return () => clearInterval(id);
  }, [wsConnected, fetchMessages]);

  const sendTyping = () => {
    // WS path (instant, if connected)
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "typing", conversationId: convId, userId: (me as any)?.id }));
    }
    // REST fallback — throttle to once every 2 seconds
    const now = Date.now();
    if (now - lastTypingSentRef.current > 2000) {
      lastTypingSentRef.current = now;
      authFetch(`/api/chat/conversations/${convId}/typing`, { method: "POST" }).catch(() => {});
    }
  };

  // Poll typing status every 1.5s (REST fallback when WS not connected)
  useEffect(() => {
    const poll = async () => {
      if (!convId || !isMounted.current) return;
      try {
        const res = await authFetch(`/api/chat/conversations/${convId}/typing`);
        if (res.ok && isMounted.current) {
          const d = await res.json();
          if (d.typing) {
            setTypingVisible(true);
            if (typingTimer.current) clearTimeout(typingTimer.current);
            typingTimer.current = setTimeout(() => {
              if (isMounted.current) setTypingVisible(false);
            }, 3000);
          }
        }
      } catch {}
    };
    const id = setInterval(poll, 1500);
    return () => clearInterval(id);
  }, [convId]);

  const handleDeleteMsg = async (msgId: number, mode: "me" | "everyone") => {
    setMsgMenuId(null);
    try {
      await authFetch(`/api/chat/messages/${msgId}?mode=${mode}`, { method: "DELETE" });
      if (mode === "everyone") {
        setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, isDeletedForEveryone: true, content: "This message was deleted" } : m));
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== msgId));
      }
    } catch { alert("Failed to delete message"); }
  };

  const startEdit = (msg: Message) => {
    setEditingId(msg.id);
    setEditText(msg.content);
    setMsgMenuId(null);
  };

  const handleEditSave = async () => {
    if (!editingId || !editText.trim()) return;
    try {
      const res = await authFetch(`/api/chat/messages/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editText.trim() }),
      });
      if (res.ok) {
        const updated = await res.json();
        setMessages((prev) => prev.map((m) => m.id === editingId ? { ...m, content: updated.content, editedAt: updated.editedAt } : m));
        setEditingId(null);
        setEditText("");
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.message ?? "Failed to edit");
      }
    } catch { alert("Failed to edit message"); }
  };

  const handleSend = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setText("");
    setSending(true);
    try {
      const res = await authFetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: convId, content }),
      });
      if (res.ok) {
        const msg: Message = await res.json();
        setMessages((prev) => [...prev, msg]);
      } else {
        const rawText = await res.text().catch(() => "Unknown error");
        let errMsg = rawText;
        try { const j = JSON.parse(rawText); errMsg = j.detail ?? j.message ?? rawText; } catch {}
        alert(`Failed to send message: ${errMsg}`);
        setText(content);
      }
    } catch (err: any) {
      alert(`Network error: ${err?.message ?? "Please retry"}`);
      setText(content);
    }
    setSending(false);
  };

  const statusText = otherOnline
    ? "Online"
    : lastSeen
    ? `Last seen ${new Date(lastSeen).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}`
    : "Offline";

  const myId = (me as any)?.id;

  // Group messages by date
  let lastDateLabel = "";

  return (
    <div className="flex flex-col max-w-2xl mx-auto h-[100dvh]">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-3 border-b border-border bg-background/95 backdrop-blur sticky top-0 z-10">
        <button onClick={() => navigate("/chat")} className="p-1.5 rounded-full hover:bg-muted transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <a
          href={convInfo?.otherUser?.id ? `/user/${convInfo.otherUser.id}` : undefined}
          className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity cursor-pointer"
        >
          {convInfo?.otherUser && <Avatar user={convInfo.otherUser} />}
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{convInfo?.otherUser?.name ?? "Chat"}</p>
            <div className="flex items-center gap-1.5">
              <span className={`inline-block w-2 h-2 rounded-full ${otherOnline ? "bg-green-500" : "bg-muted-foreground"}`} />
              <span className={`text-xs ${otherOnline ? "text-green-500" : "text-muted-foreground"}`}>{statusText}</span>
            </div>
          </div>
        </a>
        {/* 3-dot menu */}
        <div className="relative">
          <button onClick={() => setMenuOpen((o) => !o)} className="p-1.5 rounded-full hover:bg-muted transition-colors">
            <MoreVertical className="h-5 w-5" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-9 bg-card border border-border rounded-xl shadow-lg z-20 py-1 min-w-[190px]" onMouseLeave={() => setMenuOpen(false)}>
              {/* View Profile */}
              <a
                href={`/user/${convInfo?.otherUser?.id}`}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted text-foreground"
              >
                <ExternalLink className="h-4 w-4" />
                View Profile
              </a>
              {/* Share Profile */}
              <button
                onClick={handleShareProfile}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted text-foreground"
              >
                <Share2 className="h-4 w-4" />
                Share Profile
              </button>
              <div className="h-px bg-border mx-2 my-1" />
              {/* Mute */}
              <button
                onClick={handleMuteToggle}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted text-foreground"
              >
                {isMuted ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                {isMuted ? "Unmute" : "Mute Notifications"}
              </button>
              <div className="h-px bg-border mx-2 my-1" />
              {/* Report */}
              <button
                onClick={() => { setReportOpen(true); setMenuOpen(false); }}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted text-orange-500"
              >
                <Flag className="h-4 w-4" />
                Report
              </button>
              <div className="h-px bg-border mx-2 my-1" />
              {/* Delete Chat */}
              <button
                onClick={() => { setMenuOpen(false); handleDeleteConversation(); }}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted text-red-500"
              >
                <Trash2 className="h-4 w-4" />
                Delete Chat
              </button>
              {/* Block */}
              <button
                onClick={handleBlockToggle}
                className={`flex items-center gap-2.5 w-full px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted ${isBlocked ? "text-green-500" : "text-red-500"}`}
              >
                {isBlocked ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
                {isBlocked ? "Unblock User" : "Block User"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <>
            {messages.map((msg) => {
              const isMine = msg.senderId === myId;
              const dateLabel = formatDateLabel(msg.createdAt);
              const showLabel = dateLabel !== lastDateLabel;
              lastDateLabel = dateLabel;

              const isDeleted = msg.isDeletedForEveryone;
              const canEditAny = isMine && !isDeleted;

              return (
                <div key={msg.id}>
                  {showLabel && (
                    <div className="flex justify-center my-4">
                      <span className="bg-muted text-muted-foreground text-xs px-3 py-1 rounded-full">{dateLabel}</span>
                    </div>
                  )}
                  <div className={`flex items-end gap-1.5 ${isMine ? "justify-end" : "justify-start"} mb-0.5 group relative`}>
                    {/* Avatar for received messages */}
                    {!isMine && convInfo?.otherUser && (
                      <a href={`/user/${convInfo.otherUser.id}`} className="flex-shrink-0 mb-0.5 hover:opacity-75 transition-opacity">
                        <Avatar user={convInfo.otherUser} size={26} />
                      </a>
                    )}

                    {/* 3-dot button — appears on hover */}
                    {!isDeleted && (
                      <div className={`flex-shrink-0 relative self-center ${isMine ? "order-first" : "order-last"}`}>
                        <button
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-muted"
                          onClick={() => setMsgMenuId(msgMenuId === msg.id ? null : msg.id)}
                        >
                          <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        {msgMenuId === msg.id && (
                          <div className={`absolute bottom-6 ${isMine ? "right-0" : "left-0"} bg-card border border-border rounded-xl shadow-xl z-30 py-1 min-w-[160px]`}
                            onMouseLeave={() => setMsgMenuId(null)}>
                            {/* Edit — only sender, within 15 min */}
                            {canEditAny && (
                              <button
                                onClick={() => startEdit(msg)}
                                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors"
                              >
                                <Pencil className="h-3.5 w-3.5 text-blue-500" />
                                Edit
                              </button>
                            )}
                            {/* Delete for me */}
                            <button
                              onClick={() => handleDeleteMsg(msg.id, "me")}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors text-muted-foreground"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete for me
                            </button>
                            {/* Delete for everyone — only sender */}
                            {isMine && (
                              <button
                                onClick={() => handleDeleteMsg(msg.id, "everyone")}
                                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors text-red-500"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete for everyone
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div className={`max-w-[72%] px-3 py-2 rounded-2xl ${isMine
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-slate-200 dark:bg-slate-700 text-foreground rounded-bl-sm"
                    } ${isDeleted ? "opacity-60" : ""}`}>
                      {isDeleted ? (
                        <p className="text-sm italic leading-relaxed">🚫 This message was deleted</p>
                      ) : (
                        <p className="text-sm leading-relaxed break-words">{msg.content}</p>
                      )}
                      <div className="flex items-center justify-end gap-1 mt-0.5">
                        {msg.editedAt && !isDeleted && (
                          <span className={`text-[10px] ${isMine ? "text-primary-foreground/50" : "text-slate-400"}`}>edited</span>
                        )}
                        <span className={`text-[10px] ${isMine ? "text-primary-foreground/60" : "text-slate-500 dark:text-slate-400"}`}>
                          {formatTime(msg.createdAt)}
                        </span>
                        {isMine && !isDeleted && (
                          msg.isRead
                            ? <CheckCheck className="h-3 w-3 text-blue-300" />
                            : msg.deliveredAt
                            ? <CheckCheck className="h-3 w-3 text-primary-foreground/50" />
                            : <Check className="h-3 w-3 text-primary-foreground/50" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
                <p className="text-muted-foreground text-sm">No messages yet. Say hi!</p>
              </div>
            )}
            {typingVisible && (
              <div className="flex items-end gap-1.5 justify-start mb-1">
                {convInfo?.otherUser && (
                  <a href={`/user/${convInfo.otherUser.id}`} className="flex-shrink-0 mb-0.5 hover:opacity-75 transition-opacity">
                    <Avatar user={convInfo.otherUser} size={26} />
                  </a>
                )}
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 px-3.5 py-2.5 rounded-2xl rounded-bl-sm flex items-center gap-2">
                  <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                    {convInfo?.otherUser?.name?.split(" ")[0]} is typing
                  </span>
                  <span className="flex items-center gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 dark:bg-orange-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 dark:bg-orange-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 dark:bg-orange-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-border bg-background/95 backdrop-blur">
        {editingId ? (
          <div>
            <div className="flex items-center gap-2 mb-1.5 px-1">
              <Pencil className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-xs text-blue-500 font-medium">Editing message</span>
              <button onClick={() => { setEditingId(null); setEditText(""); }} className="ml-auto p-0.5 rounded hover:bg-muted">
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
            <div className="flex items-end gap-2">
              <textarea
                className="flex-1 resize-none rounded-2xl border border-blue-400 bg-card text-sm px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-300 max-h-28 leading-relaxed"
                value={editText}
                rows={1}
                maxLength={1000}
                autoFocus
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEditSave(); } if (e.key === "Escape") { setEditingId(null); setEditText(""); } }}
              />
              <button
                onClick={handleEditSave}
                disabled={!editText.trim()}
                className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${editText.trim() ? "bg-blue-500 hover:bg-blue-600" : "bg-muted cursor-not-allowed"}`}
              >
                <Check className={`h-4 w-4 ${editText.trim() ? "text-white" : "text-muted-foreground"}`} />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              className="flex-1 resize-none rounded-2xl border border-border bg-card text-sm px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/30 max-h-28 leading-relaxed"
              placeholder="Type a message..."
              value={text}
              rows={1}
              maxLength={1000}
              onChange={(e) => { setText(e.target.value); sendTyping(); }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            />
            <button
              onClick={handleSend}
              disabled={!text.trim() || sending}
              className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                text.trim() ? "bg-primary hover:bg-primary/90" : "bg-muted cursor-not-allowed"
              }`}
            >
              {sending
                ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                : <Send className={`h-4 w-4 ${text.trim() ? "text-primary-foreground" : "text-muted-foreground"}`} />
              }
            </button>
          </div>
        )}
      </div>

      {/* Report Modal */}
      {reportOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setReportOpen(false)}>
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4">
              <Flag className="h-5 w-5 text-red-500" />
              <h2 className="text-lg font-bold">Report {convInfo?.otherUser?.name ?? "User"}</h2>
            </div>
            <label className="block text-sm font-semibold mb-1">Reason</label>
            <select
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={reportReason}
              onChange={e => setReportReason(e.target.value)}
            >
              <option value="harassment">Harassment</option>
              <option value="spam">Spam</option>
              <option value="fake">Fake Profile</option>
              <option value="inappropriate">Inappropriate Content</option>
              <option value="other">Other</option>
            </select>
            <label className="block text-sm font-semibold mb-1">Additional Details (optional)</label>
            <textarea
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm mb-4 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              rows={3}
              placeholder="Describe the issue..."
              value={reportDetails}
              onChange={e => setReportDetails(e.target.value)}
              maxLength={500}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setReportOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReport}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
