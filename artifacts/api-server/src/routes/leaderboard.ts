import { Router, type IRouter } from "express";
import { db, submissionsTable, usersTable, walletTransactionsTable } from "@workspace/db";
import { eq, desc, asc, sum, count, and, like, gte } from "drizzle-orm";
import { optionalAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/exams/:examId/leaderboard", optionalAuth, async (req, res): Promise<void> => {
  const examId = parseInt(Array.isArray(req.params.examId) ? req.params.examId[0] : req.params.examId, 10);
  if (isNaN(examId)) {
    res.status(400).json({ error: "Invalid exam ID" });
    return;
  }

  const submissions = await db
    .select()
    .from(submissionsTable)
    .where(eq(submissionsTable.examId, examId))
    .orderBy(desc(submissionsTable.score), asc(submissionsTable.timeTakenSeconds))
    .limit(50);

  const entries = await Promise.all(
    submissions.map(async (sub, index) => {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, sub.userId));
      return {
        rank: index + 1,
        userId: sub.userId,
        userName: user?.name ?? "Unknown",
        avatarUrl: user?.avatarUrl ?? null,
        score: sub.score,
        totalQuestions: sub.totalQuestions,
        timeTakenSeconds: sub.timeTakenSeconds,
        isCurrentUser: req.user?.id === sub.userId,
      };
    })
  );

  res.json(entries);
});

router.get("/leaderboard/global", optionalAuth, async (req, res): Promise<void> => {
  const period = (req.query.period as string) ?? "alltime";

  let sinceDate: Date | null = null;
  if (period === "daily") {
    sinceDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
  } else if (period === "weekly") {
    sinceDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  }

  const users = await db.select().from(usersTable).limit(100);

  const entries = await Promise.all(
    users.map(async (user) => {
      const subsWhere = sinceDate
        ? and(eq(submissionsTable.userId, user.id), gte(submissionsTable.submittedAt, sinceDate))
        : eq(submissionsTable.userId, user.id);

      const subs = await db
        .select()
        .from(submissionsTable)
        .where(subsWhere);

      const totalScore = subs.reduce((acc, s) => acc + s.score, 0);
      const examsParticipated = subs.length;

      const prizeWhere = sinceDate
        ? and(
            eq(walletTransactionsTable.userId, user.id),
            like(walletTransactionsTable.description, "Prize:%"),
            gte(walletTransactionsTable.createdAt, sinceDate)
          )
        : and(
            eq(walletTransactionsTable.userId, user.id),
            like(walletTransactionsTable.description, "Prize:%")
          );

      const prizeRows = await db
        .select({ total: sum(walletTransactionsTable.amount), wins: count(walletTransactionsTable.id) })
        .from(walletTransactionsTable)
        .where(prizeWhere);

      const totalWinnings = prizeRows[0]?.total ?? "0.00";
      const winCount = Number(prizeRows[0]?.wins ?? 0);
      const winRatio = examsParticipated > 0
        ? Math.round((winCount / examsParticipated) * 100)
        : 0;

      return {
        userId: user.id,
        userName: user.name,
        avatarUrl: user.avatarUrl ?? null,
        totalScore,
        examsParticipated,
        totalWinnings,
        winCount,
        winRatio,
      };
    })
  );

  const sorted = entries
    .sort((a, b) => {
      const diff = parseFloat(String(b.totalWinnings)) - parseFloat(String(a.totalWinnings));
      if (diff !== 0) return diff;
      return b.totalScore - a.totalScore;
    })
    .map((e, index) => ({
      rank: index + 1,
      ...e,
      isCurrentUser: req.user?.id === e.userId,
    }));

  res.json(sorted);
});

export default router;
