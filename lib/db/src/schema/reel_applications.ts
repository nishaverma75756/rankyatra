import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const reelApplications = pgTable("reel_applications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  instagramHandle: text("instagram_handle"),
  youtubeChannel: text("youtube_channel"),
  facebookHandle: text("facebook_handle"),
  twitterHandle: text("twitter_handle"),
  contentType: text("content_type"),
  reason: text("reason").notNull().default(""),
  status: text("status").notNull().default("pending"),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
