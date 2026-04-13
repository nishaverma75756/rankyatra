import { db, examsTable, registrationsTable, pushTokensTable, notificationsTable } from "@workspace/db";
import { eq, and, gte, lte } from "drizzle-orm";
import { broadcastToUser } from "./ws";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// Track already-sent reminders to avoid duplicates (examId-milestone)
const sentReminders = new Set<string>();

const MILESTONES = [
  { label: "15min", offsetMs: 15 * 60 * 1000, title: "⏰ Exam 15 minute mein!", body: (name: string) => `"${name}" sirf 15 minute baad shuru hoga! Taiyaar ho jao!` },
  { label: "10min", offsetMs: 10 * 60 * 1000, title: "⚡ Exam 10 minute mein!", body: (name: string) => `"${name}" 10 minute mein start hoga. Jaldi login karo!` },
  { label: "5min",  offsetMs:  5 * 60 * 1000, title: "🔔 Sirf 5 minute bache!", body: (name: string) => `"${name}" ab 5 minute mein shuru hoga!` },
  { label: "live",  offsetMs:  0,              title: "🚀 Exam LIVE hai!",      body: (name: string) => `"${name}" ab LIVE ho gaya hai! Abhi join karo!` },
];

const WINDOW_MS = 60 * 1000; // ±1 minute window

async function sendBatchPush(tokens: string[], title: string, body: string, data: Record<string, unknown>) {
  const validTokens = tokens.filter((t) => t.startsWith("ExponentPushToken"));
  if (validTokens.length === 0) return;

  // Expo allows max 100 messages per request
  for (let i = 0; i < validTokens.length; i += 100) {
    const batch = validTokens.slice(i, i + 100).map((to) => ({
      to,
      title,
      body,
      data,
      sound: "default",
    }));
    await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(batch),
    }).catch(() => {});
  }
}

async function checkAndSendReminders() {
  const now = Date.now();

  for (const milestone of MILESTONES) {
    // Find exams whose startTime is within [offsetMs - WINDOW_MS, offsetMs + WINDOW_MS] from now
    const targetMin = new Date(now + milestone.offsetMs - WINDOW_MS);
    const targetMax = new Date(now + milestone.offsetMs + WINDOW_MS);

    try {
      const exams = await db
        .select({ id: examsTable.id, title: examsTable.title })
        .from(examsTable)
        .where(
          and(
            gte(examsTable.startTime, targetMin),
            lte(examsTable.startTime, targetMax)
          )
        );

      for (const exam of exams) {
        const key = `${exam.id}-${milestone.label}`;
        if (sentReminders.has(key)) continue;
        sentReminders.add(key);

        // Get all registered users and their push tokens
        const rows = await db
          .select({ userId: registrationsTable.userId, token: pushTokensTable.token })
          .from(registrationsTable)
          .leftJoin(pushTokensTable, eq(pushTokensTable.userId, registrationsTable.userId))
          .where(eq(registrationsTable.examId, exam.id));

        const userIds = [...new Set(rows.map((r) => r.userId))];
        const tokens = rows.map((r) => r.token).filter((t): t is string => !!t);

        // Save in-app notification + broadcast real-time badge update for each registered user
        for (const uid of userIds) {
          await db.insert(notificationsTable).values({
            userId: uid,
            type: "exam_reminder",
            examId: exam.id,
            title: milestone.title,
            body: milestone.body(exam.title),
          }).catch(() => {});
          broadcastToUser(uid, JSON.stringify({
            type: "notification",
            notifType: "exam_reminder",
            examId: exam.id,
            milestone: milestone.label,
            examTitle: exam.title,
          }));
        }

        // Push notification to devices
        if (tokens.length > 0) {
          await sendBatchPush(
            tokens,
            milestone.title,
            milestone.body(exam.title),
            { type: "exam_reminder", examId: exam.id, milestone: milestone.label }
          );
        }

        console.log(`[ExamReminder] Sent ${milestone.label} reminder for exam ${exam.id} to ${userIds.length} users`);
      }
    } catch (err) {
      console.error(`[ExamReminder] Error checking ${milestone.label} reminders:`, err);
    }
  }

  // Clean up very old entries from sentReminders (>2 hours old keys are safe to remove)
  // We do this by size cap — if over 1000 entries, clear half
  if (sentReminders.size > 1000) {
    const entries = [...sentReminders];
    entries.slice(0, 500).forEach((k) => sentReminders.delete(k));
  }
}

export function startExamReminderScheduler() {
  console.log("[ExamReminder] Scheduler started — checking every 60 seconds");
  // Run immediately on start, then every 60 seconds
  checkAndSendReminders();
  setInterval(checkAndSendReminders, 60 * 1000);
}
