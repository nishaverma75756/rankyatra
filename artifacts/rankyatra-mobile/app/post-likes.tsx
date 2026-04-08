import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image,
} from "react-native";
import { showError } from "@/utils/alert";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { customFetch } from "@workspace/api-client-react";

interface Liker {
  id: number;
  name: string;
  avatarUrl: string | null;
}

export default function PostLikesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [likers, setLikers] = useState<Liker[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await customFetch<Liker[]>(`/api/posts/${id}/likers`);
      setLikers(data);
    } catch {
      showError("Error", "Failed to load likes");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const renderItem = ({ item }: { item: Liker }) => (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      {item.avatarUrl ? (
        <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.primary + "20" }]}>
          <Text style={[styles.avatarLetter, { color: colors.primary }]}>
            {item.name?.[0]?.toUpperCase() ?? "?"}
          </Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[styles.name, { color: colors.foreground }]}>{item.name}</Text>
      </View>
      <Feather name="heart" size={16} color="#ef4444" />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Likes</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : likers.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="heart" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No likes yet</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Be the first to like this post!</Text>
        </View>
      ) : (
        <FlatList
          data={likers}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        />
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
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 36, alignItems: "flex-start" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { justifyContent: "center", alignItems: "center" },
  avatarLetter: { fontSize: 18, fontWeight: "700" },
  name: { fontSize: 15, fontWeight: "600" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingBottom: 60 },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginTop: 12 },
  emptyText: { fontSize: 14 },
});
