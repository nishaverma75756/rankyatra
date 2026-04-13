import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { showConfirm } from "@/utils/alert";
import { customFetch } from "@workspace/api-client-react";

interface RequestItem {
  id: number;
  otherUser: { id: number; name: string; avatarUrl: string | null };
  firstMessage: { content: string; createdAt: string } | null;
  createdAt: string;
}

function Avatar({ user, size = 50, colors }: { user: { name: string; avatarUrl: string | null }; size?: number; colors: any }) {
  if (user.avatarUrl) {
    return <Image source={{ uri: user.avatarUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary + "20", alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: colors.primary, fontWeight: "700", fontSize: size * 0.35 }}>
        {user.name?.slice(0, 2).toUpperCase() ?? "??"}
      </Text>
    </View>
  );
}

function timeAgo(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export default function MessageRequestsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actioning, setActioning] = useState<number | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      const data = await customFetch<RequestItem[]>("/api/chat/requests");
      setRequests(data);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleAccept = async (item: RequestItem) => {
    setActioning(item.id);
    try {
      await customFetch(`/api/chat/conversations/${item.id}/accept`, { method: "POST" });
      setRequests((prev) => prev.filter((r) => r.id !== item.id));
      router.push(`/chat/${item.id}` as any);
    } catch {
    } finally {
      setActioning(null);
    }
  };

  const handleDecline = (item: RequestItem) => {
    showConfirm(
      "Decline Request?",
      `${item.otherUser.name} ka message request decline kar doge? Conversation delete ho jaayegi.`,
      async () => {
        setActioning(item.id);
        try {
          await customFetch(`/api/chat/conversations/${item.id}/decline`, { method: "POST" });
          setRequests((prev) => prev.filter((r) => r.id !== item.id));
        } catch {
        } finally {
          setActioning(null);
        }
      }
    );
  };

  const renderItem = ({ item }: { item: RequestItem }) => {
    const isLoading = actioning === item.id;
    return (
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 }}>
        <TouchableOpacity onPress={() => router.push(`/public-profile?userId=${item.otherUser.id}` as any)} activeOpacity={0.8}>
          <Avatar user={item.otherUser} colors={colors} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }} numberOfLines={1}>
              {item.otherUser.name}
            </Text>
            <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
              {timeAgo(item.createdAt)}
            </Text>
          </View>
          {item.firstMessage && (
            <Text style={{ fontSize: 13, color: colors.mutedForeground, marginBottom: 10 }} numberOfLines={2}>
              {item.firstMessage.content}
            </Text>
          )}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              onPress={() => handleAccept(item)}
              disabled={isLoading}
              style={{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.primary, alignItems: "center" }}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Accept</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDecline(item)}
              disabled={isLoading}
              style={{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.muted, alignItems: "center" }}
            >
              <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 13 }}>Decline</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: insets.top + 12, paddingBottom: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: "700", color: colors.foreground }}>Message Requests</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(r) => String(r.id)}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRequests(); }} tintColor={colors.primary} colors={[colors.primary]} />}
          ListHeaderComponent={
            requests.length > 0 ? (
              <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                <Text style={{ fontSize: 13, color: colors.mutedForeground }}>
                  Yeh log aapse pehli baar baat karna chahte hain. Accept karo tab hi inbox mein aayega.
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 60, gap: 12 }}>
              <Feather name="inbox" size={52} color={colors.mutedForeground} />
              <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground }}>Koi request nahi</Text>
              <Text style={{ fontSize: 14, color: colors.mutedForeground, textAlign: "center" }}>
                Jab koi naya user message karega, yahan dikhega
              </Text>
            </View>
          }
          contentContainerStyle={requests.length === 0 ? { flex: 1 } : undefined}
        />
      )}
    </View>
  );
}
