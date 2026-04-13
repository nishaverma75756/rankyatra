import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";

export const bannersTable = pgTable("banners", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull().default(""),
  emoji: text("emoji").notNull().default("⚡"),
  bgFrom: text("bg_from").notNull().default("#f97316"),
  bgTo: text("bg_to").notNull().default("#ea580c"),
  linkUrl: text("link_url").notNull().default("/"),
  linkLabel: text("link_label").notNull().default("Join Now"),
  imageUrl: text("image_url"),
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
