import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation, Link } from "wouter";
import { ArrowLeft, Heart, Send, Trash2, Reply, CornerDownRight, Eye } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { customFetch } from "@workspace/api-client-react";
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
}

interface Comment {
  id: number;
  content: string;
  createdAt: string;
  userId: number;
  parentCommentId: number | null;
  userName: string;
  userAvatar: string | null;
  likeCount: number;
  isLiked: boolean;
  replies?: Comment[];
}

function timeAgo(iso: string) {
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); } catch { return ""; }
}

function Ava({ name, url, size = "w-9 h-9" }: { name: string; url: string | null; size?: string }) {
  return (
    <div className={`${size} rounded-full flex-shrink-0 overflow-hidden bg-primary/10 flex items-center justify-center`}>
      {url
        ? <img src={url} alt={name} className="w-full h-full object-cover" />
        : <span className="text-primary font-bold text-xs">{name?.slice(0, 2).toUpperCase()}</span>
      }
    </div>
  );
}

export default function PostComments() {
  const { id } = useParams<{ id: string }>();
  const postId = Number(id);
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();

  const [post, setPost] = useState<Post | null>(null);
  const [postLoading, setPostLoading] = useState(true);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load post
  useEffect(() => {
    if (!postId) return;
    customFetch<Post>(`/api/posts/${postId}`)
      .then(setPost)
      .catch(() => {})
      .finally(() => setPostLoading(false));
    // Record view
    customFetch(`/api/posts/${postId}/view`, { method: "POST" }).catch(() => {});
  }, [postId]);

  // Load comments
  const loadComments = useCallback(async () => {
    try {
      const data = await customFetch<Comment[]>(`/api/posts/${postId}/comments`);
      const toplevel = data.filter((c) => !c.parentCommentId);
      const replies = data.filter((c) => c.parentCommentId);
      setComments(toplevel.map((c) => ({
        ...c,
        replies: replies.filter((r) => r.parentCommentId === c.id),
      })));
    } catch {}
    setCommentsLoading(false);
  }, [postId]);

  useEffect(() => { loadComments(); }, [loadComments]);

  const submitComment = async () => {
    if (!text.trim() || submitting || !isAuthenticated) return;
    setSubmitting(true);
    try {
      const c = await customFetch<Comment>(`/api/posts/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify({ content: text.trim(), parentCommentId: replyTo?.id ?? null }),
        headers: { "Content-Type": "application/json" },
      });
      if (c.parentCommentId) {
        setComments((prev) => prev.map((top) =>
          top.id === c.parentCommentId ? { ...top, replies: [...(top.replies ?? []), c] } : top
        ));
      } else {
        setComments((prev) => [{ ...c, replies: [] }, ...prev]);
        setPost((p) => p ? { ...p, commentCount: p.commentCount + 1 } : p);
      }
      setText("");
      setReplyTo(null);
    } catch {}
    setSubmitting(false);
  };

  const deleteComment = async (cid: number, parentId?: number | null) => {
    await customFetch(`/api/posts/${postId}/comments/${cid}`, { method: "DELETE" }).catch(() => {});
    if (parentId) {
      setComments((prev) => prev.map((t) =>
        t.id === parentId ? { ...t, replies: (t.replies ?? []).filter((r) => r.id !== cid) } : t
      ));
    } else {
      setComments((prev) => prev.filter((c) => c.id !== cid));
      setPost((p) => p ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p);
    }
  };

  const toggleCommentLike = async (cid: number, isLiked: boolean, parentId?: number | null) => {
    const update = (c: Comment): Comment =>
      c.id === cid ? { ...c, isLiked: !isLiked, likeCount: isLiked ? c.likeCount - 1 : c.likeCount + 1 } : c;

    setComments((prev) => prev.map((top) =>
      parentId ? (top.id === parentId ? { ...top, replies: (top.replies ?? []).map(update) } : top) : update(top)
    ));

    try {
      const res = await customFetch<{ likeCount: number }>(`/api/posts/${postId}/comments/${cid}/like`, {
        method: isLiked ? "DELETE" : "POST",
      });
      const sync = (c: Comment): Comment => c.id === cid ? { ...c, likeCount: res.likeCount } : c;
      setComments((prev) => prev.map((top) =>
        parentId ? (top.id === parentId ? { ...top, replies: (top.replies ?? []).map(sync) } : top) : sync(top)
      ));
    } catch {}
  };

  const startReply = (c: Comment) => {
    setReplyTo(c);
    setText(`@${c.userName} `);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const renderComment = (c: Comment, isReply = false, parentId?: number | null) => (
    <div key={c.id} className={`flex gap-2.5 ${isReply ? "ml-10 mt-2" : ""}`}>
      <Link href={`/user/${c.userId}`}>
        <Ava name={c.userName} url={c.userAvatar} size={isReply ? "w-7 h-7" : "w-8 h-8"} />
      </Link>
      <div className="flex-1 min-w-0">
        <div className="bg-muted/60 rounded-2xl px-3 py-2 inline-block max-w-full">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/user/${c.userId}`} className="font-semibold text-xs hover:underline">{c.userName}</Link>
            <span className="text-[10px] text-muted-foreground">{timeAgo(c.createdAt)}</span>
            {c.userId === user?.id && (
              <button onClick={() => deleteComment(c.id, parentId ?? c.parentCommentId)} className="text-muted-foreground hover:text-destructive">
                <Trash2 size={10} />
              </button>
            )}
          </div>
          <p className="text-sm mt-0.5 leading-snug">{c.content}</p>
        </div>
        {/* Actions */}
        <div className="flex items-center gap-4 px-1 mt-1">
          <button
            onClick={() => isAuthenticated && toggleCommentLike(c.id, c.isLiked, isReply ? parentId : null)}
            className={`flex items-center gap-1 text-xs font-medium ${c.isLiked ? "text-red-500" : "text-muted-foreground hover:text-red-400"} transition-colors`}
          >
            <Heart size={12} className={c.isLiked ? "fill-red-500" : ""} />
            {c.likeCount > 0 && <span>{c.likeCount}</span>}
          </button>
          {!isReply && isAuthenticated && (
            <button
              onClick={() => startReply(c)}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              <Reply size={12} /> Reply
            </button>
          )}
        </div>
        {/* Nested replies */}
        {!isReply && (c.replies ?? []).length > 0 && (
          <div className="mt-2 space-y-2">
            {(c.replies ?? []).map((r) => renderComment(r, true, c.id))}
          </div>
        )}
      </div>
    </div>
  );

  const totalComments = comments.reduce((a, c) => a + 1 + (c.replies?.length ?? 0), 0);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b flex items-center gap-3 px-4 h-14">
        <button onClick={() => navigate("/moments")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={22} />
        </button>
        <h1 className="font-bold text-base flex-1">Comments</h1>
        {totalComments > 0 && (
          <span className="text-sm text-muted-foreground font-medium">{totalComments}</span>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto pb-[80px]">
        {/* Post preview at top */}
        {postLoading ? (
          <div className="p-4"><div className="h-16 rounded-xl bg-muted animate-pulse" /></div>
        ) : post ? (
          <div className="px-4 py-4 border-b">
            <div className="flex items-center gap-3 mb-3">
              <Link href={`/user/${post.userId}`}>
                <Ava name={post.userName} url={post.userAvatar} size="w-10 h-10" />
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={`/user/${post.userId}`} className="font-semibold text-sm hover:underline block">{post.userName}</Link>
                <p className="text-[11px] text-muted-foreground">UID: {post.userId} · {timeAgo(post.createdAt)}</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
            {post.imageUrl && (
              <div className="mt-3 rounded-xl overflow-hidden">
                <img src={post.imageUrl} alt="post" className="w-full max-h-72 object-cover" />
              </div>
            )}
            {/* Post stats */}
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Heart size={12} className={post.isLiked ? "fill-red-500 text-red-500" : ""} />{post.likeCount} likes</span>
              <span className="flex items-center gap-1"><Eye size={12} />{post.viewCount} views</span>
            </div>
          </div>
        ) : null}

        {/* Comments */}
        <div className="px-4 py-4 space-y-4">
          {commentsLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
              <p className="text-4xl">💬</p>
              <p className="font-bold text-base">No comments yet</p>
              <p className="text-sm text-muted-foreground">Be the first to comment!</p>
            </div>
          ) : (
            comments.map((c) => renderComment(c))
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Fixed input at bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-background border-t">
        {replyTo && (
          <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 text-xs text-muted-foreground">
            <CornerDownRight size={12} className="text-primary shrink-0" />
            <span>Replying to <strong className="text-foreground">{replyTo.userName}</strong></span>
            <button
              onClick={() => { setReplyTo(null); setText(""); }}
              className="ml-auto text-muted-foreground hover:text-foreground p-1"
            >
              ✕
            </button>
          </div>
        )}
        <div className="flex items-center gap-3 px-4 py-3">
          {isAuthenticated ? (
            <>
              <Ava name={user?.name ?? "?"} url={user?.avatarUrl ?? null} size="w-8 h-8" />
              <input
                ref={inputRef}
                className="flex-1 bg-muted rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                placeholder={replyTo ? `Reply to ${replyTo.userName}...` : "Add a comment..."}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
                maxLength={300}
                autoFocus
              />
              <button
                onClick={submitComment}
                disabled={!text.trim() || submitting}
                className="text-primary disabled:opacity-40 shrink-0 p-1"
              >
                <Send size={20} />
              </button>
            </>
          ) : (
            <Link href="/login" className="flex-1 text-center text-sm text-primary font-semibold py-2">
              Login to comment
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
