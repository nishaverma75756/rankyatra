import React, { useState, useEffect, useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, Modal, RefreshControl, Share,
  KeyboardAvoidingView, Platform, ScrollView, Linking,
} from "react-native";
import { showSuccess, showError, showAlert } from "@/utils/alert";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useActivityCount } from "@/contexts/ActivityCountContext";
import { customFetch } from "@workspace/api-client-react";
import ReelsFeed from "@/components/ReelsFeed";

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
  shareCount: number;
  updatedAt: string;
  editedAt: string | null;
  verificationStatus: string;
  rankPoints: number;
  isLiked: boolean;
  isFollowing: boolean;
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

function formatUID(id: number): string {
  return `RY${String(id).padStart(10, "0")}`;
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
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function Avatar({ name, url, size = 40, colors }: { name: string; url: string | null; size?: number; colors: any }) {
  if (url) return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary + "20", alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: colors.primary, fontWeight: "700", fontSize: size * 0.35 }}>{name?.slice(0, 2).toUpperCase()}</Text>
    </View>
  );
}

// ─── Share Modal ──────────────────────────────────────────────────────────────
function ShareModal({ post, onClose, colors, insets }: { post: Post; onClose: (shared: boolean) => void; colors: any; insets: any }) {
  const postUrl = `https://rankyatra.in/post/${post.id}`;

  const doShare = async (type: "chat" | "external" | "copy") => {
    customFetch(`/api/posts/${post.id}/share`, { method: "POST" }).catch(() => {});
    if (type === "chat") {
      onClose(true);
      router.push("/chat" as any);
      return;
    }
    if (type === "external") {
      try {
        await Share.share({ message: `${post.userName} on RankYatra:\n${post.content.slice(0, 100)}\n\n${postUrl}`, url: postUrl });
      } catch {}
      onClose(true);
      return;
    }
    if (type === "copy") {
      await Linking.openURL(`sms:?body=${encodeURIComponent(postUrl)}`).catch(() => {});
      onClose(true);
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={() => onClose(false)}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => onClose(false)} />
        <View style={[styles.sheetCard, { backgroundColor: colors.card, paddingBottom: insets.bottom + 12 }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Share Post</Text>
            <TouchableOpacity onPress={() => onClose(false)} style={{ marginLeft: "auto" }}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* URL preview row */}
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.muted, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12, gap: 8 }}>
            <Feather name="link" size={13} color={colors.mutedForeground} />
            <Text style={{ flex: 1, color: colors.mutedForeground, fontSize: 12 }} numberOfLines={1}>{postUrl}</Text>
          </View>

          {/* Option 1: Share in Chat */}
          <TouchableOpacity
            style={[styles.shareOption, { borderColor: colors.border }]}
            onPress={() => doShare("chat")}
          >
            <View style={[styles.shareIconWrap, { backgroundColor: colors.primary + "18" }]}>
              <Feather name="message-circle" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.shareOptionTitle, { color: colors.foreground }]}>Share in Chat</Text>
              <Text style={[styles.shareOptionSub, { color: colors.mutedForeground }]}>Send to someone on RankYatra</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>

          {/* Option 2: Share on Social Media */}
          <TouchableOpacity
            style={[styles.shareOption, { borderColor: colors.border }]}
            onPress={() => doShare("external")}
          >
            <View style={[styles.shareIconWrap, { backgroundColor: "#3b82f620" }]}>
              <Feather name="share-2" size={22} color="#3b82f6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.shareOptionTitle, { color: colors.foreground }]}>Share on Social Media</Text>
              <Text style={[styles.shareOptionSub, { color: colors.mutedForeground }]}>WhatsApp, Instagram, Twitter & more</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Likes Modal ──────────────────────────────────────────────────────────────
function LikesModal({ postId, onClose, colors, insets }: { postId: number; onClose: () => void; colors: any; insets: any }) {
  const [likers, setLikers] = useState<Liker[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    customFetch<Liker[]>(`/api/posts/${postId}/likers`).then(setLikers).catch(() => {}).finally(() => setLoading(false));
  }, [postId]);
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheetCard, { backgroundColor: colors.card, maxHeight: "60%", paddingBottom: insets.bottom + 12 }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Liked by</Text>
            <TouchableOpacity onPress={onClose} style={{ marginLeft: "auto" }}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          {loading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} /> : (
            <ScrollView>
              {likers.length === 0 && <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 20 }}>No likes yet</Text>}
              {likers.map((u) => (
                <TouchableOpacity key={u.id} style={[styles.searchRow, { borderBottomColor: colors.border }]} onPress={() => { router.push(`/user/${u.id}` as any); onClose(); }}>
                  <Avatar name={u.name} url={u.avatarUrl} size={36} colors={colors} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.postName, { color: colors.foreground }]}>{u.name}</Text>
                    <Text style={[styles.postTime, { color: colors.mutedForeground }]}>UID: {u.id}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Edit Post Modal ──────────────────────────────────────────────────────────
function EditPostModal({ post, onClose, onUpdated, colors, insets }: {
  post: Post; onClose: () => void; onUpdated: (content: string) => void; colors: any; insets: any;
}) {
  const [text, setText] = useState(post.content);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!text.trim() || saving) return;
    setSaving(true);
    try {
      await customFetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        body: JSON.stringify({ content: text.trim() }),
        headers: { "Content-Type": "application/json" },
      });
      onUpdated(text.trim());
      onClose();
    } catch { showError("Error", "Failed to update post"); }
    setSaving(false);
  };
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheetCard, { backgroundColor: colors.card, paddingBottom: insets.bottom + 12 }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Edit Post</Text>
            <TouchableOpacity onPress={onClose} style={{ marginLeft: "auto" }}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <TextInput
            style={[styles.postInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
            autoFocus
          />
          <Text style={[styles.charCount, { color: colors.mutedForeground }]}>{text.length}/500</Text>
          <TouchableOpacity
            style={[styles.postBtn, { backgroundColor: !text.trim() || saving ? colors.muted : colors.primary }]}
            onPress={save}
            disabled={!text.trim() || saving}
          >
            <Feather name="check" size={16} color={!text.trim() || saving ? colors.mutedForeground : "#fff"} />
            <Text style={[styles.postBtnText, { color: !text.trim() || saving ? colors.mutedForeground : "#fff" }]}>
              {saving ? "Saving..." : "Save Changes"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Report Modal ─────────────────────────────────────────────────────────────
function ReportModal({ type, postId, reportedUserId, onClose, colors, insets }: {
  type: "post" | "profile"; postId?: number; reportedUserId: number; onClose: () => void; colors: any; insets: any;
}) {
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const reasons = ["Spam", "Inappropriate content", "Harassment", "Misinformation", "Other"];
  const submit = async (r: string) => {
    setSending(true);
    try {
      await customFetch("/api/reports", {
        method: "POST",
        body: JSON.stringify({ reason: r, reportedUserId, postId: type === "post" ? postId : null }),
        headers: { "Content-Type": "application/json" },
      });
      showSuccess("Reported!", "Your report has been submitted. Thank you.");
      onClose();
    } catch { showError("Error", "Failed to submit report"); }
    setSending(false);
  };
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheetCard, { backgroundColor: colors.card, paddingBottom: insets.bottom + 12 }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
              {type === "post" ? "Report Post" : "Report Profile"}
            </Text>
            <TouchableOpacity onPress={onClose} style={{ marginLeft: "auto" }}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <Text style={[{ color: colors.mutedForeground, fontSize: 13, marginBottom: 12 }]}>Select a reason:</Text>
          {reasons.map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.shareOption, { borderColor: colors.border, opacity: sending ? 0.5 : 1 }]}
              onPress={() => submit(r)}
              disabled={sending}
            >
              <Text style={[styles.shareOptionTitle, { color: colors.foreground }]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );
}

// ─── PostCard ────────────────────────────────────────────────────────────────
const SEE_MORE_LIMIT = 200;

function PostCard({ post, currentUser, colors, insets, onDelete, onUpdated }: {
  post: Post; currentUser: any; colors: any; insets: any;
  onDelete: (id: number) => void; onUpdated: (id: number, content: string) => void;
}) {
  const isSelf = post.userId === currentUser?.id;
  const [isLiked, setIsLiked] = useState(!!post.isLiked);
  const [likeCount, setLikeCount] = useState(Number(post.likeCount) || 0);
  const [liking, setLiking] = useState(false);
  const [shareCount, setShareCount] = useState(post.shareCount);
  const [isFollowing, setIsFollowing] = useState(post.isFollowing);
  const [showMenu, setShowMenu] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showLikes, setShowLikes] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showReport, setShowReport] = useState<"post" | "profile" | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 60, right: 16 });
  const menuBtnRef = useRef<any>(null);
  const [textExpanded, setTextExpanded] = useState(false);
  const isLongText = post.content.trim().length > SEE_MORE_LIMIT;

  const toggleLike = async () => {
    if (!currentUser) { router.push("/login" as any); return; }
    if (liking) return;
    const was = isLiked;
    setLiking(true);
    setIsLiked(!was);
    setLikeCount((c) => was ? c - 1 : c + 1);
    try {
      const res = await customFetch<{ likeCount: number }>(`/api/posts/${post.id}/like`, { method: was ? "DELETE" : "POST" });
      setLikeCount(Number(res.likeCount) || (was ? likeCount - 1 : likeCount + 1));
    } catch {
      setIsLiked(was);
      setLikeCount((c) => was ? c + 1 : c - 1);
    } finally {
      setLiking(false);
    }
  };

  const toggleFollow = async () => {
    if (!currentUser) return;
    const was = isFollowing;
    setIsFollowing(!was);
    try { await customFetch(`/api/users/${post.userId}/follow`, { method: was ? "DELETE" : "POST" }); }
    catch { setIsFollowing(was); }
  };

  const handleDelete = () => {
    setShowMenu(false);
    showAlert(
      "Delete Post",
      "Are you sure you want to delete this post? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: async () => { await customFetch(`/api/posts/${post.id}`, { method: "DELETE" }).catch(() => {}); onDelete(post.id); } },
      ],
      "warning"
    );
  };

  return (
    <View style={[styles.postCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.postHeader}>
        <TouchableOpacity onPress={() => router.push(`/user/${post.userId}` as any)}>
          <Avatar name={post.userName} url={post.userAvatar} colors={colors} />
        </TouchableOpacity>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
            <TouchableOpacity onPress={() => router.push(`/user/${post.userId}` as any)}>
              <Text style={[styles.postName, { color: colors.foreground }]} numberOfLines={1}>{post.userName}</Text>
            </TouchableOpacity>
            {post.verificationStatus === "verified" && (
              <View style={{ backgroundColor: "#d1fae5", borderRadius: 10, paddingHorizontal: 5, paddingVertical: 2, borderWidth: 1, borderColor: "#6ee7b7" }}>
                <Text style={{ color: "#065f46", fontSize: 9, fontWeight: "700" }}>✓ KYC</Text>
              </View>
            )}
            {(() => {
              const rp = post.rankPoints ?? 0;
              const label = rp > 700 ? "🏆 Champion" : rp > 400 ? "🔥 Advanced" : rp > 200 ? "⚔️ Warrior" : rp > 100 ? "⚡ Explorer" : "🌱 Beginner";
              const bg = rp > 700 ? "#fef3c7" : rp > 400 ? "#fee2e2" : rp > 200 ? "#ede9fe" : rp > 100 ? "#e0f2fe" : "#f3f4f6";
              const fg = rp > 700 ? "#92400e" : rp > 400 ? "#991b1b" : rp > 200 ? "#5b21b6" : rp > 100 ? "#075985" : "#374151";
              return (
                <View style={{ backgroundColor: bg, borderRadius: 10, paddingHorizontal: 5, paddingVertical: 2 }}>
                  <Text style={{ color: fg, fontSize: 9, fontWeight: "700" }}>{label}</Text>
                </View>
              );
            })()}
          </View>
          <Text style={{ color: colors.primary, fontSize: 9, fontWeight: "700", fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", letterSpacing: 1, marginTop: 2 }}>
            UID-{formatUID(post.userId)}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 }}>
            <Text style={[styles.postTime, { color: colors.mutedForeground }]}>{timeAgo(post.createdAt)}</Text>
            {!!post.editedAt && (
              <Text style={{ color: colors.mutedForeground, fontSize: 10, fontStyle: "italic" }}>· edited</Text>
            )}
          </View>
        </View>

        {/* Follow pill (for other users) */}
        {!!currentUser && !isSelf && (
          <TouchableOpacity
            style={[styles.followPill, {
              borderColor: isFollowing ? "#ef4444" : colors.border,
              backgroundColor: isFollowing ? "#ef444415" : "transparent",
            }]}
            onPress={toggleFollow}
          >
            <Feather name={isFollowing ? "user-minus" : "user-plus"} size={11} color={isFollowing ? "#ef4444" : colors.foreground} />
            <Text style={{ fontSize: 11, fontWeight: "600", color: isFollowing ? "#ef4444" : colors.foreground }}>
              {isFollowing ? "Unfollow" : "Follow"}
            </Text>
          </TouchableOpacity>
        )}

        {/* 3-dot menu */}
        <TouchableOpacity
          ref={menuBtnRef}
          onPress={() => {
            menuBtnRef.current?.measure((_x: number, _y: number, _w: number, _h: number, pageX: number, pageY: number) => {
              setMenuPos({ top: pageY + _h + 4, right: 16 });
              setShowMenu(true);
            });
          }}
          style={{ padding: 6 }}
        >
          <Feather name="more-vertical" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {/* Content with See More */}
      {post.content?.trim().length > 0 && (
        <View style={{ marginBottom: post.imageUrl ? 0 : 4 }}>
          <Text style={[styles.postContent, { color: colors.foreground }]} numberOfLines={textExpanded ? undefined : (isLongText ? 4 : undefined)}>
            {textExpanded || !isLongText
              ? post.content
              : post.content.slice(0, SEE_MORE_LIMIT).trimEnd()}
          </Text>
          {isLongText && (
            <TouchableOpacity onPress={() => setTextExpanded((e) => !e)}>
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600", marginTop: 2 }}>
                {textExpanded ? "See less" : "...See more"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Post image */}
      {post.imageUrl && (
        <View style={styles.postImageWrap}>
          <Image source={{ uri: post.imageUrl }} style={styles.postImage} resizeMode="cover" />
        </View>
      )}

      {/* Top comment preview */}
      {post.topCommentContent && (
        <TouchableOpacity
          style={[styles.topCommentRow, { backgroundColor: colors.muted + "80", borderTopColor: colors.border }]}
          onPress={() => router.push({ pathname: "/post-comments", params: { id: post.id } } as any)}
        >
          <Avatar name={post.topCommentUser ?? "?"} url={post.topCommentUserAvatar} size={22} colors={colors} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.foreground, fontSize: 12 }} numberOfLines={1}>
              <Text style={{ fontWeight: "600" }}>{post.topCommentUser} </Text>
              <Text style={{ color: colors.mutedForeground }}>{post.topCommentContent}</Text>
            </Text>
            {post.topReplyContent && (
              <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                ↳ <Text style={{ fontWeight: "500" }}>{post.topReplyUser}</Text>: {post.topReplyContent}
              </Text>
            )}
          </View>
          <Feather name="chevron-right" size={13} color={colors.mutedForeground} />
        </TouchableOpacity>
      )}

      {/* Actions */}
      <View style={[styles.postActions, { borderTopColor: colors.border }]}>
        {/* Like */}
        <View style={styles.actionBtn}>
          <TouchableOpacity onPress={toggleLike} disabled={liking} activeOpacity={0.6} hitSlop={{ top: 6, bottom: 6, left: 6, right: 4 }}>
            <Feather name="heart" size={18} color={isLiked ? "#ef4444" : colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push({ pathname: "/post-likes", params: { id: post.id } } as any)} activeOpacity={0.6} hitSlop={{ top: 6, bottom: 6, left: 4, right: 6 }}>
            <Text style={[styles.actionCount, { color: isLiked ? "#ef4444" : colors.mutedForeground }]}>{likeCount}</Text>
          </TouchableOpacity>
        </View>

        {/* Comment */}
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push({ pathname: "/post-comments", params: { id: post.id } } as any)}>
          <Feather name="message-square" size={18} color={colors.mutedForeground} />
          <Text style={[styles.actionCount, { color: colors.mutedForeground }]}>{post.commentCount}</Text>
        </TouchableOpacity>

        {/* View count */}
        <View style={styles.actionBtn}>
          <Feather name="eye" size={16} color={colors.mutedForeground} />
          <Text style={[styles.actionCount, { color: colors.mutedForeground }]}>{post.viewCount ?? 0}</Text>
        </View>

        {/* Share */}
        <TouchableOpacity style={[styles.actionBtn, { marginLeft: "auto" }]} onPress={() => setShowShare(true)}>
          <Feather name="share-2" size={18} color={colors.mutedForeground} />
          <Text style={[styles.actionCount, { color: colors.mutedForeground }]}>{shareCount > 0 ? shareCount : "Share"}</Text>
        </TouchableOpacity>
      </View>

      {/* ─── 3-dot Menu Modal ─── */}
      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowMenu(false)} activeOpacity={1} />
        <View style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border, position: "absolute", top: menuPos.top, right: menuPos.right }]}>
          {isSelf ? (
            <>
              <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); setShowEdit(true); }}>
                <Feather name="edit-2" size={15} color={colors.foreground} />
                <Text style={[styles.menuText, { color: colors.foreground }]}>Edit Post</Text>
              </TouchableOpacity>
              <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
              <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
                <Feather name="trash-2" size={15} color="#ef4444" />
                <Text style={[styles.menuText, { color: "#ef4444" }]}>Delete Post</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); setShowReport("post"); }}>
                <Feather name="flag" size={15} color="#f97316" />
                <Text style={[styles.menuText, { color: "#f97316" }]}>Report Post</Text>
              </TouchableOpacity>
              <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
              <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); setShowReport("profile"); }}>
                <Feather name="user-x" size={15} color="#ef4444" />
                <Text style={[styles.menuText, { color: "#ef4444" }]}>Report Profile</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>

      {showShare && (
        <ShareModal
          post={post}
          colors={colors}
          insets={insets}
          onClose={(shared) => { setShowShare(false); if (shared) setShareCount((c) => c + 1); }}
        />
      )}
      {showLikes && <LikesModal postId={post.id} onClose={() => setShowLikes(false)} colors={colors} insets={insets} />}
      {showEdit && (
        <EditPostModal
          post={post}
          colors={colors}
          insets={insets}
          onClose={() => setShowEdit(false)}
          onUpdated={(content) => onUpdated(post.id, content)}
        />
      )}
      {showReport && (
        <ReportModal
          type={showReport}
          postId={showReport === "post" ? post.id : undefined}
          reportedUserId={post.userId}
          onClose={() => setShowReport(null)}
          colors={colors}
          insets={insets}
        />
      )}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function MomentsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const { unreadNotifications, unreadMessages, resetNotifications, refreshMessages, refreshNotifications } = useActivityCount();


  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [followMap, setFollowMap] = useState<Record<number, boolean>>({});
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);


  const fetchPosts = useCallback(async (cursor?: number, isRefresh = false) => {
    try {
      const url = cursor ? `/api/posts?cursor=${cursor}` : "/api/posts";
      const data = await customFetch<{ posts: Post[]; hasMore: boolean; nextCursor: number | null }>(url);
      setPosts((prev) => (cursor && !isRefresh) ? [...prev, ...data.posts] : data.posts);
      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);
    } catch {}
    setLoading(false);
    setRefreshing(false);
    setLoadingMore(false);
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  // Refresh posts + counts when screen gains focus
  useFocusEffect(useCallback(() => {
    fetchPosts(undefined, true);
    refreshMessages();
    refreshNotifications();
  }, [fetchPosts, refreshMessages, refreshNotifications]));

  const onRefresh = () => { setRefreshing(true); fetchPosts(undefined, true); };
  const handleLoadMore = () => { if (!hasMore || loadingMore || !nextCursor) return; setLoadingMore(true); fetchPosts(nextCursor); };


  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    clearTimeout(searchTimer.current);
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const data = await customFetch<SearchUser[]>(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(data);
      } catch {}
      setSearching(false);
    }, 400);
  }, [searchQuery]);

  const handleFollow = async (uid: number, curFollow: boolean) => {
    setFollowMap((m) => ({ ...m, [uid]: !curFollow }));
    await customFetch(`/api/users/${uid}/follow`, { method: curFollow ? "DELETE" : "POST" }).catch(() => {});
  };

  const openNotifs = () => { router.push("/notifications" as any); };

  const [activeTab, setActiveTab] = useState<"posts" | "reels">("posts");
  const [showCreateMenu, setShowCreateMenu] = useState(false);

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => setShowSearch(true)} style={styles.iconBtn}>
          <Feather name="search" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Moments</Text>
        <View style={styles.headerRight}>
          {/* 1. Create button — opens action sheet */}
          {token && (
            <TouchableOpacity onPress={() => setShowCreateMenu(true)} style={styles.createPostBtn}>
              <Feather name="plus" size={16} color={colors.foreground} />
              <Text style={[styles.createPostText, { color: colors.foreground }]}>Create</Text>
            </TouchableOpacity>
          )}
          {/* 2. Notification bell */}
          <TouchableOpacity onPress={openNotifs} style={styles.iconBtn}>
            <Feather name="bell" size={22} color={colors.foreground} />
            {unreadNotifications > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadNotifications > 9 ? "9+" : unreadNotifications}</Text>
              </View>
            )}
          </TouchableOpacity>
          {/* 3. Messages — orange highlighted */}
          <TouchableOpacity onPress={() => router.push("/chat" as any)} style={[styles.createBtn, { backgroundColor: colors.primary }]}>
            <Feather name="message-circle" size={20} color="#fff" />
            {unreadMessages > 0 && (
              <View style={[styles.badge, { top: -4, right: -4 }]}>
                <Text style={styles.badgeText}>{unreadMessages > 9 ? "9+" : unreadMessages}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Tab bar ── */}
      <View style={[styles.tabBar, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === "posts" && { borderBottomColor: colors.primary, borderBottomWidth: 2.5 }]}
          onPress={() => setActiveTab("posts")}
          activeOpacity={0.7}
        >
          <Feather name="grid" size={15} color={activeTab === "posts" ? colors.primary : colors.mutedForeground} />
          <Text style={[styles.tabLabel, { color: activeTab === "posts" ? colors.primary : colors.mutedForeground, fontWeight: activeTab === "posts" ? "700" : "500" }]}>
            Posts
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === "reels" && { borderBottomColor: colors.primary, borderBottomWidth: 2.5 }]}
          onPress={() => setActiveTab("reels")}
          activeOpacity={0.7}
        >
          <Feather name="film" size={15} color={activeTab === "reels" ? colors.primary : colors.mutedForeground} />
          <Text style={[styles.tabLabel, { color: activeTab === "reels" ? colors.primary : colors.mutedForeground, fontWeight: activeTab === "reels" ? "700" : "500" }]}>
            Reels
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Reels Feed ── */}
      {activeTab === "reels" && (
        <View style={styles.flex}>
          <ReelsFeed colors={colors} tabBarHeight={insets.bottom + 60} />
        </View>
      )}

      {/* ── Posts Feed ── */}
      {activeTab === "posts" && (loading ? (
        <View style={[styles.flex, styles.center]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => String(p.id)}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              currentUser={user}
              colors={colors}
              insets={insets}
              onDelete={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
              onUpdated={(id, content) => setPosts((prev) => prev.map((p) => p.id === id ? { ...p, content } : p))}
            />
          )}
          contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: insets.bottom + 90 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={[styles.flex, styles.center, { paddingTop: 60 }]}>
              <Feather name="image" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No posts yet</Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>Be first to share your journey!</Text>
              {!!token && (
                <TouchableOpacity onPress={() => router.push("/create-post" as any)} style={[styles.emptyBtn, { backgroundColor: colors.primary }]}>
                  <Text style={styles.emptyBtnText}>Create Post</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} /> : null}
        />
      ))}

      {/* ─── Search Modal ─── */}
      <Modal visible={showSearch} animationType="slide" onRequestClose={() => { setShowSearch(false); setSearchQuery(""); setSearchResults([]); }}>
        <View style={[styles.flex, { backgroundColor: colors.background, paddingTop: insets.top }]}>
          <View style={[styles.searchHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => { setShowSearch(false); setSearchQuery(""); setSearchResults([]); }}>
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
            <View style={[styles.searchInputWrap, { backgroundColor: colors.muted }]}>
              <Feather name="search" size={15} color={colors.mutedForeground} />
              <TextInput
                style={[styles.searchInput, { color: colors.foreground }]}
                placeholder="Search by name or UID..."
                placeholderTextColor={colors.mutedForeground}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
            </View>
          </View>
          {searching && <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />}
          <FlatList
            data={searchResults}
            keyExtractor={(u) => String(u.id)}
            renderItem={({ item }) => {
              const isFollowingUser = followMap[item.id] ?? false;
              return (
                <View style={[styles.searchRow, { borderBottomColor: colors.border }]}>
                  <TouchableOpacity onPress={() => { router.push(`/user/${item.id}` as any); setShowSearch(false); }}>
                    <Avatar name={item.name} url={item.avatarUrl} colors={colors} />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <TouchableOpacity onPress={() => { router.push(`/user/${item.id}` as any); setShowSearch(false); }}>
                      <Text style={[styles.postName, { color: colors.foreground }]}>{item.name}</Text>
                    </TouchableOpacity>
                    <Text style={[styles.postTime, { color: colors.mutedForeground }]}>UID: {item.id}</Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <TouchableOpacity
                      style={[styles.followBtn, { borderColor: isFollowingUser ? colors.primary : colors.border, backgroundColor: isFollowingUser ? colors.primary + "15" : "transparent" }]}
                      onPress={() => handleFollow(item.id, isFollowingUser)}
                    >
                      <Feather name={isFollowingUser ? "user-check" : "user-plus"} size={13} color={isFollowingUser ? colors.primary : colors.foreground} />
                      <Text style={[styles.followBtnText, { color: isFollowingUser ? colors.primary : colors.foreground }]}>{isFollowingUser ? "Following" : "Follow"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.msgBtn, { backgroundColor: colors.primary }]}
                      onPress={() => { router.push("/chat" as any); setShowSearch(false); }}
                    >
                      <Feather name="message-circle" size={13} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={!searching && searchQuery.trim() ? (
              <View style={styles.center}>
                <Text style={{ color: colors.mutedForeground, marginTop: 40, fontSize: 14 }}>No users found</Text>
              </View>
            ) : null}
          />
        </View>
      </Modal>

      {/* ── Create Menu Action Sheet ── */}
      <Modal
        visible={showCreateMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateMenu(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCreateMenu(false)}>
          <View style={[styles.sheetCard, { backgroundColor: colors.card, paddingBottom: insets.bottom + 8 }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.muted }]} />
            <Text style={[styles.sheetTitle, { color: colors.foreground, marginBottom: 16 }]}>Create</Text>

            {/* Create Post */}
            <TouchableOpacity
              style={[styles.createOption, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}
              onPress={() => { setShowCreateMenu(false); router.push("/create-post" as any); }}
              activeOpacity={0.75}
            >
              <View style={[styles.createOptionIcon, { backgroundColor: colors.primary + "20" }]}>
                <Feather name="file-text" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.createOptionTitle, { color: colors.foreground }]}>Create Post</Text>
                <Text style={[styles.createOptionSub, { color: colors.mutedForeground }]}>Share thoughts, images & updates</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>

            {/* Create Reel */}
            <TouchableOpacity
              style={[styles.createOption, { backgroundColor: "#a855f710", borderColor: "#a855f730", marginTop: 10 }]}
              onPress={() => { setShowCreateMenu(false); router.push("/create-reel" as any); }}
              activeOpacity={0.75}
            >
              <View style={[styles.createOptionIcon, { backgroundColor: "#a855f720" }]}>
                <Feather name="film" size={22} color="#a855f7" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.createOptionTitle, { color: colors.foreground }]}>Create Reel</Text>
                <Text style={[styles.createOptionSub, { color: colors.mutedForeground }]}>Upload a short video (up to 60s)</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowCreateMenu(false)} style={[styles.cancelBtn, { borderColor: colors.border }]}>
              <Text style={{ color: colors.mutedForeground, fontWeight: "600", fontSize: 15 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "700", letterSpacing: -0.5 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18 },
  badge: { position: "absolute", top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: "#f97316", alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  createBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  createPostBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 16 },
  createPostText: { fontSize: 12, fontWeight: "600" },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderBottomWidth: 2.5,
    borderBottomColor: "transparent",
  },
  tabLabel: { fontSize: 14 },
  reelsIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: "center", justifyContent: "center",
  },
  createOption: {
    flexDirection: "row", alignItems: "center", gap: 14,
    padding: 14, borderRadius: 16, borderWidth: 1,
  },
  createOptionIcon: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },
  createOptionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 2 },
  createOptionSub: { fontSize: 12 },
  cancelBtn: {
    marginTop: 14, paddingVertical: 14, borderRadius: 14,
    alignItems: "center", borderWidth: 1,
  },
  postCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  postHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, paddingBottom: 8 },
  postName: { fontSize: 14, fontWeight: "600" },
  postTime: { fontSize: 11 },
  followPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1 },
  postContent: { fontSize: 14, lineHeight: 20, paddingHorizontal: 12, paddingBottom: 6 },
  postImageWrap: { marginHorizontal: 0, marginTop: 6, marginBottom: 8 },
  postImage: { width: "100%", height: 260 },
  topCommentRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  postActions: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 8, borderTopWidth: 1 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  actionCount: { fontSize: 13, fontWeight: "500" },
  menuCard: { position: "absolute", borderRadius: 14, borderWidth: 1, minWidth: 160, overflow: "hidden", elevation: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 13 },
  menuText: { fontSize: 14, fontWeight: "500" },
  menuDivider: { height: StyleSheet.hairlineWidth },
  shareOption: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  shareIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  shareOptionTitle: { fontSize: 14, fontWeight: "600" },
  shareOptionSub: { fontSize: 12, marginTop: 1 },
  emptyTitle: { fontSize: 17, fontWeight: "700", marginTop: 12 },
  emptySub: { fontSize: 13, marginTop: 4 },
  emptyBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  sheetCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingTop: 12 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 12 },
  sheetTitle: { fontSize: 17, fontWeight: "700" },
  postInput: { borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 14, minHeight: 100, textAlignVertical: "top" },
  charCount: { fontSize: 11, textAlign: "right", marginTop: 4 },
  postBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16, padding: 14, borderRadius: 12 },
  postBtnText: { fontSize: 15, fontWeight: "700" },
  searchHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: 1 },
  searchInputWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  searchInput: { flex: 1, fontSize: 14 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  followBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  followBtnText: { fontSize: 12, fontWeight: "600" },
  msgBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  notifRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  notifText: { fontSize: 13, lineHeight: 18 },
});
