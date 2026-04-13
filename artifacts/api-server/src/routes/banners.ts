import { Router, type IRouter } from "express";
import { db, bannersTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";
import multer from "multer";
import path from "path";
import fs from "fs";

const APP_URL = process.env.APP_URL || "https://rankyatra.in";

const bannerUploadDir = path.join(process.cwd(), "uploads", "banners");
if (!fs.existsSync(bannerUploadDir)) fs.mkdirSync(bannerUploadDir, { recursive: true });

const bannerUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, bannerUploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".png";
      cb(null, `banner-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files allowed"));
  },
});

const router: IRouter = Router();

router.get("/banners", async (_req, res): Promise<void> => {
  const banners = await db
    .select()
    .from(bannersTable)
    .where(eq(bannersTable.isActive, true))
    .orderBy(asc(bannersTable.displayOrder));
  res.json(banners);
});

router.get("/admin/banners", requireAdmin, async (_req, res): Promise<void> => {
  const banners = await db
    .select()
    .from(bannersTable)
    .orderBy(asc(bannersTable.displayOrder));
  res.json(banners);
});

// ── Upload banner image ─────────────────────────────────────────────────────
router.post("/admin/banners/upload-image", requireAdmin, (bannerUpload as any).single("image"), async (req: any, res): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "No image file provided" }); return; }
  const url = `${APP_URL}/uploads/banners/${req.file.filename}`;
  res.json({ url });
});

router.post("/admin/banners", requireAdmin, async (req, res): Promise<void> => {
  const { title, subtitle, emoji, bgFrom, bgTo, linkUrl, linkLabel, imageUrl, displayOrder, isActive } = req.body;
  if (!title) { res.status(400).json({ error: "title required" }); return; }
  const [banner] = await db.insert(bannersTable).values({
    title,
    subtitle: subtitle ?? "",
    emoji: emoji ?? "⚡",
    bgFrom: bgFrom ?? "#f97316",
    bgTo: bgTo ?? "#ea580c",
    linkUrl: linkUrl ?? "/",
    linkLabel: linkLabel ?? "Join Now",
    imageUrl: imageUrl ?? null,
    displayOrder: displayOrder ?? 0,
    isActive: isActive ?? true,
  }).returning();
  res.status(201).json(banner);
});

router.put("/admin/banners/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { title, subtitle, emoji, bgFrom, bgTo, linkUrl, linkLabel, imageUrl, displayOrder, isActive } = req.body;
  const [banner] = await db
    .update(bannersTable)
    .set({ title, subtitle, emoji, bgFrom, bgTo, linkUrl, linkLabel, imageUrl: imageUrl ?? null, displayOrder, isActive })
    .where(eq(bannersTable.id, id))
    .returning();
  if (!banner) { res.status(404).json({ error: "Banner not found" }); return; }
  res.json(banner);
});

router.delete("/admin/banners/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.delete(bannersTable).where(eq(bannersTable.id, id));
  res.json({ success: true });
});

export default router;
