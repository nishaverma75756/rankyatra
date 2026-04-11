import React, { useEffect, useRef, useCallback, useState } from "react";
import {
  Animated,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  Keyboard,
} from "react-native";

const RANKYATRA_LOGO = require("../assets/images/notification-icon.png");

export type BannerNotification = {
  id: string;
  title: string;
  body: string;
  avatar?: string | null;
  type?: string;
  conversationId?: number;
  postId?: number;
  onPress?: () => void;
};

type Props = {
  notification: BannerNotification | null;
  onDismiss: () => void;
  onReply?: (conversationId: number, text: string) => Promise<void>;
};

const BANNER_HEIGHT = 80;
const AUTO_DISMISS_MS = 5500;

export default function NotificationBanner({ notification, onDismiss, onReply }: Props) {
  const translateY = useRef(new Animated.Value(-200)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [replyMode, setReplyMode] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const isMessage = notification?.type === "message" && !!notification?.conversationId;

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -200,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setReplyMode(false);
      setReplyText("");
      setSent(false);
      onDismiss();
    });
  }, [translateY, opacity, onDismiss]);

  useEffect(() => {
    if (!notification) return;
    setReplyMode(false);
    setReplyText("");
    setSent(false);
    translateY.setValue(-200);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        tension: 60,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
    timerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [notification]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => !replyMode && Math.abs(g.dy) > 5,
      onPanResponderMove: (_, g) => {
        if (g.dy < 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy < -30 || g.vy < -0.5) {
          dismiss();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const handleReplyPress = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setReplyMode(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleSendReply = async () => {
    const text = replyText.trim();
    if (!text || !notification?.conversationId || !onReply) return;
    setSending(true);
    try {
      await onReply(notification.conversationId, text);
      setSent(true);
      setReplyText("");
      setTimeout(dismiss, 1200);
    } catch {
      setSending(false);
    } finally {
      setSending(false);
    }
  };

  if (!notification) return null;

  const initials = notification.title
    ? notification.title.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "RY";

  return (
    <Animated.View
      style={[styles.wrapper, { transform: [{ translateY }], opacity }]}
      {...panResponder.panHandlers}
    >
      <View style={styles.card}>
        <View style={styles.accentBar} />

        <Pressable
          style={styles.mainRow}
          onPress={() => {
            if (!replyMode) {
              notification.onPress?.();
              dismiss();
            }
          }}
        >
          <View style={styles.avatarContainer}>
            {notification.avatar && notification.avatar.startsWith("http") ? (
              <Image source={{ uri: notification.avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
            <View style={styles.appIconBadge}>
              <Image source={RANKYATRA_LOGO} style={styles.appIconImage} resizeMode="contain" />
            </View>
          </View>

          <View style={styles.content}>
            <View style={styles.headerRow}>
              <Text style={styles.title} numberOfLines={1}>{notification.title}</Text>
              <Text style={styles.appName}>RankYatra</Text>
            </View>
            {!replyMode && (
              <Text style={styles.body} numberOfLines={2}>{notification.body}</Text>
            )}
          </View>

          {!replyMode && (
            <Pressable onPress={dismiss} style={styles.closeBtn} hitSlop={12}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          )}
        </Pressable>

        {replyMode ? (
          <View style={styles.replyRow}>
            <TextInput
              ref={inputRef}
              style={styles.replyInput}
              placeholder={sent ? "Message sent ✓" : "Reply..."}
              placeholderTextColor={sent ? "#22c55e" : "#94a3b8"}
              value={replyText}
              onChangeText={setReplyText}
              editable={!sending && !sent}
              returnKeyType="send"
              onSubmitEditing={handleSendReply}
              multiline={false}
            />
            <Pressable
              onPress={handleSendReply}
              style={[styles.sendBtn, (!replyText.trim() || sending || sent) && styles.sendBtnDisabled]}
              disabled={!replyText.trim() || sending || sent}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.sendBtnText}>Send</Text>
              )}
            </Pressable>
            <Pressable onPress={dismiss} style={styles.cancelBtn} hitSlop={8}>
              <Text style={styles.cancelBtnText}>✕</Text>
            </Pressable>
          </View>
        ) : isMessage && onReply ? (
          <View style={styles.actionsRow}>
            <Pressable style={styles.actionBtn} onPress={handleReplyPress}>
              <Text style={styles.actionBtnText}>↩ Reply</Text>
            </Pressable>
            <Pressable style={[styles.actionBtn, styles.actionBtnSecondary]} onPress={dismiss}>
              <Text style={styles.actionBtnTextSecondary}>Dismiss</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    top: 50,
    left: 12,
    right: 12,
    zIndex: 9999,
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    overflow: "hidden",
  },
  accentBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: "#f97316",
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingRight: 12,
    paddingLeft: 16,
    minHeight: BANNER_HEIGHT,
  },
  avatarContainer: {
    position: "relative",
    marginRight: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#f1f5f9",
  },
  avatarFallback: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#fff7ed",
    borderWidth: 2,
    borderColor: "#f97316",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 17,
    fontWeight: "700",
    color: "#f97316",
  },
  appIconBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#f0f0f0",
    overflow: "hidden",
  },
  appIconImage: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    flex: 1,
    marginRight: 8,
  },
  appName: {
    fontSize: 11,
    fontWeight: "600",
    color: "#f97316",
    letterSpacing: 0.3,
  },
  body: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
  },
  closeBtn: {
    marginLeft: 8,
    padding: 4,
  },
  closeBtnText: {
    fontSize: 13,
    color: "#94a3b8",
    fontWeight: "600",
  },
  actionsRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: "#f97316",
    borderRadius: 10,
    paddingVertical: 7,
    alignItems: "center",
  },
  actionBtnSecondary: {
    backgroundColor: "#f1f5f9",
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  actionBtnTextSecondary: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
  },
  replyRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  replyInput: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: "#0f172a",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    maxHeight: 80,
  },
  sendBtn: {
    backgroundColor: "#f97316",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 60,
  },
  sendBtnDisabled: {
    backgroundColor: "#fed7aa",
  },
  sendBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  cancelBtn: {
    padding: 4,
  },
  cancelBtnText: {
    fontSize: 13,
    color: "#94a3b8",
    fontWeight: "600",
  },
});
