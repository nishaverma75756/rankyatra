import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useChatSocket } from "@/hooks/useChatSocket";

interface ActivityCountContextValue {
  unreadMessages: number;
  unreadNotifications: number;
  totalUnread: number;
  resetNotifications: () => void;
  resetMessages: () => void;
  refreshMessages: () => void;
  refreshNotifications: () => void;
}

const ActivityCountContext = createContext<ActivityCountContextValue>({
  unreadMessages: 0,
  unreadNotifications: 0,
  totalUnread: 0,
  resetNotifications: () => {},
  resetMessages: () => {},
  refreshMessages: () => {},
  refreshNotifications: () => {},
});

export function ActivityCountProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const intervalMsgRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const intervalNotifRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const fetchMessageCount = useCallback(() => {
    if (!token) return;
    customFetch<{ count: number }>("/api/chat/unread-total")
      .then((d) => setUnreadMessages(d.count))
      .catch(() => {});
  }, [token]);

  const fetchNotifCount = useCallback(() => {
    if (!token) return;
    customFetch<{ count: number }>("/api/notifications/unread-count")
      .then((d) => setUnreadNotifications(d.count))
      .catch(() => {});
  }, [token]);

  const refreshAll = useCallback(() => {
    fetchMessageCount();
    fetchNotifCount();
  }, [fetchMessageCount, fetchNotifCount]);

  // Polling + initial fetch
  useEffect(() => {
    if (!user || !token) {
      setUnreadMessages(0);
      setUnreadNotifications(0);
      return;
    }
    refreshAll();

    // Messages: every 2s — fast enough to feel instant even if WS drops
    intervalMsgRef.current = setInterval(fetchMessageCount, 2000);
    // Notifications: every 3s — faster polling as backup when WS drops
    intervalNotifRef.current = setInterval(fetchNotifCount, 3000);

    return () => {
      if (intervalMsgRef.current) clearInterval(intervalMsgRef.current);
      if (intervalNotifRef.current) clearInterval(intervalNotifRef.current);
    };
  }, [user, token, fetchMessageCount, fetchNotifCount, refreshAll]);

  // AppState: refresh counts immediately when app comes back to foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === "active") {
        if (user && token) refreshAll();
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [user, token, refreshAll]);

  // WebSocket: instant update on new_message or notification event
  const handleSocketMessage = useCallback((msg: any) => {
    if (msg.type === "new_message") {
      setUnreadMessages((c) => c + 1);
      fetchMessageCount();
    } else if (msg.type === "notification") {
      setUnreadNotifications((c) => c + 1);
      fetchNotifCount();
    }
  }, [fetchMessageCount, fetchNotifCount]);

  useChatSocket(token, handleSocketMessage);

  const resetNotifications = useCallback(() => setUnreadNotifications(0), []);
  const resetMessages = useCallback(() => setUnreadMessages(0), []);
  const refreshMessages = useCallback(() => fetchMessageCount(), [fetchMessageCount]);
  const refreshNotifications = useCallback(() => fetchNotifCount(), [fetchNotifCount]);

  return (
    <ActivityCountContext.Provider value={{
      unreadMessages,
      unreadNotifications,
      totalUnread: unreadMessages + unreadNotifications,
      resetNotifications,
      resetMessages,
      refreshMessages,
      refreshNotifications,
    }}>
      {children}
    </ActivityCountContext.Provider>
  );
}

export function useActivityCount() {
  return useContext(ActivityCountContext);
}
