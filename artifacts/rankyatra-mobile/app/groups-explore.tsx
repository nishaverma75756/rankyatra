import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  Image, ScrollView, TextInput, RefreshControl, Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { customFetch } from "@workspace/api-client-react";
import { showError, showSuccess, showAlert } from "@/utils/alert";

interface GroupCard {
  id: number;
  name: string;
  photoUrl: string | null;
  ownerId: number;
  ownerName: string | null;
  ownerAvatar: string | null;
  memberCount: number;
  isJoined: boolean;
  isOwner: boolean;
  createdAt: string;
}

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

function resolveAvatar(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("data:") || url.startsWith("http")) return url;
  return `${BASE_URL}${url}`;
}

function formatGroupId(id: number) {
  return `GRP-${String(id).padStart(4, "0")}`;
}

function Avatar({ name, url, size = 38 }: { name: string; url: string | null; size?: number }) {
  const resolved = resolveAvatar(url);
  if (resolved) return <Image source={{ uri: resolved }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "#f9731620", alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "#f97316", fontWeight: "700", fontSize: size * 0.38 }}>{(name ?? "?").slice(0, 2).toUpperCase()}</Text>
    </View>
  );
}

function GroupCardItem({ group, colors, onJoin, onLeave, loading }: {
  group: GroupCard;
  colors: any;
  onJoin: (id: number) => void;
  onLeave: (id: number) => void;
  loading: boolean;
}) {
  const isOwner = group.isOwner;
  const isJoined = group.isJoined;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {group.photoUrl ? (
        <Image source={{ uri: group.photoUrl }} style={{ width: 52, height: 52, borderRadius: 26, flexShrink: 0 }} />
      ) : (
        <View style={[styles.groupAvatar, { backgroundColor: "#f9731615" }]}>
          <Feather name="users" size={22} color="#f97316" />
        </View>
      )}

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.groupName, { color: colors.foreground }]} numberOfLines={1}>{group.name}</Text>
        <Text style={[styles.groupId, { color: colors.mutedForeground }]}>{formatGroupId(group.id)}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 }}>
          {(group.ownerAvatar || group.ownerName) ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Avatar name={group.ownerName ?? "?"} url={group.ownerAvatar} size={18} />
              <Text style={[styles.ownerName, { color: colors.mutedForeground }]} numberOfLines={1}>{group.ownerName}</Text>
            </View>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Feather name="user" size={11} color={colors.mutedForeground} />
            <Text style={[styles.ownerName, { color: colors.mutedForeground }]}>{group.memberCount} members</Text>
          </View>
        </View>
      </View>

      {isOwner ? (
        <TouchableOpacity style={styles.ownerBadge} onPress={() => router.push("/group-dashboard")}>
          <Text style={styles.ownerBadgeText}>My Group</Text>
        </TouchableOpacity>
      ) : isJoined ? (
        <TouchableOpacity style={[styles.leaveBtn, { borderColor: "#ef4444" }]} onPress={() => onLeave(group.id)} disabled={loading}>
          {loading ? <ActivityIndicator size="small" color="#ef4444" /> : (
            <Text style={{ color: "#ef4444", fontSize: 12, fontWeight: "700" }}>Leave</Text>
          )}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={[styles.joinBtn, { backgroundColor: "#f97316", opacity: loading ? 0.7 : 1 }]} onPress={() => onJoin(group.id)} disabled={loading}>
          {loading ? <ActivityIndicator size="small" color="#fff" /> : (
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>Join</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

function LeaderboardItem({ group, rank, colors }: { group: GroupCard; rank: number; colors: any }) {
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;

  return (
    <View style={[styles.lbRow, {
      backgroundColor: rank <= 3 ? (colors.card) : colors.background,
      borderColor: rank === 1 ? "#f59e0b" : rank === 2 ? "#94a3b8" : rank === 3 ? "#cd7f32" : colors.border,
    }]}>
      {/* Rank */}
      <View style={styles.lbRank}>
        {medal ? (
          <Text style={{ fontSize: 22 }}>{medal}</Text>
        ) : (
          <Text style={{ fontSize: 15, fontWeight: "800", color: colors.mutedForeground }}>#{rank}</Text>
        )}
      </View>

      {/* Group photo */}
      {group.photoUrl ? (
        <Image source={{ uri: group.photoUrl }} style={{ width: 44, height: 44, borderRadius: 22, flexShrink: 0 }} />
      ) : (
        <View style={[styles.groupAvatar, { backgroundColor: "#f9731615", width: 44, height: 44, borderRadius: 22 }]}>
          <Feather name="users" size={18} color="#f97316" />
        </View>
      )}

      {/* Info */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.groupName, { color: colors.foreground, fontSize: 14 }]} numberOfLines={1}>{group.name}</Text>
        {group.ownerName ? (
          <Text style={[styles.ownerName, { color: colors.mutedForeground }]} numberOfLines={1}>{group.ownerName}</Text>
        ) : null}
      </View>

      {/* Members count */}
      <View style={{ alignItems: "center" }}>
        <Text style={{ fontSize: 18, fontWeight: "900", color: "#f97316" }}>{group.memberCount}</Text>
        <Text style={{ fontSize: 10, color: colors.mutedForeground, fontWeight: "600" }}>members</Text>
      </View>
    </View>
  );
}

type Tab = "mygroup" | "popular" | "leaderboard";

export default function GroupsExploreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [groups, setGroups] = useState<GroupCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("mygroup");

  const fetchGroups = useCallback(async (q = "") => {
    try {
      const url = q ? `/api/groups/explore?q=${encodeURIComponent(q)}` : "/api/groups/explore";
      const data = await customFetch<GroupCard[]>(url);
      setGroups(data);
    } catch {
      showError("Failed to Load", "Could not load groups. Please try again.");
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchGroups().finally(() => setLoading(false));
  }, []);

  const handleSearch = async (text: string) => {
    setSearch(text);
    if (!text.trim()) {
      setSearching(false);
      setLoading(true);
      await fetchGroups("").finally(() => setLoading(false));
      return;
    }
    setSearching(true);
    setLoading(true);
    await fetchGroups(text.trim()).finally(() => { setLoading(false); setSearching(false); });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchGroups(search.trim());
    setRefreshing(false);
  };

  const handleJoin = async (groupId: number) => {
    setActionLoading(groupId);
    try {
      const res = await customFetch<{ ok: boolean; groupName: string }>(`/api/groups/${groupId}/join`, { method: "POST" });
      setGroups((prev) => prev.map((g) => g.id === groupId ? { ...g, isJoined: true, memberCount: g.memberCount + 1 } : g));
      showSuccess(`Successfully joined "${res.groupName}"!`);
    } catch (e: any) {
      showError("Failed to Join", e?.message ?? "Could not join this group. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleLeave = (groupId: number) => {
    const group = groups.find((g) => g.id === groupId);
    showAlert(
      "Leave Group?",
      `Are you sure you want to leave "${group?.name ?? "this group"}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave", style: "destructive", onPress: async () => {
            setActionLoading(groupId);
            try {
              await customFetch(`/api/groups/${groupId}/leave`, { method: "DELETE" });
              setGroups((prev) => prev.map((g) => g.id === groupId ? { ...g, isJoined: false, memberCount: Math.max(0, g.memberCount - 1) } : g));
              showSuccess("Left Group", "You have successfully left the group.");
            } catch (e: any) {
              showError("Failed to Leave", e?.message ?? "Could not leave this group. Please try again.");
            } finally {
              setActionLoading(null);
            }
          }
        },
      ],
      "warning"
    );
  };

  const myGroups = groups.filter((g) => g.isJoined || g.isOwner);
  const popularGroups = groups.filter((g) => !g.isJoined && !g.isOwner);
  const leaderboard = [...groups].sort((a, b) => b.memberCount - a.memberCount);

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "mygroup", label: "My Group", icon: "shield" },
    { key: "popular", label: "Popular", icon: "globe" },
    { key: "leaderboard", label: "Leaderboard", icon: "award" },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Groups</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabItem, activeTab === tab.key && { borderBottomColor: "#f97316", borderBottomWidth: 2.5 }]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Feather name={tab.icon as any} size={14} color={activeTab === tab.key ? "#f97316" : colors.mutedForeground} />
            <Text style={[styles.tabLabel, { color: activeTab === tab.key ? "#f97316" : colors.mutedForeground, fontWeight: activeTab === tab.key ? "700" : "500" }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search bar — only on Popular tab */}
      {activeTab === "popular" && (
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Group name ya ID se dhundein..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={handleSearch}
            returnKeyType="search"
            autoCapitalize="none"
          />
          {searching && <ActivityIndicator size="small" color={colors.primary} />}
          {!!search && !searching && (
            <TouchableOpacity onPress={() => handleSearch("")}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24, paddingTop: 10 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        >
          {/* ── MY GROUP TAB ── */}
          {activeTab === "mygroup" && (
            myGroups.length === 0 ? (
              <View style={styles.empty}>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "#f9731615", alignItems: "center", justifyContent: "center" }}>
                  <Feather name="shield" size={30} color="#f97316" />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>You are not in any group</Text>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Join a group from the Popular tab</Text>
                <TouchableOpacity
                  style={{ marginTop: 12, backgroundColor: "#f97316", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 }}
                  onPress={() => setActiveTab("popular")}
                >
                  <Text style={{ color: "#fff", fontWeight: "700" }}>Groups Dhundein</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Mere Groups ({myGroups.length})</Text>
                {myGroups.map((g) => (
                  <GroupCardItem key={g.id} group={g} colors={colors} onJoin={handleJoin} onLeave={handleLeave} loading={actionLoading === g.id} />
                ))}
              </>
            )
          )}

          {/* ── POPULAR TAB ── */}
          {activeTab === "popular" && (
            popularGroups.length === 0 ? (
              <View style={styles.empty}>
                <Feather name="users" size={48} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  {search ? "No groups found" : "No more groups available"}
                </Text>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  {search ? "Try a different search term" : "You have already joined all available groups"}
                </Text>
              </View>
            ) : (
              <>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  {search ? `Results (${popularGroups.length})` : `Popular Groups (${popularGroups.length})`}
                </Text>
                {popularGroups.map((g) => (
                  <GroupCardItem key={g.id} group={g} colors={colors} onJoin={handleJoin} onLeave={handleLeave} loading={actionLoading === g.id} />
                ))}
              </>
            )
          )}

          {/* ── LEADERBOARD TAB ── */}
          {activeTab === "leaderboard" && (
            leaderboard.length === 0 ? (
              <View style={styles.empty}>
                <Feather name="award" size={48} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No groups yet</Text>
              </View>
            ) : (
              <>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Group Leaderboard 🏆</Text>
                <Text style={[{ fontSize: 12, color: colors.mutedForeground, marginBottom: 12 }]}>
                  Sabse zyada members wale groups
                </Text>
                {leaderboard.map((g, i) => (
                  <LeaderboardItem key={g.id} group={g} rank={i + 1} colors={colors} />
                ))}
              </>
            )
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "700" },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 12,
    borderBottomWidth: 2.5,
    borderBottomColor: "transparent",
  },
  tabLabel: { fontSize: 13 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 2,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  groupAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  groupName: { fontSize: 15, fontWeight: "700" },
  groupId: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 1,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  ownerName: { fontSize: 12 },
  joinBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 60,
    flexShrink: 0,
  },
  leaveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 60,
    flexShrink: 0,
  },
  ownerBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#f9731620",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  ownerBadgeText: { color: "#f97316", fontSize: 11, fontWeight: "700" },
  lbRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  lbRank: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    alignItems: "center",
    marginTop: 60,
    gap: 10,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700" },
  emptyText: { fontSize: 14, textAlign: "center" },
});
