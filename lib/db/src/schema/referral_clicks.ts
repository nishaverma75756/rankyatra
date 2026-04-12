import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const referralClicksTable = pgTable("referral_clicks", {
  id: serial("id").primaryKey(),
  referralCode: text("referral_code").notNull(),
  ip: text("ip"),
  deviceFingerprint: text("device_fingerprint"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ReferralClick = typeof referralClicksTable.$inferSelect;
