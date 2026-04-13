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
import { showError, showSuccess } from "@/utils/alert";

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
  title: string | null;
  body: string | null;
  data: string | null;
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

function GroupInviteRow({ n, colors, onRespond }: { n: Notification; colors: any; onRespond: (id: number, action: "accept" | "decline") => void }) {
  const parsed = React.useMemo(() => {
    try { return JSON.parse(n.data ?? "{}"); } catch { return {}; }
  }, [n.data]);

  const [responding, setResponding] = useState<"accept" | "decline" | null>(null);
  const [done, setDone] = useState<"accepted" | "declined" | null>(null);

  const handleRespond = async (action: "accept" | "decline") => {
    setResponding(action);
    try {
      let inviteId = parsed.inviteId;
      if (!inviteId && parsed.groupId) {
        const invites = await customFetch<{ id: number; groupId: number }[]>("/api/groups/invites");
        const match = invites.find((inv) => inv.groupId === parsed.groupId);
        inviteId = match?.id;
      }
      if (!inviteId) { showError("Invite Not Found", "You may have already responded to this invite."); return; }
      await customFetch(`/api/groups/invites/${inviteId}`, { method: "PATCH", body: JSON.stringify({ action }) });
      setDone(action === "accept" ? "accepted" : "declined");
      onRespond(n.id, action);
      if (action === "accept") showSuccess(`Successfully joined ${parsed.groupName ?? "the group"}!`);
    } catch {
      showError("Something went wrong", "Please try again.");
    } finally {
      setResponding(null);
    }
  };

  return (
    <View style={[styles.notifRow, {
      backgroundColor: n.isRead ? "transparent" : colors.primary + "08",
      borderBottomColor: colors.border,
    }]}>
      <View style={[styles.groupIcon, { backgroundColor: colors.primary + "20" }]}>
        <Feather name="users" size={20} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.notifText, { color: colors.foreground }]}>
          <Text style={{ fontWeight: "700" }}>{n.fromUserName ?? "Someone"}</Text>
          {" "}invited you to{" "}
          <Text style={{ fontWeight: "700" }}>"{parsed.groupName ?? "Group"}"</Text>
        </Text>
        <Text style={[styles.timeText, { color: colors.mutedForeground }]}>{timeAgo(n.createdAt)}</Text>
        {done ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
            <View style={{
              paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
              backgroundColor: done === "accepted" ? "#d1fae5" : "#fee2e2",
            }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: done === "accepted" ? "#065f46" : "#991b1b" }}>
                {done === "accepted" ? "✓ Accepted" : "✗ Declined"}
              </Text>
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <TouchableOpacity
              style={[styles.inviteBtn, { backgroundColor: colors.primary, opacity: responding ? 0.6 : 1 }]}
              onPress={() => handleRespond("accept")}
              disabled={!!responding}
            >
              {responding === "accept"
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>Accept</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.inviteBtn, { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border, opacity: responding ? 0.6 : 1 }]}
              onPress={() => handleRespond("decline")}
              disabled={!!responding}
            >
              {responding === "decline"
                ? <ActivityIndicator size="small" color={colors.foreground} />
                : <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "600" }}>Decline</Text>
              }
            </TouchableOpacity>
          </View>
        )}
      </View>
      {!n.isRead && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
    </View>
  );
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
    new_post: "shared a new post",
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
    if (n.type === "group_invite") return;
    const isExamNotif = n.type === "exam_reminder";
    if (isExamNotif && n.examId) router.push({ pathname: "/exam-detail", params: { id: n.examId } } as any);
    else if (n.postId) router.push({ pathname: "/post-comments", params: { id: n.postId } } as any);
    else if (n.fromUserId) router.push(`/user/${n.fromUserId}` as any);
  };

  const handleInviteRespond = (notifId: number, action: "accept" | "decline") => {
    setNotifs((prev) => prev.map((n) => n.id === notifId ? { ...n, isRead: true } : n));
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
            if (n.type === "group_invite") {
              return <GroupInviteRow key={n.id} n={n} colors={colors} onRespond={handleInviteRespond} />;
            }

            const isExamNotif = n.type === "exam_reminder";
            const isSystemNotif = n.type === "system";
            // Notifications that use stored title+body instead of fromUser label
            const hasTitleBody = (isExamNotif || isSystemNotif) && (n.title || n.body);

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
                {/* Icon / Avatar */}
                {isExamNotif ? (
                  <View style={[styles.examIcon, { backgroundColor: "#f9731620" }]}>
                    <Feather name="book-open" size={20} color={colors.primary} />
                  </View>
                ) : isSystemNotif ? (
                  <View style={[styles.examIcon, { backgroundColor: "#6366f120" }]}>
                    <Feather name="bell" size={20} color="#6366f1" />
                  </View>
                ) : (
                  <Avatar name={n.fromUserName ?? "?"} url={n.fromUserAvatar} size={42} colors={colors} />
                )}

                {/* Text content */}
                <View style={{ flex: 1 }}>
                  {hasTitleBody ? (
                    <>
                      <Text style={[styles.notifText, { color: colors.foreground }]} numberOfLines={1}>
                        <Text style={{ fontWeight: "700" }}>{n.title}</Text>
                      </Text>
                      {n.body ? (
                        <Text style={[styles.bodyText, { color: colors.mutedForeground }]} numberOfLines={2}>
                          {n.body}
                        </Text>
                      ) : null}
                    </>
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
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  examIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  groupIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  notifText: { fontSize: 14, lineHeight: 20 },
  bodyText: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  timeText: { fontSize: 12, marginTop: 3 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  empty: { alignItems: "center", marginTop: 80, gap: 12 },
  emptyText: { fontSize: 15 },
  inviteBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 80,
  },
});
