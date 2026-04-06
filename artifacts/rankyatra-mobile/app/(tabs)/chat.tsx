import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Image,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useChatSocket } from "@/hooks/useChatSocket";
import { customFetch } from "@workspace/api-client-react";

interface OtherUser {
  id: number;
  name: string;
  avatarUrl: string | null;
}

interface LastMessage {
  id: number;
  content: string;
  senderId: number;
  isRead: boolean;
  deliveredAt: string | null;
  createdAt: string;
}

interface Conversation {
  id: number;
  otherUser: OtherUser;
  lastMessage: LastMessage | null;
  unreadCount: number;
  updatedAt: string;
}

function timeAgo(iso: string) {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function Avatar({ user, size = 46, colors }: { user: OtherUser; size?: number; colors: any }) {
  const initials = user.name?.slice(0, 2).toUpperCase() ?? "??";
  if (user.avatarUrl) {
    return (
      <Image
        source={{ uri: user.avatarUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: colors.primary + "20",
      alignItems: "center", justifyContent: "center"
    }}>
      <Text style={{ color: colors.primary, fontWeight: "700", fontSize: size * 0.35 }}>
        {initials}
      </Text>
    </View>
  );
}

function MsgTick({ msg }: { msg: LastMessage }) {
  if (msg.isRead) {
    return (
      <MaterialCommunityIcons name="check-all" size={15} color="#22c55e" style={{ marginRight: 3 }} />
    );
  }
  if (msg.deliveredAt) {
    return (
      <MaterialCommunityIcons name="check-all" size={15} color="#94a3b8" style={{ marginRight: 3 }} />
    );
  }
  return (
    <Feather name="check" size={13} color="#94a3b8" style={{ marginRight: 3 }} />
  );
}

export default function ChatListScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const myId = user?.id;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchConversations = useCallback(async () => {
    try {
      const data = await customFetch<Conversation[]>("/api/chat/conversations");
      setConversations(data);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  const handleWsMessage = useCallback((msg: any) => {
    if (msg.type === "new_message") fetchConversations();
    if (msg.type === "messages_read") fetchConversations();
  }, [fetchConversations]);

  useChatSocket(token, handleWsMessage);

  const onRefresh = () => { setRefreshing(true); fetchConversations(); };

  const renderItem = ({ item }: { item: Conversation }) => {
    const lm = item.lastMessage;
    const isMyMsg = !!lm && myId !== undefined && lm.senderId === myId;
    const hasUnread = item.unreadCount > 0;

    return (
      <TouchableOpacity
        style={[
          styles.convRow,
          { borderBottomColor: colors.border },
          hasUnread && { backgroundColor: "#f0fdf4" },
        ]}
        onPress={() => router.push(`/chat/${item.id}` as any)}
        activeOpacity={0.7}
      >
        {/* Avatar with unread dot */}
        <View style={{ position: "relative" }}>
          <Avatar user={item.otherUser} colors={colors} />
          {hasUnread && (
            <View style={styles.unreadDot} />
          )}
        </View>

        <View style={styles.convInfo}>
          {/* Name + Time */}
          <View style={styles.convTop}>
            <Text
              style={[styles.convName, { color: colors.foreground }, hasUnread && styles.bold]}
              numberOfLines={1}
            >
              {item.otherUser.name}
            </Text>
            <Text style={[styles.convTime, { color: hasUnread ? "#22c55e" : colors.mutedForeground }, hasUnread && styles.bold]}>
              {item.updatedAt ? timeAgo(item.updatedAt) : ""}
            </Text>
          </View>

          {/* Last message + badge */}
          <View style={styles.convBottom}>
            <View style={styles.lastMsgRow}>
              {isMyMsg && lm && <MsgTick msg={lm} />}
              <Text
                style={[
                  styles.lastMsg,
                  { color: hasUnread ? colors.foreground : colors.mutedForeground },
                  hasUnread && styles.bold,
                ]}
                numberOfLines={1}
              >
                {lm
                  ? (isMyMsg ? `You: ${lm.content}` : lm.content)
                  : "Start chatting"
                }
              </Text>
            </View>

            {/* Green unread badge */}
            {hasUnread && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.unreadCount > 99 ? "99+" : item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.flex, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Messages</Text>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(c) => String(c.id)}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={[styles.emptyBox]}>
            <Feather name="message-circle" size={52} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No messages yet</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              Visit a user's profile to start a chat
            </Text>
          </View>
        }
        contentContainerStyle={conversations.length === 0 ? styles.flex : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  bold: { fontWeight: "700" },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  convRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    gap: 12,
  },
  unreadDot: {
    position: "absolute",
    top: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#22c55e",
    borderWidth: 2,
    borderColor: "#fff",
  },
  convInfo: { flex: 1, gap: 4 },
  convTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  convName: { fontSize: 15, fontWeight: "600", flex: 1 },
  convTime: { fontSize: 12 },
  convBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  lastMsgRow: { flexDirection: "row", alignItems: "center", flex: 1 },
  lastMsg: { fontSize: 13, flex: 1 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    marginLeft: 6,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  emptyBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptySub: { fontSize: 14, textAlign: "center" },
});
