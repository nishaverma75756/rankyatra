import { Router, type IRouter } from "express";
import { db, usersTable, verificationsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/verify/status", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const [latest] = await db
    .select()
    .from(verificationsTable)
    .where(eq(verificationsTable.userId, req.user!.id))
    .orderBy(desc(verificationsTable.createdAt))
    .limit(1);

  res.json({
    verificationStatus: user.verificationStatus,
    latestRequest: latest
      ? {
          id: latest.id,
          status: latest.status,
          adminNote: latest.adminNote,
          createdAt: latest.createdAt.toISOString(),
        }
      : null,
  });
});

router.post("/verify/submit", requireAuth, async (req, res): Promise<void> => {
  const { govtId, panCardBase64, panCardMimeType } = req.body;
  if (!govtId || !panCardBase64 || !panCardMimeType) {
    res.status(400).json({ error: "govtId, panCardBase64 and panCardMimeType are required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  if (user.verificationStatus === "verified") {
    res.status(400).json({ error: "Already verified" });
    return;
  }

  const panCardUrl = `data:${panCardMimeType};base64,${panCardBase64}`;

  await db.update(usersTable).set({
    govtId,
    panCardUrl,
    verificationStatus: "under_review",
  }).where(eq(usersTable.id, req.user!.id));

  await db.insert(verificationsTable).values({
    userId: req.user!.id,
    govtId,
    panCardUrl,
    status: "pending",
  });

  res.json({ verificationStatus: "under_review" });
});

export default router;
