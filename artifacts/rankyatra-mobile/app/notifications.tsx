import React, { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  Image, ScrollView, Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useActivityCount } from "@/contexts/ActivityCountContext";
import { customFetch } from "@workspace/api-client-react";

interface Notification {
  id: number;
  type: string;
  isRead: boolean;
  createdAt: string;
  postId: number | null;
  examId: number | null;
  fromUserId: number | null;
  fromUserName: string | null;
  fromUserAvatar: string | null;
}

function Avatar({ name, url, size = 40, colors }: { name: string; url: string | null; size?: number; colors: any }) {
  if (url) return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary + "20", alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: colors.primary, fontWeight: "700", fontSize: size * 0.35 }}>{name?.slice(0, 2).toUpperCase()}</Text>
    </View>
  );
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

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { resetNotifications } = useActivityCount();

  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const notifLabel: Record<string, string> = {
    like: "liked your post",
    comment: "commented on your post",
    follow: "started following you",
    reply: "replied to your comment",
    new_post: "ne naya post kiya",
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await customFetch<Notification[]>("/api/notifications");
        setNotifs(data);
        await customFetch("/api/notifications/read-all", { method: "POST" });
        resetNotifications();
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  const handleNotifPress = (n: Notification) => {
    const isExamNotif = n.type === "exam_reminder";
    if (isExamNotif && n.examId) router.push({ pathname: "/exam-detail", params: { id: n.examId } } as any);
    else if (n.postId) router.push({ pathname: "/post-comments", params: { id: n.postId } } as any);
    else if (n.fromUserId) router.push(`/user/${n.fromUserId}` as any);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
          {notifs.length === 0 && (
            <View style={styles.empty}>
              <Feather name="bell" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No notifications yet</Text>
            </View>
          )}
          {notifs.map((n) => {
            const isExamNotif = n.type === "exam_reminder";
            return (
              <TouchableOpacity
                key={n.id}
                style={[styles.notifRow, {
                  backgroundColor: n.isRead ? "transparent" : colors.primary + "08",
                  borderBottomColor: colors.border,
                }]}
                onPress={() => handleNotifPress(n)}
                activeOpacity={0.7}
              >
                {isExamNotif ? (
                  <View style={[styles.examIcon, { backgroundColor: colors.primary + "20" }]}>
                    <Feather name="book-open" size={20} color={colors.primary} />
                  </View>
                ) : (
                  <Avatar name={n.fromUserName ?? "?"} url={n.fromUserAvatar} size={42} colors={colors} />
                )}
                <View style={{ flex: 1 }}>
                  {isExamNotif ? (
                    <Text style={[styles.notifText, { color: colors.foreground }]}>
                      <Text style={{ fontWeight: "700" }}>Exam Reminder 📚</Text>
                    </Text>
                  ) : (
                    <Text style={[styles.notifText, { color: colors.foreground }]}>
                      <Text style={{ fontWeight: "700" }}>{n.fromUserName}</Text>
                      {" "}{notifLabel[n.type] ?? n.type}
                    </Text>
                  )}
                  <Text style={[styles.timeText, { color: colors.mutedForeground }]}>{timeAgo(n.createdAt)}</Text>
                </View>
                {!n.isRead && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
              </TouchableOpacity>
            );
          })}
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
  notifRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  examIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  notifText: { fontSize: 14, lineHeight: 20 },
  timeText: { fontSize: 12, marginTop: 3 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  empty: { alignItems: "center", marginTop: 80, gap: 12 },
  emptyText: { fontSize: 15 },
});
