import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const reels = pgTable("reels", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  videoUrl: text("video_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  caption: text("caption").notNull().default(""),
  likeCount: integer("like_count").notNull().default(0),
  commentCount: integer("comment_count").notNull().default(0),
  viewCount: integer("view_count").notNull().default(0),
  category: text("category"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reelLikes = pgTable("reel_likes", {
  id: serial("id").primaryKey(),
  reelId: integer("reel_id").notNull(),
  userId: integer("user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
