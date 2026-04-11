-- ============================================================
-- RankYatra — PostgreSQL Schema Dump
-- Generated: April 2026
-- DB: rankyatradb | User: rankyatra
-- Connection: postgresql://rankyatra:StrongPass123@localhost:5432/rankyatradb
-- ORM: Drizzle ORM (lib/db/src/schema/)
-- Push command: cd ~/rankyatra/lib/db && DATABASE_URL="..." pnpm run push
-- ============================================================

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS "users" (
  "id" serial PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "password_hash" text,
  "google_id" text UNIQUE,
  "facebook_id" text UNIQUE,
  "wallet_balance" decimal(10,2) NOT NULL DEFAULT '0.00',
  "winning_balance" decimal(10,2) NOT NULL DEFAULT '0.00',
  "avatar_url" text,
  "is_admin" boolean NOT NULL DEFAULT false,
  "is_blocked" boolean NOT NULL DEFAULT false,
  "phone" text,
  "govt_id" text,
  "pan_card_url" text,
  "email_verified" boolean NOT NULL DEFAULT false,
  "verification_status" text NOT NULL DEFAULT 'not_submitted',
  "show_online_status" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- EMAIL VERIFICATIONS (OTP)
-- ============================================================
CREATE TABLE IF NOT EXISTS "email_verifications" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "otp" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "used" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- PASSWORD RESETS
-- ============================================================
CREATE TABLE IF NOT EXISTS "password_resets" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "used" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- PUSH TOKENS (Firebase FCM)
-- ============================================================
CREATE TABLE IF NOT EXISTS "push_tokens" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token" text NOT NULL,
  "platform" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- KYC VERIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS "verifications" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id"),
  "govt_id" text NOT NULL,
  "pan_card_url" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "admin_note" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- USER ROLES (teacher | influencer | promoter | partner | premium)
-- ============================================================
CREATE TABLE IF NOT EXISTS "user_roles" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" text NOT NULL,
  "assigned_by" integer REFERENCES "users"("id"),
  "assigned_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz DEFAULT now()
);

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS "categories" (
  "id" serial PRIMARY KEY,
  "name" text NOT NULL UNIQUE,
  "display_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- BANNERS
-- ============================================================
CREATE TABLE IF NOT EXISTS "banners" (
  "id" serial PRIMARY KEY,
  "title" text NOT NULL,
  "subtitle" text NOT NULL DEFAULT '',
  "emoji" text NOT NULL DEFAULT '⚡',
  "bg_from" text NOT NULL DEFAULT '#f97316',
  "bg_to" text NOT NULL DEFAULT '#ea580c',
  "link_url" text NOT NULL DEFAULT '/',
  "link_label" text NOT NULL DEFAULT 'Join Now',
  "display_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- EXAMS
-- ============================================================
CREATE TABLE IF NOT EXISTS "exams" (
  "id" serial PRIMARY KEY,
  "title" text NOT NULL,
  "category" text NOT NULL,
  "start_time" timestamptz NOT NULL,
  "end_time" timestamptz NOT NULL,
  "entry_fee" decimal(10,2) NOT NULL DEFAULT '5.00',
  "status" text NOT NULL DEFAULT 'upcoming',
  "solution_pdf_url" text,
  "prize_pool" decimal(10,2) NOT NULL DEFAULT '0.00',
  "rewards_distributed" text NOT NULL DEFAULT 'false',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
-- status values: upcoming | live | completed

-- ============================================================
-- QUESTIONS (MCQ)
-- ============================================================
CREATE TABLE IF NOT EXISTS "questions" (
  "id" serial PRIMARY KEY,
  "exam_id" integer NOT NULL REFERENCES "exams"("id") ON DELETE CASCADE,
  "question_text" text NOT NULL,
  "option_a" text NOT NULL,
  "option_b" text NOT NULL,
  "option_c" text NOT NULL,
  "option_d" text NOT NULL,
  "correct_option" text NOT NULL,
  "explanation_a" text,
  "explanation_b" text,
  "explanation_c" text,
  "explanation_d" text,
  "order_index" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
-- correct_option values: A | B | C | D

-- ============================================================
-- REGISTRATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS "registrations" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "exam_id" integer NOT NULL REFERENCES "exams"("id") ON DELETE CASCADE,
  "amount_paid" decimal(10,2) NOT NULL DEFAULT '5.00',
  "registered_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "unique_user_exam" UNIQUE ("user_id", "exam_id")
);

-- ============================================================
-- SUBMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS "submissions" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "exam_id" integer NOT NULL REFERENCES "exams"("id") ON DELETE CASCADE,
  "score" integer NOT NULL DEFAULT 0,
  "total_questions" integer NOT NULL DEFAULT 0,
  "correct_answers" integer NOT NULL DEFAULT 0,
  "time_taken_seconds" integer NOT NULL DEFAULT 0,
  "rank" integer,
  "submitted_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "unique_user_exam_submission" UNIQUE ("user_id", "exam_id")
);

-- ============================================================
-- USER ANSWERS (per question)
-- ============================================================
CREATE TABLE IF NOT EXISTS "user_answers" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "exam_id" integer NOT NULL REFERENCES "exams"("id") ON DELETE CASCADE,
  "question_id" integer NOT NULL REFERENCES "questions"("id") ON DELETE CASCADE,
  "selected_option" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "unique_user_exam_question" UNIQUE ("user_id", "exam_id", "question_id")
);
-- selected_option: A | B | C | D | NULL (skipped)

-- ============================================================
-- WALLET TRANSACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS "wallet_transactions" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "amount" decimal(10,2) NOT NULL,
  "type" text NOT NULL,
  "description" text NOT NULL,
  "balance_after" decimal(10,2) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
-- type values: credit | debit

-- ============================================================
-- WALLET DEPOSITS
-- ============================================================
CREATE TABLE IF NOT EXISTS "wallet_deposits" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id"),
  "amount" numeric(10,2) NOT NULL,
  "utr_number" varchar(100),
  "payment_method" varchar(20) NOT NULL DEFAULT 'manual',
  "payment_request_id" varchar(100),
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "admin_note" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
-- payment_method: manual | instamojo
-- status: pending | approved | rejected

-- ============================================================
-- PAYMENT SETTINGS (Admin UPI / QR Code)
-- ============================================================
CREATE TABLE IF NOT EXISTS "payment_settings" (
  "id" serial PRIMARY KEY,
  "qr_code_url" text,
  "upi_id" varchar(100),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- ============================================================
-- WALLET WITHDRAWALS
-- ============================================================
CREATE TABLE IF NOT EXISTS "wallet_withdrawals" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id"),
  "amount" numeric(10,2) NOT NULL,
  "payment_method" varchar(20) NOT NULL DEFAULT 'upi',
  "payment_details" text,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "admin_utr_number" varchar(100),
  "admin_note" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
-- status: pending | approved | rejected

-- ============================================================
-- GROUPS
-- ============================================================
CREATE TABLE IF NOT EXISTS "groups" (
  "id" serial PRIMARY KEY,
  "owner_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "photo_url" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- GROUP MEMBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS "group_members" (
  "id" serial PRIMARY KEY,
  "group_id" integer NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'pending',
  "invited_at" timestamptz NOT NULL DEFAULT now(),
  "joined_at" timestamptz
);
-- status values: pending | accepted | declined
-- Self-join: status = 'accepted', joined_at = now() immediately
-- Group owners cannot join/leave their own group

-- ============================================================
-- GROUP COMMISSION WITHDRAWALS
-- ============================================================
CREATE TABLE IF NOT EXISTS "group_commission_withdrawals" (
  "id" serial PRIMARY KEY,
  "group_id" integer NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "owner_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "amount" decimal(10,2) NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "utr_number" text,
  "upi_id" text,
  "requested_at" timestamptz NOT NULL DEFAULT now(),
  "processed_at" timestamptz
);
-- status: pending | approved | rejected

-- ============================================================
-- CONVERSATIONS (DM)
-- ============================================================
CREATE TABLE IF NOT EXISTS "conversations" (
  "id" serial PRIMARY KEY,
  "user1_id" integer NOT NULL REFERENCES "users"("id"),
  "user2_id" integer NOT NULL REFERENCES "users"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_for_user1" boolean NOT NULL DEFAULT false,
  "deleted_for_user2" boolean NOT NULL DEFAULT false
);

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS "messages" (
  "id" serial PRIMARY KEY,
  "conversation_id" integer NOT NULL REFERENCES "conversations"("id"),
  "sender_id" integer NOT NULL REFERENCES "users"("id"),
  "content" text NOT NULL,
  "is_read" boolean NOT NULL DEFAULT false,
  "delivered_at" timestamptz,
  "read_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "edited_at" timestamptz,
  "is_deleted_for_sender" boolean NOT NULL DEFAULT false,
  "is_deleted_for_receiver" boolean NOT NULL DEFAULT false,
  "is_deleted_for_everyone" boolean NOT NULL DEFAULT false
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type" varchar(50) NOT NULL,
  "from_user_id" integer REFERENCES "users"("id") ON DELETE CASCADE,
  "post_id" integer,
  "comment_id" integer,
  "exam_id" integer,
  "is_read" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "title" text,
  "body" text,
  "data" text
);

-- ============================================================
-- FOLLOWS
-- ============================================================
CREATE TABLE IF NOT EXISTS "follows" (
  "follower_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "following_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("follower_id", "following_id")
);

-- ============================================================
-- POSTS
-- ============================================================
CREATE TABLE IF NOT EXISTS "posts" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "content" text NOT NULL,
  "image_url" text,
  "view_count" integer NOT NULL DEFAULT 0,
  "share_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "edited_at" timestamp
);

-- ============================================================
-- POST LIKES
-- ============================================================
CREATE TABLE IF NOT EXISTS "post_likes" (
  "id" serial PRIMARY KEY,
  "post_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- ============================================================
-- POST COMMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS "post_comments" (
  "id" serial PRIMARY KEY,
  "post_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- ============================================================
-- REELS
-- ============================================================
CREATE TABLE IF NOT EXISTS "reels" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL,
  "video_url" text NOT NULL,
  "thumbnail_url" text,
  "caption" text NOT NULL DEFAULT '',
  "like_count" integer NOT NULL DEFAULT 0,
  "comment_count" integer NOT NULL DEFAULT 0,
  "view_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- ============================================================
-- REEL LIKES
-- ============================================================
CREATE TABLE IF NOT EXISTS "reel_likes" (
  "id" serial PRIMARY KEY,
  "reel_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- ============================================================
-- USER BLOCKS
-- ============================================================
CREATE TABLE IF NOT EXISTS "user_blocks" (
  "id" serial PRIMARY KEY,
  "blocker_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "blocked_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- REPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS "reports" (
  "id" serial PRIMARY KEY,
  "reporter_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "reported_user_id" integer,
  "reported_post_id" integer,
  "reported_reel_id" integer,
  "reason" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "created_at" timestamptz NOT NULL DEFAULT now()
);
-- status: pending | reviewed | dismissed
