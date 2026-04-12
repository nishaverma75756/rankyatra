import { Router, type IRouter } from "express";
import {
  db,
  registrationsTable,
  submissionsTable,
  examsTable,
  usersTable,
  walletTransactionsTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { sendContestJoinEmail } from "../lib/email";

const router: IRouter = Router();

router.post("/exams/:examId/register", requireAuth, async (req, res): Promise<void> => {
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

  const now = new Date();
  if (now >= exam.endTime) {
    res.status(400).json({ error: "Exam has already ended" });
    return;
  }

  // Check already registered
  const [existing] = await db
    .select()
    .from(registrationsTable)
    .where(and(eq(registrationsTable.userId, req.user!.id), eq(registrationsTable.examId, examId)));

  if (existing) {
    res.status(400).json({ error: "Already registered for this exam" });
    return;
  }

  // Check wallet balance
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  const balance = parseFloat(user.walletBalance);
  const fee = parseFloat(exam.entryFee);

  if (balance < fee) {
    res.status(400).json({ error: "Insufficient wallet balance. Please add funds." });
    return;
  }

  // Deduct fee and register
  const newBalance = (balance - fee).toFixed(2);

  await db.update(usersTable).set({ walletBalance: newBalance }).where(eq(usersTable.id, req.user!.id));

  await db.insert(walletTransactionsTable).values({
    userId: req.user!.id,
    amount: fee.toFixed(2),
    type: "debit",
    description: `Exam registration: ${exam.title}`,
    balanceAfter: newBalance,
  });

  const [registration] = await db
    .insert(registrationsTable)
    .values({ userId: req.user!.id, examId, amountPaid: exam.entryFee })
    .returning();

  try {
    await sendContestJoinEmail(user.email, user.name, exam.title, exam.entryFee, exam.startTime, newBalance, examId, registration.id);
  } catch (err) { console.error("Contest join email failed:", err); }

  res.status(201).json({
    id: registration.id,
    userId: registration.userId,
    examId: registration.examId,
    registeredAt: registration.registeredAt.toISOString(),
    amountPaid: registration.amountPaid,
  });
});

router.get("/exams/:examId/registration-status", requireAuth, async (req, res): Promise<void> => {
  const examId = parseInt(Array.isArray(req.params.examId) ? req.params.examId[0] : req.params.examId, 10);
  if (isNaN(examId)) {
    res.status(400).json({ error: "Invalid exam ID" });
    return;
  }

  const [reg] = await db
    .select()
    .from(registrationsTable)
    .where(and(eq(registrationsTable.userId, req.user!.id), eq(registrationsTable.examId, examId)));

  const [sub] = await db
    .select()
    .from(submissionsTable)
    .where(and(eq(submissionsTable.userId, req.user!.id), eq(submissionsTable.examId, examId)));

  res.json({
    isRegistered: !!reg,
    hasSubmitted: !!sub,
    registeredAt: reg?.registeredAt?.toISOString() ?? null,
  });
});

router.get("/registrations/my", requireAuth, async (req, res): Promise<void> => {
  const registrations = await db
    .select()
    .from(registrationsTable)
    .where(eq(registrationsTable.userId, req.user!.id))
    .orderBy(desc(registrationsTable.registeredAt));

  const results = await Promise.all(
    registrations.map(async (reg) => {
      const [exam] = await db.select().from(examsTable).where(eq(examsTable.id, reg.examId));
      if (!exam) return null;

      const now = new Date();
      let status: "upcoming" | "live" | "completed" = "upcoming";
      if (now >= exam.startTime && now <= exam.endTime) status = "live";
      else if (now > exam.endTime) status = "completed";

      const [sub] = await db
        .select()
        .from(submissionsTable)
        .where(and(eq(submissionsTable.userId, req.user!.id), eq(submissionsTable.examId, reg.examId)));

      return {
        id: reg.id,
        examId: reg.examId,
        registeredAt: reg.registeredAt.toISOString(),
        amountPaid: reg.amountPaid,
        hasSubmitted: !!sub,
        exam: {
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
        },
      };
    })
  );

  res.json(results.filter(Boolean));
});

export default router;
