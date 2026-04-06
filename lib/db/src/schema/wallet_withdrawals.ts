import { pgTable, serial, integer, numeric, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const walletWithdrawalsTable = pgTable("wallet_withdrawals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 20 }).notNull().default("upi"),
  paymentDetails: text("payment_details"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  adminUtrNumber: varchar("admin_utr_number", { length: 100 }),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
