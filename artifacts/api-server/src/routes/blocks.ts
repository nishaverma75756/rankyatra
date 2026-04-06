import { Router, type IRouter } from "express";
import { db, userBlocksTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

// Get my blocked users list
router.get("/me/blocked-users", requireAuth, async (req: any, res: any) => {
  const myId = req.user.id;
  try {
    const rows = await db
      .select({ blockedId: userBlocksTable.blockedId, createdAt: userBlocksTable.createdAt })
      .from(userBlocksTable)
      .where(eq(userBlocksTable.blockerId, myId));

    const users = await Promise.all(
      rows.map(async (r) => {
        const [u] = await db
          .select({ id: usersTable.id, name: usersTable.name, avatarUrl: usersTable.avatarUrl })
          .from(usersTable)
          .where(eq(usersTable.id, r.blockedId))
          .limit(1);
        return { ...u, blockedAt: r.createdAt };
      })
    );
    res.json(users.filter(Boolean));
  } catch {
    res.status(500).json({ message: "Failed to fetch blocked users" });
  }
});

// Block a user
router.post("/users/:id/block", requireAuth, async (req: any, res: any) => {
  const myId = req.user.id;
  const targetId = Number(req.params.id);
  if (myId === targetId) return res.status(400).json({ message: "Cannot block yourself" });

  try {
    const [existing] = await db
      .select()
      .from(userBlocksTable)
      .where(and(eq(userBlocksTable.blockerId, myId), eq(userBlocksTable.blockedId, targetId)))
      .limit(1);

    if (!existing) {
      await db.insert(userBlocksTable).values({ blockerId: myId, blockedId: targetId });
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: "Failed to block user" });
  }
});

// Unblock a user
router.delete("/users/:id/block", requireAuth, async (req: any, res: any) => {
  const myId = req.user.id;
  const targetId = Number(req.params.id);
  try {
    await db
      .delete(userBlocksTable)
      .where(and(eq(userBlocksTable.blockerId, myId), eq(userBlocksTable.blockedId, targetId)));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: "Failed to unblock user" });
  }
});

// Toggle online status visibility
router.patch("/me/online-status", requireAuth, async (req: any, res: any) => {
  const myId = req.user.id;
  const { showOnlineStatus } = req.body;
  if (typeof showOnlineStatus !== "boolean") {
    return res.status(400).json({ message: "showOnlineStatus must be boolean" });
  }
  try {
    await db.update(usersTable).set({ showOnlineStatus }).where(eq(usersTable.id, myId));
    res.json({ ok: true, showOnlineStatus });
  } catch {
    res.status(500).json({ message: "Failed to update online status setting" });
  }
});

// Get my online status preference
router.get("/me/online-status", requireAuth, async (req: any, res: any) => {
  const myId = req.user.id;
  try {
    const [u] = await db.select({ showOnlineStatus: usersTable.showOnlineStatus }).from(usersTable).where(eq(usersTable.id, myId)).limit(1);
    res.json({ showOnlineStatus: u?.showOnlineStatus ?? true });
  } catch {
    res.status(500).json({ message: "Failed to fetch setting" });
  }
});

export default router;
