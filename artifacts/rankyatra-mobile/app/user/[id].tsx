import React, { useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, Image, ActivityIndicator,
  TouchableOpacity, Platform, Dimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { customFetch } from "@workspace/api-client-react";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

function resolveAvatar(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("data:") || url.startsWith("http")) return url;
  return `${BASE_URL}${url}`;
}

function resolveImage(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("data:") || url.startsWith("http")) return url;
  return `${BASE_URL}${url}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function formatUID(id: number) {
  return `RY${String(id).padStart(10, "0")}`;
}

const SKILL_COLORS: Record<string, string> = {
  Champion: "#f59e0b", Advanced: "#ef4444", Warrior: "#8b5cf6", Explorer: "#0891b2", Beginner: "#6b7280",
};

// ─── ProfilePostCard ──────────────────────────────────────────────────────────
function ProfilePostCard({ post, user, colors }: { post: any; user: any; colors: any }) {
  const router = useRouter();
  const [isLiked, setIsLiked] = useState(post.isLiked ?? false);
  const [likeCount, setLikeCount] = useState(post.likeCount ?? 0);
  const { user: me } = useAuth();

  const toggleLike = async () => {
    if (!me) { router.push("/login" as any); return; }
    const was = isLiked;
    setIsLiked(!was);
    setLikeCount((c: number) => was ? c - 1 : c + 1);
    try {
      const res = await customFetch<{ likeCount: number }>(`/api/posts/${post.id}/like`, { method: was ? "DELETE" : "POST" });
      setLikeCount(res.likeCount);
    } catch {
      setIsLiked(was);
      setLikeCount(post.likeCount ?? 0);
    }
  };

  const rp = user?.rankPoints ?? 0;
  const skillLabel = rp > 700 ? "🏆 Champion" : rp > 400 ? "🔥 Advanced" : rp > 200 ? "⚔️ Warrior" : rp > 100 ? "⚡ Explorer" : "🌱 Beginner";
  const skillBg = rp > 700 ? "#fef3c7" : rp > 400 ? "#fee2e2" : rp > 200 ? "#ede9fe" : rp > 100 ? "#e0f2fe" : "#f3f4f6";
  const skillFg = rp > 700 ? "#92400e" : rp > 400 ? "#991b1b" : rp > 200 ? "#5b21b6" : rp > 100 ? "#075985" : "#374151";
  const isKyc = user?.verificationStatus === "verified";
  const avatarUri = resolveAvatar(user?.avatarUrl);
  const initials = (user?.name ?? "?").split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();

  return (
    <View style={[styles.postCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.postHeader}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.postAvatar} />
        ) : (
          <View style={[styles.postAvatar, styles.postAvatarFallback, { backgroundColor: colors.primary + "22" }]}>
            <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 14 }}>{initials}</Text>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
            <Text style={[styles.postName, { color: colors.foreground }]} numberOfLines={1}>{user?.name}</Text>
            {isKyc && (
              <View style={{ backgroundColor: "#d1fae5", borderRadius: 10, paddingHorizontal: 5, paddingVertical: 2, borderWidth: 1, borderColor: "#6ee7b7" }}>
                <Text style={{ color: "#065f46", fontSize: 9, fontWeight: "700" }}>✓ KYC</Text>
              </View>
            )}
            <View style={{ backgroundColor: skillBg, borderRadius: 10, paddingHorizontal: 5, paddingVertical: 2 }}>
              <Text style={{ color: skillFg, fontSize: 9, fontWeight: "700" }}>{skillLabel}</Text>
            </View>
          </View>
          <Text style={{ color: colors.primary, fontSize: 9, fontWeight: "700", fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", letterSpacing: 1, marginTop: 2 }}>
            UID-{formatUID(user?.id ?? 0)}
          </Text>
          <Text style={[styles.postTime, { color: colors.mutedForeground, marginTop: 1 }]}>{timeAgo(post.createdAt)}</Text>
        </View>
      </View>

      {/* Content */}
      {!!post.content && (
        <Text style={[styles.postContent, { color: colors.foreground }]}>{post.content}</Text>
      )}
      {resolveImage(post.imageUrl) && (
        <Image source={{ uri: resolveImage(post.imageUrl)! }} style={styles.postImage} resizeMode="cover" />
      )}

      {/* Top comment preview */}
      {post.topCommentContent && (
        <TouchableOpacity
          style={[styles.topCommentRow, { backgroundColor: colors.muted + "80", borderTopColor: colors.border }]}
          onPress={() => router.push({ pathname: "/post-comments", params: { id: post.id } } as any)}
        >
          <View style={[styles.commentAvatar, { backgroundColor: colors.primary + "22" }]}>
            <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 9 }}>
              {(post.topCommentUser ?? "?")[0]?.toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.foreground, fontSize: 12 }} numberOfLines={1}>
              <Text style={{ fontWeight: "600" }}>{post.topCommentUser} </Text>
              <Text style={{ color: colors.mutedForeground }}>{post.topCommentContent}</Text>
            </Text>
          </View>
          <Feather name="chevron-right" size={13} color={colors.mutedForeground} />
        </TouchableOpacity>
      )}

      {/* Actions */}
      <View style={[styles.postActions, { borderTopColor: colors.border }]}>
        <TouchableOpacity style={styles.actionBtn} onPress={toggleLike}>
          <Feather name="heart" size={18} color={isLiked ? "#ef4444" : colors.mutedForeground} />
          <Text style={[styles.actionCount, { color: isLiked ? "#ef4444" : colors.mutedForeground }]}>{likeCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => router.push({ pathname: "/post-comments", params: { id: post.id } } as any)}
        >
          <Feather name="message-square" size={18} color={colors.mutedForeground} />
          <Text style={[styles.actionCount, { color: colors.mutedForeground }]}>{post.commentCount ?? 0}</Text>
        </TouchableOpacity>

        <View style={styles.actionBtn}>
          <Feather name="eye" size={16} color={colors.mutedForeground} />
          <Text style={[styles.actionCount, { color: colors.mutedForeground }]}>{post.viewCount ?? 0}</Text>
        </View>
      </View>
    </View>
  );
}

export default function UserPublicProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = parseInt(id ?? "0");
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token, user: me } = useAuth();
  const queryClient = useQueryClient();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0) + 16;
  const [activeTab, setActiveTab] = useState<"posts" | "reels" | "stats">("posts");

  const { data: profile, isLoading, isError } = useQuery<any>({
    queryKey: ["/api/users", userId, "public-profile"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/users/${userId}/public-profile`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: userId > 0,
    staleTime: 30_000,
  });

  const { data: userPostsData, isLoading: postsLoading } = useQuery<any>({
    queryKey: ["/api/posts/user", userId],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/posts/user/${userId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: userId > 0,
    staleTime: 30_000,
  });

  const { data: userReelsData, isLoading: reelsLoading } = useQuery<any>({
    queryKey: ["/api/reels/user", userId],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/reels/user/${userId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: userId > 0,
    staleTime: 30_000,
  });

  const invalidateCounts = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "public-profile"] });
    if ((me as any)?.id) {
      queryClient.invalidateQueries({ queryKey: ["user-follow-counts", (me as any).id] });
    }
  };

  const followMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE_URL}/api/users/${userId}/follow`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: invalidateCounts,
  });

  const unfollowMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE_URL}/api/users/${userId}/follow`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: invalidateCounts,
  });

  const u = profile as any;
  const isSelf = me && u && (me as any).id === u?.id;
  const initials = (u?.name ?? "?").split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();
  const skillColor = SKILL_COLORS[u?.skillLevel] ?? "#6b7280";
  const isKyc = u?.verificationStatus === "verified";
  const uid = u?.id ? `UID-RY${String(u.id).padStart(10, "0")}` : "";
  const isFollowing: boolean = u?.isFollowing ?? false;
  const followsYou: boolean = u?.followsYou ?? false;
  const isMutating = followMutation.isPending || unfollowMutation.isPending;
  const userPosts: any[] = userPostsData?.posts ?? [];
  const userReels: any[] = userReelsData?.reels ?? [];

  function MessageBtn() {
    if (!me || isSelf) return null;
    const startChat = async () => {
      try {
        const data = await customFetch<{ id: number }>(`/api/chat/conversations/start/${userId}`, { method: "POST" });
        router.push(`/chat/${data.id}` as any);
      } catch {}
    };
    return (
      <TouchableOpacity
        style={[styles.followBtn, { backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.5)" }]}
        onPress={startChat}
        activeOpacity={0.8}
      >
        <Feather name="message-circle" size={13} color="#fff" />
        <Text style={[styles.followBtnText, { color: "#fff" }]}>Message</Text>
      </TouchableOpacity>
    );
  }

  function FollowBtn() {
    if (!me || isSelf) return null;
    if (isFollowing) {
      return (
        <TouchableOpacity
          style={[styles.followBtn, { backgroundColor: "transparent", borderWidth: 2, borderColor: colors.primary }]}
          onPress={() => unfollowMutation.mutate()}
          disabled={isMutating}
          activeOpacity={0.8}
        >
          <Feather name="user-minus" size={13} color={colors.primary} />
          <Text style={[styles.followBtnText, { color: colors.primary }]}>Unfollow</Text>
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity
        style={[styles.followBtn, { backgroundColor: followsYou ? "#8b5cf6" : colors.primary }]}
        onPress={() => followMutation.mutate()}
        disabled={isMutating}
        activeOpacity={0.8}
      >
        <Feather name="user-plus" size={13} color="#fff" />
        <Text style={[styles.followBtnText, { color: "#fff" }]}>{followsYou ? "Follow Back" : "Follow"}</Text>
      </TouchableOpacity>
    );
  }

  if (isLoading) return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.secondary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Profile</Text>
        <View style={{ width: 36 }} />
      </View>
      <View style={styles.loadingCenter}><ActivityIndicator size="large" color={colors.primary} /></View>
    </View>
  );

  if (isError || !u) return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.secondary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Profile</Text>
        <View style={{ width: 36 }} />
      </View>
      <View style={styles.loadingCenter}>
        <Feather name="user-x" size={48} color={colors.mutedForeground} style={{ opacity: 0.3, marginBottom: 12 }} />
        <Text style={{ color: colors.foreground, fontWeight: "800", fontSize: 18, marginBottom: 6 }}>User Not Found</Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>This profile doesn't exist.</Text>
      </View>
    </View>
  );

  const HeroSection = (
    <View style={styles.hero}>
      <View style={styles.heroInner}>
        {resolveAvatar(u.avatarUrl) ? (
          <Image source={{ uri: resolveAvatar(u.avatarUrl)! }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        )}
        <View style={styles.heroInfo}>
          <View style={styles.heroNameRow}>
            <Text style={styles.heroName} numberOfLines={1}>{u.name}</Text>
            {u.isAdmin && <View style={styles.adminBadge}><Text style={styles.adminBadgeText}>👑 Admin</Text></View>}
          </View>
          {followsYou && !isSelf && (
            <View style={styles.followsYouBadge}>
              <Text style={styles.followsYouText}>Follows you</Text>
            </View>
          )}
          <Text style={styles.heroUID}>{uid}</Text>
          <View style={styles.badgeRow}>
            {isKyc && (
              <View style={styles.kycBadge}>
                <Feather name="shield" size={9} color="#34d399" />
                <Text style={styles.kycText}>KYC Verified</Text>
              </View>
            )}
            {u.skillLevel && (
              <View style={[styles.tierBadge, { backgroundColor: skillColor + "30" }]}>
                <Text style={[styles.tierText, { color: skillColor }]}>{u.skillIcon} {u.skillLevel}</Text>
              </View>
            )}
          </View>
          <View style={styles.pointsRow}>
            <Feather name="zap" size={10} color="#ffffff55" />
            <Text style={styles.pointsText}>{u.rankPoints} pts</Text>
            <Text style={styles.dotSep}>·</Text>
            <Text style={styles.joinText}>Joined {new Date(u.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <FollowBtn />
            <MessageBtn />
          </View>
        </View>
      </View>

      {/* Strip — 5 cols */}
      <View style={styles.strip}>
        <View style={styles.stripCell}>
          <Text style={styles.stripVal}>{u.examsParticipated}</Text>
          <Text style={styles.stripLabel}>Contests</Text>
        </View>
        <View style={[styles.stripCell, styles.stripBorder]}>
          <Text style={styles.stripVal}>{u.examsCompleted}</Text>
          <Text style={styles.stripLabel}>Played</Text>
        </View>
        <View style={[styles.stripCell, styles.stripBorder]}>
          <Text style={[styles.stripVal, { color: "#fbbf24" }]}>{u.examsWon}</Text>
          <Text style={styles.stripLabel}>Won</Text>
        </View>
        <TouchableOpacity style={[styles.stripCell, styles.stripBorder]} activeOpacity={0.7} onPress={() => router.push(`/user-followers/${userId}` as any)}>
          <Text style={styles.stripVal}>{u.followersCount ?? 0}</Text>
          <Text style={styles.stripLabel}>Followers</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.stripCell} activeOpacity={0.7} onPress={() => router.push(`/user-following/${userId}` as any)}>
          <Text style={styles.stripVal}>{u.followingCount ?? 0}</Text>
          <Text style={styles.stripLabel}>Following</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const TabBar = (
    <View style={[styles.tabBar, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
      <TouchableOpacity
        style={[styles.tab, activeTab === "posts" && { borderBottomColor: colors.primary, borderBottomWidth: 2.5 }]}
        onPress={() => setActiveTab("posts")}
        activeOpacity={0.8}
      >
        <Feather name="align-left" size={15} color={activeTab === "posts" ? colors.primary : colors.mutedForeground} />
        <Text style={[styles.tabText, { color: activeTab === "posts" ? colors.primary : colors.mutedForeground }]}>Posts</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === "reels" && { borderBottomColor: colors.primary, borderBottomWidth: 2.5 }]}
        onPress={() => setActiveTab("reels")}
        activeOpacity={0.8}
      >
        <Feather name="film" size={15} color={activeTab === "reels" ? colors.primary : colors.mutedForeground} />
        <Text style={[styles.tabText, { color: activeTab === "reels" ? colors.primary : colors.mutedForeground }]}>Reels</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === "stats" && { borderBottomColor: colors.primary, borderBottomWidth: 2.5 }]}
        onPress={() => setActiveTab("stats")}
        activeOpacity={0.8}
      >
        <Feather name="bar-chart-2" size={15} color={activeTab === "stats" ? colors.primary : colors.mutedForeground} />
        <Text style={[styles.tabText, { color: activeTab === "stats" ? colors.primary : colors.mutedForeground }]}>Stats</Text>
      </TouchableOpacity>
    </View>
  );

  const StatsContent = (
    <View style={{ paddingTop: 16, paddingBottom: insets.bottom + 32 }}>
      {/* Performance */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>PERFORMANCE</Text>
        <View style={styles.statsGrid}>
          {[
            { icon: "crosshair", label: "Accuracy", value: `${u.accuracyPercent}%`, color: "#2563eb" },
            { icon: "trending-up", label: "Win Ratio", value: `${u.winRatio}%`, color: "#059669" },
            { icon: "award", label: "Total Won", value: `₹${parseFloat(u.totalWinnings).toLocaleString("en-IN")}`, color: "#f59e0b" },
            { icon: "star", label: "Best Rank", value: u.highestRank ? `#${u.highestRank}` : "—", color: "#8b5cf6" },
            { icon: "users", label: "Podium", value: u.podiumFinishes, color: "#0891b2" },
            { icon: "bar-chart-2", label: "Rank Points", value: u.rankPoints, color: "#ef4444" },
          ].map((stat) => (
            <View key={stat.label} style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.statIcon, { backgroundColor: stat.color + "18" }]}>
                <Feather name={stat.icon as any} size={16} color={stat.color} />
              </View>
              <Text style={[styles.statVal, { color: stat.color }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Recent Exams */}
      {u.recentResults?.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>RECENT EXAMS</Text>
          {u.recentResults.map((r: any) => {
            const pct = r.totalQuestions > 0 ? Math.round((r.correctAnswers / r.totalQuestions) * 100) : 0;
            const pctColor = pct >= 80 ? "#22c55e" : pct >= 60 ? "#f59e0b" : pct >= 40 ? "#f97316" : "#ef4444";
            const medal = r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : r.rank ? `#${r.rank}` : "—";
            return (
              <View key={r.examId + r.submittedAt} style={[styles.examRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={styles.examMedal}>{medal}</Text>
                <View style={styles.examInfo}>
                  <Text style={[styles.examTitle, { color: colors.foreground }]} numberOfLines={1}>{r.examTitle}</Text>
                  <Text style={[styles.examSub, { color: colors.mutedForeground }]}>{r.category} · {new Date(r.submittedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</Text>
                </View>
                <View style={styles.examRight}>
                  <Text style={[styles.examPct, { color: pctColor }]}>{pct}%</Text>
                  <Text style={[styles.examScore, { color: colors.mutedForeground }]}>{r.correctAnswers}/{r.totalQuestions}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );

  const REEL_CELL = (Dimensions.get("window").width - 32 - 4) / 3;

  const ReelsContent = reelsLoading ? (
    <View style={{ padding: 40, alignItems: "center" }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  ) : userReels.length === 0 ? (
    <View style={{ padding: 40, alignItems: "center", gap: 8 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary + "15", alignItems: "center", justifyContent: "center" }}>
        <Feather name="film" size={28} color={colors.primary} style={{ opacity: 0.6 }} />
      </View>
      <Text style={{ color: colors.mutedForeground, fontSize: 14, fontWeight: "600" }}>No reels yet</Text>
    </View>
  ) : (
    <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 32 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 2 }}>
        {userReels.map((reel: any) => (
          <View
            key={reel.id}
            style={{
              width: REEL_CELL, height: REEL_CELL * 1.5,
              backgroundColor: "#111",
              borderRadius: 8, overflow: "hidden",
              alignItems: "center", justifyContent: "center",
            }}
          >
            {reel.thumbnailUrl ? (
              <Image source={{ uri: reel.thumbnailUrl }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
            ) : (
              <View style={{ alignItems: "center", gap: 4 }}>
                <Feather name="play-circle" size={28} color="#ffffff60" />
              </View>
            )}
            {/* Overlay — like + eye count */}
            <View style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              paddingHorizontal: 6, paddingVertical: 5,
              backgroundColor: "rgba(0,0,0,0.45)",
              flexDirection: "row", alignItems: "center", gap: 8,
            }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Feather name="heart" size={11} color="#fff" />
                <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
                  {reel.likeCount > 999 ? `${(reel.likeCount / 1000).toFixed(1)}k` : reel.likeCount}
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Feather name="eye" size={11} color="#ffffff99" />
                <Text style={{ color: "#ffffff99", fontSize: 10 }}>
                  {reel.viewCount > 999 ? `${(reel.viewCount / 1000).toFixed(1)}k` : reel.viewCount}
                </Text>
              </View>
            </View>
            {/* Play icon on top-right */}
            <View style={{ position: "absolute", top: 6, right: 6 }}>
              <Feather name="play" size={13} color="#ffffffcc" />
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  const PostsContent = postsLoading ? (
    <View style={{ padding: 40, alignItems: "center" }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  ) : userPosts.length === 0 ? (
    <View style={{ padding: 40, alignItems: "center", gap: 8 }}>
      <Feather name="camera-off" size={36} color={colors.mutedForeground} style={{ opacity: 0.3 }} />
      <Text style={{ color: colors.mutedForeground, fontSize: 14, fontWeight: "600" }}>No posts yet</Text>
    </View>
  ) : (
    <View style={styles.feedContainer}>
      {userPosts.map((post: any) => (
        <ProfilePostCard key={post.id} post={post} user={u} colors={colors} />
      ))}
    </View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.secondary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Player Profile</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          {HeroSection}
        </View>
        {TabBar}
        {activeTab === "posts" ? PostsContent : activeTab === "reels" ? ReelsContent : StatsContent}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "800" },
  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: { borderRadius: 20, overflow: "hidden", backgroundColor: "#1e1b4b" },
  heroInner: { flexDirection: "row", alignItems: "flex-start", padding: 16, gap: 14 },
  avatar: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: "rgba(255,255,255,0.2)" },
  avatarFallback: { backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 26, fontWeight: "800" },
  heroInfo: { flex: 1, gap: 3 },
  heroNameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  heroName: { color: "#fff", fontSize: 18, fontWeight: "800", flexShrink: 1 },
  adminBadge: { backgroundColor: "#f59e0b", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  adminBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  followsYouBadge: { backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, alignSelf: "flex-start" },
  followsYouText: { color: "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: "600" },
  heroUID: { color: "rgba(255,255,255,0.4)", fontSize: 10, fontFamily: "monospace", fontWeight: "700", letterSpacing: 1.5 },
  badgeRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 2 },
  kycBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(52,211,153,0.15)", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  kycText: { color: "#34d399", fontSize: 10, fontWeight: "700" },
  tierBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  tierText: { fontSize: 10, fontWeight: "700" },
  pointsRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  pointsText: { color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: "600" },
  dotSep: { color: "rgba(255,255,255,0.25)", fontSize: 10 },
  joinText: { color: "rgba(255,255,255,0.3)", fontSize: 10 },
  followBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 6, alignSelf: "flex-start" },
  followBtnText: { fontSize: 12, fontWeight: "800" },
  strip: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)" },
  stripCell: { flex: 1, alignItems: "center", paddingVertical: 12, gap: 2 },
  stripBorder: { borderLeftWidth: 1, borderRightWidth: 0, borderColor: "rgba(255,255,255,0.1)" },
  stripVal: { color: "#fff", fontSize: 16, fontWeight: "800" },
  stripLabel: { color: "rgba(255,255,255,0.4)", fontSize: 9, fontWeight: "600" },
  tabBar: { flexDirection: "row", borderBottomWidth: 1, marginTop: 16, marginHorizontal: 16, borderRadius: 0 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderBottomWidth: 2.5, borderBottomColor: "transparent" },
  tabText: { fontSize: 13, fontWeight: "700" },
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginBottom: 12 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statBox: { width: "30%", flexGrow: 1, borderWidth: 1, borderRadius: 16, padding: 14, alignItems: "center", gap: 6 },
  statIcon: { borderRadius: 10, padding: 8 },
  statVal: { fontSize: 18, fontWeight: "800" },
  statLabel: { fontSize: 10, fontWeight: "600", textAlign: "center" },
  examRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 8, gap: 10 },
  examMedal: { fontSize: 20, width: 30, textAlign: "center" },
  examInfo: { flex: 1, minWidth: 0 },
  examTitle: { fontSize: 13, fontWeight: "700" },
  examSub: { fontSize: 11, marginTop: 2 },
  examRight: { alignItems: "flex-end" },
  examPct: { fontSize: 15, fontWeight: "800" },
  examScore: { fontSize: 11, marginTop: 1 },
  // Feed-style post cards
  feedContainer: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  postCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  postAvatar: { width: 40, height: 40, borderRadius: 20 },
  postAvatarFallback: { alignItems: "center", justifyContent: "center" },
  postHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, paddingBottom: 8 },
  postName: { fontSize: 14, fontWeight: "600" },
  postTime: { fontSize: 11 },
  postContent: { fontSize: 14, lineHeight: 20, paddingHorizontal: 12, paddingBottom: 10 },
  postImage: { width: "100%", height: 200, marginBottom: 8 },
  topCommentRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  commentAvatar: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  postActions: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 8, borderTopWidth: 1 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  actionCount: { fontSize: 13, fontWeight: "500" },
});
