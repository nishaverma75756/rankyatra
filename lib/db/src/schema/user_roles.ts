import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const USER_ROLES = ["teacher", "influencer", "promoter", "partner", "premium"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const userRolesTable = pgTable("user_roles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  role: text("role").$type<UserRole>().notNull(),
  assignedBy: integer("assigned_by").references(() => usersTable.id),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type UserRoleRow = typeof userRolesTable.$inferSelect;
