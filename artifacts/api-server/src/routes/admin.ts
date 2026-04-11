import { Router, type IRouter } from "express";
import {
  db,
  usersTable,
  examsTable,
  registrationsTable,
  submissionsTable,
  walletTransactionsTable,
  verificationsTable,
} from "@workspace/db";
import { eq, count, sum, desc, asc, like, sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";
import bcrypt from "bcryptjs";
import { sendPrizeWonEmail, sendKycApprovedEmail, sendKycRejectedEmail } from "../lib/email";

const router: IRouter = Router();

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
        name: user.name,
        email: user.email,
        walletBalance: user.walletBalance,
        avatarUrl: user.avatarUrl ?? null,
        isAdmin: user.isAdmin,
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
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    walletBalance: user.walletBalance,
    avatarUrl: user.avatarUrl ?? null,
    isAdmin: user.isAdmin,
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

router.patch("/admin/users/:userId", requireAdmin, async (req, res): Promise<void> => {
  const userId = parseInt(Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId, 10);

  const { name, email, password, walletBalance, isAdmin } = req.body;
  const updates: Partial<typeof usersTable.$inferInsert> = {};

  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = email;
  if (password !== undefined) updates.passwordHash = await bcrypt.hash(password, 10);
  if (walletBalance !== undefined) updates.walletBalance = walletBalance;
  if (isAdmin !== undefined) updates.isAdmin = isAdmin;

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

router.patch("/admin/users/:userId/block", requireAdmin, async (req, res): Promise<void> => {
  const userId = parseInt(Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId, 10);
  const { isBlocked } = req.body;

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
  if (user.isAdmin) { res.status(403).json({ error: "Admin users cannot be deleted" }); return; }

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

export default router;
