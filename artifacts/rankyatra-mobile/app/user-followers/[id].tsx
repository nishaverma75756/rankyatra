import React from "react";
import {
  View, Text, FlatList, StyleSheet, Image, ActivityIndicator,
  TouchableOpacity, Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
function resolveAvatar(url: string | null | undefined) {
  if (!url) return null;
  if (url.startsWith("data:") || url.startsWith("http")) return url;
  return `${BASE_URL}${url}`;
}

type FUser = { id: number; name: string; avatarUrl: string | null; verificationStatus: string; isFollowing: boolean };

export default function FollowersScreen() {
  return <FollowListScreen type="followers" />;
}

function FollowListScreen({ type }: { type: "followers" | "following" }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = parseInt(id ?? "0");
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token, user: me } = useAuth();
  const queryClient = useQueryClient();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0) + 16;
  const isFollowers = type === "followers";
  const qKey = ["/api/users", userId, type];

  const { data = [], isLoading } = useQuery<FUser[]>({
    queryKey: qKey,
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/users/${userId}/${type}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      return res.json();
    },
    enabled: userId > 0,
    staleTime: 30_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: qKey });
    if ((me as any)?.id) queryClient.invalidateQueries({ queryKey: ["user-follow-counts", (me as any).id] });
  };

  const followMutation = useMutation({
    mutationFn: async (targetId: number) => {
      await fetch(`${BASE_URL}/api/users/${targetId}/follow`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    },
    onSuccess: invalidate,
  });

  const unfollowMutation = useMutation({
    mutationFn: async (targetId: number) => {
      await fetch(`${BASE_URL}/api/users/${targetId}/follow`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    },
    onSuccess: invalidate,
  });

  function handleToggle(u: FUser) {
    if (!me) return;
    if (u.isFollowing) unfollowMutation.mutate(u.id);
    else followMutation.mutate(u.id);
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.secondary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{isFollowers ? "Followers" : "Following"}</Text>
        <View style={{ width: 36 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : data.length === 0 ? (
        <View style={styles.center}>
          <Feather name="users" size={44} color={colors.mutedForeground} style={{ opacity: 0.3, marginBottom: 12 }} />
          <Text style={{ color: colors.mutedForeground, fontWeight: "700", fontSize: 16 }}>
            {isFollowers ? "No followers yet" : "Not following anyone"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingVertical: 8, paddingBottom: insets.bottom + 32 }}
          renderItem={({ item: u }) => {
            const initials = u.name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();
            const isSelf = !!(me && (me as any).id === u.id);
            return (
              <TouchableOpacity
                style={[styles.row, { borderBottomColor: colors.border }]}
                onPress={() => router.push(`/user/${u.id}` as any)}
                activeOpacity={0.7}
              >
                {resolveAvatar(u.avatarUrl) ? (
                  <Image source={{ uri: resolveAvatar(u.avatarUrl)! }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: colors.primary + "20", alignItems: "center", justifyContent: "center" }]}>
                    <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 16 }}>{initials}</Text>
                  </View>
                )}
                <View style={styles.info}>
                  <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>{u.name}</Text>
                  {u.verificationStatus === "verified" && (
                    <Text style={{ color: "#10b981", fontSize: 11, fontWeight: "600" }}>✓ KYC Verified</Text>
                  )}
                </View>
                {!isSelf && me && (
                  <TouchableOpacity
                    style={[styles.followBtn, u.isFollowing
                      ? { backgroundColor: "transparent", borderWidth: 1.5, borderColor: colors.primary }
                      : { backgroundColor: colors.primary }
                    ]}
                    onPress={() => handleToggle(u)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.followBtnText, { color: u.isFollowing ? colors.primary : "#fff" }]}>
                      {u.isFollowing ? "Unfollow" : "Follow Back"}
                    </Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  info: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: "700" },
  followBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  followBtnText: { fontSize: 13, fontWeight: "700" },
});
