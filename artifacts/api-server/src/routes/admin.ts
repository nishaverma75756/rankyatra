import { Router, type IRouter } from "express";
import {
  db,
  usersTable,
  examsTable,
  registrationsTable,
  submissionsTable,
  walletTransactionsTable,
  walletDepositsTable,
  walletWithdrawalsTable,
  verificationsTable,
  followsTable,
  notificationsTable,
  postsTable,
  postLikesTable,
  postCommentsTable,
  userRolesTable,
  groupMembersTable,
  reportsTable,
  userBlocksTable,
  userAnswersTable,
  reels,
  reelLikes,
  reelCommentsTable,
  reelCommentLikesTable,
  pushTokensTable,
  reelApplications,
} from "@workspace/db";
import { eq, count, sum, desc, asc, like, sql, or } from "drizzle-orm";
import { requireAdmin, requireSuperAdmin, requirePermission } from "../middlewares/auth";
import bcrypt from "bcryptjs";
import { sendPrizeWonEmail, sendKycApprovedEmail, sendKycRejectedEmail } from "../lib/email";
import { sendPushToUser } from "../lib/pushNotifications";

const router: IRouter = Router();

// ── GET /admin/me — current admin info ───────────────────────────────────────
router.get("/admin/me", requireAdmin, async (req: any, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    isAdmin: user.isAdmin,
    isSuperAdmin: user.isSuperAdmin,
    adminPermissions: user.adminPermissions ?? [],
  });
});

router.get("/admin/users", requireAdmin, async (_req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));

  const results = await Promise.all(
    users.map(async (user) => {
      const [examStats] = await db
        .select({ count: count() })
        .from(submissionsTable)
        .where(eq(submissionsTable.userId, user.id));

      const [winnings] = await db
        .select({ total: sum(walletTransactionsTable.amount) })
        .from(walletTransactionsTable)
        .where(eq(walletTransactionsTable.userId, user.id));

      return {
        id: user.id,
        customUid: user.customUid ?? null,
        name: user.name,
        email: user.email,
        walletBalance: user.walletBalance,
        avatarUrl: user.avatarUrl ?? null,
        isAdmin: user.isAdmin,
        isSuperAdmin: user.isSuperAdmin ?? false,
        adminPermissions: user.adminPermissions ?? [],
        isBlocked: user.isBlocked,
        createdAt: user.createdAt.toISOString(),
        totalExamsTaken: examStats?.count ?? 0,
        totalWinnings: winnings?.total ?? "0.00",
        verificationStatus: user.verificationStatus ?? "not_submitted",
      };
    })
  );

  res.json(results);
});

router.get("/admin/users/:userId", requireAdmin, async (req, res): Promise<void> => {
  const userId = parseInt(Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId, 10);

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [[examStats], [winnings], [verification]] = await Promise.all([
    db.select({ count: count() }).from(submissionsTable).where(eq(submissionsTable.userId, user.id)),
    db.select({ total: sum(walletTransactionsTable.amount) }).from(walletTransactionsTable).where(eq(walletTransactionsTable.userId, user.id)),
    db.select().from(verificationsTable).where(eq(verificationsTable.userId, user.id)).orderBy(desc(verificationsTable.createdAt)).limit(1),
  ]);

  res.json({
    id: user.id,
    customUid: user.customUid ?? null,
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    walletBalance: user.walletBalance,
    avatarUrl: user.avatarUrl ?? null,
    isAdmin: user.isAdmin,
    isSuperAdmin: user.isSuperAdmin ?? false,
    adminPermissions: user.adminPermissions ?? [],
    isBlocked: user.isBlocked,
    createdAt: user.createdAt.toISOString(),
    totalExamsTaken: examStats?.count ?? 0,
    totalWinnings: winnings?.total ?? "0.00",
    verificationStatus: user.verificationStatus ?? "not_submitted",
    govtId: verification?.govtId ?? user.govtId ?? null,
    panCardUrl: verification?.panCardUrl ?? null,
    kycStatus: verification?.status ?? null,
    kycNote: verification?.adminNote ?? null,
  });
});

router.patch("/admin/users/:userId", requireAdmin, async (req: any, res): Promise<void> => {
  const userId = parseInt(Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId, 10);

  // Protect super admin — nobody can edit a super admin except themselves
  const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (targetUser?.isSuperAdmin && req.user!.id !== userId) {
    res.status(403).json({ error: "Super admin cannot be modified by other admins" });
    return;
  }

  const { name, email, password, walletBalance, isAdmin } = req.body;
  const updates: Partial<typeof usersTable.$inferInsert> = {};

  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = email;
  if (password !== undefined) updates.passwordHash = await bcrypt.hash(password, 10);
  if (walletBalance !== undefined) updates.walletBalance = walletBalance;

  // Only super admin can grant/revoke admin status
  if (isAdmin !== undefined) {
    if (!req.user!.isSuperAdmin) {
      res.status(403).json({ error: "Only super admin can grant or revoke admin access" });
      return;
    }
    // Cannot revoke super admin's own admin status
    if (targetUser?.isSuperAdmin && !isAdmin) {
      res.status(403).json({ error: "Super admin cannot be demoted" });
      return;
    }
    updates.isAdmin = isAdmin;
    if (!isAdmin) updates.adminPermissions = []; // Clear permissions when revoking admin
  }

  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, userId)).returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [examStats] = await db
    .select({ count: count() })
    .from(submissionsTable)
    .where(eq(submissionsTable.userId, user.id));

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    walletBalance: user.walletBalance,
    avatarUrl: user.avatarUrl ?? null,
    isAdmin: user.isAdmin,
    isBlocked: user.isBlocked,
    createdAt: user.createdAt.toISOString(),
    totalExamsTaken: examStats?.count ?? 0,
    totalWinnings: "0.00",
  });
});

// ── Super admin only: set custom UID for a user ───────────────────────────────
router.patch("/admin/users/:userId/custom-uid", requireSuperAdmin, async (req: any, res): Promise<void> => {
  const userId = parseInt(Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId, 10);
  const { customUid } = req.body as { customUid: number | null };

  if (customUid !== null && (isNaN(customUid) || customUid < 1)) {
    res.status(400).json({ error: "Invalid UID — must be a positive number" });
    return;
  }

  // Check uniqueness if assigning a new value
  if (customUid !== null) {
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.customUid, customUid))
      .limit(1);
    if (existing && existing.id !== userId) {
      res.status(409).json({ error: `UID ${customUid} is already assigned to another user` });
      return;
    }
  }

  const [updated] = await db
    .update(usersTable)
    .set({ customUid: customUid ?? null })
    .where(eq(usersTable.id, userId))
    .returning();

  if (!updated) { res.status(404).json({ error: "User not found" }); return; }
  res.json({ id: updated.id, customUid: updated.customUid ?? null });
});

// ── Super admin only: full data reset for a user ──────────────────────────────
router.post("/admin/users/:userId/reset-data", requireSuperAdmin, async (req: any, res): Promise<void> => {
  const userId = parseInt(Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId, 10);

  // Protect super admin from being reset
  const [target] = await db.select({ id: usersTable.id, isSuperAdmin: usersTable.isSuperAdmin }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!target) { res.status(404).json({ error: "User not found" }); return; }
  if (target.isSuperAdmin) { res.status(403).json({ error: "Super admin ka data reset nahi ho sakta" }); return; }

  try {
    // 1. Social data — likes & comments by user
    await db.delete(postLikesTable).where(eq(postLikesTable.userId, userId));
    await db.delete(postCommentsTable).where(eq(postCommentsTable.userId, userId));

    // 2. User's own posts (cascade deletes post_likes + post_comments on those posts)
    await db.delete(postsTable).where(eq(postsTable.userId, userId));

    // 3. Reels
    await db.delete(reelCommentLikesTable).where(eq(reelCommentLikesTable.userId, userId));
    await db.delete(reelCommentsTable).where(eq(reelCommentsTable.userId, userId));
    await db.delete(reelLikes).where(eq(reelLikes.userId, userId));
    await db.delete(reels).where(eq(reels.userId, userId));

    // 4. Exam data
    await db.delete(userAnswersTable).where(eq(userAnswersTable.userId, userId));
    await db.delete(submissionsTable).where(eq(submissionsTable.userId, userId));
    await db.delete(registrationsTable).where(eq(registrationsTable.userId, userId));

    // 5. Social relationships
    await db.delete(followsTable).where(
      or(eq(followsTable.followerId, userId), eq(followsTable.followingId, userId))
    );
    await db.delete(userBlocksTable).where(
      or(eq(userBlocksTable.blockerId, userId), eq(userBlocksTable.blockedId, userId))
    );

    // 6. Notifications
    await db.delete(notificationsTable).where(eq(notificationsTable.userId, userId));

    // 7. KYC / verification
    await db.delete(verificationsTable).where(eq(verificationsTable.userId, userId));

    // 8. Wallet history
    await db.delete(walletTransactionsTable).where(eq(walletTransactionsTable.userId, userId));
    await db.delete(walletDepositsTable).where(eq(walletDepositsTable.userId, userId));
    await db.delete(walletWithdrawalsTable).where(eq(walletWithdrawalsTable.userId, userId));

    // 9. Roles & groups
    await db.delete(userRolesTable).where(eq(userRolesTable.userId, userId));
    await db.delete(groupMembersTable).where(eq(groupMembersTable.userId, userId));

    // 10. Reports by this user
    await db.delete(reportsTable).where(eq(reportsTable.reporterId, userId));

    // 11. Push tokens
    await db.delete(pushTokensTable).where(eq(pushTokensTable.userId, userId));

    // 12. Reset wallet balance to 0
    await db.update(usersTable)
      .set({ walletBalance: "0.00", verificationStatus: "none" })
      .where(eq(usersTable.id, userId));

    res.json({ success: true, message: "User ka saara data reset ho gaya" });
  } catch (e: any) {
    console.error("[reset-data]", e);
    res.status(500).json({ error: "Reset failed: " + (e?.message ?? "Unknown error") });
  }
});

// ── Super admin only: update another admin's permissions ─────────────────────
router.patch("/admin/users/:userId/admin-permissions", requireSuperAdmin, async (req: any, res): Promise<void> => {
  const userId = parseInt(Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId, 10);
  const { permissions, isAdmin } = req.body as { permissions: string[]; isAdmin?: boolean };

  const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!targetUser) { res.status(404).json({ error: "User not found" }); return; }
  if (targetUser.isSuperAdmin) { res.status(403).json({ error: "Cannot modify another super admin" }); return; }

  const updates: Partial<typeof usersTable.$inferInsert> = {
    adminPermissions: permissions ?? [],
  };
  if (isAdmin !== undefined) updates.isAdmin = isAdmin;
  if (isAdmin === false) updates.adminPermissions = [];

  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, userId)).returning();
  res.json({
    id: updated.id,
    name: updated.name,
    isAdmin: updated.isAdmin,
    isSuperAdmin: updated.isSuperAdmin,
    adminPermissions: updated.adminPermissions ?? [],
  });
});

router.patch("/admin/users/:userId/block", requireAdmin, async (req: any, res): Promise<void> => {
  const userId = parseInt(Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId, 10);
  const { isBlocked } = req.body;

  // Protect super admin from being blocked
  const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (targetUser?.isSuperAdmin) {
    res.status(403).json({ error: "Super admin cannot be blocked" });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set({ isBlocked })
    .where(eq(usersTable.id, userId))
    .returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    walletBalance: user.walletBalance,
    avatarUrl: user.avatarUrl ?? null,
    isAdmin: user.isAdmin,
    isBlocked: user.isBlocked,
    createdAt: user.createdAt.toISOString(),
    totalExamsTaken: 0,
    totalWinnings: "0.00",
  });
});

// ── Delete user (fully remove from DB) ──────────────────────────────────────
router.delete("/admin/users/:userId", requireAdmin, async (req, res): Promise<void> => {
  const userId = parseInt(Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid user ID" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (user.isAdmin || user.isSuperAdmin) { res.status(403).json({ error: "Admin users cannot be deleted" }); return; }

  // Delete in the correct order to avoid FK constraint violations
  // (tables without ON DELETE CASCADE must be cleaned manually)
  await db.execute(sql`DELETE FROM messages WHERE sender_id = ${userId}`);
  await db.execute(sql`DELETE FROM conversations WHERE user1_id = ${userId} OR user2_id = ${userId}`);
  await db.execute(sql`DELETE FROM reels WHERE user_id = ${userId}`);
  await db.execute(sql`DELETE FROM reel_likes WHERE user_id = ${userId}`);
  await db.execute(sql`DELETE FROM reports WHERE reporter_id = ${userId} OR reported_user_id = ${userId}`);
  await db.execute(sql`DELETE FROM verifications WHERE user_id = ${userId}`);
  // Finally delete user — cascade handles: follows, post_likes, post_comments, registrations,
  // submissions, notifications, push_tokens, password_resets, email_verifications, wallet_transactions, user_blocks
  await db.delete(usersTable).where(eq(usersTable.id, userId));

  res.json({ success: true, message: `User ${user.name} (ID: ${userId}) deleted successfully.` });
});

router.patch("/admin/users/:userId/wallet", requireAdmin, async (req, res): Promise<void> => {
  const userId = parseInt(Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId, 10);
  const { amount, type, description } = req.body;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const currentBalance = parseFloat(user.walletBalance);
  const adjustAmount = parseFloat(amount);
  const newBalance = type === "credit"
    ? (currentBalance + adjustAmount).toFixed(2)
    : (currentBalance - adjustAmount).toFixed(2);

  await db.update(usersTable).set({ walletBalance: newBalance }).where(eq(usersTable.id, userId));

  await db.insert(walletTransactionsTable).values({
    userId,
    amount: adjustAmount.toFixed(2),
    type,
    description: description || `Admin wallet adjustment`,
    balanceAfter: newBalance,
  });

  const [updated] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

  res.json({
    id: updated.id,
    name: updated.name,
    email: updated.email,
    walletBalance: updated.walletBalance,
    avatarUrl: updated.avatarUrl ?? null,
    isAdmin: updated.isAdmin,
    isBlocked: updated.isBlocked,
    createdAt: updated.createdAt.toISOString(),
    totalExamsTaken: 0,
    totalWinnings: "0.00",
  });
});

router.post("/admin/exams/:examId/reward", requireAdmin, async (req, res): Promise<void> => {
  const examId = parseInt(Array.isArray(req.params.examId) ? req.params.examId[0] : req.params.examId, 10);

  const [exam] = await db.select().from(examsTable).where(eq(examsTable.id, examId));
  if (!exam) {
    res.status(404).json({ error: "Exam not found" });
    return;
  }

  const { prizes } = req.body as { prizes: { rank: number; amount: string }[] };

  const submissions = await db
    .select()
    .from(submissionsTable)
    .where(eq(submissionsTable.examId, examId))
    .orderBy(desc(submissionsTable.score), asc(submissionsTable.timeTakenSeconds))
    .limit(5);

  const rewarded: { rank: number; userId: number; userName: string; amount: string }[] = [];

  for (const prize of prizes) {
    const sub = submissions[prize.rank - 1];
    if (!sub) continue;

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, sub.userId));
    if (!user) continue;

    const currentBalance = parseFloat(user.walletBalance);
    const currentWinning = parseFloat(user.winningBalance ?? "0");
    const prizeAmount = parseFloat(prize.amount);
    const newBalance = (currentBalance + prizeAmount).toFixed(2);
    const newWinning = (currentWinning + prizeAmount).toFixed(2);

    await db.update(usersTable).set({
      walletBalance: newBalance,
      winningBalance: newWinning,
    }).where(eq(usersTable.id, user.id));

    await db.insert(walletTransactionsTable).values({
      userId: user.id,
      amount: prizeAmount.toFixed(2),
      type: "credit",
      description: `Prize: Rank #${prize.rank} in ${exam.title}`,
      balanceAfter: newBalance,
    });

    try {
      await sendPrizeWonEmail(user.email, user.name, exam.title, prize.rank, prizeAmount.toFixed(2), newBalance);
    } catch (err) { console.error("Prize won email failed:", err); }

    rewarded.push({
      rank: prize.rank,
      userId: user.id,
      userName: user.name,
      amount: prize.amount,
    });
  }

  await db.update(examsTable).set({ rewardsDistributed: "true" }).where(eq(examsTable.id, examId));

  res.json({ success: true, rewarded });
});

router.patch("/admin/exams/:examId/solution-pdf", requireAdmin, async (req, res): Promise<void> => {
  const examId = parseInt(Array.isArray(req.params.examId) ? req.params.examId[0] : req.params.examId, 10);
  const { solutionPdfUrl } = req.body;

  const [exam] = await db
    .update(examsTable)
    .set({ solutionPdfUrl: solutionPdfUrl ?? null })
    .where(eq(examsTable.id, examId))
    .returning();

  if (!exam) {
    res.status(404).json({ error: "Exam not found" });
    return;
  }

  const now = new Date();
  let status: "upcoming" | "live" | "completed" = "upcoming";
  if (now >= exam.startTime && now <= exam.endTime) status = "live";
  else if (now > exam.endTime) status = "completed";

  res.json({
    id: exam.id,
    title: exam.title,
    category: exam.category,
    startTime: exam.startTime.toISOString(),
    endTime: exam.endTime.toISOString(),
    entryFee: exam.entryFee,
    status,
    solutionPdfUrl: status === "completed" ? exam.solutionPdfUrl : null,
    questionCount: 0,
    registeredCount: 0,
    prizePool: exam.prizePool,
    createdAt: exam.createdAt.toISOString(),
  });
});

router.get("/admin/verifications", requireAdmin, async (_req, res): Promise<void> => {
  const verifications = await db
    .select({
      id: verificationsTable.id,
      userId: verificationsTable.userId,
      govtId: verificationsTable.govtId,
      panCardUrl: verificationsTable.panCardUrl,
      status: verificationsTable.status,
      adminNote: verificationsTable.adminNote,
      createdAt: verificationsTable.createdAt,
      userName: usersTable.name,
      userEmail: usersTable.email,
      userPhone: usersTable.phone,
    })
    .from(verificationsTable)
    .leftJoin(usersTable, eq(verificationsTable.userId, usersTable.id))
    .orderBy(desc(verificationsTable.createdAt));

  res.json(verifications.map(v => ({
    ...v,
    createdAt: v.createdAt.toISOString(),
  })));
});

router.patch("/admin/verifications/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { action, adminNote } = req.body;

  if (!["approve", "reject"].includes(action)) {
    res.status(400).json({ error: "action must be approve or reject" });
    return;
  }

  const [verification] = await db
    .update(verificationsTable)
    .set({ status: action === "approve" ? "approved" : "rejected", adminNote: adminNote ?? null })
    .where(eq(verificationsTable.id, id))
    .returning();

  if (!verification) {
    res.status(404).json({ error: "Verification not found" });
    return;
  }

  await db.update(usersTable)
    .set({ verificationStatus: action === "approve" ? "verified" : "rejected" })
    .where(eq(usersTable.id, verification.userId));

  const [kycUser] = await db.select().from(usersTable).where(eq(usersTable.id, verification.userId));
  if (kycUser) {
    try {
      if (action === "approve") {
        await sendKycApprovedEmail(kycUser.email, kycUser.name);
      } else {
        await sendKycRejectedEmail(kycUser.email, kycUser.name, adminNote ?? null);
      }
    } catch (err) { console.error("KYC email failed:", err); }
  }

  res.json({ success: true, status: action === "approve" ? "verified" : "rejected" });
});

// Completed exams — full participant breakdown + top 5 leaderboard
router.get("/admin/exams/completed", requireAdmin, async (_req, res): Promise<void> => {
  const now = new Date();
  const allExams = await db.select().from(examsTable).orderBy(desc(examsTable.endTime));
  const completedExams = allExams.filter(e => now > e.endTime);

  const results = await Promise.all(
    completedExams.map(async (exam) => {
      const registrations = await db
        .select({ userId: registrationsTable.userId })
        .from(registrationsTable)
        .where(eq(registrationsTable.examId, exam.id));

      const submissions = await db
        .select()
        .from(submissionsTable)
        .where(eq(submissionsTable.examId, exam.id))
        .orderBy(desc(submissionsTable.score), asc(submissionsTable.timeTakenSeconds));

      const submittedUserIds = new Set(submissions.map(s => s.userId));

      const participantDetails = await Promise.all(
        registrations.map(async (reg) => {
          const [user] = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
            .from(usersTable).where(eq(usersTable.id, reg.userId));
          const sub = submissions.find(s => s.userId === reg.userId);
          return {
            userId: reg.userId,
            name: user?.name ?? "Unknown",
            email: user?.email ?? "",
            submitted: submittedUserIds.has(reg.userId),
            score: sub?.score ?? null,
            timeTakenSeconds: sub?.timeTakenSeconds ?? null,
          };
        })
      );

      const topFive = submissions.slice(0, 5).map((sub, idx) => {
        const participant = participantDetails.find(p => p.userId === sub.userId);
        return {
          rank: idx + 1,
          userId: sub.userId,
          name: participant?.name ?? "Unknown",
          email: participant?.email ?? "",
          score: sub.score,
          timeTakenSeconds: sub.timeTakenSeconds,
        };
      });

      return {
        id: exam.id,
        title: exam.title,
        category: exam.category,
        startTime: exam.startTime.toISOString(),
        endTime: exam.endTime.toISOString(),
        prizePool: exam.prizePool,
        entryFee: exam.entryFee,
        rewardsDistributed: exam.rewardsDistributed === "true",
        totalRegistered: registrations.length,
        totalSubmitted: submissions.length,
        totalNotSubmitted: registrations.length - submissions.length,
        participants: participantDetails,
        topFive,
      };
    })
  );

  res.json(results);
});

// Upcoming & live exams — who joined
router.get("/admin/exams/upcoming", requireAdmin, async (_req, res): Promise<void> => {
  const now = new Date();
  const allExams = await db.select().from(examsTable).orderBy(asc(examsTable.startTime));
  const upcomingExams = allExams.filter(e => now <= e.endTime);

  const results = await Promise.all(
    upcomingExams.map(async (exam) => {
      const registrations = await db
        .select({ userId: registrationsTable.userId, registeredAt: registrationsTable.registeredAt })
        .from(registrationsTable)
        .where(eq(registrationsTable.examId, exam.id))
        .orderBy(desc(registrationsTable.registeredAt));

      const participants = await Promise.all(
        registrations.map(async (reg) => {
          const [user] = await db
            .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
            .from(usersTable).where(eq(usersTable.id, reg.userId));
          return {
            userId: reg.userId,
            name: user?.name ?? "Unknown",
            email: user?.email ?? "",
            joinedAt: reg.registeredAt.toISOString(),
          };
        })
      );

      const isLive = now >= exam.startTime && now <= exam.endTime;

      return {
        id: exam.id,
        title: exam.title,
        category: exam.category,
        startTime: exam.startTime.toISOString(),
        endTime: exam.endTime.toISOString(),
        prizePool: exam.prizePool,
        entryFee: exam.entryFee,
        isLive,
        totalRegistered: registrations.length,
        participants,
      };
    })
  );

  res.json(results);
});

router.get("/admin/stats", requireAdmin, async (_req, res): Promise<void> => {
  const [totalUsers] = await db.select({ count: count() }).from(usersTable);
  const [activeUsers] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.isBlocked, false));
  const [totalExams] = await db.select({ count: count() }).from(examsTable);
  const [totalRegistrations] = await db.select({ count: count() }).from(registrationsTable);

  const [revenueRow] = await db
    .select({ total: sum(walletTransactionsTable.amount) })
    .from(walletTransactionsTable)
    .where(like(walletTransactionsTable.description, "Exam registration%"));

  const [prizesRow] = await db
    .select({ total: sum(walletTransactionsTable.amount) })
    .from(walletTransactionsTable)
    .where(like(walletTransactionsTable.description, "Prize:%"));

  const now = new Date();
  const allExams = await db.select().from(examsTable);
  const liveExams = allExams.filter(e => now >= e.startTime && now <= e.endTime).length;
  const completedExams = allExams.filter(e => now > e.endTime).length;

  res.json({
    totalUsers: totalUsers?.count ?? 0,
    activeUsers: activeUsers?.count ?? 0,
    totalExams: totalExams?.count ?? 0,
    liveExams,
    completedExams,
    totalRegistrations: totalRegistrations?.count ?? 0,
    totalRevenue: parseFloat(String(revenueRow?.total ?? "0")).toFixed(2),
    totalPrizesDistributed: parseFloat(String(prizesRow?.total ?? "0")).toFixed(2),
  });
});

// ─── GET /admin/reel-applications — list all applications ────────────────────
router.get("/admin/reel-applications", requireSuperAdmin, async (_req, res): Promise<void> => {
  try {
    const apps = await db
      .select({
        id: reelApplications.id,
        userId: reelApplications.userId,
        instagramHandle: reelApplications.instagramHandle,
        youtubeChannel: reelApplications.youtubeChannel,
        facebookHandle: reelApplications.facebookHandle,
        twitterHandle: reelApplications.twitterHandle,
        contentType: reelApplications.contentType,
        reason: reelApplications.reason,
        status: reelApplications.status,
        adminNote: reelApplications.adminNote,
        createdAt: reelApplications.createdAt,
        updatedAt: reelApplications.updatedAt,
        userName: usersTable.name,
        userEmail: usersTable.email,
        userAvatarUrl: usersTable.avatarUrl,
        canPostReels: usersTable.canPostReels,
      })
      .from(reelApplications)
      .leftJoin(usersTable, eq(reelApplications.userId, usersTable.id))
      .orderBy(desc(reelApplications.createdAt));
    res.json(apps);
  } catch (err) {
    console.error("[admin/reel-applications]", err);
    res.status(500).json({ error: "Failed to fetch reel applications" });
  }
});

// ─── GET /admin/users/:id/reel-application ────────────────────────────────────
router.get("/admin/users/:id/reel-application", requireSuperAdmin, async (req, res): Promise<void> => {
  const userId = Number(req.params.id);
  try {
    const [app] = await db
      .select()
      .from(reelApplications)
      .where(eq(reelApplications.userId, userId));
    res.json({ application: app ?? null });
  } catch {
    res.status(500).json({ error: "Failed to fetch application" });
  }
});

// ─── PATCH /admin/reel-applications/:id/status — approve or reject ────────────
router.patch("/admin/reel-applications/:id/status", requireSuperAdmin, async (req, res): Promise<void> => {
  const appId = Number(req.params.id);
  const { status, adminNote } = req.body;
  if (!["approved", "rejected"].includes(status)) {
    res.status(400).json({ error: "status must be 'approved' or 'rejected'" });
    return;
  }
  try {
    const [app] = await db
      .update(reelApplications)
      .set({ status, adminNote: adminNote?.trim() || null })
      .where(eq(reelApplications.id, appId))
      .returning();
    if (!app) { res.status(404).json({ error: "Application not found" }); return; }

    // If approved, also set canPostReels = true on the user
    if (status === "approved") {
      await db
        .update(usersTable)
        .set({ canPostReels: true })
        .where(eq(usersTable.id, app.userId));

      // In-app notification
      await db.insert(notificationsTable).values({
        userId: app.userId,
        type: "system",
        title: "Reel Access Approved! 🎬",
        body: "Congratulations! You are now authorized to post reels on RankYatra. Go to Moments and start creating!",
        data: JSON.stringify({ screen: "apply-for-reels" }),
      }).catch(() => {});

      // Push notification
      await sendPushToUser(app.userId, {
        title: "Reel Access Approved! 🎬",
        body: "Congratulations! You can now post reels on RankYatra. Go to Moments and start creating!",
        data: { screen: "apply-for-reels" },
      }).catch(() => {});
    }
    // If rejected, ensure canPostReels = false
    if (status === "rejected") {
      await db
        .update(usersTable)
        .set({ canPostReels: false })
        .where(eq(usersTable.id, app.userId));

      const rejectMsg = adminNote?.trim()
        ? `Your reel access request was not approved. Reason: ${adminNote.trim()}`
        : "Your reel access request was not approved at this time. You may re-apply with more details.";

      // In-app notification
      await db.insert(notificationsTable).values({
        userId: app.userId,
        type: "system",
        title: "Reel Application Update",
        body: rejectMsg,
        data: JSON.stringify({ screen: "apply-for-reels" }),
      }).catch(() => {});

      // Push notification
      await sendPushToUser(app.userId, {
        title: "Reel Application Update",
        body: rejectMsg,
        data: { screen: "apply-for-reels" },
      }).catch(() => {});
    }
    res.json({ application: app });
  } catch (err) {
    console.error("[admin/reel-applications/:id/status]", err);
    res.status(500).json({ error: "Failed to update application" });
  }
});

// ─── PATCH /admin/users/:id/reel-access — directly grant or revoke ────────────
router.patch("/admin/users/:id/reel-access", requireSuperAdmin, async (req, res): Promise<void> => {
  const userId = Number(req.params.id);
  const { canPostReels } = req.body;
  if (typeof canPostReels !== "boolean") {
    res.status(400).json({ error: "canPostReels (boolean) required" });
    return;
  }
  try {
    await db
      .update(usersTable)
      .set({ canPostReels })
      .where(eq(usersTable.id, userId));
    // If granting access, also mark any pending application as approved
    if (canPostReels) {
      await db
        .update(reelApplications)
        .set({ status: "approved", adminNote: "Manually granted by admin" })
        .where(eq(reelApplications.userId, userId));
    }
    res.json({ ok: true, canPostReels });
  } catch (err) {
    console.error("[admin/users/:id/reel-access]", err);
    res.status(500).json({ error: "Failed to update reel access" });
  }
});

// ─── GET /admin/users/:userId/content/posts — list user's posts for admin ────
router.get("/admin/users/:userId/content/posts", requireAdmin, async (req, res): Promise<void> => {
  const targetUserId = Number(req.params.userId);
  try {
    const posts = await db
      .select({
        id: postsTable.id,
        content: postsTable.content,
        imageUrl: postsTable.imageUrl,
        createdAt: postsTable.createdAt,
        viewCount: postsTable.viewCount,
        likeCount: sql<number>`(SELECT COUNT(*) FROM post_likes WHERE post_id = ${postsTable.id})::int`,
        commentCount: sql<number>`(SELECT COUNT(*) FROM post_comments WHERE post_id = ${postsTable.id})::int`,
      })
      .from(postsTable)
      .where(eq(postsTable.userId, targetUserId))
      .orderBy(desc(postsTable.id))
      .limit(200);
    res.json({ posts });
  } catch (err) {
    console.error("[admin/content/posts]", err);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

// ─── GET /admin/users/:userId/content/reels — list user's reels for admin ────
router.get("/admin/users/:userId/content/reels", requireAdmin, async (req, res): Promise<void> => {
  const targetUserId = Number(req.params.userId);
  try {
    const reelsList = await db
      .select({
        id: reels.id,
        caption: reels.caption,
        thumbnailUrl: reels.thumbnailUrl,
        videoUrl: reels.videoUrl,
        viewCount: reels.viewCount,
        likeCount: reels.likeCount,
        commentCount: reels.commentCount,
        createdAt: reels.createdAt,
      })
      .from(reels)
      .where(eq(reels.userId, targetUserId))
      .orderBy(desc(reels.id))
      .limit(200);
    res.json({ reels: reelsList });
  } catch (err) {
    console.error("[admin/content/reels]", err);
    res.status(500).json({ error: "Failed to fetch reels" });
  }
});

// ─── DELETE /admin/posts/:postId — admin delete any post ─────────────────────
router.delete("/admin/posts/:postId", requireAdmin, async (req, res): Promise<void> => {
  const postId = Number(req.params.postId);
  try {
    const [post] = await db.select({ id: postsTable.id }).from(postsTable).where(eq(postsTable.id, postId)).limit(1);
    if (!post) { res.status(404).json({ error: "Post not found" }); return; }
    await db.delete(postsTable).where(eq(postsTable.id, postId));
    res.json({ ok: true });
  } catch (err) {
    console.error("[admin/posts/:postId DELETE]", err);
    res.status(500).json({ error: "Failed to delete post" });
  }
});

// ─── DELETE /admin/reels/:reelId — admin delete any reel ─────────────────────
router.delete("/admin/reels/:reelId", requireAdmin, async (req, res): Promise<void> => {
  const reelId = Number(req.params.reelId);
  try {
    const [reel] = await db.select({ id: reels.id }).from(reels).where(eq(reels.id, reelId)).limit(1);
    if (!reel) { res.status(404).json({ error: "Reel not found" }); return; }
    await db.delete(reelLikes).where(eq(reelLikes.reelId, reelId));
    await db.delete(reelCommentsTable).where(eq(reelCommentsTable.reelId, reelId));
    await db.delete(reels).where(eq(reels.id, reelId));
    res.json({ ok: true });
  } catch (err) {
    console.error("[admin/reels/:reelId DELETE]", err);
    res.status(500).json({ error: "Failed to delete reel" });
  }
});

export default router;
