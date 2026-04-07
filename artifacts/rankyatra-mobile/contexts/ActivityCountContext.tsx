import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
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
}

const ActivityCountContext = createContext<ActivityCountContextValue>({
  unreadMessages: 0,
  unreadNotifications: 0,
  totalUnread: 0,
  resetNotifications: () => {},
  resetMessages: () => {},
  refreshMessages: () => {},
});

export function ActivityCountProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const intervalMsgRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const intervalNotifRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  useEffect(() => {
    if (!user || !token) {
      setUnreadMessages(0);
      setUnreadNotifications(0);
      return;
    }
    fetchMessageCount();
    fetchNotifCount();

    intervalMsgRef.current = setInterval(fetchMessageCount, 5000);
    intervalNotifRef.current = setInterval(fetchNotifCount, 10000);

    return () => {
      if (intervalMsgRef.current) clearInterval(intervalMsgRef.current);
      if (intervalNotifRef.current) clearInterval(intervalNotifRef.current);
    };
  }, [user, token, fetchMessageCount, fetchNotifCount]);

  const handleSocketMessage = useCallback((msg: any) => {
    if (msg.type === "new_message") {
      setUnreadMessages((c) => c + 1);
    } else if (msg.type === "notification") {
      setUnreadNotifications((c) => c + 1);
    }
  }, []);

  useChatSocket(token, handleSocketMessage);

  const resetNotifications = useCallback(() => setUnreadNotifications(0), []);
  const resetMessages = useCallback(() => setUnreadMessages(0), []);
  const refreshMessages = useCallback(() => fetchMessageCount(), [fetchMessageCount]);

  return (
    <ActivityCountContext.Provider value={{
      unreadMessages,
      unreadNotifications,
      totalUnread: unreadMessages + unreadNotifications,
      resetNotifications,
      resetMessages,
      refreshMessages,
    }}>
      {children}
    </ActivityCountContext.Provider>
  );
}

export function useActivityCount() {
  return useContext(ActivityCountContext);
}
