import { pgTable, text, serial, integer, timestamp, decimal, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ADMIN_PERMISSIONS = [
  "users",
  "exams",
  "deposits",
  "withdrawals",
  "kyc",
  "reports",
  "banners",
  "categories",
  "roles",
] as const;
export type AdminPermission = typeof ADMIN_PERMISSIONS[number];

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  googleId: text("google_id").unique(),
  facebookId: text("facebook_id").unique(),
  walletBalance: decimal("wallet_balance", { precision: 10, scale: 2 }).notNull().default("0.00"),
  winningBalance: decimal("winning_balance", { precision: 10, scale: 2 }).notNull().default("0.00"),
  avatarUrl: text("avatar_url"),
  isAdmin: boolean("is_admin").notNull().default(false),
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
  adminPermissions: text("admin_permissions").array().notNull().default([]),
  isBlocked: boolean("is_blocked").notNull().default(false),
  phone: text("phone"),
  govtId: text("govt_id"),
  panCardUrl: text("pan_card_url"),
  emailVerified: boolean("email_verified").notNull().default(false),
  verificationStatus: text("verification_status").notNull().default("not_submitted"),
  customUid: integer("custom_uid").unique(),
  showOnlineStatus: boolean("show_online_status").notNull().default(true),
  referralCode: text("referral_code").unique(),
  referredById: integer("referred_by_id"),
  registrationIp: text("registration_ip"),
  canPostReels: boolean("can_post_reels").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
