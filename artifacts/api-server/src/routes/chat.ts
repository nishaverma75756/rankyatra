import { Router, type IRouter } from "express";
import { db, conversationsTable, messagesTable, usersTable, userBlocksTable } from "@workspace/db";
import { eq, and, or, desc, asc, lt } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { broadcastToUser } from "../lib/ws";

const router: IRouter = Router();

// In-memory typing state: "convId:userId" -> timestamp
const typingMap = new Map<string, number>();
const TYPING_TTL_MS = 4000;

// Get all conversations for current user
router.get("/chat/conversations", requireAuth, async (req: any, res: any) => {
  const userId = req.user.id;
  try {
    const convs = await db
      .select()
      .from(conversationsTable)
      .where(
        or(
          eq(conversationsTable.user1Id, userId),
          eq(conversationsTable.user2Id, userId)
        )
      )
      .orderBy(desc(conversationsTable.updatedAt));

    const result = await Promise.all(
      convs.map(async (c) => {
        const otherUserId = c.user1Id === userId ? c.user2Id : c.user1Id;
        const [otherUser] = await db
          .select({ id: usersTable.id, name: usersTable.name, avatarUrl: usersTable.avatarUrl })
          .from(usersTable)
          .where(eq(usersTable.id, otherUserId))
          .limit(1);

        const [lastMsg] = await db
          .select()
          .from(messagesTable)
          .where(eq(messagesTable.conversationId, c.id))
          .orderBy(desc(messagesTable.createdAt))
          .limit(1);

        const unreadRows = await db
          .select()
          .from(messagesTable)
          .where(
            and(
              eq(messagesTable.conversationId, c.id),
              eq(messagesTable.senderId, otherUserId),
              eq(messagesTable.isRead, false)
            )
          );

        return {
          id: c.id,
          otherUser,
          lastMessage: lastMsg ?? null,
          unreadCount: unreadRows.length,
          updatedAt: c.updatedAt,
        };
      })
    );

    res.json(result);
  } catch (e) {
    res.status(500).json({ message: "Failed to fetch conversations" });
  }
});

// Get messages for a conversation (paginated, newest first)
router.get("/chat/conversations/:id/messages", requireAuth, async (req: any, res: any) => {
  const userId = req.user.id;
  const convId = Number(req.params.id);
  const before = req.query.before ? Number(req.query.before) : null;
  const limit = 40;

  try {
    const [conv] = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, convId))
      .limit(1);

    if (!conv || (conv.user1Id !== userId && conv.user2Id !== userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const msgs = await db
      .select()
      .from(messagesTable)
      .where(
        before
          ? and(eq(messagesTable.conversationId, convId), lt(messagesTable.id, before))
          : eq(messagesTable.conversationId, convId)
      )
      .orderBy(desc(messagesTable.createdAt))
      .limit(limit);

    // Filter out messages deleted for this specific user
    const filtered = msgs
      .filter((m) => {
        if (m.isDeletedForEveryone) return true; // Still show but as "deleted"
        if (m.senderId === userId && m.isDeletedForSender) return false;
        if (m.senderId !== userId && m.isDeletedForReceiver) return false;
        return true;
      });

    res.json(filtered.reverse());
  } catch (e) {
    res.status(500).json({ message: "Failed to fetch messages" });
  }
});

// Start or get existing conversation with a user
router.post("/chat/conversations/start/:userId", requireAuth, async (req: any, res: any) => {
  const myId = req.user.id;
  const otherId = Number(req.params.userId);

  if (myId === otherId) {
    return res.status(400).json({ message: "Cannot chat with yourself" });
  }

  try {
    const [existing] = await db
      .select()
      .from(conversationsTable)
      .where(
        or(
          and(eq(conversationsTable.user1Id, myId), eq(conversationsTable.user2Id, otherId)),
          and(eq(conversationsTable.user1Id, otherId), eq(conversationsTable.user2Id, myId))
        )
      )
      .limit(1);

    if (existing) {
      return res.json({ id: existing.id });
    }

    const [created] = await db
      .insert(conversationsTable)
      .values({ user1Id: myId, user2Id: otherId })
      .returning();

    res.json({ id: created.id });
  } catch (e: any) {
    console.error("[chat/start] error:", e?.message ?? e);
    res.status(500).json({ message: "Failed to start conversation", detail: e?.message ?? String(e) });
  }
});

// Send a message
router.post("/chat/messages", requireAuth, async (req: any, res: any) => {
  const senderId = req.user.id;
  const { conversationId, content } = req.body;

  if (!content?.trim()) {
    return res.status(400).json({ message: "Message cannot be empty" });
  }

  try {
    const [conv] = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, conversationId))
      .limit(1);

    if (!conv || (conv.user1Id !== senderId && conv.user2Id !== senderId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const recipientId = conv.user1Id === senderId ? conv.user2Id : conv.user1Id;

    // Check if either user has blocked the other
    const [block] = await db.select().from(userBlocksTable).where(
      or(
        and(eq(userBlocksTable.blockerId, senderId), eq(userBlocksTable.blockedId, recipientId)),
        and(eq(userBlocksTable.blockerId, recipientId), eq(userBlocksTable.blockedId, senderId))
      )
    ).limit(1);
    if (block) return res.status(403).json({ message: "Cannot send message: user is blocked" });

    const [msg] = await db
      .insert(messagesTable)
      .values({
        conversationId,
        senderId,
        content: content.trim(),
        deliveredAt: new Date(),
      })
      .returning();

    // Update conversation updatedAt
    await db
      .update(conversationsTable)
      .set({ updatedAt: new Date() })
      .where(eq(conversationsTable.id, conversationId));

    // Push via WebSocket to recipient and sender
    const payload = JSON.stringify({ type: "new_message", message: msg });
    broadcastToUser(recipientId, payload);
    broadcastToUser(senderId, payload);

    res.json(msg);
  } catch (e: any) {
    console.error("[chat/send] error:", e?.message ?? e);
    res.status(500).json({ message: "Failed to send message", detail: e?.message ?? String(e) });
  }
});

// Mark all messages in a conversation as read
router.post("/chat/conversations/:id/read", requireAuth, async (req: any, res: any) => {
  const userId = req.user.id;
  const convId = Number(req.params.id);

  try {
    const [conv] = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, convId))
      .limit(1);

    if (!conv || (conv.user1Id !== userId && conv.user2Id !== userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const otherUserId = conv.user1Id === userId ? conv.user2Id : conv.user1Id;

    await db
      .update(messagesTable)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(messagesTable.conversationId, convId),
          eq(messagesTable.senderId, otherUserId),
          eq(messagesTable.isRead, false)
        )
      );

    // Notify the other user that messages were read
    broadcastToUser(otherUserId, JSON.stringify({ type: "messages_read", conversationId: convId, readBy: userId }));

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: "Failed to mark as read" });
  }
});

// Mark current user as typing in a conversation (REST fallback)
router.post("/chat/conversations/:id/typing", requireAuth, async (req: any, res: any) => {
  const convId = Number(req.params.id);
  const userId = req.user.id;
  typingMap.set(`${convId}:${userId}`, Date.now());
  // Also broadcast via WS if recipient is online
  try {
    const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, convId)).limit(1);
    if (conv && (conv.user1Id === userId || conv.user2Id === userId)) {
      const recipientId = conv.user1Id === userId ? conv.user2Id : conv.user1Id;
      broadcastToUser(recipientId, JSON.stringify({ type: "typing", conversationId: convId, userId }));
    }
  } catch {}
  res.json({ ok: true });
});

// Check if anyone else is typing in a conversation (REST fallback)
router.get("/chat/conversations/:id/typing", requireAuth, async (req: any, res: any) => {
  const convId = Number(req.params.id);
  const myId = req.user.id;
  const now = Date.now();
  // Find another user in this conversation who typed recently
  try {
    const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, convId)).limit(1);
    if (!conv) return res.json({ typing: false, userId: null });
    const otherId = conv.user1Id === myId ? conv.user2Id : conv.user1Id;
    const ts = typingMap.get(`${convId}:${otherId}`);
    const typing = !!ts && (now - ts) < TYPING_TTL_MS;
    res.json({ typing, userId: typing ? otherId : null });
  } catch {
    res.json({ typing: false, userId: null });
  }
});

// Heartbeat — keeps this user "online" for up to 90 seconds without a WS connection
router.post("/me/heartbeat", requireAuth, async (req: any, res: any) => {
  try {
    const { updateHeartbeat } = await import("../lib/ws");
    updateHeartbeat(req.user.id);
    res.json({ ok: true });
  } catch {
    res.json({ ok: false });
  }
});

// Edit a message (sender only, within 15 minutes)
router.patch("/chat/messages/:msgId", requireAuth, async (req: any, res: any) => {
  const myId = req.user.id;
  const msgId = Number(req.params.msgId);
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ message: "Content required" });
  try {
    const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.id, msgId)).limit(1);
    if (!msg) return res.status(404).json({ message: "Message not found" });
    if (msg.senderId !== myId) return res.status(403).json({ message: "Not your message" });
    const ageMs = Date.now() - new Date(msg.createdAt).getTime();
    if (ageMs > 15 * 60 * 1000) return res.status(400).json({ message: "Can only edit within 15 minutes" });
    const [updated] = await db
      .update(messagesTable)
      .set({ content: content.trim(), editedAt: new Date() })
      .where(eq(messagesTable.id, msgId))
      .returning();
    broadcastToUser(myId, { type: "message_edited", message: updated });
    const [conversation] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, msg.conversationId)).limit(1);
    if (conversation) {
      const otherId = conversation.user1Id === myId ? conversation.user2Id : conversation.user1Id;
      broadcastToUser(otherId, { type: "message_edited", message: updated });
    }
    res.json(updated);
  } catch {
    res.status(500).json({ message: "Failed to edit message" });
  }
});

// Delete a message (for me / for everyone)
router.delete("/chat/messages/:msgId", requireAuth, async (req: any, res: any) => {
  const myId = req.user.id;
  const msgId = Number(req.params.msgId);
  const mode = req.query.mode as string; // "me" | "everyone"
  try {
    const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.id, msgId)).limit(1);
    if (!msg) return res.status(404).json({ message: "Message not found" });
    const [conversation] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, msg.conversationId)).limit(1);
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });
    const isParticipant = conversation.user1Id === myId || conversation.user2Id === myId;
    if (!isParticipant) return res.status(403).json({ message: "Not a participant" });
    const otherId = conversation.user1Id === myId ? conversation.user2Id : conversation.user1Id;

    if (mode === "everyone") {
      if (msg.senderId !== myId) return res.status(403).json({ message: "Can only delete your own messages for everyone" });
      const [updated] = await db
        .update(messagesTable)
        .set({ isDeletedForEveryone: true, content: "This message was deleted" })
        .where(eq(messagesTable.id, msgId))
        .returning();
      broadcastToUser(myId, { type: "message_deleted", messageId: msgId, mode: "everyone" });
      broadcastToUser(otherId, { type: "message_deleted", messageId: msgId, mode: "everyone" });
      res.json(updated);
    } else {
      // Delete for me only — sender uses isDeletedForSender, receiver uses isDeletedForReceiver
      const isSender = msg.senderId === myId;
      await db
        .update(messagesTable)
        .set(isSender ? { isDeletedForSender: true } : { isDeletedForReceiver: true })
        .where(eq(messagesTable.id, msgId));
      broadcastToUser(myId, { type: "message_deleted", messageId: msgId, mode: "me" });
      res.json({ ok: true });
    }
  } catch {
    res.status(500).json({ message: "Failed to delete message" });
  }
});

// Get online status of a user (respects showOnlineStatus + block)
router.get("/chat/online/:userId", requireAuth, async (req: any, res: any) => {
  const { isUserOnline, getLastSeen } = await import("../lib/ws");
  const uid = Number(req.params.userId);
  const myId = req.user.id;
  try {
    const [u] = await db.select({ showOnlineStatus: usersTable.showOnlineStatus }).from(usersTable).where(eq(usersTable.id, uid)).limit(1);
    if (!u || !u.showOnlineStatus) return res.json({ online: false, lastSeen: null });
    // Check if target blocked me
    const [blocked] = await db.select().from(userBlocksTable).where(and(eq(userBlocksTable.blockerId, uid), eq(userBlocksTable.blockedId, myId))).limit(1);
    if (blocked) return res.json({ online: false, lastSeen: null });
    res.json({ online: isUserOnline(uid), lastSeen: getLastSeen(uid) });
  } catch {
    res.json({ online: false, lastSeen: null });
  }
});

export default router;
