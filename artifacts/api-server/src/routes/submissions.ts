import { Router, type IRouter } from "express";
import {
  db,
  submissionsTable,
  questionsTable,
  registrationsTable,
  examsTable,
  walletTransactionsTable,
  userAnswersTable,
} from "@workspace/db";
import { eq, and, desc, asc, sum, count } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { SubmitExamBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/exams/:examId/submit", requireAuth, async (req, res): Promise<void> => {
  const examId = parseInt(Array.isArray(req.params.examId) ? req.params.examId[0] : req.params.examId, 10);
  if (isNaN(examId)) {
    res.status(400).json({ error: "Invalid exam ID" });
    return;
  }

  const parsed = SubmitExamBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [exam] = await db.select().from(examsTable).where(eq(examsTable.id, examId));
  if (!exam) {
    res.status(404).json({ error: "Exam not found" });
    return;
  }

  // Verify registration
  const [reg] = await db
    .select()
    .from(registrationsTable)
    .where(and(eq(registrationsTable.userId, req.user!.id), eq(registrationsTable.examId, examId)));

  if (!reg) {
    res.status(403).json({ error: "You are not registered for this exam" });
    return;
  }

  // Check if already submitted
  const [existingSub] = await db
    .select()
    .from(submissionsTable)
    .where(and(eq(submissionsTable.userId, req.user!.id), eq(submissionsTable.examId, examId)));

  if (existingSub) {
    res.json({
      id: existingSub.id,
      userId: existingSub.userId,
      examId: existingSub.examId,
      score: existingSub.score,
      totalQuestions: existingSub.totalQuestions,
      correctAnswers: existingSub.correctAnswers,
      timeTakenSeconds: existingSub.timeTakenSeconds,
      rank: existingSub.rank,
      submittedAt: existingSub.submittedAt.toISOString(),
    });
    return;
  }

  // Grade the exam
  const questions = await db.select().from(questionsTable).where(eq(questionsTable.examId, examId));
  const { answers, timeTakenSeconds, timeTakenPerQuestion } = parsed.data;

  const QUESTION_TIME_LIMIT = 20;
  let correctAnswers = 0;
  let score = 0;
  const answerMap = new Map(answers.map((a) => [a.questionId, a.selectedOption]));

  for (const q of questions) {
    const selected = answerMap.get(q.id);
    const isCorrect = selected != null && selected.toLowerCase() === (q.correctOption ?? "").toLowerCase();
    if (isCorrect) {
      correctAnswers++;
      const secondsTaken = timeTakenPerQuestion
        ? Math.min(QUESTION_TIME_LIMIT, Math.max(0, timeTakenPerQuestion[String(q.id)] ?? QUESTION_TIME_LIMIT))
        : QUESTION_TIME_LIMIT;
      const points = Math.max(0, QUESTION_TIME_LIMIT - secondsTaken);
      score += points;
    }
  }

  const totalQuestions = questions.length;

  const [submission] = await db
    .insert(submissionsTable)
    .values({
      userId: req.user!.id,
      examId,
      score,
      totalQuestions,
      correctAnswers,
      timeTakenSeconds,
    })
    .returning();

  // Store individual user answers for answer sheet
  const answerInserts = answers.map((a) => ({
    userId: req.user!.id,
    examId,
    questionId: a.questionId,
    selectedOption: a.selectedOption ?? null,
  }));
  if (answerInserts.length > 0) {
    await db.insert(userAnswersTable).values(answerInserts).onConflictDoNothing();
  }

  // Calculate ranks for this exam
  const allSubmissions = await db
    .select()
    .from(submissionsTable)
    .where(eq(submissionsTable.examId, examId))
    .orderBy(desc(submissionsTable.score), asc(submissionsTable.timeTakenSeconds));

  // Update ranks
  for (let i = 0; i < allSubmissions.length; i++) {
    await db
      .update(submissionsTable)
      .set({ rank: i + 1 })
      .where(eq(submissionsTable.id, allSubmissions[i].id));
  }

  // Get updated rank
  const [updated] = await db.select().from(submissionsTable).where(eq(submissionsTable.id, submission.id));

  res.json({
    id: updated.id,
    userId: updated.userId,
    examId: updated.examId,
    score: updated.score,
    totalQuestions: updated.totalQuestions,
    correctAnswers: updated.correctAnswers,
    timeTakenSeconds: updated.timeTakenSeconds,
    rank: updated.rank,
    submittedAt: updated.submittedAt.toISOString(),
  });
});

router.get("/exams/:examId/my-result", requireAuth, async (req, res): Promise<void> => {
  const examId = parseInt(Array.isArray(req.params.examId) ? req.params.examId[0] : req.params.examId, 10);
  if (isNaN(examId)) {
    res.status(400).json({ error: "Invalid exam ID" });
    return;
  }

  const [sub] = await db
    .select()
    .from(submissionsTable)
    .where(and(eq(submissionsTable.userId, req.user!.id), eq(submissionsTable.examId, examId)));

  if (!sub) {
    res.status(404).json({ error: "No submission found" });
    return;
  }

  // Get individual answers to compute proper wrong/skipped counts
  const userAnswers = await db
    .select()
    .from(userAnswersTable)
    .where(and(eq(userAnswersTable.userId, req.user!.id), eq(userAnswersTable.examId, examId)));

  const questions = await db.select().from(questionsTable).where(eq(questionsTable.examId, examId));
  const totalQuestions = sub.totalQuestions ?? questions.length;
  const correctAnswers = sub.correctAnswers ?? 0;
  const answeredCount = userAnswers.length;
  const wrongAnswers = answeredCount > 0 ? answeredCount - correctAnswers : totalQuestions - correctAnswers;
  const skippedAnswers = answeredCount > 0 ? totalQuestions - answeredCount : 0;

  res.json({
    id: sub.id,
    userId: sub.userId,
    examId: sub.examId,
    score: sub.score,
    totalQuestions,
    correctAnswers,
    wrongAnswers,
    skippedAnswers,
    timeTakenSeconds: sub.timeTakenSeconds,
    rank: sub.rank,
    submittedAt: sub.submittedAt.toISOString(),
  });
});

router.get("/me/stats", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;

  // All submissions for this user with exam data
  const submissions = await db
    .select()
    .from(submissionsTable)
    .where(eq(submissionsTable.userId, userId))
    .orderBy(desc(submissionsTable.submittedAt));

  // All registrations
  const registrations = await db
    .select()
    .from(registrationsTable)
    .where(eq(registrationsTable.userId, userId));

  // Total winnings from wallet transactions
  const winningsTxns = await db
    .select()
    .from(walletTransactionsTable)
    .where(and(eq(walletTransactionsTable.userId, userId), eq(walletTransactionsTable.type, "credit")));

  const totalWinnings = winningsTxns.reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const examsCompleted = submissions.length;
  const examsParticipated = registrations.length;
  const examsWon = submissions.filter((s) => s.rank === 1).length;
  const podiumFinishes = submissions.filter((s) => s.rank !== null && s.rank <= 3).length;
  const highestRank = submissions.length > 0
    ? Math.min(...submissions.map((s) => s.rank ?? 9999))
    : null;

  const totalCorrect = submissions.reduce((s, sub) => s + (sub.correctAnswers ?? 0), 0);
  const totalQuestions = submissions.reduce((s, sub) => s + (sub.totalQuestions ?? 0), 0);
  const accuracyPercent = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  const avgTimeTakenSeconds = examsCompleted > 0
    ? Math.round(submissions.reduce((s, sub) => s + (sub.timeTakenSeconds ?? 0), 0) / examsCompleted)
    : 0;

  const avgScore = examsCompleted > 0
    ? Math.round(submissions.reduce((s, sub) => {
        const pct = sub.totalQuestions ? (sub.correctAnswers ?? 0) / sub.totalQuestions * 100 : 0;
        return s + pct;
      }, 0) / examsCompleted)
    : 0;

  // Category breakdown from submissions joined with exams
  const categoryMap = new Map<string, { count: number; correct: number; total: number }>();
  for (const sub of submissions) {
    const [exam] = await db.select().from(examsTable).where(eq(examsTable.id, sub.examId));
    if (!exam) continue;
    const cat = exam.category ?? "Other";
    const entry = categoryMap.get(cat) ?? { count: 0, correct: 0, total: 0 };
    entry.count++;
    entry.correct += sub.correctAnswers ?? 0;
    entry.total += sub.totalQuestions ?? 0;
    categoryMap.set(cat, entry);
  }
  const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, data]) => ({
    category,
    count: data.count,
    accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
  })).sort((a, b) => b.count - a.count);

  // Recent results (last 5)
  const recentResults = await Promise.all(
    submissions.slice(0, 5).map(async (sub) => {
      const [exam] = await db.select().from(examsTable).where(eq(examsTable.id, sub.examId));
      return {
        examId: sub.examId,
        examTitle: exam?.title ?? "Unknown Exam",
        category: exam?.category ?? "Other",
        score: sub.score,
        totalQuestions: sub.totalQuestions,
        correctAnswers: sub.correctAnswers,
        rank: sub.rank,
        timeTakenSeconds: sub.timeTakenSeconds,
        submittedAt: sub.submittedAt.toISOString(),
      };
    })
  );

  // Skill level based on cumulative correct answers (ranking points)
  // 0-100: Beginner | 101-200: Explorer | 201-400: Warrior | 401-700: Advanced | 701+: Champion
  const rankPoints = totalCorrect;
  let skillLevel: string;
  let skillIcon: string;
  if (rankPoints <= 100) { skillLevel = "Beginner"; skillIcon = "🌱"; }
  else if (rankPoints <= 200) { skillLevel = "Explorer"; skillIcon = "⚡"; }
  else if (rankPoints <= 400) { skillLevel = "Warrior"; skillIcon = "⚔️"; }
  else if (rankPoints <= 700) { skillLevel = "Advanced"; skillIcon = "🔥"; }
  else { skillLevel = "Champion"; skillIcon = "🏆"; }

  res.json({
    examsParticipated,
    examsCompleted,
    examsWon,
    podiumFinishes,
    highestRank: highestRank === 9999 ? null : highestRank,
    totalCorrect,
    totalQuestions,
    accuracyPercent,
    avgScore,
    avgTimeTakenSeconds,
    totalWinnings,
    rankPoints,
    skillLevel,
    skillIcon,
    categoryBreakdown,
    recentResults,
  });
});

export default router;
