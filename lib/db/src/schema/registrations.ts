import { pgTable, serial, timestamp, integer, decimal, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { examsTable } from "./exams";

export const registrationsTable = pgTable("registrations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  examId: integer("exam_id").notNull().references(() => examsTable.id, { onDelete: "cascade" }),
  amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }).notNull().default("5.00"),
  registeredAt: timestamp("registered_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("unique_user_exam").on(t.userId, t.examId),
]);

export const insertRegistrationSchema = createInsertSchema(registrationsTable).omit({
  id: true,
  registeredAt: true,
});
export type InsertRegistration = z.infer<typeof insertRegistrationSchema>;
export type Registration = typeof registrationsTable.$inferSelect;
