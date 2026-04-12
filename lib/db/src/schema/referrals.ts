import { pgTable, serial, integer, boolean, timestamp, text } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const referralsTable = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrer_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  referredId: integer("referred_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  bonusPaid: boolean("bonus_paid").notNull().default(false),
  fraudBlocked: boolean("fraud_blocked").notNull().default(false),
  deviceFingerprint: text("device_fingerprint"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Referral = typeof referralsTable.$inferSelect;
