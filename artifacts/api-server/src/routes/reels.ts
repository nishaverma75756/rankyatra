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
const chunksDir = path.join(process.cwd(), "uploads", "chunks");
if (!fs.existsSync(videosDir)) fs.mkdirSync(videosDir, { recursive: true });
if (!fs.existsSync(thumbsDir)) fs.mkdirSync(thumbsDir, { recursive: true });
if (!fs.existsSync(chunksDir)) fs.mkdirSync(chunksDir, { recursive: true });

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
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === "video") {
      const isVideoMime = file.mimetype.startsWith("video/") || file.mimetype === "application/octet-stream";
      if (!isVideoMime) return cb(new Error("Only video files allowed"));
    }
    if (file.fieldname === "thumbnail" && !file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files allowed for thumbnail"));
    }
    cb(null, true);
  },
});

function getServerBaseUrl(req: any): string {
  const host = process.env.APP_URL || process.env.FRONTEND_URL || `${req.protocol}://${req.get("host")}`;
  return host.replace(/\/+$/, "");
}

// ─── Chunked upload session store ────────────────────────────────────────────
interface ChunkSession {
  userId: number;
  totalChunks: number;
  receivedChunks: Set<number>;
  createdAt: Date;
}

const chunkSessions = new Map<string, ChunkSession>();

// Clean up stale sessions every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of chunkSessions.entries()) {
    if (now - session.createdAt.getTime() > 30 * 60 * 1000) {
      for (let i = 0; i < session.totalChunks; i++) {
        try { fs.unlinkSync(path.join(chunksDir, `${id}_chunk${i}`)); } catch {}
      }
      chunkSessions.delete(id);
    }
  }
}, 15 * 60 * 1000);

// ─── POST /api/reels/upload-init ─────────────────────────────────────────────
router.post("/reels/upload-init", requireAuth, async (req: any, res) => {
  const { totalChunks } = req.body;
  if (!totalChunks || typeof totalChunks !== "number" || totalChunks < 1 || totalChunks > 5000) {
    res.status(400).json({ error: "Invalid totalChunks" }); return;
  }
  const uploadId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  chunkSessions.set(uploadId, {
    userId: req.user.id,
    totalChunks,
    receivedChunks: new Set(),
    createdAt: new Date(),
  });
  res.json({ uploadId });
});

// ─── POST /api/reels/upload-chunk ────────────────────────────────────────────
router.post("/reels/upload-chunk", requireAuth, async (req: any, res) => {
  const { uploadId, chunkIndex, data } = req.body;
  if (!uploadId || typeof chunkIndex !== "number" || !data) {
    res.status(400).json({ error: "uploadId, chunkIndex, data required" }); return;
  }
  const session = chunkSessions.get(uploadId);
  if (!session) { res.status(404).json({ error: "Upload session not found or expired" }); return; }
  if (session.userId !== req.user.id) { res.status(403).json({ error: "Forbidden" }); return; }
  if (chunkIndex < 0 || chunkIndex >= session.totalChunks) {
    res.status(400).json({ error: "Invalid chunk index" }); return;
  }
  try {
    const buffer = Buffer.from(data, "base64");
    const chunkPath = path.join(chunksDir, `${uploadId}_chunk${chunkIndex}`);
    fs.writeFileSync(chunkPath, buffer);
    session.receivedChunks.add(chunkIndex);
    res.json({ ok: true, received: session.receivedChunks.size, total: session.totalChunks });
  } catch {
    res.status(500).json({ error: "Failed to save chunk" });
  }
});

// ─── POST /api/reels/upload-finalize ─────────────────────────────────────────
router.post("/reels/upload-finalize", requireAuth, async (req: any, res) => {
  const { uploadId, caption, thumbnailBase64, thumbnailMime } = req.body;
  if (!uploadId) { res.status(400).json({ error: "uploadId required" }); return; }
  const session = chunkSessions.get(uploadId);
  if (!session) { res.status(404).json({ error: "Upload session not found or expired" }); return; }
  if (session.userId !== req.user.id) { res.status(403).json({ error: "Forbidden" }); return; }
  if (session.receivedChunks.size !== session.totalChunks) {
    res.status(400).json({
      error: `Missing chunks: received ${session.receivedChunks.size}/${session.totalChunks}`,
    }); return;
  }

  const videoFilename = `reel_${uploadId}.mp4`;
  const videoPath = path.join(videosDir, videoFilename);

  try {
    // Assemble all chunks into final video file
    const writeStream = fs.createWriteStream(videoPath);
    await new Promise<void>((resolve, reject) => {
      writeStream.on("error", reject);
      writeStream.on("finish", resolve);
      (async () => {
        try {
          for (let i = 0; i < session.totalChunks; i++) {
            const chunkPath = path.join(chunksDir, `${uploadId}_chunk${i}`);
            const chunk = fs.readFileSync(chunkPath);
            if (!writeStream.write(chunk)) {
              await new Promise<void>((r) => writeStream.once("drain", r));
            }
            try { fs.unlinkSync(chunkPath); } catch {}
          }
          writeStream.end();
        } catch (e) {
          reject(e);
        }
      })();
    });

    chunkSessions.delete(uploadId);

    const base = process.env.APP_URL || "https://rankyatra.in";
    const videoUrl = `${base}/uploads/videos/${videoFilename}`;

    // Save thumbnail
    let thumbnailUrl: string | null = null;
    if (thumbnailBase64) {
      try {
        const ext = (thumbnailMime || "image/jpeg").includes("png") ? ".png" : ".jpg";
        const thumbFilename = `thumb_${uploadId}${ext}`;
        const thumbPath = path.join(thumbsDir, thumbFilename);
        fs.writeFileSync(thumbPath, Buffer.from(thumbnailBase64, "base64"));
        thumbnailUrl = `${base}/uploads/thumbnails/${thumbFilename}`;
      } catch {}
    }

    // Save reel to database
    const [reel] = await db
      .insert(reels)
      .values({ userId: req.user.id, videoUrl, thumbnailUrl, caption: (caption ?? "").trim() })
      .returning();

    res.status(201).json({ reel });
  } catch (err) {
    console.error("[reels/upload-finalize]", err);
    try { fs.unlinkSync(videoPath); } catch {}
    res.status(500).json({ error: "Failed to assemble and save reel" });
  }
});

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

// ─── POST /api/reels/upload — multipart (fallback, may fail on Nginx < 100MB) ──
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
      const thumbnailBase64: string | undefined = req.body?.thumbnailBase64;
      const thumbnailMime: string = req.body?.thumbnailMime || "image/jpeg";

      if (!videoFile) {
        return res.status(400).json({ error: "Video file required" });
      }

      const base = getServerBaseUrl(req);
      const videoUrl = `${base}/uploads/videos/${videoFile.filename}`;

      let thumbnailUrl: string | null = null;
      if (thumbFile) {
        thumbnailUrl = `${base}/uploads/thumbnails/${thumbFile.filename}`;
      } else if (thumbnailBase64) {
        const ext = thumbnailMime.includes("png") ? ".png" : ".jpg";
        const thumbFilename = `thumb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
        const thumbPath = path.join(thumbsDir, thumbFilename);
        const buffer = Buffer.from(thumbnailBase64, "base64");
        fs.writeFileSync(thumbPath, buffer);
        thumbnailUrl = `${base}/uploads/thumbnails/${thumbFilename}`;
      }

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

// ─── POST /api/reels — create reel (legacy) ──────────────────────────────────
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

// ─── DELETE /api/reels/:id ───────────────────────────────────────────────────
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
