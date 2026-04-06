import { useEffect, useRef, useCallback, useState } from "react";

type MessageHandler = (msg: any) => void;

export function useChatSocket(token: string | null, onMessage: MessageHandler) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [online, setOnline] = useState(false);
  // Use a ref so the WS handler always calls the latest onMessage
  // without needing to reconnect when the callback changes
  const onMessageRef = useRef<MessageHandler>(onMessage);
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);

  const connect = useCallback(() => {
    if (!token) return;

    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    if (!domain) return;

    const wsUrl = `wss://${domain}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setOnline(true);
      ws.send(JSON.stringify({ type: "auth", token }));
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        onMessageRef.current(data);
      } catch {}
    };

    ws.onclose = () => {
      setOnline(false);
      wsRef.current = null;
      reconnectTimer.current = setTimeout(() => connect(), 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [token]); // token only — onMessage changes no longer cause reconnects

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  const send = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { connected: online, send };
}
