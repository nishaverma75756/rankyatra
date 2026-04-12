import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Modal,
  Share,
  Animated,
} from "react-native";
import { showAlert, showSuccess, showError } from "@/utils/alert";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useChatSocket } from "@/hooks/useChatSocket";
import { customFetch } from "@workspace/api-client-react";

interface Message {
  id: number;
  conversationId: number;
  senderId: number;
  content: string;
  isRead: boolean;
  deliveredAt: string | null;
  readAt: string | null;
  createdAt: string;
  editedAt: string | null;
  isDeletedForEveryone: boolean;
}

interface ConvInfo {
  id: number;
  otherUser: { id: number; name: string; avatarUrl: string | null };
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function formatDateLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function ReadTick({ isRead, delivered, isMine }: { isRead: boolean; delivered: boolean; colors: any; isMine: boolean }) {
  if (!isMine) return null;
  // On orange bubble background — use white/green so ticks are visible
  const singleColor = "rgba(255,255,255,0.55)";
  const doubleColor = "rgba(255,255,255,0.75)";
  const readColor = "#4ade80"; // bright green
  if (isRead) {
    return (
      <View style={{ flexDirection: "row", marginLeft: 3, alignItems: "center" }}>
        <Feather name="check" size={12} color={readColor} />
        <Feather name="check" size={12} color={readColor} style={{ marginLeft: -7 }} />
      </View>
    );
  }
  if (delivered) {
    return (
      <View style={{ flexDirection: "row", marginLeft: 3, alignItems: "center" }}>
        <Feather name="check" size={12} color={doubleColor} />
        <Feather name="check" size={12} color={doubleColor} style={{ marginLeft: -7 }} />
      </View>
    );
  }
  return <Feather name="check" size={12} color={singleColor} style={{ marginLeft: 3 }} />;
}

function TypingDots({ colors }: { colors: any }) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: -5, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(600 - delay),
        ])
      );
    const a1 = anim(dot1, 0);
    const a2 = anim(dot2, 150);
    const a3 = anim(dot3, 300);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  const dotStyle = (dot: Animated.Value) => ({
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: "#f97316",
    marginHorizontal: 2,
    transform: [{ translateY: dot }],
  });

  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 4 }}>
      <Animated.View style={dotStyle(dot1)} />
      <Animated.View style={dotStyle(dot2)} />
      <Animated.View style={dotStyle(dot3)} />
    </View>
  );
}

const REPORT_REASONS = [
  { value: "harassment", label: "Harassment" },
  { value: "spam", label: "Spam" },
  { value: "fake", label: "Fake Profile" },
  { value: "inappropriate", label: "Inappropriate Content" },
  { value: "other", label: "Other" },
];

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, user } = useAuth();
  const convId = Number(id);

  const [messages, setMessages] = useState<Message[]>([]);
  const [convInfo, setConvInfo] = useState<ConvInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [otherOnline, setOtherOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [typingVisible, setTypingVisible] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [reportReason, setReportReason] = useState("harassment");
  const [reportDetails, setReportDetails] = useState("");
  const [reasonPickerVisible, setReasonPickerVisible] = useState(false);
  const [msgActionItem, setMsgActionItem] = useState<Message | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTypingSentRef = useRef<number>(0);
  const flatListRef = useRef<FlatList>(null);
  const isMounted = useRef(true);

  useEffect(() => () => { isMounted.current = false; }, []);

  // Load conversation info + messages
  useEffect(() => {
    const loadConv = async () => {
      try {
        const convs = await customFetch<any[]>("/api/chat/conversations");
        const found = convs.find((c) => c.id === convId);
        if (found && isMounted.current) setConvInfo({ id: found.id, otherUser: found.otherUser });
      } catch {}
    };
    const loadMessages = async () => {
      try {
        const data = await customFetch<Message[]>(`/api/chat/conversations/${convId}/messages`);
        if (isMounted.current) setMessages(data);
      } catch {}
      if (isMounted.current) setLoading(false);
    };
    loadConv();
    loadMessages();
  }, [convId]);

  // Poll messages as fallback when WS not connected
  useEffect(() => {
    if (wsConnected) {
      if (pollTimer.current) clearInterval(pollTimer.current);
      return;
    }
    pollTimer.current = setInterval(async () => {
      try {
        const data = await customFetch<Message[]>(`/api/chat/conversations/${convId}/messages`);
        if (isMounted.current) setMessages(data);
      } catch {}
    }, 3000);
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, [wsConnected, convId]);

  // Fetch block status
  const fetchBlockStatus = useCallback(async () => {
    if (!convInfo?.otherUser?.id) return;
    const list = await customFetch<any[]>("/api/me/blocked-users").catch(() => []);
    if (isMounted.current) setIsBlocked(list.some((u) => u.id === convInfo.otherUser.id));
  }, [convInfo?.otherUser?.id]);

  useEffect(() => { fetchBlockStatus(); }, [fetchBlockStatus]);

  // Fetch mute status
  const fetchMuteStatus = useCallback(async () => {
    try {
      const data = await customFetch<{ muted: boolean }>(`/api/chat/conversations/${convId}/mute`);
      if (isMounted.current) setIsMuted(data.muted);
    } catch {}
  }, [convId]);

  useEffect(() => { fetchMuteStatus(); }, [fetchMuteStatus]);

  // Online status poll (10s)
  const fetchOnlineStatus = useCallback(async () => {
    if (!convInfo?.otherUser?.id) return;
    try {
      const data = await customFetch<{ online: boolean; lastSeen: string | null }>(
        `/api/chat/online/${convInfo.otherUser.id}`
      );
      if (isMounted.current) { setOtherOnline(data.online); setLastSeen(data.lastSeen); }
    } catch {}
  }, [convInfo?.otherUser?.id]);

  useEffect(() => {
    fetchOnlineStatus();
    const interval = setInterval(fetchOnlineStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchOnlineStatus]);

  // Poll typing status every 1.5s (REST fallback — works even when WS drops)
  useEffect(() => {
    if (!convId) return;
    const poll = async () => {
      if (!isMounted.current) return;
      try {
        const data = await customFetch<{ typing: boolean; userId: number | null }>(
          `/api/chat/conversations/${convId}/typing`
        );
        if (data.typing && isMounted.current) {
          setTypingVisible(true);
          if (typingTimer.current) clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() => {
            if (isMounted.current) setTypingVisible(false);
          }, 3000);
        }
      } catch {}
    };
    const id = setInterval(poll, 1500);
    return () => clearInterval(id);
  }, [convId]);

  // Mark as read
  const markRead = useCallback(async () => {
    try { await customFetch(`/api/chat/conversations/${convId}/read`, { method: "POST" }); } catch {}
  }, [convId]);

  useEffect(() => { if (!loading) markRead(); }, [loading, markRead]);

  // WebSocket handler
  const handleWsMessage = useCallback((msg: any) => {
    if (msg.type === "connected") setWsConnected(true);
    if (msg.type === "new_message" && msg.message.conversationId === convId) {
      setMessages((prev) => {
        if (prev.find((m) => m.id === msg.message.id)) return prev;
        return [...prev, msg.message];
      });
      markRead();
    }
    if (msg.type === "messages_delivered" && msg.conversationId === convId) {
      const ids = new Set<number>(msg.messageIds);
      setMessages((prev) => prev.map((m) =>
        ids.has(m.id) ? { ...m, deliveredAt: msg.deliveredAt } : m
      ));
    }
    if (msg.type === "messages_read" && msg.conversationId === convId) {
      setMessages((prev) => prev.map((m) =>
        m.senderId === user?.id ? { ...m, isRead: true, readAt: new Date().toISOString() } : m
      ));
    }
    if (msg.type === "typing" && msg.conversationId === convId && msg.userId !== user?.id) {
      setTypingVisible(true);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTypingVisible(false), 3000);
    }
    if (msg.type === "online_status" && msg.userId === convInfo?.otherUser?.id) {
      setOtherOnline(msg.online);
      if (!msg.online) setLastSeen(msg.lastSeen ?? null);
    }
    if (msg.type === "message_edited") {
      setMessages((prev) => prev.map((m) => m.id === msg.message.id ? { ...m, content: msg.message.content, editedAt: msg.message.editedAt } : m));
    }
    if (msg.type === "message_deleted") {
      if (msg.mode === "everyone") {
        setMessages((prev) => prev.map((m) => m.id === msg.messageId ? { ...m, isDeletedForEveryone: true, content: "This message was deleted" } : m));
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== msg.messageId));
      }
    }
  }, [convId, markRead, user?.id, convInfo?.otherUser?.id]);

  const { send } = useChatSocket(token, handleWsMessage);

  // Inverted FlatList: newest messages at bottom — no manual scroll needed
  // Reversed so index 0 = newest (shown at bottom of inverted list)
  const reversedMessages = useMemo(() => [...messages].reverse(), [messages]);

  const handleSend = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setText("");
    setSending(true);
    try {
      const msg = await customFetch<Message>("/api/chat/messages", {
        method: "POST",
        body: JSON.stringify({ conversationId: convId, content }),
        headers: { "Content-Type": "application/json" },
      });
      setMessages((prev) => [...prev, msg]);
      // inverted FlatList — new message appears at bottom automatically, no scroll needed
    } catch {}
    setSending(false);
  };

  const handleTyping = (val: string) => {
    setText(val);
    // WebSocket path (instant)
    send({ type: "typing", conversationId: convId, userId: user?.id });
    // REST fallback — throttle to once every 2 seconds
    const now = Date.now();
    if (now - lastTypingSentRef.current > 2000) {
      lastTypingSentRef.current = now;
      customFetch(`/api/chat/conversations/${convId}/typing`, { method: "POST" }).catch(() => {});
    }
  };

  const handleBlockToggle = () => {
    const name = convInfo?.otherUser?.name ?? "this user";
    setMenuVisible(false);
    if (isBlocked) {
      showAlert(`Unblock ${name}?`, `${name} will be able to message you again.`, [
        { text: "Cancel", style: "cancel" },
        { text: "Unblock", onPress: async () => {
          await customFetch(`/api/users/${convInfo!.otherUser.id}/block`, { method: "DELETE" }).catch(() => {});
          setIsBlocked(false);
        }},
      ], "confirm");
    } else {
      showAlert(`Block ${name}?`, `${name} won't be able to message you anymore.`, [
        { text: "Cancel", style: "cancel" },
        { text: "Block", style: "destructive", onPress: async () => {
          await customFetch(`/api/users/${convInfo!.otherUser.id}/block`, { method: "POST" }).catch(() => {});
          setIsBlocked(true);
        }},
      ], "warning");
    }
  };

  const handleMuteToggle = async () => {
    setMenuVisible(false);
    if (isMuted) {
      await customFetch(`/api/chat/conversations/${convId}/mute`, { method: "DELETE" }).catch(() => {});
      setIsMuted(false);
    } else {
      await customFetch(`/api/chat/conversations/${convId}/mute`, { method: "POST" }).catch(() => {});
      setIsMuted(true);
    }
  };

  const handleDeleteConversation = () => {
    const name = convInfo?.otherUser?.name ?? "this chat";
    setMenuVisible(false);
    showAlert(
      "Delete Chat?",
      `This will delete the chat with ${name} only for you. They won't be notified.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await customFetch(`/api/chat/conversations/${convId}`, { method: "DELETE" });
              router.back();
            } catch {
              showError("Error", "Failed to delete chat. Please try again.");
            }
          },
        },
      ],
      "warning"
    );
  };

  const handleViewProfile = () => {
    setMenuVisible(false);
    if (convInfo?.otherUser?.id) router.push(`/user/${convInfo.otherUser.id}` as any);
  };

  const handleShareProfile = async () => {
    setMenuVisible(false);
    if (!convInfo?.otherUser?.id) return;
    const url = `https://${process.env.EXPO_PUBLIC_DOMAIN}/user/${convInfo.otherUser.id}`;
    await Share.share({ message: `Check out ${convInfo.otherUser.name}'s profile on RankYatra: ${url}` });
  };

  const handleReport = async () => {
    if (!convInfo?.otherUser?.id) return;
    try {
      await customFetch(`/api/users/${convInfo.otherUser.id}/report`, {
        method: "POST",
        body: JSON.stringify({ reason: reportReason, details: reportDetails, conversationId: convId }),
        headers: { "Content-Type": "application/json" },
      });
      setReportVisible(false);
      setReportDetails("");
      showSuccess("Reported!", "Your report has been submitted. Our team will review it.");
    } catch {
      showError("Error", "Failed to submit report. Please try again.");
    }
  };

  const handleMsgLongPress = (item: Message) => {
    if (item.isDeletedForEveryone) return;
    setMsgActionItem(item);
  };

  const handleDeleteMsg = (msgId: number, mode: "me" | "everyone") => {
    setMsgActionItem(null);
    showAlert(
      mode === "everyone" ? "Delete for Everyone?" : "Delete for Me?",
      mode === "everyone" ? "This message will be deleted for all users." : "This message will only be removed for you.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await customFetch(`/api/chat/messages/${msgId}?mode=${mode}`, { method: "DELETE" });
              if (mode === "everyone") {
                setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, isDeletedForEveryone: true, content: "This message was deleted" } : m));
              } else {
                setMessages((prev) => prev.filter((m) => m.id !== msgId));
              }
            } catch { showError("Error", "Failed to delete message"); }
          },
        },
      ],
      "warning"
    );
  };

  const handleStartEdit = (item: Message) => {
    setMsgActionItem(null);
    setEditingId(item.id);
    setEditText(item.content);
  };

  const handleEditSave = async () => {
    if (!editingId || !editText.trim()) return;
    try {
      const updated = await customFetch<Message>(`/api/chat/messages/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify({ content: editText.trim() }),
        headers: { "Content-Type": "application/json" },
      });
      setMessages((prev) => prev.map((m) => m.id === editingId ? { ...m, content: updated.content, editedAt: updated.editedAt } : m));
      setEditingId(null);
      setEditText("");
    } catch { showError("Error", "Failed to edit message"); }
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMine = item.senderId === user?.id;
    // In inverted FlatList with reversed data: index+1 is the message visually above (older)
    const prevItem = reversedMessages[index + 1];
    const showDateLabel = !prevItem || formatDateLabel(item.createdAt) !== formatDateLabel(prevItem.createdAt);
    const avatarUrl = convInfo?.otherUser?.avatarUrl;
    const avatarName = convInfo?.otherUser?.name ?? "?";

    return (
      <>
        {showDateLabel && (
          <View style={styles.dateLabel}>
            <View style={[styles.dateLabelPill, { backgroundColor: colors.muted }]}>
              <Text style={[styles.dateLabelText, { color: colors.mutedForeground }]}>
                {formatDateLabel(item.createdAt)}
              </Text>
            </View>
          </View>
        )}
        <View style={[styles.msgRow, isMine ? styles.msgRowRight : styles.msgRowLeft]}>
          {/* Small avatar for received messages */}
          {!isMine && (
            <View style={styles.msgAvatar}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.msgAvatarImg} />
              ) : (
                <View style={[styles.msgAvatarImg, styles.msgAvatarFallback, { backgroundColor: colors.primary + "20" }]}>
                  <Text style={[styles.msgAvatarText, { color: colors.primary }]}>
                    {avatarName.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          )}
          <TouchableOpacity
            onLongPress={() => handleMsgLongPress(item)}
            delayLongPress={400}
            activeOpacity={0.85}
          >
            <View style={[
              styles.bubble,
              isMine
                ? [styles.bubbleMine, { backgroundColor: item.isDeletedForEveryone ? colors.muted : colors.primary }]
                : [styles.bubbleOther, { backgroundColor: colors.muted, borderWidth: 0 }],
            ]}>
              {item.isDeletedForEveryone ? (
                <Text style={[styles.bubbleText, { color: colors.mutedForeground, fontStyle: "italic" }]}>
                  🚫 This message was deleted
                </Text>
              ) : (
                <Text style={[styles.bubbleText, { color: isMine ? "#fff" : colors.foreground }]}>
                  {item.content}
                </Text>
              )}
              <View style={styles.bubbleMeta}>
                {item.editedAt && !item.isDeletedForEveryone && (
                  <Text style={[styles.msgTime, { color: isMine ? "rgba(255,255,255,0.5)" : colors.mutedForeground, marginRight: 3 }]}>edited</Text>
                )}
                <Text style={[styles.msgTime, { color: isMine ? "rgba(255,255,255,0.65)" : colors.mutedForeground }]}>
                  {formatTime(item.createdAt)}
                </Text>
                {!item.isDeletedForEveryone && (
                  <ReadTick isRead={item.isRead} delivered={!!item.deliveredAt} colors={colors} isMine={isMine} />
                )}
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </>
    );
  };

  const statusText = otherOnline
    ? "Online"
    : lastSeen
    ? `Last seen ${new Date(lastSeen).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}`
    : "Offline";

  const selectedReasonLabel = REPORT_REASONS.find(r => r.value === reportReason)?.label ?? "Harassment";

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {/* 3-dot Menu Modal */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* View Profile */}
            <TouchableOpacity style={styles.menuItem} onPress={handleViewProfile}>
              <Feather name="user" size={17} color={colors.foreground} />
              <Text style={[styles.menuItemText, { color: colors.foreground }]}>View Profile</Text>
            </TouchableOpacity>
            {/* Share Profile */}
            <TouchableOpacity style={styles.menuItem} onPress={handleShareProfile}>
              <Feather name="share-2" size={17} color={colors.foreground} />
              <Text style={[styles.menuItemText, { color: colors.foreground }]}>Share Profile</Text>
            </TouchableOpacity>
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            {/* Mute */}
            <TouchableOpacity style={styles.menuItem} onPress={handleMuteToggle}>
              <Feather name={isMuted ? "bell" : "bell-off"} size={17} color={colors.foreground} />
              <Text style={[styles.menuItemText, { color: colors.foreground }]}>
                {isMuted ? "Unmute" : "Mute Notifications"}
              </Text>
            </TouchableOpacity>
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            {/* Report */}
            <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); setReportVisible(true); }}>
              <Feather name="flag" size={17} color="#f97316" />
              <Text style={[styles.menuItemText, { color: "#f97316" }]}>Report</Text>
            </TouchableOpacity>
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            {/* Delete Chat */}
            <TouchableOpacity style={styles.menuItem} onPress={handleDeleteConversation}>
              <Feather name="trash-2" size={17} color="#ef4444" />
              <Text style={[styles.menuItemText, { color: "#ef4444" }]}>Delete Chat</Text>
            </TouchableOpacity>
            {/* Block */}
            <TouchableOpacity style={styles.menuItem} onPress={handleBlockToggle}>
              <Feather name={isBlocked ? "user-check" : "user-x"} size={17} color={isBlocked ? "#22c55e" : "#ef4444"} />
              <Text style={[styles.menuItemText, { color: isBlocked ? "#22c55e" : "#ef4444" }]}>
                {isBlocked ? "Unblock User" : "Block User"}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Report Modal */}
      <Modal visible={reportVisible} transparent animationType="slide" onRequestClose={() => setReportVisible(false)}>
        <TouchableOpacity style={styles.reportOverlay} activeOpacity={1} onPress={() => setReportVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.reportCard, { backgroundColor: colors.card }]}>
            <View style={[styles.reportHandle, { backgroundColor: colors.border }]} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Feather name="flag" size={20} color="#ef4444" />
              <Text style={[styles.reportTitle, { color: colors.foreground }]}>
                Report {convInfo?.otherUser?.name ?? "User"}
              </Text>
            </View>

            <Text style={[styles.reportLabel, { color: colors.mutedForeground }]}>Reason</Text>
            <TouchableOpacity
              style={[styles.reasonPicker, { borderColor: colors.border, backgroundColor: colors.background }]}
              onPress={() => setReasonPickerVisible(true)}
            >
              <Text style={[styles.reasonPickerText, { color: colors.foreground }]}>{selectedReasonLabel}</Text>
              <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>

            <Text style={[styles.reportLabel, { color: colors.mutedForeground, marginTop: 12 }]}>Details (optional)</Text>
            <TextInput
              style={[styles.reportInput, { borderColor: colors.border, backgroundColor: colors.background, color: colors.foreground }]}
              placeholder="Describe the issue..."
              placeholderTextColor={colors.mutedForeground}
              value={reportDetails}
              onChangeText={setReportDetails}
              multiline
              maxLength={500}
              numberOfLines={3}
            />

            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.reportBtn, { backgroundColor: colors.muted, flex: 1 }]}
                onPress={() => setReportVisible(false)}
              >
                <Text style={[styles.reportBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.reportBtn, { backgroundColor: "#ef4444", flex: 1 }]}
                onPress={handleReport}
              >
                <Text style={[styles.reportBtnText, { color: "#fff" }]}>Submit</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Message Action Bottom Sheet */}
      <Modal visible={!!msgActionItem} transparent animationType="slide" onRequestClose={() => setMsgActionItem(null)}>
        <TouchableOpacity style={styles.reportOverlay} activeOpacity={1} onPress={() => setMsgActionItem(null)}>
          <TouchableOpacity activeOpacity={1} style={[styles.reportCard, { backgroundColor: colors.card }]}>
            <View style={[styles.reportHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.reportTitle, { color: colors.foreground, marginBottom: 12 }]}>Message Options</Text>
            {/* Edit — only my messages */}
            {msgActionItem && msgActionItem.senderId === user?.id && (
              <TouchableOpacity style={styles.menuItem} onPress={() => handleStartEdit(msgActionItem)}>
                <Feather name="edit-2" size={17} color="#3b82f6" />
                <Text style={[styles.menuItemText, { color: "#3b82f6" }]}>Edit Message</Text>
              </TouchableOpacity>
            )}
            {/* Delete for me */}
            {msgActionItem && (
              <TouchableOpacity style={styles.menuItem} onPress={() => handleDeleteMsg(msgActionItem.id, "me")}>
                <Feather name="trash-2" size={17} color={colors.mutedForeground} />
                <Text style={[styles.menuItemText, { color: colors.mutedForeground }]}>Delete for Me</Text>
              </TouchableOpacity>
            )}
            {/* Delete for everyone — only sender */}
            {msgActionItem && msgActionItem.senderId === user?.id && (
              <TouchableOpacity style={styles.menuItem} onPress={() => handleDeleteMsg(msgActionItem.id, "everyone")}>
                <Feather name="trash-2" size={17} color="#ef4444" />
                <Text style={[styles.menuItemText, { color: "#ef4444" }]}>Delete for Everyone</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.reportBtn, { backgroundColor: colors.muted, marginTop: 12 }]}
              onPress={() => setMsgActionItem(null)}
            >
              <Text style={[styles.reportBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Reason Picker Modal */}
      <Modal visible={reasonPickerVisible} transparent animationType="slide" onRequestClose={() => setReasonPickerVisible(false)}>
        <TouchableOpacity style={styles.reportOverlay} activeOpacity={1} onPress={() => setReasonPickerVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.reportCard, { backgroundColor: colors.card }]}>
            <View style={[styles.reportHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.reportTitle, { color: colors.foreground, marginBottom: 12 }]}>Select Reason</Text>
            {REPORT_REASONS.map(r => (
              <TouchableOpacity
                key={r.value}
                style={[styles.reasonOption, { backgroundColor: reportReason === r.value ? colors.primary + "15" : "transparent" }]}
                onPress={() => { setReportReason(r.value); setReasonPickerVisible(false); }}
              >
                <Text style={[styles.reasonOptionText, { color: reportReason === r.value ? colors.primary : colors.foreground }]}>
                  {r.label}
                </Text>
                {reportReason === r.value && <Feather name="check" size={16} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Header — outside KAV so it never moves when keyboard opens */}
      <View style={[styles.header, { paddingTop: insets.top + 6, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>

        <TouchableOpacity onPress={handleViewProfile} style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: 10 }}>
          {convInfo?.otherUser?.avatarUrl ? (
            <Image source={{ uri: convInfo.otherUser.avatarUrl }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarFallback, { backgroundColor: colors.primary + "20" }]}>
              <Text style={[styles.headerAvatarText, { color: colors.primary }]}>
                {convInfo?.otherUser?.name?.slice(0, 2).toUpperCase() ?? "??"}
              </Text>
            </View>
          )}
          <View style={styles.headerInfo}>
            <Text style={[styles.headerName, { color: colors.foreground }]} numberOfLines={1}>
              {convInfo?.otherUser?.name ?? "Chat"}
            </Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: otherOnline ? "#22c55e" : colors.mutedForeground }]} />
              <Text style={[styles.statusText, { color: otherOnline ? "#22c55e" : colors.mutedForeground }]}>
                {statusText}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.menuBtn}>
          <Feather name="more-vertical" size={22} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* KAV wraps only messages + input — header stays fixed above */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
      {/* Messages */}
      {loading ? (
        <View style={[styles.flex, styles.center]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={reversedMessages}
          inverted
          keyExtractor={(m) => String(m.id)}
          renderItem={renderMessage}
          contentContainerStyle={{
            paddingHorizontal: 12,
            paddingTop: 8,
            paddingBottom: 12,
          }}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={100}
          ListEmptyComponent={
            <View style={[styles.center, { paddingVertical: 60 }]}>
              <Feather name="message-circle" size={42} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Say hello!</Text>
            </View>
          }
          ListHeaderComponent={typingVisible ? (
            <View style={[styles.typingRow]}>
              <View style={[styles.msgRow, styles.msgRowLeft]}>
                <View style={styles.msgAvatar}>
                  {convInfo?.otherUser?.avatarUrl ? (
                    <Image source={{ uri: convInfo.otherUser.avatarUrl }} style={styles.msgAvatarImg} />
                  ) : (
                    <View style={[styles.msgAvatarImg, styles.msgAvatarFallback, { backgroundColor: colors.primary + "20" }]}>
                      <Text style={[styles.msgAvatarText, { color: colors.primary }]}>{convInfo?.otherUser?.name?.[0]?.toUpperCase()}</Text>
                    </View>
                  )}
                </View>
                <View style={[styles.bubble, styles.bubbleOther, styles.typingBubble, { backgroundColor: colors.muted, borderColor: "transparent" }]}>
                  <TypingDots colors={colors} />
                </View>
              </View>
            </View>
          ) : null}
        />
      )}

      {/* Edit mode banner */}
      {editingId && (
        <View style={[styles.editBanner, { backgroundColor: "#eff6ff", borderTopColor: "#93c5fd" }]}>
          <Feather name="edit-2" size={13} color="#3b82f6" />
          <Text style={{ fontSize: 12, color: "#3b82f6", fontWeight: "600", flex: 1 }}>Editing message</Text>
          <TouchableOpacity onPress={() => { setEditingId(null); setEditText(""); }}>
            <Feather name="x" size={16} color="#94a3b8" />
          </TouchableOpacity>
        </View>
      )}

      {/* Input */}
      <View
        style={[styles.inputRow, {
          paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
          borderTopColor: editingId ? "#93c5fd" : colors.border,
          backgroundColor: colors.background,
        }]}
      >
        <TextInput
          style={[styles.input, {
            backgroundColor: colors.card,
            borderColor: editingId ? "#93c5fd" : colors.border,
            color: colors.foreground
          }]}
          placeholder={editingId ? "Edit message..." : "Type a message..."}
          placeholderTextColor={colors.mutedForeground}
          value={editingId ? editText : text}
          onChangeText={editingId ? setEditText : handleTyping}
          multiline
          maxLength={1000}
          returnKeyType="default"
          autoFocus={!!editingId}
        />
        <TouchableOpacity
          style={[styles.sendBtn, {
            backgroundColor: (editingId ? editText.trim() : text.trim()) ? (editingId ? "#3b82f6" : colors.primary) : colors.muted,
            opacity: sending ? 0.6 : 1
          }]}
          onPress={editingId ? handleEditSave : handleSend}
          disabled={editingId ? !editText.trim() : (!text.trim() || sending)}
          activeOpacity={0.8}
        >
          {sending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Feather name={editingId ? "check" : "send"} size={18} color={(editingId ? editText.trim() : text.trim()) ? "#fff" : colors.mutedForeground} />
          }
        </TouchableOpacity>
      </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20 },
  headerAvatarFallback: { alignItems: "center", justifyContent: "center" },
  headerAvatarText: { fontWeight: "700", fontSize: 14 },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 16, fontWeight: "700" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12 },
  // Messages
  msgRow: { marginBottom: 4, maxWidth: "78%", flexDirection: "row", alignItems: "flex-end", gap: 6 },
  msgRowRight: { alignSelf: "flex-end" },
  msgRowLeft: { alignSelf: "flex-start" },
  msgAvatar: { width: 26, height: 26, borderRadius: 13, overflow: "hidden" },
  msgAvatarImg: { width: 26, height: 26, borderRadius: 13 },
  msgAvatarFallback: { alignItems: "center", justifyContent: "center" },
  msgAvatarText: { fontWeight: "700", fontSize: 11 },
  bubble: { borderRadius: 16, paddingHorizontal: 13, paddingVertical: 8, borderWidth: 1 },
  bubbleMine: { borderRadius: 16, borderBottomRightRadius: 4, borderColor: "transparent" },
  bubbleOther: { borderRadius: 16, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  bubbleMeta: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: 3, gap: 2 },
  msgTime: { fontSize: 11 },
  dateLabel: { alignItems: "center", marginVertical: 10 },
  dateLabelPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  dateLabelText: { fontSize: 12 },
  // Typing
  typingRow: { paddingHorizontal: 14, paddingVertical: 4 },
  typingBubble: { paddingHorizontal: 14, paddingVertical: 10 },
  typingName: { fontSize: 12 },
  // Input
  inputRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    alignItems: "flex-end",
    gap: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    maxHeight: 120,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { fontSize: 15, marginTop: 10 },
  menuBtn: { padding: 8, marginLeft: 4 },
  // Menu modal
  modalOverlay: { flex: 1, justifyContent: "flex-start", alignItems: "flex-end", paddingTop: 80, paddingRight: 12 },
  menuCard: { borderRadius: 14, borderWidth: 1, paddingVertical: 4, minWidth: 200, elevation: 8, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8 },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  menuItemText: { fontSize: 15, fontWeight: "600" },
  menuDivider: { height: 1, marginHorizontal: 8 },
  // Report modal
  reportOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  reportCard: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32 },
  reportHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  reportTitle: { fontSize: 18, fontWeight: "700" },
  reportLabel: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  reasonPicker: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  reasonPickerText: { fontSize: 15 },
  reportInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, minHeight: 80, textAlignVertical: "top" },
  reportBtn: { paddingVertical: 13, borderRadius: 12, alignItems: "center" },
  reportBtnText: { fontWeight: "700", fontSize: 15 },
  reasonOption: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 13, borderRadius: 10 },
  reasonOptionText: { fontSize: 15 },
  editBanner: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1 },
});
