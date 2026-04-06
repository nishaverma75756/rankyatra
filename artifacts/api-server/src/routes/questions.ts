import { Router, type IRouter } from "express";
import { db, questionsTable, registrationsTable, examsTable, submissionsTable, userAnswersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireAdmin, optionalAuth } from "../middlewares/auth";
import { AddQuestionBody, UpdateQuestionBody } from "@workspace/api-zod";

const router: IRouter = Router();

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = (seed ^ 0xdeadbeef) >>> 0;
  for (let i = result.length - 1; i > 0; i--) {
    s = Math.imul(s ^ (s >>> 15), s | 1);
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
    s = ((s ^ (s >>> 14)) >>> 0);
    const j = s % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

router.get("/exams/:examId/questions", requireAuth, async (req, res): Promise<void> => {
  const examId = parseInt(Array.isArray(req.params.examId) ? req.params.examId[0] : req.params.examId, 10);
  if (isNaN(examId)) {
    res.status(400).json({ error: "Invalid exam ID" });
    return;
  }

  // Check if exam is live or user is admin
  const [exam] = await db.select().from(examsTable).where(eq(examsTable.id, examId));
  if (!exam) {
    res.status(404).json({ error: "Exam not found" });
    return;
  }

  const now = new Date();
  const isLive = now >= exam.startTime && now <= exam.endTime;

  if (!req.user!.isAdmin) {
    // Check registration
    const [reg] = await db
      .select()
      .from(registrationsTable)
      .where(and(eq(registrationsTable.userId, req.user!.id), eq(registrationsTable.examId, examId)));

    if (!reg) {
      res.status(403).json({ error: "You are not registered for this exam" });
      return;
    }

    if (!isLive) {
      res.status(403).json({ error: "Exam is not currently live" });
      return;
    }
  }

  const questions = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.examId, examId))
    .orderBy(questionsTable.orderIndex);

  const userId = req.user!.id;
  const isAdmin = req.user!.isAdmin;

  // Shuffle questions per user (deterministic: same user always gets same order)
  const questionSeed = userId * 999983 + examId * 1000003;
  const shuffledQuestions = isAdmin ? questions : seededShuffle(questions, questionSeed);

  const displayKeys = ["a", "b", "c", "d"] as const;

  res.json(
    shuffledQuestions.map((q) => {
      const originalOptions = [
        { originalKey: "a", label: q.optionA },
        { originalKey: "b", label: q.optionB },
        { originalKey: "c", label: q.optionC },
        { originalKey: "d", label: q.optionD },
      ];

      // Shuffle options per user per question (deterministic)
      const optionSeed = userId * 999983 + examId * 1000003 + q.id * 7919;
      const shuffled = isAdmin ? originalOptions : seededShuffle(originalOptions, optionSeed);
      const shuffledOptions = shuffled.map((opt, idx) => ({
        key: displayKeys[idx],
        label: opt.label,
        originalKey: opt.originalKey,
      }));

      return {
        id: q.id,
        examId: q.examId,
        questionText: q.questionText,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctOption: q.correctOption,
        explanationA: q.explanationA ?? null,
        explanationB: q.explanationB ?? null,
        explanationC: q.explanationC ?? null,
        explanationD: q.explanationD ?? null,
        orderIndex: q.orderIndex,
        shuffledOptions,
      };
    })
  );
});

router.get("/exams/:examId/answer-sheet", requireAuth, async (req, res): Promise<void> => {
  const examId = parseInt(Array.isArray(req.params.examId) ? req.params.examId[0] : req.params.examId, 10);
  if (isNaN(examId)) { res.status(400).json({ error: "Invalid exam ID" }); return; }

  const [exam] = await db.select().from(examsTable).where(eq(examsTable.id, examId));
  if (!exam) { res.status(404).json({ error: "Exam not found" }); return; }

  const now = new Date();
  const isEnded = now > exam.endTime;

  if (!isEnded && !req.user!.isAdmin) {
    res.status(403).json({ error: "Answer sheet is available only after the exam ends" });
    return;
  }

  // Only for registered users who submitted
  if (!req.user!.isAdmin) {
    const [reg] = await db.select().from(registrationsTable)
      .where(and(eq(registrationsTable.userId, req.user!.id), eq(registrationsTable.examId, examId)));
    if (!reg) { res.status(403).json({ error: "You are not registered for this exam" }); return; }

    const [sub] = await db.select().from(submissionsTable)
      .where(and(eq(submissionsTable.userId, req.user!.id), eq(submissionsTable.examId, examId)));
    if (!sub) { res.status(403).json({ error: "You have not submitted this exam" }); return; }
  }

  const questions = await db.select().from(questionsTable)
    .where(eq(questionsTable.examId, examId))
    .orderBy(questionsTable.orderIndex);

  const userAnswers = await db.select().from(userAnswersTable)
    .where(and(eq(userAnswersTable.userId, req.user!.id), eq(userAnswersTable.examId, examId)));

  const answerMap = new Map(userAnswers.map((a) => [a.questionId, a.selectedOption]));

  const [submission] = await db.select().from(submissionsTable)
    .where(and(eq(submissionsTable.userId, req.user!.id), eq(submissionsTable.examId, examId)));

  res.json({
    exam: { id: exam.id, title: exam.title, category: exam.category },
    submission: submission ? {
      score: submission.score,
      totalQuestions: submission.totalQuestions,
      correctAnswers: submission.correctAnswers,
      rank: submission.rank,
      timeTakenSeconds: submission.timeTakenSeconds,
    } : null,
    questions: questions.map((q, idx) => ({
      index: idx + 1,
      id: q.id,
      questionText: q.questionText,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      correctOption: q.correctOption,
      explanationA: q.explanationA ?? null,
      explanationB: q.explanationB ?? null,
      explanationC: q.explanationC ?? null,
      explanationD: q.explanationD ?? null,
      selectedOption: answerMap.get(q.id) ?? null,
      isCorrect: !!answerMap.get(q.id) && (answerMap.get(q.id) ?? "").toLowerCase() === (q.correctOption ?? "").toLowerCase(),
      isSkipped: !answerMap.has(q.id),
    })),
  });
});

router.post("/exams/:examId/questions", requireAdmin, async (req, res): Promise<void> => {
  const examId = parseInt(Array.isArray(req.params.examId) ? req.params.examId[0] : req.params.examId, 10);
  if (isNaN(examId)) {
    res.status(400).json({ error: "Invalid exam ID" });
    return;
  }

  const parsed = AddQuestionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [question] = await db
    .insert(questionsTable)
    .values({ ...parsed.data, examId })
    .returning();

  res.status(201).json({
    id: question.id,
    examId: question.examId,
    questionText: question.questionText,
    optionA: question.optionA,
    optionB: question.optionB,
    optionC: question.optionC,
    optionD: question.optionD,
    correctOption: question.correctOption,
    explanationA: question.explanationA ?? null,
    explanationB: question.explanationB ?? null,
    explanationC: question.explanationC ?? null,
    explanationD: question.explanationD ?? null,
    orderIndex: question.orderIndex,
  });
});

router.patch("/exams/:examId/questions/:questionId", requireAdmin, async (req, res): Promise<void> => {
  const examId = parseInt(Array.isArray(req.params.examId) ? req.params.examId[0] : req.params.examId, 10);
  const questionId = parseInt(Array.isArray(req.params.questionId) ? req.params.questionId[0] : req.params.questionId, 10);

  const parsed = UpdateQuestionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [question] = await db
    .update(questionsTable)
    .set(parsed.data)
    .where(and(eq(questionsTable.id, questionId), eq(questionsTable.examId, examId)))
    .returning();

  if (!question) {
    res.status(404).json({ error: "Question not found" });
    return;
  }

  res.json({
    id: question.id,
    examId: question.examId,
    questionText: question.questionText,
    optionA: question.optionA,
    optionB: question.optionB,
    optionC: question.optionC,
    optionD: question.optionD,
    correctOption: question.correctOption,
    explanationA: question.explanationA ?? null,
    explanationB: question.explanationB ?? null,
    explanationC: question.explanationC ?? null,
    explanationD: question.explanationD ?? null,
    orderIndex: question.orderIndex,
  });
});

router.delete("/exams/:examId/questions/:questionId", requireAdmin, async (req, res): Promise<void> => {
  const examId = parseInt(Array.isArray(req.params.examId) ? req.params.examId[0] : req.params.examId, 10);
  const questionId = parseInt(Array.isArray(req.params.questionId) ? req.params.questionId[0] : req.params.questionId, 10);

  await db
    .delete(questionsTable)
    .where(and(eq(questionsTable.id, questionId), eq(questionsTable.examId, examId)));

  res.json({ success: true, message: "Question deleted" });
});

export default router;
