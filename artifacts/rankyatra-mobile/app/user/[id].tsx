import React, { useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, Image, ActivityIndicator,
  TouchableOpacity, Platform, FlatList, Dimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { customFetch } from "@workspace/api-client-react";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
const SCREEN_W = Dimensions.get("window").width;
const GRID_SIZE = (SCREEN_W - 32 - 4) / 3;

function resolveAvatar(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("data:") || url.startsWith("http")) return url;
  return `${BASE_URL}${url}`;
}

const SKILL_COLORS: Record<string, string> = {
  Champion: "#f59e0b", Advanced: "#ef4444", Warrior: "#8b5cf6", Explorer: "#0891b2", Beginner: "#6b7280",
};

export default function UserPublicProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = parseInt(id ?? "0");
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token, user: me } = useAuth();
  const queryClient = useQueryClient();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0) + 16;
  const [activeTab, setActiveTab] = useState<"posts" | "stats">("posts");

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
        <Feather name="grid" size={15} color={activeTab === "posts" ? colors.primary : colors.mutedForeground} />
        <Text style={[styles.tabText, { color: activeTab === "posts" ? colors.primary : colors.mutedForeground }]}>Posts</Text>
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

  const renderPostItem = ({ item, index }: { item: any; index: number }) => {
    const isMiddle = index % 3 === 1;
    return (
      <TouchableOpacity
        style={[styles.gridItem, { width: GRID_SIZE, height: GRID_SIZE, marginLeft: isMiddle ? 2 : 0, marginRight: isMiddle ? 2 : 0 }]}
        activeOpacity={0.85}
        onPress={() => router.push(`/post-comments?id=${item.id}` as any)}
      >
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl.startsWith("http") ? item.imageUrl : `${BASE_URL}${item.imageUrl}` }} style={styles.gridImg} />
        ) : (
          <View style={[styles.gridTextCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.gridText, { color: colors.foreground }]} numberOfLines={4}>{item.content}</Text>
          </View>
        )}
        <View style={styles.gridOverlay}>
          <Feather name="heart" size={11} color="#fff" />
          <Text style={styles.gridOverlayText}>{item.likeCount}</Text>
          <Feather name="message-circle" size={11} color="#fff" style={{ marginLeft: 6 }} />
          <Text style={styles.gridOverlayText}>{item.commentCount}</Text>
        </View>
      </TouchableOpacity>
    );
  };

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
    <View style={styles.gridContainer}>
      {userPosts.map((item: any, index: number) => (
        <View key={item.id}>
          {renderPostItem({ item, index })}
        </View>
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
        {activeTab === "posts" ? PostsContent : StatsContent}
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
  gridContainer: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, paddingTop: 12, gap: 2 },
  gridItem: { borderRadius: 8, overflow: "hidden", position: "relative" },
  gridImg: { width: "100%", height: "100%", borderRadius: 8 },
  gridTextCard: { width: "100%", height: "100%", borderRadius: 8, borderWidth: 1, padding: 8, justifyContent: "center" },
  gridText: { fontSize: 11, fontWeight: "500", lineHeight: 16 },
  gridOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.45)", paddingHorizontal: 6, paddingVertical: 4, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
  gridOverlayText: { color: "#fff", fontSize: 10, fontWeight: "700", marginLeft: 2 },
});
