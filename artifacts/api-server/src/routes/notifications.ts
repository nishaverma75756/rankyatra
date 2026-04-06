import { Router, type IRouter } from "express";
import { db, notificationsTable, usersTable, postsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

// Get notifications for current user
router.get("/notifications", requireAuth, async (req: any, res: any) => {
  const userId = req.user.id;
  const cursor = req.query.cursor ? Number(req.query.cursor) : null;
  const limit = 20;
  try {
    const notifs = await db
      .select({
        id: notificationsTable.id,
        type: notificationsTable.type,
        isRead: notificationsTable.isRead,
        createdAt: notificationsTable.createdAt,
        postId: notificationsTable.postId,
        commentId: notificationsTable.commentId,
        fromUserId: notificationsTable.fromUserId,
        fromUserName: usersTable.name,
        fromUserAvatar: usersTable.avatarUrl,
      })
      .from(notificationsTable)
      .innerJoin(usersTable, eq(usersTable.id, notificationsTable.fromUserId))
      .where(eq(notificationsTable.userId, userId))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(limit);
    res.json(notifs);
  } catch {
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
});

// Get unread notification count
router.get("/notifications/unread-count", requireAuth, async (req: any, res: any) => {
  const userId = req.user.id;
  try {
    const rows = await db
      .select()
      .from(notificationsTable)
      .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.isRead, false)));
    res.json({ count: rows.length });
  } catch {
    res.status(500).json({ message: "Failed to fetch count" });
  }
});

// Mark all as read
router.post("/notifications/read-all", requireAuth, async (req: any, res: any) => {
  const userId = req.user.id;
  try {
    await db.update(notificationsTable).set({ isRead: true }).where(eq(notificationsTable.userId, userId));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: "Failed to mark as read" });
  }
});

export default router;
