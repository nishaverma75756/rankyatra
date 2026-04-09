import { Router, type IRouter } from "express";
import { db, usersTable, walletTransactionsTable, submissionsTable, registrationsTable, examsTable, followsTable, notificationsTable, pushTokensTable } from "@workspace/db";
import { eq, count, min, sum, desc, and, ne } from "drizzle-orm";
import { requireAuth, optionalAuth } from "../middlewares/auth";
import { broadcastToUser } from "../lib/ws";
import { sendPushToUser, getDisplayName } from "../lib/pushNotifications";
import bcrypt from "bcryptjs";

const router: IRouter = Router();

router.get("/users/profile", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [examStats] = await db
    .select({ count: count() })
    .from(submissionsTable)
    .where(eq(submissionsTable.userId, user.id));

  const [wins] = await db
    .select({ count: count() })
    .from(submissionsTable)
    .where(eq(submissionsTable.userId, user.id));

  const [rankData] = await db
    .select({ bestRank: min(submissionsTable.rank) })
    .from(submissionsTable)
    .where(eq(submissionsTable.userId, user.id));

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    govtId: user.govtId,
    walletBalance: user.walletBalance,
    avatarUrl: user.avatarUrl,
    isAdmin: user.isAdmin,
    isBlocked: user.isBlocked,
    verificationStatus: user.verificationStatus,
    createdAt: user.createdAt.toISOString(),
    totalExamsTaken: examStats?.count ?? 0,
    totalExamsWon: 0,
    bestRank: rankData?.bestRank ?? null,
  });
});

router.patch("/users/profile", requireAuth, async (req, res): Promise<void> => {
  const { name, email, phone, govtId } = req.body;
  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (name) updates.name = name;
  if (email) updates.email = email;
  if (phone !== undefined) updates.phone = phone;
  if (govtId !== undefined) updates.govtId = govtId;

  const [user] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, req.user!.id))
    .returning();

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    govtId: user.govtId,
    walletBalance: user.walletBalance,
    avatarUrl: user.avatarUrl,
    isAdmin: user.isAdmin,
    isBlocked: user.isBlocked,
    verificationStatus: user.verificationStatus,
    createdAt: user.createdAt.toISOString(),
  });
});

router.post("/users/avatar", requireAuth, async (req, res): Promise<void> => {
  const { avatarBase64, mimeType } = req.body;
  if (!avatarBase64 || !mimeType) {
    res.status(400).json({ error: "Missing avatarBase64 or mimeType" });
    return;
  }

  const avatarUrl = `data:${mimeType};base64,${avatarBase64}`;

  await db.update(usersTable).set({ avatarUrl }).where(eq(usersTable.id, req.user!.id));

  res.json({ avatarUrl });
});

router.get("/users/dashboard", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [examStats] = await db
    .select({ count: count() })
    .from(submissionsTable)
    .where(eq(submissionsTable.userId, user.id));

  const recentTransactions = await db
    .select()
    .from(walletTransactionsTable)
    .where(eq(walletTransactionsTable.userId, user.id))
    .orderBy(desc(walletTransactionsTable.createdAt))
    .limit(5);

  const upcomingRegistrations = await db
    .select({ count: count() })
    .from(registrationsTable)
    .where(eq(registrationsTable.userId, user.id));

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      walletBalance: user.walletBalance,
      avatarUrl: user.avatarUrl,
      isAdmin: user.isAdmin,
      isBlocked: user.isBlocked,
      createdAt: user.createdAt.toISOString(),
    },
    walletBalance: user.walletBalance,
    totalExamsTaken: examStats?.count ?? 0,
    totalExamsWon: 0,
    upcomingRegistrations: upcomingRegistrations[0]?.count ?? 0,
    recentTransactions: recentTransactions.map((t) => ({
      id: t.id,
      userId: t.userId,
      amount: t.amount,
      type: t.type,
      description: t.description,
      balanceAfter: t.balanceAfter,
      createdAt: t.createdAt.toISOString(),
    })),
    liveExams: [],
  });
});

router.get("/users/:userId/public-profile", optionalAuth, async (req, res): Promise<void> => {
  const userId = parseInt(String(req.params.userId), 10);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid user ID" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user || user.isBlocked) { res.status(404).json({ error: "User not found" }); return; }

  const currentUserId = (req as any).user?.id ?? null;

  const [submissions, registrations, winningsData, followersData, followingData, isFollowingData, followsYouData] = await Promise.all([
    db.select().from(submissionsTable).where(eq(submissionsTable.userId, userId)).orderBy(desc(submissionsTable.submittedAt)),
    db.select().from(registrationsTable).where(eq(registrationsTable.userId, userId)),
    db.select({ total: sum(walletTransactionsTable.amount) })
      .from(walletTransactionsTable)
      .where(and(eq(walletTransactionsTable.userId, userId), eq(walletTransactionsTable.type, "credit"))),
    db.select({ cnt: count() }).from(followsTable).where(eq(followsTable.followingId, userId)),
    db.select({ cnt: count() }).from(followsTable).where(eq(followsTable.followerId, userId)),
    currentUserId
      ? db.select().from(followsTable).where(and(eq(followsTable.followerId, currentUserId), eq(followsTable.followingId, userId)))
      : Promise.resolve([]),
    currentUserId
      ? db.select().from(followsTable).where(and(eq(followsTable.followerId, userId), eq(followsTable.followingId, currentUserId)))
      : Promise.resolve([]),
  ]);

  const totalWinnings = parseFloat(String(winningsData[0]?.total ?? "0"));
  const examsCompleted = submissions.length;
  const examsParticipated = registrations.length;
  const examsWon = submissions.filter((s) => s.rank === 1).length;
  const podiumFinishes = submissions.filter((s) => s.rank !== null && s.rank <= 3).length;
  const highestRank = examsCompleted > 0 ? Math.min(...submissions.map((s) => s.rank ?? 9999)) : null;
  const totalCorrect = submissions.reduce((s, sub) => s + (sub.correctAnswers ?? 0), 0);
  const totalQuestions = submissions.reduce((s, sub) => s + (sub.totalQuestions ?? 0), 0);
  const accuracyPercent = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  const winRatio = examsCompleted > 0 ? Math.round((examsWon / examsCompleted) * 100) : 0;
  const rankPoints = totalCorrect;

  let skillLevel: string; let skillIcon: string;
  if (rankPoints <= 100) { skillLevel = "Beginner"; skillIcon = "🌱"; }
  else if (rankPoints <= 200) { skillLevel = "Explorer"; skillIcon = "⚡"; }
  else if (rankPoints <= 400) { skillLevel = "Warrior"; skillIcon = "⚔️"; }
  else if (rankPoints <= 700) { skillLevel = "Advanced"; skillIcon = "🔥"; }
  else { skillLevel = "Champion"; skillIcon = "🏆"; }

  const recentSubmissions = submissions.slice(0, 5);
  const recentResults = await Promise.all(
    recentSubmissions.map(async (sub) => {
      const [exam] = await db.select().from(examsTable).where(eq(examsTable.id, sub.examId));
      return {
        examId: sub.examId,
        examTitle: exam?.title ?? "Unknown Exam",
        category: exam?.category ?? "Other",
        score: sub.score,
        totalQuestions: sub.totalQuestions,
        correctAnswers: sub.correctAnswers,
        rank: sub.rank,
        submittedAt: sub.submittedAt.toISOString(),
      };
    })
  );

  const followersCount = Number(followersData[0]?.cnt ?? 0);
  const followingCount = Number(followingData[0]?.cnt ?? 0);
  const isFollowing = (isFollowingData as any[]).length > 0;
  const followsYou = (followsYouData as any[]).length > 0;

  res.json({
    id: user.id,
    name: user.name,
    avatarUrl: user.avatarUrl ?? null,
    verificationStatus: user.verificationStatus,
    isAdmin: user.isAdmin,
    createdAt: user.createdAt.toISOString(),
    examsParticipated,
    examsCompleted,
    examsWon,
    podiumFinishes,
    highestRank: highestRank === 9999 ? null : highestRank,
    accuracyPercent,
    winRatio,
    totalWinnings,
    rankPoints,
    skillLevel,
    skillIcon,
    recentResults,
    followersCount,
    followingCount,
    isFollowing,
    followsYou,
  });
});

router.get("/users/:userId/followers", optionalAuth, async (req, res): Promise<void> => {
  const userId = parseInt(String(req.params.userId), 10);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid user ID" }); return; }
  const currentUserId = (req as any).user?.id ?? null;

  const rows = await db
    .select({ follower: usersTable })
    .from(followsTable)
    .innerJoin(usersTable, eq(usersTable.id, followsTable.followerId))
    .where(eq(followsTable.followingId, userId))
    .orderBy(desc(followsTable.createdAt));

  const result = await Promise.all(rows.map(async ({ follower }) => {
    const isFollowing = currentUserId
      ? (await db.select().from(followsTable).where(and(eq(followsTable.followerId, currentUserId), eq(followsTable.followingId, follower.id)))).length > 0
      : false;
    return { id: follower.id, name: follower.name, avatarUrl: follower.avatarUrl ?? null, verificationStatus: follower.verificationStatus, isFollowing };
  }));
  res.json(result);
});

router.get("/users/:userId/following", optionalAuth, async (req, res): Promise<void> => {
  const userId = parseInt(String(req.params.userId), 10);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid user ID" }); return; }
  const currentUserId = (req as any).user?.id ?? null;

  const rows = await db
    .select({ following: usersTable })
    .from(followsTable)
    .innerJoin(usersTable, eq(usersTable.id, followsTable.followingId))
    .where(eq(followsTable.followerId, userId))
    .orderBy(desc(followsTable.createdAt));

  const result = await Promise.all(rows.map(async ({ following }) => {
    const isFollowing = currentUserId
      ? (await db.select().from(followsTable).where(and(eq(followsTable.followerId, currentUserId), eq(followsTable.followingId, following.id)))).length > 0
      : false;
    return { id: following.id, name: following.name, avatarUrl: following.avatarUrl ?? null, verificationStatus: following.verificationStatus, isFollowing };
  }));
  res.json(result);
});

router.post("/users/:userId/follow", requireAuth, async (req, res): Promise<void> => {
  const userId = parseInt(String(req.params.userId), 10);
  const currentUserId = (req as any).user.id;
  if (isNaN(userId) || userId === currentUserId) { res.status(400).json({ error: "Invalid" }); return; }

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!target || target.isBlocked) { res.status(404).json({ error: "User not found" }); return; }

  await db.insert(followsTable).values({ followerId: currentUserId, followingId: userId }).onConflictDoNothing();
  await db.insert(notificationsTable).values({ userId, type: "follow", fromUserId: currentUserId }).catch(() => {});
  broadcastToUser(userId, JSON.stringify({ type: "notification", notifType: "follow", fromUserId: currentUserId }));
  getDisplayName(currentUserId).then((name) => sendPushToUser(userId, "New Follower 🔔", `${name} started following you`, { type: "follow", fromUserId: currentUserId }));
  res.json({ success: true });
});

router.delete("/users/:userId/follow", requireAuth, async (req, res): Promise<void> => {
  const userId = parseInt(String(req.params.userId), 10);
  const currentUserId = (req as any).user.id;
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid" }); return; }

  await db.delete(followsTable).where(and(eq(followsTable.followerId, currentUserId), eq(followsTable.followingId, userId)));
  res.json({ success: true });
});

// Debug: Send a test push to self
router.post("/push/test", requireAuth, async (req: any, res: any): Promise<void> => {
  const userId = req.user.id;
  const tokens = await db.select().from(pushTokensTable).where(eq(pushTokensTable.userId, userId));
  console.log(`[Push/Test] User ${userId} has ${tokens.length} token(s):`, tokens.map(t => t.token.slice(0, 30) + "..."));
  if (tokens.length === 0) {
    res.json({ ok: false, reason: "No push tokens registered for this user. Log out and log back in." });
    return;
  }
  const { sendPushToUser } = await import("../lib/pushNotifications");
  await sendPushToUser(userId, "🔔 Test Notification", "Push notifications are working!", { type: "test" });
  res.json({ ok: true, tokenCount: tokens.length, tokens: tokens.map(t => ({ type: t.token.startsWith("Expo") ? "expo" : "fcm", preview: t.token.slice(0, 30) + "..." })) });
});

// Register push token (Expo or FCM) for current user
router.post("/users/push-token", requireAuth, async (req: any, res: any): Promise<void> => {
  const userId = req.user.id;
  const { token } = req.body;
  const isExpoToken = typeof token === "string" && token.startsWith("ExponentPushToken");
  const isFcmToken = typeof token === "string" && token.length > 20 && !token.startsWith("ExponentPushToken");
  if (!token || typeof token !== "string" || (!isExpoToken && !isFcmToken)) {
    res.status(400).json({ error: "Invalid push token" });
    return;
  }
  try {
    await db.insert(pushTokensTable).values({ userId, token }).onConflictDoUpdate({
      target: pushTokensTable.token,
      set: { userId, updatedAt: new Date() },
    });
    console.log(`[Push] Token saved for user ${userId}: ${isExpoToken ? "Expo" : "FCM"}`);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to save push token" });
  }
});

export default router;
