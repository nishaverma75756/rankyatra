import { Router, type IRouter } from "express";
import { db, bannersTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";

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

router.post("/admin/banners", requireAdmin, async (req, res): Promise<void> => {
  const { title, subtitle, emoji, bgFrom, bgTo, linkUrl, linkLabel, displayOrder, isActive } = req.body;
  if (!title) { res.status(400).json({ error: "title required" }); return; }
  const [banner] = await db.insert(bannersTable).values({
    title,
    subtitle: subtitle ?? "",
    emoji: emoji ?? "⚡",
    bgFrom: bgFrom ?? "#f97316",
    bgTo: bgTo ?? "#ea580c",
    linkUrl: linkUrl ?? "/",
    linkLabel: linkLabel ?? "Join Now",
    displayOrder: displayOrder ?? 0,
    isActive: isActive ?? true,
  }).returning();
  res.status(201).json(banner);
});

router.put("/admin/banners/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { title, subtitle, emoji, bgFrom, bgTo, linkUrl, linkLabel, displayOrder, isActive } = req.body;
  const [banner] = await db
    .update(bannersTable)
    .set({ title, subtitle, emoji, bgFrom, bgTo, linkUrl, linkLabel, displayOrder, isActive })
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
