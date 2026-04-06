import { Router, type IRouter } from "express";
import { db, reportsTable, mutedConversationsTable, conversationsTable, usersTable, messagesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

// Submit a report
router.post("/users/:id/report", requireAuth, async (req: any, res: any) => {
  const reporterId = req.user.id;
  const reportedUserId = Number(req.params.id);
  const { reason, details, conversationId } = req.body;

  if (!reason) return res.status(400).json({ message: "Reason is required" });
  if (reporterId === reportedUserId) return res.status(400).json({ message: "Cannot report yourself" });

  try {
    await db.insert(reportsTable).values({
      reporterId,
      reportedUserId,
      conversationId: conversationId ?? null,
      reason,
      details: details ?? null,
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: "Failed to submit report" });
  }
});

// Mute a conversation
router.post("/chat/conversations/:id/mute", requireAuth, async (req: any, res: any) => {
  const userId = req.user.id;
  const conversationId = Number(req.params.id);
  try {
    await db.insert(mutedConversationsTable).values({ userId, conversationId })
      .onConflictDoNothing();
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: "Failed to mute conversation" });
  }
});

// Unmute a conversation
router.delete("/chat/conversations/:id/mute", requireAuth, async (req: any, res: any) => {
  const userId = req.user.id;
  const conversationId = Number(req.params.id);
  try {
    await db.delete(mutedConversationsTable)
      .where(and(eq(mutedConversationsTable.userId, userId), eq(mutedConversationsTable.conversationId, conversationId)));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: "Failed to unmute conversation" });
  }
});

// Check mute status
router.get("/chat/conversations/:id/mute", requireAuth, async (req: any, res: any) => {
  const userId = req.user.id;
  const conversationId = Number(req.params.id);
  try {
    const [row] = await db.select().from(mutedConversationsTable)
      .where(and(eq(mutedConversationsTable.userId, userId), eq(mutedConversationsTable.conversationId, conversationId)))
      .limit(1);
    res.json({ muted: !!row });
  } catch {
    res.json({ muted: false });
  }
});

// Admin: get all reports
router.get("/admin/reports", requireAuth, async (req: any, res: any) => {
  if (!req.user.isAdmin) return res.status(403).json({ message: "Forbidden" });
  try {
    const reports = await db.select({
      id: reportsTable.id,
      reason: reportsTable.reason,
      details: reportsTable.details,
      status: reportsTable.status,
      createdAt: reportsTable.createdAt,
      conversationId: reportsTable.conversationId,
      postId: reportsTable.postId,
      reporterId: reportsTable.reporterId,
      reportedUserId: reportsTable.reportedUserId,
    }).from(reportsTable).orderBy(desc(reportsTable.createdAt));

    // Fetch user names separately
    const userIds = [...new Set(reports.flatMap(r => [r.reporterId, r.reportedUserId]))];
    // Build full user map
    const userMap = new Map<number, { id: number; name: string; email: string }>();
    for (const uid of userIds) {
      const [u] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
        .from(usersTable).where(eq(usersTable.id, uid)).limit(1);
      if (u) userMap.set(uid, u);
    }

    const enriched = reports.map(r => ({
      ...r,
      reporter: userMap.get(r.reporterId) ?? { id: r.reporterId, name: "Unknown", email: "" },
      reportedUser: userMap.get(r.reportedUserId) ?? { id: r.reportedUserId, name: "Unknown", email: "" },
    }));

    res.json(enriched);
  } catch {
    res.status(500).json({ message: "Failed to fetch reports" });
  }
});

// Admin: get last 20 messages of a conversation
router.get("/admin/conversations/:id/messages", requireAuth, async (req: any, res: any) => {
  if (!req.user.isAdmin) return res.status(403).json({ message: "Forbidden" });
  const convId = Number(req.params.id);
  try {
    const msgs = await db.select().from(messagesTable)
      .where(eq(messagesTable.conversationId, convId))
      .orderBy(desc(messagesTable.createdAt))
      .limit(20);

    const userIds = [...new Set(msgs.map(m => m.senderId))];
    const userMap = new Map<number, { id: number; name: string; avatarUrl: string | null }>();
    for (const uid of userIds) {
      const [u] = await db.select({ id: usersTable.id, name: usersTable.name, avatarUrl: usersTable.avatarUrl })
        .from(usersTable).where(eq(usersTable.id, uid)).limit(1);
      if (u) userMap.set(uid, u);
    }

    const enriched = msgs.reverse().map(m => ({
      id: m.id,
      content: m.content,
      createdAt: m.createdAt,
      sender: userMap.get(m.senderId) ?? { id: m.senderId, name: "Unknown", avatarUrl: null },
    }));

    res.json(enriched);
  } catch {
    res.status(500).json({ message: "Failed to fetch messages" });
  }
});

// Admin: update report status
router.patch("/admin/reports/:id", requireAuth, async (req: any, res: any) => {
  if (!req.user.isAdmin) return res.status(403).json({ message: "Forbidden" });
  const { status } = req.body;
  try {
    await db.update(reportsTable).set({ status }).where(eq(reportsTable.id, Number(req.params.id)));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: "Failed to update report" });
  }
});

export default router;
