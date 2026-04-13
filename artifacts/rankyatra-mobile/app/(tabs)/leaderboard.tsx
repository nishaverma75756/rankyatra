import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useQuery } from "@tanstack/react-query";
import type { GlobalLeaderboardEntry } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";

const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
function resolveAvatar(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("data:") || url.startsWith("http")) return url;
  return `${BASE_URL}${url}`;
}

type Period = "daily" | "weekly" | "alltime";
const TABS: { key: Period; label: string }[] = [
  { key: "daily", label: "Today" },
  { key: "weekly", label: "This Week" },
  { key: "alltime", label: "All Time" },
];

type EntryWithStats = GlobalLeaderboardEntry & {
  winCount?: number;
  winRatio?: number;
};

function LeaderboardItem({ item, isMe, onPress }: { item: EntryWithStats; isMe: boolean; onPress?: () => void }) {
  const colors = useColors();
  const rank = item.rank;
  const isTop3 = rank <= 3;
  const winnings = parseFloat(String(item.totalWinnings ?? 0));
  const winRatio = (item as any).winRatio ?? 0;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        styles.item,
        {
          backgroundColor: isMe
            ? colors.primary + "10"
            : isTop3
            ? colors.saffronLight
            : colors.card,
          borderColor: isMe
            ? colors.primary + "60"
            : isTop3
            ? colors.saffron + "50"
            : colors.border,
          borderWidth: isMe ? 2 : 1,
        },
      ]}
    >
      <View style={styles.itemTop}>
        <View style={styles.rankCell}>
          {rank <= 3 ? (
            <Text style={styles.medal}>{MEDALS[rank]}</Text>
          ) : (
            <Text style={[styles.rankNum, { color: colors.mutedForeground }]}>#{rank}</Text>
          )}
        </View>

        <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
          {resolveAvatar((item as any).avatarUrl) ? (
            <Image source={{ uri: resolveAvatar((item as any).avatarUrl)! }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarText}>
              {(item.userName ?? "?")[0].toUpperCase()}
            </Text>
          )}
        </View>

        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
            {item.userName}
            {isMe ? (
              <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 12 }}> (You)</Text>
            ) : null}
          </Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>Rank #{rank}</Text>
          {/* Skill + Group badges */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
            {!!(item as any).skillLevel && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, backgroundColor: "#f9731618", borderWidth: 1, borderColor: "#f9731640" }}>
                <Text style={{ fontSize: 9 }}>{(item as any).skillIcon}</Text>
                <Text style={{ fontSize: 10, fontWeight: "700", color: "#f97316" }}>{(item as any).skillLevel}</Text>
              </View>
            )}
            {!!(item as any).groupBadge && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, backgroundColor: "#0369a118", borderWidth: 1, borderColor: "#0369a140" }}>
                <Feather name="users" size={8} color="#0369a1" />
                <Text style={{ fontSize: 10, fontWeight: "700", color: "#0369a1" }} numberOfLines={1}>{(item as any).groupBadge}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.right}>
          <Text style={[styles.winAmount, { color: winnings > 0 ? colors.success : colors.mutedForeground }]}>
            ₹{winnings > 0 ? winnings.toLocaleString("en-IN") : "0"}
          </Text>
          <Text style={[styles.wonLabel, { color: colors.mutedForeground }]}>won</Text>
        </View>
      </View>

      <View style={[styles.statsRow, { borderTopColor: colors.border + "80" }]}>
        <View style={styles.statCell}>
          <View style={[styles.statIcon, { backgroundColor: "#EFF6FF" }]}>
            <Feather name="star" size={11} color="#2563EB" />
          </View>
          <Text style={[styles.statVal, { color: colors.foreground }]}>{item.totalScore}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>pts</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statCell}>
          <View style={[styles.statIcon, { backgroundColor: "#F5F3FF" }]}>
            <Feather name="users" size={11} color="#7C3AED" />
          </View>
          <Text style={[styles.statVal, { color: colors.foreground }]}>{item.examsParticipated}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>exams</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statCell}>
          <View style={[styles.statIcon, { backgroundColor: "#F0FDF4" }]}>
            <Feather name="target" size={11} color="#16A34A" />
          </View>
          <Text style={[styles.statVal, { color: colors.foreground }]}>{winRatio}%</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>win rate</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function LeaderboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const router = useRouter();
  const [activePeriod, setActivePeriod] = useState<Period>("alltime");

  const baseUrl = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
  const { data, isLoading } = useQuery<EntryWithStats[]>({
    queryKey: ["/api/leaderboard/global", activePeriod],
    queryFn: async () => {
      const url = activePeriod === "alltime"
        ? `${baseUrl}/api/leaderboard/global`
        : `${baseUrl}/api/leaderboard/global?period=${activePeriod}`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      return res.json();
    },
    staleTime: 30_000,
  });

  const entries: EntryWithStats[] = (data ?? []) as EntryWithStats[];
  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0) + 16;

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>Leaderboard</Text>
            <Text style={[styles.sub2, { color: colors.mutedForeground }]}>
              Ranked by total prize winnings
            </Text>
          </View>
          <View style={[styles.trophyBox, { backgroundColor: colors.primary }]}>
            <Feather name="award" size={20} color="#fff" />
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
          contentContainerStyle={styles.tabsContent}
        >
          {TABS.map((tab) => {
            const active = activePeriod === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActivePeriod(tab.key)}
                style={[
                  styles.tab,
                  {
                    backgroundColor: active ? colors.primary : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: active ? "#fff" : colors.mutedForeground },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="award" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No rankings yet</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Be the first to compete and win!
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item, i) => `${(item as any).userId}-${activePeriod}-${i}`}
          renderItem={({ item }) => (
            <LeaderboardItem
              item={item as EntryWithStats}
              isMe={(item as any).userId === (user as any)?.id}
              onPress={() => router.push(`/user/${(item as any).userId}` as any)}
            />
          )}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 90 },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 4 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  title: { fontSize: 24, fontWeight: "800" },
  sub2: { fontSize: 13, marginTop: 2 },
  trophyBox: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  tabsScroll: { marginBottom: 12 },
  tabsContent: { gap: 8, paddingRight: 8 },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  tabText: { fontSize: 13, fontWeight: "700" },
  list: { paddingHorizontal: 20, paddingTop: 4 },
  item: {
    borderRadius: 16,
    marginBottom: 10,
    overflow: "hidden",
  },
  itemTop: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 10,
  },
  rankCell: { width: 32, alignItems: "center" },
  medal: { fontSize: 22 },
  rankNum: { fontSize: 15, fontWeight: "700" },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: { width: 40, height: 40 },
  avatarText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: "700" },
  sub: { fontSize: 11, marginTop: 1 },
  right: { alignItems: "flex-end" },
  winAmount: { fontSize: 16, fontWeight: "800" },
  wonLabel: { fontSize: 10, marginTop: 1 },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  statCell: { flex: 1, flexDirection: "row", alignItems: "center", gap: 5 },
  statDivider: { width: 1, height: 16, marginHorizontal: 4 },
  statIcon: {
    width: 20,
    height: 20,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  statVal: { fontSize: 13, fontWeight: "800" },
  statLabel: { fontSize: 11 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: "700" },
  emptyText: { fontSize: 14 },
});
