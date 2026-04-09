import { Router } from "express";
import { db } from "@workspace/db";
import { reels, reelLikes } from "@workspace/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// ─── GET /api/reels — paginated feed ────────────────────────────────────────
router.get("/reels", async (req, res) => {
  try {
    const limit = 10;
    const cursor = req.query.cursor ? Number(req.query.cursor) : undefined;
    const userId = (req as any).user?.id ?? null;

    const rows = await db.execute(sql`
      SELECT
        r.id, r.user_id AS "userId", r.video_url AS "videoUrl",
        r.caption, r.like_count AS "likeCount", r.comment_count AS "commentCount",
        r.view_count AS "viewCount", r.created_at AS "createdAt",
        u.name AS "userName", u.avatar_url AS "userAvatar",
        u.rank_points AS "rankPoints", u.verification_status AS "verificationStatus",
        ${userId ? sql`(SELECT COUNT(*)::int > 0 FROM reel_likes rl WHERE rl.reel_id = r.id AND rl.user_id = ${userId})` : sql`false`} AS "isLiked"
      FROM reels r
      JOIN users u ON u.id = r.user_id
      ${cursor ? sql`WHERE r.id < ${cursor}` : sql``}
      ORDER BY r.id DESC
      LIMIT ${limit + 1}
    `);

    const items = rows.rows as any[];
    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    res.json({ reels: data, hasMore, nextCursor });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch reels" });
  }
});

// ─── GET /api/reels/user/:uid — user's own reels ────────────────────────────
router.get("/reels/user/:uid", async (req, res) => {
  try {
    const uid = Number(req.params.uid);
    const rows = await db
      .select()
      .from(reels)
      .where(eq(reels.userId, uid))
      .orderBy(desc(reels.id))
      .limit(20);
    res.json({ reels: rows });
  } catch {
    res.status(500).json({ error: "Failed to fetch user reels" });
  }
});

// ─── POST /api/reels — create reel ──────────────────────────────────────────
router.post("/reels", requireAuth, async (req: any, res) => {
  try {
    const { videoUrl, caption } = req.body;
    if (!videoUrl) return res.status(400).json({ error: "videoUrl required" });

    const [reel] = await db
      .insert(reels)
      .values({ userId: req.user.id, videoUrl, caption: caption?.trim() ?? "" })
      .returning();

    res.status(201).json({ reel });
  } catch {
    res.status(500).json({ error: "Failed to create reel" });
  }
});

// ─── DELETE /api/reels/:id — delete reel ────────────────────────────────────
router.delete("/reels/:id", requireAuth, async (req: any, res) => {
  try {
    const reelId = Number(req.params.id);
    const [reel] = await db.select().from(reels).where(eq(reels.id, reelId));
    if (!reel) return res.status(404).json({ error: "Not found" });
    if (reel.userId !== req.user.id) return res.status(403).json({ error: "Forbidden" });
    await db.delete(reelLikes).where(eq(reelLikes.reelId, reelId));
    await db.delete(reels).where(eq(reels.id, reelId));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete reel" });
  }
});

// ─── POST /api/reels/:id/like ────────────────────────────────────────────────
router.post("/reels/:id/like", requireAuth, async (req: any, res) => {
  try {
    const reelId = Number(req.params.id);
    const userId = req.user.id;
    const existing = await db.select().from(reelLikes).where(and(eq(reelLikes.reelId, reelId), eq(reelLikes.userId, userId)));
    if (existing.length > 0) return res.json({ ok: true });
    await db.insert(reelLikes).values({ reelId, userId });
    await db.update(reels).set({ likeCount: sql`like_count + 1` }).where(eq(reels.id, reelId));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to like reel" });
  }
});

// ─── DELETE /api/reels/:id/like ─────────────────────────────────────────────
router.delete("/reels/:id/like", requireAuth, async (req: any, res) => {
  try {
    const reelId = Number(req.params.id);
    const userId = req.user.id;
    await db.delete(reelLikes).where(and(eq(reelLikes.reelId, reelId), eq(reelLikes.userId, userId)));
    await db.update(reels).set({ likeCount: sql`GREATEST(like_count - 1, 0)` }).where(eq(reels.id, reelId));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to unlike reel" });
  }
});

// ─── POST /api/reels/:id/view ────────────────────────────────────────────────
router.post("/reels/:id/view", async (req, res) => {
  try {
    await db.update(reels).set({ viewCount: sql`view_count + 1` }).where(eq(reels.id, Number(req.params.id)));
    res.json({ ok: true });
  } catch {
    res.json({ ok: true });
  }
});

export default router;
