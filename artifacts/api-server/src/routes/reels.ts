import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { reels, reelLikes } from "@workspace/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// ─── Multer setup for video uploads ─────────────────────────────────────────
const videosDir = path.join(process.cwd(), "uploads", "videos");
const thumbsDir = path.join(process.cwd(), "uploads", "thumbnails");
if (!fs.existsSync(videosDir)) fs.mkdirSync(videosDir, { recursive: true });
if (!fs.existsSync(thumbsDir)) fs.mkdirSync(thumbsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, file.fieldname === "thumbnail" ? thumbsDir : videosDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || (file.mimetype.includes("mp4") ? ".mp4" : ".mp4");
    cb(null, `reel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB max (after compression)
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === "video" && !file.mimetype.startsWith("video/")) {
      return cb(new Error("Only video files allowed"));
    }
    if (file.fieldname === "thumbnail" && !file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files allowed for thumbnail"));
    }
    cb(null, true);
  },
});

function getServerBaseUrl(req: any): string {
  // On EC2: APP_URL = "https://rankyatra.in" (set in ecosystem.config.js)
  const host = process.env.APP_URL || process.env.FRONTEND_URL || `${req.protocol}://${req.get("host")}`;
  return host.replace(/\/+$/, "");
}

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
        u.verification_status AS "verificationStatus",
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
  } catch {
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

// ─── POST /api/reels/upload — multipart video upload (Instagram-style) ──────
// Accepts multipart/form-data with fields: video (required), thumbnail (optional), caption (optional)
// Compresses on device, uploads raw bytes here — no base64 needed
router.post(
  "/reels/upload",
  requireAuth,
  (req: any, res: any, next: any) => {
    upload.fields([
      { name: "video", maxCount: 1 },
      { name: "thumbnail", maxCount: 1 },
    ])(req, res, (err: any) => {
      if (err) {
        return res.status(400).json({ error: err.message || "Upload failed" });
      }
      next();
    });
  },
  async (req: any, res: any) => {
    try {
      const files = req.files as Record<string, Express.Multer.File[]>;
      const videoFile = files?.["video"]?.[0];
      const thumbFile = files?.["thumbnail"]?.[0];
      const caption = (req.body?.caption ?? "").trim();

      if (!videoFile) {
        return res.status(400).json({ error: "Video file required" });
      }

      const base = getServerBaseUrl(req);
      const videoUrl = `${base}/uploads/videos/${videoFile.filename}`;
      const thumbnailUrl = thumbFile ? `${base}/uploads/thumbnails/${thumbFile.filename}` : null;

      const [reel] = await db
        .insert(reels)
        .values({ userId: req.user.id, videoUrl, thumbnailUrl, caption })
        .returning();

      res.status(201).json({ reel });
    } catch (err) {
      console.error("[reels/upload]", err);
      res.status(500).json({ error: "Failed to create reel" });
    }
  }
);

// ─── POST /api/reels — create reel (legacy: base64) ─────────────────────────
router.post("/reels", requireAuth, async (req: any, res) => {
  try {
    const { videoUrl, caption, thumbnailUrl } = req.body;
    if (!videoUrl) return res.status(400).json({ error: "videoUrl required" });

    const [reel] = await db
      .insert(reels)
      .values({ userId: req.user.id, videoUrl, thumbnailUrl: thumbnailUrl ?? null, caption: caption?.trim() ?? "" })
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
