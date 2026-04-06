import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const avatarsDir = path.join(process.cwd(), "uploads", "avatars");
if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });

async function handleAvatarUpload(req: Request, res: Response): Promise<void> {
  const { avatarBase64, mimeType } = req.body;

  if (!avatarBase64 || !mimeType) {
    res.status(400).json({ error: "No image data provided" });
    return;
  }

  try {
    const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
    const filename = `${randomUUID()}.${ext}`;
    const filePath = path.join(avatarsDir, filename);
    const buffer = Buffer.from(avatarBase64, "base64");

    if (buffer.length > 5 * 1024 * 1024) {
      res.status(400).json({ error: "Image too large (max 5MB)" });
      return;
    }

    fs.writeFileSync(filePath, buffer);

    const avatarUrl = `/uploads/avatars/${filename}`;
    await db
      .update(usersTable)
      .set({ avatarUrl })
      .where(eq(usersTable.id, req.user!.id));

    res.json({ avatarUrl });
  } catch (err: any) {
    console.error("Avatar upload error:", err);
    res.status(500).json({ error: "Failed to upload avatar" });
  }
}

router.post("/users/avatar", requireAuth, handleAvatarUpload);
router.post("/me/avatar", requireAuth, handleAvatarUpload);

router.delete("/me/avatar", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [user] = await db
      .select({ avatarUrl: usersTable.avatarUrl })
      .from(usersTable)
      .where(eq(usersTable.id, req.user!.id));

    if (user?.avatarUrl?.startsWith("/uploads/avatars/")) {
      const filePath = path.join(process.cwd(), user.avatarUrl);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await db
      .update(usersTable)
      .set({ avatarUrl: null })
      .where(eq(usersTable.id, req.user!.id));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove avatar" });
  }
});

export default router;
