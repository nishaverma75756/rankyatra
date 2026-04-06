import { useState, useEffect, useCallback, useRef } from "react";
import { Heart, MessageSquare, Send, MoreVertical, Search, Bell, MessageCircle, Plus, X, Camera, Trash2, UserPlus, UserCheck, Eye, Edit2, Flag, UserX, Share2, Copy, ExternalLink } from "lucide-react";
import { formatUID } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow } from "date-fns";

interface Post {
  id: number;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  userId: number;
  userName: string;
  userAvatar: string | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
  isFollowing: boolean;
  shareCount: number;
  updatedAt: string;
  verificationStatus: string;
  rankPoints: number;
  topCommentContent: string | null;
  topCommentUser: string | null;
  topCommentUserAvatar: string | null;
  topReplyContent: string | null;
  topReplyUser: string | null;
  topReplyUserAvatar: string | null;
}

interface SearchUser {
  id: number;
  name: string;
  avatarUrl: string | null;
}

interface Liker {
  id: number;
  name: string;
  avatarUrl: string | null;
}

interface Notification {
  id: number;
  type: string;
  isRead: boolean;
  createdAt: string;
  postId: number | null;
  fromUserId: number;
  fromUserName: string;
  fromUserAvatar: string | null;
}

function timeAgo(iso: string) {
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); } catch { return ""; }
}

function UserAvatar({ name, url, size = "w-10 h-10" }: { name: string; url: string | null; size?: string }) {
  return (
    <div className={`${size} rounded-full overflow-hidden flex-shrink-0 bg-primary/10 flex items-center justify-center`}>
      {url
        ? <img src={url} alt={name} className="w-full h-full object-cover" />
        : <span className="text-primary font-bold text-sm">{name?.slice(0, 2).toUpperCase()}</span>
      }
    </div>
  );
}

// ─── Create Post Modal ───────────────────────────────────────────────────────
function CreatePostModal({ onClose, onCreated }: { onClose: () => void; onCreated: (p: Post) => void }) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handlePost = async () => {
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    try {
      const post = await customFetch<Post>("/api/posts", {
        method: "POST",
        body: JSON.stringify({ content: content.trim() }),
        headers: { "Content-Type": "application/json" },
      });
      onCreated(post);
      onClose();
    } catch { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="bg-background rounded-2xl w-full max-w-lg shadow-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Create Post</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>
        <div className="flex gap-3">
          <UserAvatar name={user?.name ?? "?"} url={user?.avatarUrl ?? null} />
          <div className="flex-1">
            <p className="font-semibold text-sm mb-2">{user?.name}</p>
            <Textarea
              placeholder="What's on your mind? Share your exam journey..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="resize-none min-h-[120px] border-none bg-muted/40 focus-visible:ring-1"
              maxLength={500}
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">{content.length}/500</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handlePost} disabled={!content.trim() || submitting} className="gap-2">
            <Send size={15} /> Post
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Post Modal ──────────────────────────────────────────────────────────
function EditPostModal({ post, onClose, onUpdated }: { post: Post; onClose: () => void; onUpdated: (content: string) => void }) {
  const [content, setContent] = useState(post.content);
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    if (!content.trim() || submitting || content === post.content) return;
    setSubmitting(true);
    try {
      await customFetch(`/api/posts/${post.id}`, {
        method: "PUT",
        body: JSON.stringify({ content: content.trim() }),
        headers: { "Content-Type": "application/json" },
      });
      onUpdated(content.trim());
      onClose();
    } catch { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="bg-background rounded-2xl w-full max-w-lg shadow-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Edit Post</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="resize-none min-h-[120px] border-none bg-muted/40 focus-visible:ring-1"
          maxLength={500}
          autoFocus
        />
        <p className="text-xs text-muted-foreground mt-1 text-right">{content.length}/500</p>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!content.trim() || submitting || content === post.content}>
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Report Modal ─────────────────────────────────────────────────────────────
const REPORT_REASONS = [
  { value: "spam", label: "Spam or misleading" },
  { value: "hate", label: "Hate speech or harassment" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "fake", label: "Fake or impersonation" },
  { value: "other", label: "Other" },
];

function ReportModal({ postId, reportedUserId, type, onClose }: {
  postId?: number; reportedUserId: number; type: "post" | "profile"; onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!reason || submitting) return;
    setSubmitting(true);
    try {
      const url = type === "post" ? `/api/posts/${postId}/report` : `/api/users/${reportedUserId}/report`;
      await customFetch(url, {
        method: "POST",
        body: JSON.stringify({ reason, details }),
        headers: { "Content-Type": "application/json" },
      });
      setDone(true);
    } catch { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="bg-background rounded-2xl w-full max-w-md shadow-xl p-5">
        {done ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-3">✅</div>
            <h3 className="font-bold text-lg">Report Submitted</h3>
            <p className="text-muted-foreground text-sm mt-1">We'll review and take action.</p>
            <Button className="mt-4" onClick={onClose}>Done</Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Report {type === "post" ? "Post" : "Profile"}</h3>
              <button onClick={onClose}><X size={20} className="text-muted-foreground" /></button>
            </div>
            <div className="space-y-2 mb-3">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setReason(r.value)}
                  className={`w-full text-left px-4 py-2.5 rounded-xl text-sm border transition-all ${reason === r.value ? "border-primary bg-primary/5 font-semibold" : "border-border hover:bg-muted"}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <textarea
              className="w-full bg-muted rounded-xl px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-primary/30 min-h-[70px]"
              placeholder="Additional details (optional)..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={300}
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!reason || submitting} className="gap-2">
                <Flag size={14} /> Submit Report
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Share Modal ─────────────────────────────────────────────────────────────
function ShareModal({ postId, postContent, posterName, onClose }: {
  postId: number; postContent: string; posterName: string; onClose: () => void;
}) {
  const [, navigate] = useLocation();
  const [copied, setCopied] = useState(false);
  const postUrl = `${window.location.origin}/post/${postId}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(postUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    customFetch(`/api/posts/${postId}/share`, { method: "POST" }).catch(() => {});
  };

  const shareExternal = async () => {
    customFetch(`/api/posts/${postId}/share`, { method: "POST" }).catch(() => {});
    try {
      await navigator.share({ title: `${posterName} on RankYatra`, text: postContent.slice(0, 100), url: postUrl });
    } catch {
      await navigator.clipboard.writeText(postUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    onClose();
  };

  const shareInChat = () => {
    customFetch(`/api/posts/${postId}/share`, { method: "POST" }).catch(() => {});
    navigate(`/chat`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-background rounded-2xl w-full max-w-sm shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-bold text-base">Share Post</h3>
          <button onClick={onClose}><X size={20} className="text-muted-foreground" /></button>
        </div>

        {/* Post URL preview */}
        <div className="mx-4 mt-3 flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2">
          <ExternalLink size={13} className="text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground truncate flex-1">{postUrl}</span>
          <button onClick={copyLink} className={`text-xs font-semibold shrink-0 ${copied ? "text-green-500" : "text-primary"}`}>
            {copied ? "✓ Copied!" : "Copy"}
          </button>
        </div>

        <div className="p-4 space-y-2">
          {/* Share in Chat */}
          <button
            onClick={shareInChat}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border hover:bg-muted transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <MessageCircle size={20} className="text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">Share in Chat</p>
              <p className="text-xs text-muted-foreground">Send to someone on RankYatra</p>
            </div>
          </button>

          {/* Share on Social Media */}
          <button
            onClick={shareExternal}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border hover:bg-muted transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
              <Share2 size={20} className="text-blue-500" />
            </div>
            <div>
              <p className="font-semibold text-sm">Share on Social Media</p>
              <p className="text-xs text-muted-foreground">WhatsApp, Instagram, Twitter & more</p>
            </div>
          </button>

          {/* Copy Link */}
          <button
            onClick={copyLink}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border hover:bg-muted transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Copy size={18} className="text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-sm">{copied ? "✓ Link Copied!" : "Copy Link"}</p>
              <p className="text-xs text-muted-foreground">Share the post URL anywhere</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Likes Modal ──────────────────────────────────────────────────────────────
function LikesModal({ postId, onClose }: { postId: number; onClose: () => void }) {
  const [likers, setLikers] = useState<Liker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    customFetch<Liker[]>(`/api/posts/${postId}/likers`).then(setLikers).catch(() => {}).finally(() => setLoading(false));
  }, [postId]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="bg-background rounded-2xl w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-bold text-base">Liked by</h3>
          <button onClick={onClose}><X size={20} className="text-muted-foreground" /></button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : likers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">No likes yet</p>
          ) : likers.map((u) => (
            <Link key={u.id} href={`/user/${u.id}`} onClick={onClose}>
              <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
                <UserAvatar name={u.name} url={u.avatarUrl} size="w-9 h-9" />
                <div>
                  <p className="font-semibold text-sm">{u.name}</p>
                  <p className="text-xs text-muted-foreground">UID: {u.id}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Search Modal ─────────────────────────────────────────────────────────────
function SearchModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [followMap, setFollowMap] = useState<Record<number, boolean>>({});
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    clearTimeout(timer.current);
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const data = await customFetch<SearchUser[]>(`/api/users/search?q=${encodeURIComponent(query)}`);
        setResults(data);
      } catch {} finally { setLoading(false); }
    }, 400);
  }, [query]);

  const handleFollow = async (uid: number, cur: boolean) => {
    await customFetch(`/api/users/${uid}/follow`, { method: cur ? "DELETE" : "POST" }).catch(() => {});
    setFollowMap((m) => ({ ...m, [uid]: !cur }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b">
        <button onClick={onClose}><X size={22} className="text-muted-foreground" /></button>
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            className="w-full bg-muted rounded-full pl-9 pr-4 py-2 text-sm outline-none"
            placeholder="Search by name or UID..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}
        {!loading && results.length === 0 && query.trim() && <p className="text-center text-muted-foreground py-10 text-sm">No users found</p>}
        {results.map((u) => {
          const isFollowing = followMap[u.id] ?? false;
          return (
            <div key={u.id} className="flex items-center gap-3 px-4 py-3 border-b">
              <button onClick={() => { navigate(`/user/${u.id}`); onClose(); }}>
                <UserAvatar name={u.name} url={u.avatarUrl} />
              </button>
              <div className="flex-1">
                <button onClick={() => { navigate(`/user/${u.id}`); onClose(); }} className="font-semibold text-sm hover:underline text-left">{u.name}</button>
                <p className="text-xs text-muted-foreground">UID: {u.id}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1 h-8 text-xs" onClick={() => handleFollow(u.id, isFollowing)}>
                  {isFollowing ? <><UserCheck size={13} /> Following</> : <><UserPlus size={13} /> Follow</>}
                </Button>
                <Button size="sm" className="h-8 text-xs gap-1" onClick={() => { navigate(`/chat`); onClose(); }}>
                  <MessageCircle size={13} /> Chat
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Notification Panel ───────────────────────────────────────────────────────
function NotifPanel({ onClose, onRead }: { onClose: () => void; onRead: () => void }) {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    customFetch<Notification[]>("/api/notifications").then(setNotifs).catch(() => {}).finally(() => setLoading(false));
    customFetch("/api/notifications/read-all", { method: "POST" }).then(onRead).catch(() => {});
  }, []);

  const typeLabel: Record<string, string> = {
    like: "liked your post",
    comment: "commented on your post",
    follow: "started following you",
  };

  return (
    <div className="absolute right-0 top-12 w-80 bg-background border border-border rounded-2xl shadow-xl z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h4 className="font-bold">Notifications</h4>
        <button onClick={onClose}><X size={18} className="text-muted-foreground" /></button>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {loading
          ? <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          : notifs.length === 0
            ? <p className="text-center text-muted-foreground py-6 text-sm">No notifications yet</p>
            : notifs.map((n) => (
              <div key={n.id} className={`flex gap-3 px-4 py-3 border-b ${!n.isRead ? "bg-primary/5" : ""}`}>
                <Link href={`/user/${n.fromUserId}`}>
                  <UserAvatar name={n.fromUserName} url={n.fromUserAvatar} size="w-9 h-9" />
                </Link>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <Link href={`/user/${n.fromUserId}`} className="font-semibold hover:underline">{n.fromUserName}</Link>
                    {" "}{typeLabel[n.type] ?? n.type}
                  </p>
                  <p className="text-xs text-muted-foreground">{timeAgo(n.createdAt)}</p>
                </div>
              </div>
            ))}
      </div>
    </div>
  );
}

// ─── Post Card ────────────────────────────────────────────────────────────────
function PostCard({ post, currentUserId, onDelete, onFollowToggle, onEdit }: {
  post: Post;
  currentUserId?: number;
  onDelete: (id: number) => void;
  onFollowToggle: (userId: number, nowFollowing: boolean) => void;
  onEdit: (id: number, content: string) => void;
}) {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [liked, setLiked] = useState(post.isLiked);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [isFollowing, setIsFollowing] = useState(post.isFollowing);
  const [showMenu, setShowMenu] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [showLikes, setShowLikes] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showReport, setShowReport] = useState<"post" | "profile" | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [shareCount, setShareCount] = useState(post.shareCount);
  const isSelf = currentUserId === post.userId;

  const toggleLike = async () => {
    if (!isAuthenticated) return;
    setLiked((l) => !l);
    setLikeCount((c) => liked ? c - 1 : c + 1);
    try {
      const res = await customFetch<{ likeCount: number }>(`/api/posts/${post.id}/like`, {
        method: liked ? "DELETE" : "POST",
      });
      setLikeCount(res.likeCount);
    } catch { setLiked((l) => !l); setLikeCount((c) => liked ? c + 1 : c - 1); }
  };

  const handleFollow = async () => {
    if (!isAuthenticated || isSelf || followLoading) return;
    setFollowLoading(true);
    const was = isFollowing;
    setIsFollowing(!was);
    try {
      await customFetch(`/api/users/${post.userId}/follow`, { method: was ? "DELETE" : "POST" });
      onFollowToggle(post.userId, !was);
    } catch { setIsFollowing(was); }
    setFollowLoading(false);
  };

  const handleDelete = async () => {
    setShowMenu(false);
    await customFetch(`/api/posts/${post.id}`, { method: "DELETE" }).catch(() => {});
    onDelete(post.id);
  };

  return (
    <>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <Link href={`/user/${post.userId}`}>
            <UserAvatar name={post.userName} url={post.userAvatar} />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 flex-wrap">
              <Link href={`/user/${post.userId}`} className="font-semibold text-sm hover:underline truncate">{post.userName}</Link>
              {post.verificationStatus === "verified" && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0.5 shrink-0">✓ KYC</span>
              )}
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold rounded-full px-1.5 py-0.5 shrink-0"
                style={{
                  backgroundColor: post.rankPoints > 700 ? "#fef3c7" : post.rankPoints > 400 ? "#fee2e2" : post.rankPoints > 200 ? "#ede9fe" : post.rankPoints > 100 ? "#e0f2fe" : "#f3f4f6",
                  color: post.rankPoints > 700 ? "#92400e" : post.rankPoints > 400 ? "#991b1b" : post.rankPoints > 200 ? "#5b21b6" : post.rankPoints > 100 ? "#075985" : "#374151",
                }}>
                {post.rankPoints > 700 ? "🏆 Champion" : post.rankPoints > 400 ? "🔥 Advanced" : post.rankPoints > 200 ? "⚔️ Warrior" : post.rankPoints > 100 ? "⚡ Explorer" : "🌱 Beginner"}
              </span>
            </div>
            <p className="text-[10px] font-mono font-bold tracking-widest text-primary mt-0.5">
              UID-{formatUID(post.userId)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {timeAgo(post.createdAt)}
              {post.updatedAt && new Date(post.updatedAt).getTime() - new Date(post.createdAt).getTime() > 5000 && (
                <span className="ml-1.5 text-[10px] text-muted-foreground/70 italic">· edited</span>
              )}
            </p>
          </div>
          {/* Follow button for other users */}
          {isAuthenticated && !isSelf && (
            <button
              onClick={handleFollow}
              disabled={followLoading}
              className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all shrink-0 mr-1 ${
                isFollowing
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border text-foreground hover:border-primary hover:text-primary"
              }`}
            >
              {isFollowing ? <><UserCheck size={12} /> Following</> : <><UserPlus size={12} /> Follow</>}
            </button>
          )}
          {/* 3-dot menu — always show for logged-in users */}
          {isAuthenticated && (
            <div className="relative">
              <button onClick={() => setShowMenu((o) => !o)} className="text-muted-foreground hover:text-foreground p-1 rounded-full">
                <MoreVertical size={18} />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-8 bg-background border border-border rounded-xl shadow-lg z-10 min-w-[160px] py-1" onClick={() => setShowMenu(false)}>
                  {isSelf ? (
                    <>
                      <button className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted w-full text-left" onClick={() => setShowEditModal(true)}>
                        <Edit2 size={14} /> Edit Post
                      </button>
                      <button className="flex items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-muted w-full text-left" onClick={handleDelete}>
                        <Trash2 size={14} /> Delete Post
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-muted w-full text-left" onClick={() => setShowReport("post")}>
                        <Flag size={14} /> Report Post
                      </button>
                      <button className="flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-muted w-full text-left" onClick={() => setShowReport("profile")}>
                        <UserX size={14} /> Report Profile
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="px-4 pb-2">
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{post.content}</p>
        </div>
        {post.imageUrl && (
          <div className="mx-4 mb-2 rounded-xl overflow-hidden">
            <img src={post.imageUrl} alt="post" className="w-full max-h-80 object-cover" />
          </div>
        )}

        {/* Top comment + reply preview */}
        {post.topCommentContent && (
          <button
            className="mx-4 mb-2 text-left w-[calc(100%-2rem)] space-y-1"
            onClick={() => navigate(`/post/${post.id}/comments`)}
          >
            {/* Top comment row */}
            <div className="flex items-start gap-2 bg-muted/40 rounded-xl px-3 py-2">
              <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 bg-primary/10 flex items-center justify-center mt-0.5">
                {post.topCommentUserAvatar
                  ? <img src={post.topCommentUserAvatar} alt="" className="w-full h-full object-cover" />
                  : <span className="text-[9px] font-bold text-primary">{post.topCommentUser?.slice(0, 2).toUpperCase()}</span>
                }
              </div>
              <p className="text-xs text-foreground flex-1 truncate">
                <span className="font-semibold">{post.topCommentUser}</span>{" "}
                <span className="text-muted-foreground">{post.topCommentContent}</span>
              </p>
            </div>
            {/* Reply row */}
            {post.topReplyContent && (
              <div className="flex items-start gap-2 bg-muted/20 rounded-xl px-3 py-1.5 ml-4 border-l-2 border-primary/20">
                <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 bg-primary/10 flex items-center justify-center mt-0.5">
                  {post.topReplyUserAvatar
                    ? <img src={post.topReplyUserAvatar} alt="" className="w-full h-full object-cover" />
                    : <span className="text-[8px] font-bold text-primary">{post.topReplyUser?.slice(0, 2).toUpperCase()}</span>
                  }
                </div>
                <p className="text-xs text-foreground flex-1 truncate">
                  <span className="font-semibold">{post.topReplyUser}</span>{" "}
                  <span className="text-muted-foreground">{post.topReplyContent}</span>
                </p>
              </div>
            )}
          </button>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 px-3 pb-3 border-t border-border/50 pt-3">
          <button
            onClick={toggleLike}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${liked ? "text-red-500 bg-red-50 dark:bg-red-950/30" : "text-muted-foreground hover:bg-muted"}`}
          >
            <Heart size={16} className={liked ? "fill-red-500" : ""} />
            <button onClick={(e) => { e.stopPropagation(); if (isAuthenticated) setShowLikes(true); }} className="hover:underline">
              {likeCount}
            </button>
          </button>
          <button
            onClick={() => navigate(`/post/${post.id}/comments`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            <MessageSquare size={16} />
            <span>{post.commentCount}</span>
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm text-muted-foreground">
            <Eye size={14} />
            <span>{post.viewCount}</span>
          </div>
          <button
            onClick={() => setShowShare(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-muted-foreground hover:bg-muted transition-colors ml-auto"
          >
            <Share2 size={16} />
            <span>{shareCount > 0 ? shareCount : "Share"}</span>
          </button>
        </div>
      </div>

      {showShare && (
        <ShareModal
          postId={post.id}
          postContent={post.content}
          posterName={post.userName}
          onClose={() => { setShowShare(false); setShareCount((c) => c + 1); }}
        />
      )}
      {showLikes && <LikesModal postId={post.id} onClose={() => setShowLikes(false)} />}
      {showEditModal && (
        <EditPostModal
          post={post}
          onClose={() => setShowEditModal(false)}
          onUpdated={(content) => onEdit(post.id, content)}
        />
      )}
      {showReport && (
        <ReportModal
          postId={post.id}
          reportedUserId={post.userId}
          type={showReport}
          onClose={() => setShowReport(null)}
        />
      )}
    </>
  );
}

// ─── Main Moments Page ────────────────────────────────────────────────────────
export default function Moments() {
  const { user, isAuthenticated } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchPosts = useCallback(async (cursor?: number) => {
    try {
      const url = cursor ? `/api/posts?cursor=${cursor}` : "/api/posts";
      const data = await customFetch<{ posts: Post[]; hasMore: boolean; nextCursor: number | null }>(url);
      setPosts((prev) => cursor ? [...prev, ...data.posts] : data.posts);
      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);
    } catch {} finally { setLoading(false); setLoadingMore(false); }
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const fetch = () => customFetch<{ count: number }>("/api/notifications/unread-count").then((d) => setUnreadCount(d.count)).catch(() => {});
    fetch();
    const interval = setInterval(fetch, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const handleLoadMore = () => {
    if (!hasMore || loadingMore || !nextCursor) return;
    setLoadingMore(true);
    fetchPosts(nextCursor);
  };

  const handlePostCreated = (post: Post) => {
    const full: Post = {
      ...post,
      userName: user?.name ?? "",
      userAvatar: user?.avatarUrl ?? null,
      viewCount: 0,
      likeCount: 0,
      commentCount: 0,
      isLiked: false,
      isFollowing: false,
      shareCount: 0,
      updatedAt: new Date().toISOString(),
      verificationStatus: (user as any)?.verificationStatus ?? "not_submitted",
      rankPoints: 0,
      topCommentContent: null,
      topCommentUser: null,
      topCommentUserAvatar: null,
      topReplyContent: null,
      topReplyUser: null,
      topReplyUserAvatar: null,
    };
    setPosts((prev) => [full, ...prev]);
  };

  const handleDeletePost = (id: number) => setPosts((prev) => prev.filter((p) => p.id !== id));
  const handleFollowToggle = (userId: number, nowFollowing: boolean) => {
    setPosts((prev) => prev.map((p) => p.userId === userId ? { ...p, isFollowing: nowFollowing } : p));
  };
  const handleEditPost = (id: number, content: string) => {
    setPosts((prev) => prev.map((p) => p.id === id ? { ...p, content } : p));
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <button onClick={() => setShowSearch(true)} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
            <Search size={20} />
          </button>
          <h1 className="font-bold text-lg tracking-tight flex-1 text-center">Moments</h1>
          <div className="flex items-center gap-1">
            {isAuthenticated && (
              <div className="relative">
                <button onClick={() => setShowNotif((s) => !s)} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-primary text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
                {showNotif && <NotifPanel onClose={() => setShowNotif(false)} onRead={() => setUnreadCount(0)} />}
              </div>
            )}
            <Link href="/chat">
              <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
                <MessageCircle size={20} />
              </button>
            </Link>
            {isAuthenticated && (
              <button onClick={() => setShowCreate(true)} className="w-9 h-9 flex items-center justify-center rounded-full bg-primary text-white hover:bg-primary/90 transition-colors">
                <Plus size={20} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Feed */}
      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Camera size={28} className="text-primary" />
            </div>
            <div>
              <p className="font-bold text-lg">No posts yet</p>
              <p className="text-muted-foreground text-sm mt-1">Be the first to share your exam journey!</p>
            </div>
            {isAuthenticated && (
              <Button onClick={() => setShowCreate(true)} className="gap-2"><Plus size={16} /> Create Post</Button>
            )}
          </div>
        ) : (
          <>
            {posts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                currentUserId={user?.id}
                onDelete={handleDeletePost}
                onFollowToggle={handleFollowToggle}
                onEdit={handleEditPost}
              />
            ))}
            {hasMore && (
              <button onClick={handleLoadMore} disabled={loadingMore} className="w-full py-3 text-sm text-primary font-medium hover:bg-muted rounded-xl transition-colors disabled:opacity-50">
                {loadingMore ? "Loading..." : "Load more"}
              </button>
            )}
          </>
        )}
      </div>

      {showCreate && <CreatePostModal onClose={() => setShowCreate(false)} onCreated={handlePostCreated} />}
      {showSearch && <SearchModal onClose={() => setShowSearch(false)} />}
    </div>
  );
}
