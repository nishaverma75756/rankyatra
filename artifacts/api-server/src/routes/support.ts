import { Router, type IRouter } from "express";
import { db, feedbackTable, userRolesTable, usersTable, conversationsTable } from "@workspace/db";
import { eq, desc, and, or } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import multer from "multer";
import path from "path";
import fs from "fs";

const APP_URL = process.env.APP_URL || "https://rankyatra.in";

const feedbackUploadDir = path.join(process.cwd(), "uploads", "feedback");
if (!fs.existsSync(feedbackUploadDir)) fs.mkdirSync(feedbackUploadDir, { recursive: true });

const feedbackUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, feedbackUploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".jpg";
      cb(null, `fb-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only images allowed"));
  },
});

const router: IRouter = Router();

// ── Get support agent info ─────────────────────────────────────────────────
router.get("/support/agent", requireAuth, async (_req, res): Promise<void> => {
  try {
    const [roleRow] = await db
      .select({ userId: userRolesTable.userId })
      .from(userRolesTable)
      .where(eq(userRolesTable.role, "customer_support"))
      .limit(1);

    if (!roleRow) {
      res.json({ agent: null });
      return;
    }

    const [agent] = await db
      .select({ id: usersTable.id, name: usersTable.name, avatarUrl: usersTable.avatarUrl })
      .from(usersTable)
      .where(eq(usersTable.id, roleRow.userId))
      .limit(1);

    res.json({ agent: agent ?? null });
  } catch {
    res.status(500).json({ error: "Failed to get agent" });
  }
});

// ── Get or create support conversation ────────────────────────────────────
router.post("/support/conversation", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).user.id;
  try {
    const [roleRow] = await db
      .select({ userId: userRolesTable.userId })
      .from(userRolesTable)
      .where(eq(userRolesTable.role, "customer_support"))
      .limit(1);

    if (!roleRow) {
      res.status(404).json({ error: "No support agent available" });
      return;
    }

    const agentId = roleRow.userId;
    if (agentId === userId) {
      res.status(400).json({ error: "Agent cannot chat with themselves" });
      return;
    }

    // Find existing conversation
    const [existing] = await db
      .select()
      .from(conversationsTable)
      .where(
        or(
          and(eq(conversationsTable.user1Id, userId), eq(conversationsTable.user2Id, agentId)),
          and(eq(conversationsTable.user1Id, agentId), eq(conversationsTable.user2Id, userId))
        )
      )
      .limit(1);

    if (existing) {
      // Auto-accept support conversations
      if (!existing.isAccepted) {
        await db.update(conversationsTable).set({ isAccepted: true }).where(eq(conversationsTable.id, existing.id));
      }
      res.json({ conversationId: existing.id, agentId });
      return;
    }

    const [conv] = await db
      .insert(conversationsTable)
      .values({ user1Id: userId, user2Id: agentId, isAccepted: true, initiatedBy: userId })
      .returning();

    res.json({ conversationId: conv.id, agentId });
  } catch {
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

// ── Submit feedback ────────────────────────────────────────────────────────
router.post("/feedback", requireAuth, (feedbackUpload as any).single("image"), async (req: any, res): Promise<void> => {
  const userId = req.user.id;
  const { type, message } = req.body;
  if (!message?.trim()) { res.status(400).json({ error: "Message required" }); return; }

  let imageUrl: string | null = null;
  if (req.file) {
    imageUrl = `${APP_URL}/uploads/feedback/${req.file.filename}`;
  }

  try {
    const [fb] = await db.insert(feedbackTable).values({
      userId,
      type: type === "suggestion" ? "suggestion" : "feedback",
      message: message.trim(),
      imageUrl,
    }).returning();
    res.status(201).json(fb);
  } catch {
    res.status(500).json({ error: "Failed to submit" });
  }
});

// ── Admin: get all feedback ────────────────────────────────────────────────
router.get("/admin/feedback", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const rows = await db
      .select({
        id: feedbackTable.id,
        type: feedbackTable.type,
        message: feedbackTable.message,
        imageUrl: feedbackTable.imageUrl,
        status: feedbackTable.status,
        adminNote: feedbackTable.adminNote,
        createdAt: feedbackTable.createdAt,
        userId: feedbackTable.userId,
        userName: usersTable.name,
        userAvatar: usersTable.avatarUrl,
        userEmail: usersTable.email,
      })
      .from(feedbackTable)
      .leftJoin(usersTable, eq(feedbackTable.userId, usersTable.id))
      .orderBy(desc(feedbackTable.createdAt));
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch feedback" });
  }
});

// ── Admin: update feedback status / note ──────────────────────────────────
router.put("/admin/feedback/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { status, adminNote } = req.body;
  try {
    const [fb] = await db
      .update(feedbackTable)
      .set({ status, adminNote })
      .where(eq(feedbackTable.id, id))
      .returning();
    if (!fb) { res.status(404).json({ error: "Not found" }); return; }
    res.json(fb);
  } catch {
    res.status(500).json({ error: "Failed to update" });
  }
});

// ── Admin: delete feedback ─────────────────────────────────────────────────
router.delete("/admin/feedback/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.delete(feedbackTable).where(eq(feedbackTable.id, id));
  res.json({ success: true });
});

export default router;
