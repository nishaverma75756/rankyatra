import { Router, type IRouter } from "express";
import { db, examsTable, questionsTable, registrationsTable, submissionsTable } from "@workspace/db";
import { eq, count, and, sql } from "drizzle-orm";
import { requireAuth, requireAdmin, optionalAuth } from "../middlewares/auth";
import { CreateExamBody, UpdateExamBody } from "@workspace/api-zod";

const router: IRouter = Router();

function examStatus(startTime: Date, endTime: Date): "upcoming" | "live" | "completed" {
  const now = new Date();
  if (now < startTime) return "upcoming";
  if (now >= startTime && now <= endTime) return "live";
  return "completed";
}

async function buildExamResponse(exam: typeof examsTable.$inferSelect, userId?: number) {
  const [qCount] = await db.select({ count: count() }).from(questionsTable).where(eq(questionsTable.examId, exam.id));
  const [rCount] = await db.select({ count: count() }).from(registrationsTable).where(eq(registrationsTable.examId, exam.id));

  const computedStatus = examStatus(exam.startTime, exam.endTime);

  return {
    id: exam.id,
    title: exam.title,
    category: exam.category,
    startTime: exam.startTime.toISOString(),
    endTime: exam.endTime.toISOString(),
    entryFee: exam.entryFee,
    status: computedStatus,
    solutionPdfUrl: computedStatus === "completed" ? exam.solutionPdfUrl : null,
    questionCount: qCount?.count ?? 0,
    registeredCount: rCount?.count ?? 0,
    prizePool: exam.prizePool,
    createdAt: exam.createdAt.toISOString(),
  };
}

router.get("/exams", optionalAuth, async (req, res): Promise<void> => {
  const { status, category } = req.query;
  const exams = await db.select().from(examsTable);

  const results = await Promise.all(
    exams.map(async (exam) => buildExamResponse(exam, req.user?.id))
  );

  let filtered = results;
  if (status) filtered = filtered.filter((e) => e.status === status);
  if (category && typeof category === "string") {
    filtered = filtered.filter((e) => e.category?.toLowerCase() === category.toLowerCase());
  }

  res.json(filtered);
});

router.post("/exams", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateExamBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { title, category, startTime, endTime, entryFee, prizePool, solutionPdfUrl } = parsed.data;

  const [exam] = await db
    .insert(examsTable)
    .values({
      title,
      category,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      entryFee: entryFee,
      prizePool: prizePool,
      solutionPdfUrl: solutionPdfUrl ?? null,
    })
    .returning();

  const response = await buildExamResponse(exam);
  res.status(201).json(response);
});

router.get("/exams/:examId", optionalAuth, async (req, res): Promise<void> => {
  const examId = parseInt(Array.isArray(req.params.examId) ? req.params.examId[0] : req.params.examId, 10);
  if (isNaN(examId)) {
    res.status(400).json({ error: "Invalid exam ID" });
    return;
  }

  const [exam] = await db.select().from(examsTable).where(eq(examsTable.id, examId));
  if (!exam) {
    res.status(404).json({ error: "Exam not found" });
    return;
  }

  const base = await buildExamResponse(exam, req.user?.id);

  let isRegistered = false;
  let hasSubmitted = false;
  let myResult = null;

  if (req.user) {
    const [reg] = await db
      .select()
      .from(registrationsTable)
      .where(and(eq(registrationsTable.userId, req.user.id), eq(registrationsTable.examId, examId)));
    isRegistered = !!reg;

    const [sub] = await db
      .select()
      .from(submissionsTable)
      .where(and(eq(submissionsTable.userId, req.user.id), eq(submissionsTable.examId, examId)));
    hasSubmitted = !!sub;

    if (sub) {
      myResult = {
        id: sub.id,
        userId: sub.userId,
        examId: sub.examId,
        score: sub.score,
        totalQuestions: sub.totalQuestions,
        correctAnswers: sub.correctAnswers,
        timeTakenSeconds: sub.timeTakenSeconds,
        rank: sub.rank,
        submittedAt: sub.submittedAt.toISOString(),
      };
    }
  }

  res.json({
    ...base,
    isRegistered,
    hasSubmitted,
    myResult,
  });
});

router.patch("/exams/:examId", requireAdmin, async (req, res): Promise<void> => {
  const examId = parseInt(Array.isArray(req.params.examId) ? req.params.examId[0] : req.params.examId, 10);
  if (isNaN(examId)) {
    res.status(400).json({ error: "Invalid exam ID" });
    return;
  }

  const parsed = UpdateExamBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Partial<typeof examsTable.$inferInsert> = {};
  const d = parsed.data;
  if (d.title !== undefined) updates.title = d.title;
  if (d.category !== undefined) updates.category = d.category;
  if (d.startTime !== undefined) updates.startTime = new Date(d.startTime);
  if (d.endTime !== undefined) updates.endTime = new Date(d.endTime);
  if (d.entryFee !== undefined) updates.entryFee = d.entryFee;
  if (d.prizePool !== undefined) updates.prizePool = d.prizePool;
  if (d.solutionPdfUrl !== undefined) updates.solutionPdfUrl = d.solutionPdfUrl ?? null;

  const [exam] = await db.update(examsTable).set(updates).where(eq(examsTable.id, examId)).returning();
  if (!exam) {
    res.status(404).json({ error: "Exam not found" });
    return;
  }

  const response = await buildExamResponse(exam);
  res.json(response);
});

router.delete("/exams/:examId", requireAdmin, async (req, res): Promise<void> => {
  const examId = parseInt(Array.isArray(req.params.examId) ? req.params.examId[0] : req.params.examId, 10);
  if (isNaN(examId)) {
    res.status(400).json({ error: "Invalid exam ID" });
    return;
  }

  await db.delete(examsTable).where(eq(examsTable.id, examId));
  res.json({ success: true, message: "Exam deleted" });
});

export default router;
