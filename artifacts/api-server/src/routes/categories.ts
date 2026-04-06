import { Router, type IRouter } from "express";
import { db, categoriesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/categories", async (_req, res): Promise<void> => {
  const cats = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.isActive, true))
    .orderBy(asc(categoriesTable.displayOrder));
  res.json(cats.map(c => c.name));
});

router.get("/admin/categories", requireAdmin, async (_req, res): Promise<void> => {
  const cats = await db.select().from(categoriesTable).orderBy(asc(categoriesTable.displayOrder));
  res.json(cats);
});

router.post("/admin/categories", requireAdmin, async (req, res): Promise<void> => {
  const { name, displayOrder, isActive } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: "name required" }); return; }
  const existing = await db.select().from(categoriesTable).where(eq(categoriesTable.name, name.trim()));
  if (existing.length) { res.status(409).json({ error: "Category already exists" }); return; }
  const [cat] = await db.insert(categoriesTable).values({
    name: name.trim(),
    displayOrder: displayOrder ?? 0,
    isActive: isActive ?? true,
  }).returning();
  res.status(201).json(cat);
});

router.put("/admin/categories/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { name, displayOrder, isActive } = req.body;
  const [cat] = await db
    .update(categoriesTable)
    .set({ ...(name ? { name: name.trim() } : {}), ...(displayOrder !== undefined ? { displayOrder } : {}), ...(isActive !== undefined ? { isActive } : {}) })
    .where(eq(categoriesTable.id, id))
    .returning();
  if (!cat) { res.status(404).json({ error: "Category not found" }); return; }
  res.json(cat);
});

router.delete("/admin/categories/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
  res.json({ success: true });
});

export default router;
