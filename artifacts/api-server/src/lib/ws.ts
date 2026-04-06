import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { verifyToken } from "../middlewares/auth";
import { db, conversationsTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";

// userId -> Set of connected sockets
const userSockets = new Map<number, Set<WebSocket>>();
// userId -> last seen timestamp (set when WS closes or heartbeat expires)
const lastSeenMap = new Map<number, Date>();
// userId -> last heartbeat timestamp (updated via WS ping or REST heartbeat)
const heartbeatMap = new Map<number, number>();

const ONLINE_THRESHOLD_MS = 90_000; // 90 seconds

export function updateHeartbeat(userId: number): void {
  heartbeatMap.set(userId, Date.now());
}

export function isUserOnline(userId: number): boolean {
  const sockets = userSockets.get(userId);
  if (sockets && sockets.size > 0) return true;
  const hb = heartbeatMap.get(userId);
  return !!hb && Date.now() - hb < ONLINE_THRESHOLD_MS;
}

export function getLastSeen(userId: number): string | null {
  const d = lastSeenMap.get(userId);
  return d ? d.toISOString() : null;
}

export function broadcastToUser(userId: number, payload: string) {
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

// Broadcast online status change to all conversation partners of a user
async function notifyPartnersOnlineStatus(userId: number, online: boolean, lastSeen: string | null) {
  try {
    const convs = await db.select().from(conversationsTable)
      .where(or(eq(conversationsTable.user1Id, userId), eq(conversationsTable.user2Id, userId)));
    const payload = JSON.stringify({ type: "online_status", userId, online, lastSeen });
    for (const conv of convs) {
      const partnerId = conv.user1Id === userId ? conv.user2Id : conv.user1Id;
      broadcastToUser(partnerId, payload);
    }
  } catch {}
}

// Cleanup expired heartbeats every 30s and update lastSeen
setInterval(() => {
  const now = Date.now();
  for (const [uid, ts] of heartbeatMap.entries()) {
    if (now - ts >= ONLINE_THRESHOLD_MS) {
      if (!userSockets.has(uid)) {
        lastSeenMap.set(uid, new Date(ts));
      }
      heartbeatMap.delete(uid);
    }
  }
}, 30_000);

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    let userId: number | null = null;

    // Expect first message to be auth: { type: "auth", token: "..." }
    const authTimeout = setTimeout(() => {
      if (!userId) ws.terminate();
    }, 5000);

    ws.on("message", async (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === "auth") {
          clearTimeout(authTimeout);
          const decoded = verifyToken(msg.token);
          if (!decoded) {
            ws.send(JSON.stringify({ type: "error", message: "Invalid token" }));
            ws.terminate();
            return;
          }
          userId = decoded.id;
          updateHeartbeat(userId);

          if (!userSockets.has(userId)) userSockets.set(userId, new Set());
          userSockets.get(userId)!.add(ws);

          ws.send(JSON.stringify({ type: "auth_ok", userId }));
          // Notify conversation partners that this user is now online
          notifyPartnersOnlineStatus(userId, true, null);
          return;
        }

        if (msg.type === "ping") {
          if (userId) updateHeartbeat(userId);
          ws.send(JSON.stringify({ type: "pong" }));
          return;
        }

        // Forward typing indicator to the other participant
        if (msg.type === "typing" && userId && msg.conversationId) {
          if (userId) updateHeartbeat(userId);
          try {
            const [conv] = await db.select().from(conversationsTable)
              .where(eq(conversationsTable.id, msg.conversationId)).limit(1);
            if (conv && (conv.user1Id === userId || conv.user2Id === userId)) {
              const recipientId = conv.user1Id === userId ? conv.user2Id : conv.user1Id;
              broadcastToUser(recipientId, JSON.stringify({
                type: "typing",
                conversationId: msg.conversationId,
                userId,
              }));
            }
          } catch {}
          return;
        }
      } catch {}
    });

    ws.on("close", () => {
      if (userId !== null) {
        const now = new Date();
        lastSeenMap.set(userId, now);
        const sockets = userSockets.get(userId);
        if (sockets) {
          sockets.delete(ws);
          if (sockets.size === 0) {
            userSockets.delete(userId);
            // Notify partners this user is now offline
            notifyPartnersOnlineStatus(userId, false, now.toISOString());
          }
        }
      }
    });

    ws.on("error", () => {
      ws.terminate();
    });
  });

  return wss;
}
