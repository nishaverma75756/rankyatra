import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, KeyboardAvoidingView, Keyboard, Platform,
} from "react-native";
import { showError } from "@/utils/alert";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { customFetch } from "@workspace/api-client-react";

const MIN_ASPECT = 3 / 4;
function SmartImage({ uri, colors }: { uri: string; colors: any }) {
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [resizeMode, setResizeMode] = useState<"cover" | "contain">("cover");
  useEffect(() => {
    Image.getSize(uri, (w, h) => {
      if (!w || !h) return;
      const nat = w / h;
      if (nat < MIN_ASPECT) { setAspectRatio(MIN_ASPECT); setResizeMode("cover"); }
      else { setAspectRatio(nat); setResizeMode("contain"); }
    }, () => { setAspectRatio(MIN_ASPECT); setResizeMode("cover"); });
  }, [uri]);
  if (!aspectRatio) return <View style={{ width: "100%", aspectRatio: MIN_ASPECT, backgroundColor: colors.muted, borderRadius: 12, marginTop: 10 }} />;
  return (
    <View style={{ width: "100%", aspectRatio, borderRadius: 12, marginTop: 10, overflow: "hidden", backgroundColor: resizeMode === "contain" ? colors.muted + "60" : "transparent" }}>
      <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode={resizeMode} />
    </View>
  );
}

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
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function Avatar({ name, url, size = 36, colors }: { name: string; url: string | null; size?: number; colors: any }) {
  if (url) return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary + "20", alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: colors.primary, fontWeight: "700", fontSize: size * 0.35 }}>{name?.slice(0, 2).toUpperCase()}</Text>
    </View>
  );
}

export default function PostCommentsScreen() {
  const params = useLocalSearchParams<{ id: string; reelId: string; isReel: string }>();
  const isReel = params.isReel === "1" || !!params.reelId;
  const postId = isReel ? null : Number(params.id);
  const reelId = isReel ? Number(params.reelId ?? params.id) : null;

  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();

  const [post, setPost] = useState<Post | null>(null);
  const [postLoading, setPostLoading] = useState(!isReel);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const inputRef = useRef<TextInput>(null);

  // For reel mode — keep a live comment count
  const [reelCommentCount, setReelCommentCount] = useState(0);

  // ── Load post (only in post mode) ────────────────────────────────────────
  useEffect(() => {
    if (isReel || !postId) { setPostLoading(false); return; }
    customFetch<Post>(`/api/posts/${postId}`)
      .then(setPost)
      .catch(() => {})
      .finally(() => setPostLoading(false));
    customFetch(`/api/posts/${postId}/view`, { method: "POST" }).catch(() => {});
  }, [postId, isReel]);

  // ── Load comments ─────────────────────────────────────────────────────────
  const loadComments = useCallback(async () => {
    const url = isReel ? `/api/reels/${reelId}/comments` : `/api/posts/${postId}/comments`;
    try {
      const data = await customFetch<Comment[]>(url);
      const topLevel = data.filter((c) => !c.parentCommentId);
      const replies = data.filter((c) => !!c.parentCommentId);
      const merged = topLevel.map((c) => ({
        ...c,
        replies: replies.filter((r) => r.parentCommentId === c.id),
      }));
      setComments(merged);
      if (isReel) setReelCommentCount(data.length);
    } catch {}
    setLoading(false);
  }, [postId, reelId, isReel]);

  useEffect(() => { loadComments(); }, [loadComments]);

  // ── Submit comment ────────────────────────────────────────────────────────
  const submit = async () => {
    const content = text.trim();
    if (!content || submitting || !token) return;
    setText("");
    setReplyTo(null);
    setSubmitting(true);
    const url = isReel ? `/api/reels/${reelId}/comments` : `/api/posts/${postId}/comments`;
    try {
      const c = await customFetch<Comment>(url, {
        method: "POST",
        body: JSON.stringify({ content, parentCommentId: replyTo?.id ?? null }),
        headers: { "Content-Type": "application/json" },
      });
      if (c.parentCommentId) {
        setComments((prev) => prev.map((top) =>
          top.id === c.parentCommentId ? { ...top, replies: [...(top.replies ?? []), c] } : top
        ));
      } else {
        setComments((prev) => [{ ...c, replies: [] }, ...prev]);
        if (!isReel) setPost((p) => p ? { ...p, commentCount: p.commentCount + 1 } : p);
        else setReelCommentCount((n) => n + 1);
      }
    } catch {
      loadComments();
    }
    setSubmitting(false);
  };

  // ── Delete comment ────────────────────────────────────────────────────────
  const deleteComment = async (cid: number, parentId?: number | null) => {
    const url = isReel
      ? `/api/reels/${reelId}/comments/${cid}`
      : `/api/posts/${postId}/comments/${cid}`;
    await customFetch(url, { method: "DELETE" }).catch(() => {});
    if (parentId) {
      setComments((prev) => prev.map((t) =>
        t.id === parentId ? { ...t, replies: (t.replies ?? []).filter((r) => r.id !== cid) } : t
      ));
    } else {
      setComments((prev) => prev.filter((c) => c.id !== cid));
    }
  };

  // ── Toggle comment like ───────────────────────────────────────────────────
  const toggleLike = async (cid: number, isLiked: boolean, parentId?: number | null) => {
    const update = (c: Comment): Comment =>
      c.id === cid ? { ...c, isLiked: !isLiked, likeCount: isLiked ? c.likeCount - 1 : c.likeCount + 1 } : c;

    setComments((prev) => prev.map((top) =>
      parentId ? (top.id === parentId ? { ...top, replies: (top.replies ?? []).map(update) } : top) : update(top)
    ));

    const url = isReel
      ? `/api/reels/${reelId}/comments/${cid}/like`
      : `/api/posts/${postId}/comments/${cid}/like`;
    try {
      const res = await customFetch<{ likeCount: number }>(url, { method: isLiked ? "DELETE" : "POST" });
      const sync = (c: Comment): Comment => c.id === cid ? { ...c, likeCount: res.likeCount } : c;
      setComments((prev) => prev.map((top) =>
        parentId ? (top.id === parentId ? { ...top, replies: (top.replies ?? []).map(sync) } : top) : sync(top)
      ));
    } catch {}
  };

  const startReply = (c: Comment) => {
    setReplyTo(c);
    setText(`@${c.userName} `);
    inputRef.current?.focus();
  };

  // ── Render comment ────────────────────────────────────────────────────────
  const renderComment = ({ item: c }: { item: Comment }) => (
    <View>
      <View style={styles.commentRow}>
        <TouchableOpacity onPress={() => router.push(`/user/${c.userId}` as any)}>
          <Avatar name={c.userName} url={c.userAvatar} size={34} colors={colors} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <View style={[styles.bubble, { backgroundColor: colors.muted }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <TouchableOpacity onPress={() => router.push(`/user/${c.userId}` as any)}>
                <Text style={{ fontWeight: "700", fontSize: 12, color: colors.foreground }}>{c.userName}</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 10, color: colors.mutedForeground }}>{timeAgo(c.createdAt)}</Text>
              {c.userId === user?.id && (
                <TouchableOpacity onPress={() => deleteComment(c.id)}>
                  <Feather name="trash-2" size={11} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>
            <Text style={{ fontSize: 13, color: colors.foreground, marginTop: 3, lineHeight: 18 }}>{c.content}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 16, marginTop: 4, paddingLeft: 4 }}>
            <TouchableOpacity
              onPress={() => token && toggleLike(c.id, c.isLiked)}
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <Feather name="heart" size={13} color={c.isLiked ? colors.primary : colors.mutedForeground} />
              {c.likeCount > 0 && <Text style={{ fontSize: 11, color: c.isLiked ? colors.primary : colors.mutedForeground }}>{c.likeCount}</Text>}
            </TouchableOpacity>
            {token && (
              <TouchableOpacity onPress={() => startReply(c)} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Feather name="corner-down-left" size={13} color={colors.mutedForeground} />
                <Text style={{ fontSize: 11, color: colors.mutedForeground }}>Reply</Text>
              </TouchableOpacity>
            )}
          </View>
          {(c.replies ?? []).map((r) => (
            <View key={r.id} style={[styles.commentRow, { marginTop: 8 }]}>
              <TouchableOpacity onPress={() => router.push(`/user/${r.userId}` as any)}>
                <Avatar name={r.userName} url={r.userAvatar} size={28} colors={colors} />
              </TouchableOpacity>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <View style={[styles.bubble, { backgroundColor: colors.muted }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <TouchableOpacity onPress={() => router.push(`/user/${r.userId}` as any)}>
                      <Text style={{ fontWeight: "700", fontSize: 11, color: colors.foreground }}>{r.userName}</Text>
                    </TouchableOpacity>
                    <Text style={{ fontSize: 10, color: colors.mutedForeground }}>{timeAgo(r.createdAt)}</Text>
                    {r.userId === user?.id && (
                      <TouchableOpacity onPress={() => deleteComment(r.id, c.id)}>
                        <Feather name="trash-2" size={10} color={colors.mutedForeground} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={{ fontSize: 12, color: colors.foreground, marginTop: 2, lineHeight: 17 }}>{r.content}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => token && toggleLike(r.id, r.isLiked, c.id)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3, paddingLeft: 4 }}
                >
                  <Feather name="heart" size={12} color={r.isLiked ? colors.primary : colors.mutedForeground} />
                  {r.likeCount > 0 && <Text style={{ fontSize: 10, color: r.isLiked ? colors.primary : colors.mutedForeground }}>{r.likeCount}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  // ── List header ───────────────────────────────────────────────────────────
  const ListHeader = () => (
    <View>
      {isReel ? (
        <View style={[styles.postPreview, { borderBottomColor: colors.border }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={[styles.reelBadge, { backgroundColor: colors.primary + "20" }]}>
              <Feather name="film" size={14} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 12 }}>Reel</Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
              {reelCommentCount} comment{reelCommentCount !== 1 ? "s" : ""}
            </Text>
          </View>
        </View>
      ) : postLoading ? (
        <ActivityIndicator color={colors.primary} style={{ margin: 20 }} />
      ) : post ? (
        <View style={[styles.postPreview, { borderBottomColor: colors.border }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <TouchableOpacity onPress={() => router.push(`/user/${post.userId}` as any)}>
              <Avatar name={post.userName} url={post.userAvatar} size={40} colors={colors} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <TouchableOpacity onPress={() => router.push(`/user/${post.userId}` as any)}>
                <Text style={{ fontWeight: "700", fontSize: 14, color: colors.foreground }}>{post.userName}</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 11, color: colors.mutedForeground }}>{timeAgo(post.createdAt)}</Text>
            </View>
          </View>
          <Text style={{ fontSize: 14, color: colors.foreground, lineHeight: 20 }}>{post.content}</Text>
          {post.imageUrl && (
            <SmartImage uri={post.imageUrl} colors={colors} />
          )}
          <View style={{ flexDirection: "row", gap: 16, marginTop: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Feather name="heart" size={13} color={post.isLiked ? colors.primary : colors.mutedForeground} />
              <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{post.likeCount} likes</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Feather name="eye" size={13} color={colors.mutedForeground} />
              <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{post.viewCount} views</Text>
            </View>
          </View>
        </View>
      ) : null}
      <Text style={{ fontSize: 12, fontWeight: "700", color: colors.mutedForeground, marginHorizontal: 16, marginTop: 12, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Comments</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground, flex: 1, textAlign: "center" }}>
          {isReel ? "Reel Comments" : "Comments"}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Comments list */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : (
          <FlatList
            data={comments}
            keyExtractor={(c) => String(c.id)}
            renderItem={renderComment}
            ListHeaderComponent={<ListHeader />}
            ListEmptyComponent={
              <View style={{ alignItems: "center", paddingVertical: 60 }}>
                <Text style={{ fontSize: 36 }}>💬</Text>
                <Text style={{ fontWeight: "700", fontSize: 16, color: colors.foreground, marginTop: 8 }}>No comments yet</Text>
                <Text style={{ fontSize: 13, color: colors.mutedForeground, marginTop: 4 }}>Be the first to comment!</Text>
              </View>
            }
            contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          />
        )}

        {/* Input area */}
        <View style={[styles.inputArea, { borderTopColor: colors.border, backgroundColor: colors.background, paddingBottom: insets.bottom + 8 }]}>
          {replyTo && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 6, backgroundColor: colors.primary + "10" }}>
              <Feather name="corner-down-right" size={13} color={colors.primary} />
              <Text style={{ fontSize: 12, color: colors.mutedForeground, flex: 1 }}>
                Replying to <Text style={{ fontWeight: "700", color: colors.foreground }}>{replyTo.userName}</Text>
              </Text>
              <TouchableOpacity onPress={() => { setReplyTo(null); setText(""); }}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          )}
          {token ? (
            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 8, gap: 10 }}>
              <Avatar name={user?.name ?? "?"} url={(user as any)?.avatarUrl ?? null} size={32} colors={colors} />
              <TextInput
                ref={inputRef}
                style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, flex: 1 }]}
                placeholder={replyTo ? `Reply to ${replyTo.userName}...` : "Add a comment..."}
                placeholderTextColor={colors.mutedForeground}
                value={text}
                onChangeText={setText}
                returnKeyType="send"
                onSubmitEditing={submit}
                maxLength={300}
                multiline
              />
              <TouchableOpacity onPress={submit} disabled={!text.trim() || submitting}>
                <Feather name="send" size={20} color={text.trim() ? colors.primary : colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => router.push("/login" as any)} style={styles.loginPrompt}>
              <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 14 }}>Login to comment</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 36, alignItems: "flex-start" },
  postPreview: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  reelBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  commentRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 2,
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inputArea: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
    fontSize: 14,
    maxHeight: 100,
  },
  loginPrompt: {
    padding: 16,
    alignItems: "center",
  },
});
