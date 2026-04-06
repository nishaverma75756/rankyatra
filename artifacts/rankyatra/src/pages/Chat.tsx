import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { MessageCircle, RefreshCw, Check, CheckCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getAuthToken } from "@/lib/auth";

function authFetch(url: string, options?: RequestInit) {
  const token = getAuthToken();
  return fetch(url, {
    ...options,
    headers: { ...(options?.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
}

interface OtherUser { id: number; name: string; avatarUrl: string | null }
interface LastMessage {
  id: number;
  content: string;
  senderId: number;
  isRead: boolean;
  deliveredAt: string | null;
  createdAt: string;
}
interface Conversation {
  id: number;
  otherUser: OtherUser;
  lastMessage: LastMessage | null;
  unreadCount: number;
  updatedAt: string;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function Avatar({ user, size = 44 }: { user: OtherUser; size?: number }) {
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

function MsgTick({ msg }: { msg: LastMessage }) {
  if (msg.isRead) {
    return (
      <span className="inline-flex items-center flex-shrink-0">
        <CheckCheck className="h-3.5 w-3.5 text-green-500" />
      </span>
    );
  }
  if (msg.deliveredAt) {
    return (
      <span className="inline-flex items-center flex-shrink-0">
        <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center flex-shrink-0">
      <Check className="h-3.5 w-3.5 text-muted-foreground" />
    </span>
  );
}

export default function ChatPage() {
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const myId = (user as any)?.id as number | undefined;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await authFetch("/api/chat/conversations");
      if (res.ok) setConversations(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { navigate("/login"); return; }
    fetchConversations();
    const id = setInterval(fetchConversations, 5000);
    return () => clearInterval(id);
  }, [isAuthenticated, authLoading, fetchConversations, navigate]);

  return (
    <div className="max-w-lg mx-auto px-0 pb-24">
      <div className="flex items-center justify-between px-4 pt-6 pb-4 border-b border-border">
        <h1 className="text-2xl font-bold">Messages</h1>
        <button onClick={fetchConversations} className="p-2 rounded-full hover:bg-muted transition-colors">
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center px-8">
          <MessageCircle className="h-14 w-14 text-muted-foreground" />
          <p className="text-lg font-semibold">No messages yet</p>
          <p className="text-sm text-muted-foreground">Visit a user's profile to start a chat</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {conversations.map((c) => {
            const lm = c.lastMessage;
            const isMyMsg = !!lm && myId !== undefined && lm.senderId === myId;
            const hasUnread = c.unreadCount > 0;

            return (
              <button
                key={c.id}
                className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors text-left ${hasUnread ? "bg-green-50/60 dark:bg-green-900/10" : ""}`}
                onClick={() => navigate(`/chat/${c.id}`)}
              >
                {/* Avatar with unread dot */}
                <div className="relative flex-shrink-0">
                  <Avatar user={c.otherUser} />
                  {hasUnread && (
                    <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-background" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Name + Time row */}
                  <div className="flex justify-between items-center mb-0.5">
                    <span className={`text-sm truncate ${hasUnread ? "font-bold text-foreground" : "font-medium text-foreground"}`}>
                      {c.otherUser.name}
                    </span>
                    <span className={`text-xs ml-2 flex-shrink-0 ${hasUnread ? "text-green-600 dark:text-green-400 font-semibold" : "text-muted-foreground"}`}>
                      {c.updatedAt ? timeAgo(c.updatedAt) : ""}
                    </span>
                  </div>

                  {/* Last message + badge row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 min-w-0">
                      {/* Tick for my sent messages */}
                      {isMyMsg && lm && <MsgTick msg={lm} />}
                      <p className={`text-xs truncate ${
                        hasUnread ? "text-foreground font-semibold" : "text-muted-foreground"
                      } ${isMyMsg && !hasUnread ? "text-muted-foreground" : ""}`}>
                        {lm
                          ? (isMyMsg ? `You: ${lm.content}` : lm.content)
                          : "Start chatting"
                        }
                      </p>
                    </div>

                    {/* Unread count badge — green */}
                    {hasUnread && (
                      <span className="flex-shrink-0 bg-green-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                        {c.unreadCount > 99 ? "99+" : c.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
