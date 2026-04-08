import { pgTable, serial, integer, numeric, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const walletDepositsTable = pgTable("wallet_deposits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  utrNumber: varchar("utr_number", { length: 100 }),
  paymentMethod: varchar("payment_method", { length: 20 }).notNull().default("manual"),
  paymentRequestId: varchar("payment_request_id", { length: 100 }),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const paymentSettingsTable = pgTable("payment_settings", {
  id: serial("id").primaryKey(),
  qrCodeUrl: text("qr_code_url"),
  upiId: varchar("upi_id", { length: 100 }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
