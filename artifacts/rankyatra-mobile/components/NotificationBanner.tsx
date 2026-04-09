import React, { useEffect, useRef, useCallback } from "react";
import {
  Animated,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

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
};

const BANNER_HEIGHT = 80;
const AUTO_DISMISS_MS = 4500;

export default function NotificationBanner({ notification, onDismiss }: Props) {
  const translateY = useRef(new Animated.Value(-BANNER_HEIGHT - 20)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -BANNER_HEIGHT - 20,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss());
  }, [translateY, opacity, onDismiss]);

  useEffect(() => {
    if (!notification) return;
    translateY.setValue(-BANNER_HEIGHT - 20);
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
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
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

  if (!notification) return null;

  const initials = notification.title
    ? notification.title.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "RY";

  return (
    <Animated.View
      style={[styles.wrapper, { transform: [{ translateY }], opacity }]}
      {...panResponder.panHandlers}
    >
      <Pressable
        style={styles.card}
        onPress={() => {
          notification.onPress?.();
          dismiss();
        }}
      >
        <View style={styles.accentBar} />
        <View style={styles.avatarContainer}>
          {notification.avatar && notification.avatar.startsWith("http") ? (
            <Image source={{ uri: notification.avatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}
          <View style={styles.appIconBadge}>
            <Text style={styles.appIconText}>R</Text>
          </View>
        </View>
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <Text style={styles.title} numberOfLines={1}>{notification.title}</Text>
            <Text style={styles.appName}>RankYatra</Text>
          </View>
          <Text style={styles.body} numberOfLines={2}>{notification.body}</Text>
        </View>
        <Pressable onPress={dismiss} style={styles.closeBtn} hitSlop={12}>
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>
      </Pressable>
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
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingVertical: 12,
    paddingRight: 12,
    paddingLeft: 0,
    minHeight: BANNER_HEIGHT,
    overflow: "hidden",
  },
  accentBar: {
    width: 4,
    alignSelf: "stretch",
    backgroundColor: "#f97316",
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    marginRight: 12,
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
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#f97316",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  appIconText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#fff",
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
});
