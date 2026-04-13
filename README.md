# RankYatra — Complete Setup Guide

Full-stack exam management + social platform. pnpm monorepo with Express.js backend, React web dashboard, and Expo mobile app.

---

## Project Architecture

```
rankyatra/ (pnpm monorepo)
├── artifacts/
│   ├── api-server/          → Express.js REST API + WebSocket server (Port: $PORT / 8080)
│   ├── rankyatra/           → React + Vite web admin/dashboard (Port: $PORT / 3000)
│   └── rankyatra-mobile/    → Expo SDK 54 React Native mobile app (Port: 8099)
├── lib/
│   ├── db/                  → Drizzle ORM schema + push migrations
│   ├── api-spec/            → Shared OpenAPI spec
│   ├── api-zod/             → Zod validation schemas
│   └── api-client-react/    → React Query hooks (auto-generated from spec)
├── schema.sql               → Full DB schema (CREATE TABLE) — run on new DB
├── data_dump.sql            → All existing data (INSERTs) — seed a new DB
└── README.md                → This file
```

---

## Step 1 — Clone & Install Dependencies

```bash
# Install pnpm if not already installed
npm install -g pnpm

# Install all workspace dependencies
pnpm install
```

---

## Step 2 — Set Up Environment Secrets (Replit)

Go to **Replit Secrets** and add the following keys. NEVER hardcode these in source files.

| Secret Key | Purpose | Where to get |
|------------|---------|---------------|
| `DATABASE_URL` | PostgreSQL connection string | Auto-provided by Replit DB |
| `GOOGLE_CLIENT_ID` | Google OAuth (web login) | Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Google OAuth (web login) | Google Cloud Console |
| `EXPO_TOKEN` | EAS Build authentication | `npx expo login` then account settings |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Push notifications via FCM | Firebase Console → Project Settings → Service Accounts |
| `INSTAMOJO_API_KEY` | Payment gateway (deposits) | Instamojo dashboard |
| `INSTAMOJO_AUTH_TOKEN` | Payment gateway (deposits) | Instamojo dashboard |
| `INSTAMOJO_SALT` | Payment webhook verification | Instamojo dashboard |
| `SMTP_USER` | Email (OTP + password reset) | Your email provider SMTP credentials |
| `SMTP_PASS` | Email (OTP + password reset) | Your email provider SMTP credentials |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | File/object storage | Replit Object Storage bucket |
| `PRIVATE_OBJECT_DIR` | Private file path prefix | Replit Object Storage config |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Public file paths | Replit Object Storage config |

> **Note:** `EXPO_PUBLIC_GOOGLE_CLIENT_ID` (mobile Google OAuth) is configured in `artifacts/rankyatra-mobile/app.json` under `expo.extra`, not as a Replit secret.

---

## Step 3 — Set Up PostgreSQL Database

Replit provides a PostgreSQL database via the **Database** tab. Once created, `DATABASE_URL` is automatically set.

### Option A — Fresh database (schema only, no data)

```bash
# Push Drizzle schema to DB (creates all tables)
cd lib/db && pnpm run push
```

### Option B — Restore from dump (schema + all existing data)

```bash
# Step 1: Create all tables
psql $DATABASE_URL -f schema.sql

# Step 2: Insert all existing data
psql $DATABASE_URL -f data_dump.sql
```

> **Tip:** After restoring data, reset sequences so new IDs don't conflict:
> ```bash
> psql $DATABASE_URL -c "SELECT setval(pg_get_serial_sequence(quote_ident(t.table_name), 'id'), COALESCE(MAX(id), 1)) FROM information_schema.tables t JOIN (SELECT table_name FROM information_schema.columns WHERE column_name='id') c USING(table_name) JOIN (SELECT tablename AS table_name FROM pg_tables WHERE schemaname='public') p USING(table_name) LEFT JOIN (SELECT relname AS table_name, MAX(CASE WHEN attname='id' THEN atttypid::regtype::text END) AS idtype FROM pg_attribute JOIN pg_class ON attrelid=pg_class.oid GROUP BY relname) tp USING(table_name) WHERE tp.idtype LIKE '%int%' GROUP BY t.table_name;" 2>/dev/null || echo "Run sequences manually if needed"
> ```

---

## Step 4 — Configure Mobile App API URL

The mobile app reads `EXPO_PUBLIC_DOMAIN` to point to the API server.

Open `artifacts/rankyatra-mobile/app.json` and verify:
```json
{
  "expo": {
    "extra": {
      "EXPO_PUBLIC_DOMAIN": "your-replit-dev-domain.repl.co"
    }
  }
}
```

Or set it in a `.env` file at `artifacts/rankyatra-mobile/.env`:
```
EXPO_PUBLIC_DOMAIN=your-replit-dev-domain.repl.co
```

For production: set this to `rankyatra.in`

---

## Step 5 — Start All Services

### In Replit (Workflows auto-start all services):

| Workflow | Command | Port |
|----------|---------|------|
| API Server | `pnpm --filter @workspace/api-server run dev` | `$PORT` |
| Web App | `pnpm --filter @workspace/rankyatra run dev` | `$PORT` |
| Mobile App | `pnpm --filter @workspace/rankyatra-mobile run dev` | `8099` |

### Manually from terminal:

```bash
# API server
pnpm --filter @workspace/api-server run dev

# Web dashboard
pnpm --filter @workspace/rankyatra run dev

# Mobile (Expo)
pnpm --filter @workspace/rankyatra-mobile run dev
```

---

## Step 6 — Push DB Schema Changes (when schema files change)

Whenever you modify files in `lib/db/src/schema/`, run:

```bash
cd lib/db && pnpm run push
```

---

## Production Environment (EC2)

| Item | Value |
|------|-------|
| Domain | `rankyatra.in` |
| Server | AWS EC2 |
| Process Manager | PM2 (app name: `rankyatra-api`) |
| Database | PostgreSQL on EC2 |
| DB Name | `rankyatradb` |
| DB User | `rankyatra` |
| DB Password | `StrongPass123` |
| DB URL | `postgresql://rankyatra:StrongPass123@localhost:5432/rankyatradb` |

### EC2 Deploy Commands

```bash
# SSH into EC2 first, then:

# Deploy latest code (runs in background — safe to disconnect)
cd ~/rankyatra && setsid bash deploy.sh > deploy.log 2>&1 &

# Watch deploy progress
tail -f ~/rankyatra/deploy.log

# Push DB schema to production (only when schema changes)
cd ~/rankyatra/lib/db && DATABASE_URL="postgresql://rankyatra:StrongPass123@localhost:5432/rankyatradb" pnpm run push

# Restore data dump to production DB
psql postgresql://rankyatra:StrongPass123@localhost:5432/rankyatradb -f data_dump.sql

# PM2 commands
pm2 status                    # Check if API is running
pm2 restart rankyatra-api     # Restart API server
pm2 logs rankyatra-api        # View live logs
pm2 stop rankyatra-api        # Stop API server
```

---

## Critical Constants & Rules

| Item | Value |
|------|-------|
| Brand Color | `#f97316` (orange) |
| JWT Secret | `rankyatra-secret-key` |
| App Bundle ID | `com.niskutech.rankyatra` |
| Commission Rate | `5%` (`COMMISSION_RATE = 0.05`) |
| Reel Upload URL | Always `https://rankyatra.in/api/reels/upload` — NEVER use Replit dev proxy for this |
| Super Admin | `admin@rankyatra.com` (id=1) AND `kundansinghofficial@gmail.com` (id=8) |

### Alert System Rule (CRITICAL)
```
NEVER use Alert.alert() in mobile app.
ALWAYS use these from @/utils/alert:
  showError(title, message)
  showSuccess(title, message)
  showAlert(title, message, buttons, type)
  showConfirm(title, message, onConfirm, confirmText?, cancelText?, type?)
```

### Theme Colors Rule
```
ALWAYS use: useColors() from @/hooks/useColors
NEVER use: useThemeColors (does not exist)
```

### UI Text Rule
```
ALL user-facing text must be in English only.
NO Hinglish (mixed Hindi/English) in any UI string.
```

---

## API Server (`artifacts/api-server`)

- **Framework:** Express.js v5, TypeScript, ESM
- **Auth:** JWT Bearer token — secret: `rankyatra-secret-key`
- **WebSocket:** `ws` library (real-time chat + typing + online status)
- **ORM:** Drizzle ORM with PostgreSQL
- **Port:** Reads from `PORT` env var (required — will throw if missing)
- **Body Limit:** 50MB (base64 image/video uploads)

### Route Files

| File | Handles |
|------|---------|
| `auth.ts` | Login, signup, JWT, password hashing |
| `oauth.ts` | Google OAuth (web + mobile callback) |
| `users.ts` | User profile, search, follow/unfollow |
| `exams.ts` | Exam CRUD, status, scheduling |
| `questions.ts` | MCQ questions per exam |
| `registrations.ts` | Exam registrations + fee deduction |
| `submissions.ts` | Submissions, auto-scoring, leaderboard |
| `wallet.ts` | Wallet balance, transactions |
| `deposits.ts` | Deposit requests (Instamojo + manual) — live Instamojo polling on status check |
| `withdrawals.ts` | Withdrawal requests |
| `roles.ts` | Special roles (teacher/influencer/promoter/partner/premium/customer_support) + 5% commission |
| `groups.ts` | Study groups — creation, members, invites |
| `chat.ts` | DM conversations + messages (REST + WS) |
| `notifications.ts` | In-app notifications (push via FCM) |
| `posts.ts` | Social feed posts + likes + comments |
| `reels.ts` | Short video reels + likes + comments |
| `referral.ts` | Referral codes, link clicks, ₹20 reward |
| `leaderboard.ts` | Exam leaderboard + global leaderboard |
| `categories.ts` | Exam categories |
| `banners.ts` | Home screen banners (text or image, image upload supported) |
| `admin.ts` | Admin panel — user management, approvals, KYC |
| `support.ts` | Customer support — agent info, support conversation, feedback CRUD |
| `sitemap.ts` | Dynamic `/api/sitemap.xml` for SEO |
| `reports.ts` | User reports |
| `blocks.ts` | Block/unblock users |
| `avatar.ts` | Avatar image upload |
| `storage.ts` | File storage endpoints |
| `verify.ts` | KYC verification (govt ID + PAN) |
| `email-verification.ts` | OTP email verification |
| `password-reset.ts` | Password reset flow |
| `health.ts` | Health check (`GET /api/health`) |

### Auth Middleware
```ts
// All protected routes require:
Authorization: Bearer <jwt_token>

// userPayload() in auth.ts must always include:
// id, name, email, phone, role, avatarUrl, walletBalance, winningBalance,
// verificationStatus, canPostReels, customUid, preferences
```

---

## Mobile App (`artifacts/rankyatra-mobile`)

- **Framework:** Expo SDK 54, React Native
- **Router:** Expo Router v4 (file-based routing)
- **State:** React Context (AuthContext, ActivityCountContext, ReelsUploadContext)
- **Styling:** StyleSheet + `useColors()` hook

### Tab Bar

5 visible tabs: **Home, My Exams, Moments, Leaderboard, Profile**
Hidden tabs (no tab icon): `chat`, `wallet`, `support`

The `support` screen is accessible from:
- Profile page header (headphones icon, before Groups icon)
- Profile page → Support section → "Customer Support" menu item

### Key Files

| File | Purpose |
|------|---------|
| `contexts/AuthContext.tsx` | Auth state, token, user (includes customUid, AppState refresh) |
| `app/(tabs)/_layout.tsx` | Tab layout + OnboardingPopup |
| `app/(tabs)/index.tsx` | Home screen — banners (text or image), exams |
| `app/(tabs)/profile.tsx` | Own profile — stats, hero card, edit name, KYC badge, support header button |
| `app/(tabs)/moments.tsx` | Social feed — posts + reels |
| `app/(tabs)/joined.tsx` | My Exams tab |
| `app/(tabs)/support.tsx` | Customer support — Live Chat tab + Feedback/Suggestion tab |
| `app/user/[id].tsx` | Public user profile (posts/reels tabs, self: create + delete) |
| `app/chat/[id].tsx` | DM chat — inverted FlatList, WhatsApp style |
| `app/exam/[id].tsx` | Live exam screen |
| `app/wallet/` | Wallet, deposits, withdrawals, transaction detail |
| `app/referral.tsx` | Refer & Earn screen |
| `app/notifications.tsx` | Notifications list |
| `app/apply-for-reels.tsx` | Apply for Reel access |
| `components/OnboardingPopup.tsx` | Onboarding prompts (10s delay after login) |
| `components/ExamCard.tsx` | Exam card with answer sheet button |
| `hooks/useChatSocket.ts` | WebSocket hook for real-time chat |
| `utils/alert.ts` | Custom alert helpers |
| `hooks/useColors.ts` | Theme-aware color hook |

### Chat Screen Notes (`app/chat/[id].tsx`)
- `inverted` FlatList with `data={reversedMessages}` (newest at bottom)
- `KeyboardAvoidingView` behavior: `"padding"` on both iOS and Android
- `ListHeaderComponent` = typing indicator (appears at bottom, visually)
- Date label logic: `reversedMessages[index + 1]` = visually "above" message

### Expo SDK 54 Important Notes
```ts
// File system import — must use legacy path:
import * as FileSystem from "expo-file-system/legacy";

// Reel upload uses XHR (not fetch) for progress tracking
// Always uploads to: https://rankyatra.in/api/reels/upload
// NEVER use the Replit dev domain for reel uploads
```

### OnboardingPopup Behaviour
- Shows after **10 seconds** of login (not immediately)
- Reads latest user data via `userRef` (after server refresh completes)
- Checks in order: phone missing → preferences missing → KYC not submitted
- Each popup can be permanently dismissed via "Remind me later" (stored in AsyncStorage)
- Session guard: only one popup per app session

---

## Web App (`artifacts/rankyatra`)

- **Framework:** React + Vite
- **Styling:** Tailwind CSS v4
- **State:** TanStack React Query
- **Purpose:** Admin dashboard for managing users, exams, deposits, KYC

### Admin Pages

| Page | Route | Purpose |
|------|-------|---------|
| `AdminDashboard` | `/admin` | Main admin hub with all quick links |
| `AdminUsers` | `/admin/users` | User list |
| `AdminUserDetail` | `/admin/users/:id` | User profile — block, ban, grant admin, assign roles |
| `AdminExams` | `/admin/exams` | Exam management |
| `AdminDeposits` | `/admin/deposits` | Deposit requests |
| `AdminWithdrawals` | `/admin/withdrawals` | Withdrawal requests |
| `AdminVerifications` | `/admin/verifications` | KYC verification queue |
| `AdminBanners` | `/admin/banners` | Banner slider (text or image toggle) |
| `AdminCategories` | `/admin/categories` | Exam categories |
| `AdminRoles` | `/admin/roles` | Role holders list with filters |
| `AdminReelApplications` | `/admin/reel-applications` | Approve/reject reel access |
| `AdminBroadcast` | `/admin/broadcast` | Send push + in-app notifications |
| `AdminEmailCompose` | `/admin/email` | HTML email composer (5 templates) |
| `AdminFeedback` | `/admin/feedback` | Feedback & suggestions from users |

---

## Database Schema (Drizzle ORM / PostgreSQL)

Schema path: `lib/db/src/schema/`

### Tables

| Table | Description |
|-------|-------------|
| `users` | Core user accounts (email, phone, password hash, wallet balances, customUid, referralCode, preferences, canPostReels) |
| `exams` | Exam definitions (title, fees, prize, duration, category, status) |
| `questions` | MCQ questions per exam (4 options, correct answer) |
| `registrations` | User exam registrations (fee paid, registered timestamp) |
| `submissions` | Exam submissions + scores + rank |
| `user_answers` | Per-question answers per user per exam |
| `categories` | Exam categories |
| `banners` | Home screen banners (text or image — `imageUrl` column) |
| `posts` | Social feed posts (text + optional image) |
| `post_likes` | Post likes (userId + postId) |
| `post_comments` | Post comments (supports replies via parentId) |
| `post_comment_likes` | Likes on post comments |
| `reels` | Short video reels |
| `reel_likes` | Reel likes |
| `reel_comments` | Reel comments |
| `reel_comment_likes` | Likes on reel comments |
| `reel_applications` | Applications to get reel posting access |
| `follows` | User follow relationships |
| `conversations` | DM conversations (user pairs, isAccepted flag) |
| `messages` | Chat messages (edit + soft-delete support) |
| `muted_conversations` | Muted DM conversations per user |
| `notifications` | In-app notifications |
| `groups` | Study groups |
| `group_members` | Group membership (pending/accepted/declined) |
| `group_commission_withdrawals` | Group owner commission withdrawal requests |
| `user_roles` | Special roles: teacher / influencer / promoter / partner / premium / **customer_support** |
| `wallet_transactions` | All wallet credit/debit history |
| `wallet_deposits` | Deposit requests (Instamojo + manual) |
| `wallet_withdrawals` | Withdrawal requests |
| `payment_settings` | Admin UPI / QR code config |
| `verifications` | KYC (govt ID + PAN card photos) |
| `email_verifications` | OTP verification codes |
| `password_resets` | Password reset tokens |
| `push_tokens` | Firebase FCM tokens per device (platform + updatedAt columns) |
| `user_blocks` | Blocked users |
| `reports` | User reports (reason, details, conversationId, postId) |
| `referrals` | Referral relationships (referrer → referred user, ₹20 reward) |
| `referral_clicks` | Link click tracking per device fingerprint (anti-abuse) |
| `feedback` | User-submitted feedback and suggestions (type, message, imageUrl, status, adminNote) |

### Key Business Logic

**Wallet:**
- `walletBalance` = deposited money
- `winningBalance` = prize earnings
- `depositBalance` = computed from walletBalance

**Commission (Roles):**
- Rate: 5% of exam registration fees
- Filter: only registrations where `registeredAt >= user's role joinedAt`
- Applies to: teacher, influencer, promoter, partner, premium roles

**Referral:**
- Both referrer and referred user get ₹20 on signup
- Tracked via `referralCode` on the user, stored in `referrals` table
- Device fingerprint in `referral_clicks` to prevent abuse

**Groups:**
- Owner self-joins automatically (status = 'accepted')
- Group owners cannot leave their own group
- Commission filtered same as role commission

**KYC/Verification:**
- Status values: `not_submitted`, `pending`, `verified`, `rejected`
- KYC docs stored via Object Storage

**Customer Support:**
- Users with `customer_support` role in `user_roles` are support agents
- Support chat reuses existing `conversations` table (auto-accepted)
- First user with `customer_support` role is the active support agent
- Feedback stored in `feedback` table with image upload support
- Feedback images stored at: `uploads/feedback/` → served at `${APP_URL}/uploads/feedback/filename`

**Payment Verification (Instamojo):**
- Mobile polls `GET /api/wallet/deposits/:id` every 2 seconds
- Backend now calls Instamojo API live on each poll when status is "pending"
- Instantly credits wallet as soon as Instamojo confirms payment
- Fallback: auto-verify scheduler still runs every 3 minutes

**Leaderboard Skill Levels:**
- ≤100 pts → Beginner 🌱
- ≤200 pts → Explorer ⚡
- ≤400 pts → Warrior ⚔️
- ≤700 pts → Advanced 🔥
- >700 pts → Champion 🏆

---

## Payments

- **Gateway:** Instamojo (Indian payment gateway for deposits)
- **Manual Deposits:** Admin approves with UTR number
- **Withdrawals:** UPI only, admin processes manually
- **Webhook:** Instamojo sends callback to `/api/deposits/webhook`
- **Live Polling:** `GET /api/wallet/deposits/:id` calls Instamojo API in real-time for pending deposits

---

## Push Notifications

- **Provider:** Firebase Cloud Messaging (FCM)
- **Config:** `FIREBASE_SERVICE_ACCOUNT_JSON` secret (full JSON string)
- **Tokens:** Stored in `push_tokens` table per device
- **Sent on:** Exam reminders, reel approval/rejection, new message (when offline)

---

## Email

- **Library:** Nodemailer
- **Credentials:** `SMTP_USER` + `SMTP_PASS` secrets
- **Used for:** OTP email verification + password reset emails

---

## SEO

- `artifacts/rankyatra/public/index.html` — `lang=hi`, canonical to `rankyatra.in`, JSON-LD structured data (Organization + WebApplication + FAQPage), manifest.json link
- `artifacts/rankyatra/public/robots.txt` — allows all crawlers, sitemap link
- `artifacts/rankyatra/public/manifest.json` — PWA manifest
- `artifacts/rankyatra/public/sitemap.xml` — static sitemap (23 pages: 11 static + 12 exams)
- `GET /api/sitemap.xml` — dynamic sitemap from backend (all live exams)

---

## Database Files

| File | Purpose |
|------|---------|
| `schema.sql` | All CREATE TABLE / CREATE INDEX statements — run first on new DB |
| `data_dump.sql` | All existing data as INSERT statements — import after schema |

### Restore Full Database on New Environment

```bash
# Create all tables first
psql $DATABASE_URL -f schema.sql

# Insert all data
psql $DATABASE_URL -f data_dump.sql
```

### Re-generate These Files (when DB changes)

```bash
# Regenerate schema.sql
pg_dump $DATABASE_URL --schema-only --no-owner --no-acl -f schema.sql

# Regenerate data_dump.sql
pg_dump $DATABASE_URL --data-only --no-owner --no-acl --disable-triggers -f data_dump.sql
```

---

## Regenerate API Client (after spec changes)

```bash
cd lib/api-client-react && pnpm run codegen
```

---

## Type Check All Packages

```bash
pnpm run typecheck
```

---

## Common Issues & Fixes

| Problem | Fix |
|---------|-----|
| Expo app shows blank / won't connect | Check `EXPO_PUBLIC_DOMAIN` in app.json — must point to running API server |
| Push notifications not working | Verify `FIREBASE_SERVICE_ACCOUNT_JSON` secret is valid JSON string |
| Google OAuth fails | Verify `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` and authorized redirect URIs in Google Console |
| Payment webhook not firing | Instamojo requires a public HTTPS URL — use production domain |
| DB schema mismatch errors | Run `cd lib/db && pnpm run push` to sync schema |
| Chat extra space after keyboard closes | KAV behavior must be `"padding"` (not `"height"`) — already fixed |
| Reel upload fails in dev | Reel uploads always go to `https://rankyatra.in/api/reels/upload` regardless of env |
| `Alert.alert()` used somewhere | Replace with `showError/showConfirm/showAlert/showSuccess` from `@/utils/alert` |
| "Invalid role" when assigning role | Ensure role key is in `validRoles` array in `routes/roles.ts` |
| Payment stuck on "Verifying" | Backend now calls Instamojo live on each poll — deploy latest code |

---

## All Changes Made (Full History Since Import)

### New Database Tables

| Table | Purpose |
|-------|---------|
| `reel_applications` | Users apply for permission to post reels; admin approves/rejects |
| `referrals` | Tracks referrer → referred user relationship; ₹20 credited to both |
| `referral_clicks` | Tracks referral link clicks by device fingerprint (anti-abuse) |
| `reel_comments` | Comments on reels |
| `reel_comment_likes` | Likes on reel comments |
| `post_comment_likes` | Likes on post comments |
| `muted_conversations` | Muted DM conversations per user |
| `feedback` | User feedback and suggestions (type, message, imageUrl, status, adminNote) |

### New Columns Added to Existing Tables

| Table | New Column | Type | Notes |
|-------|-----------|------|-------|
| `users` | `can_post_reels` | boolean | Admin grants reel posting permission |
| `users` | `custom_uid` | text | User-friendly display UID (e.g. RY12345) |
| `users` | `referral_code` | text unique | Each user's unique referral code |
| `users` | `preferences` | text[] | Exam preferences selected during onboarding |
| `push_tokens` | `platform` | text | Device platform (ios/android) |
| `push_tokens` | `updated_at` | timestamptz | Last token update time |
| `reports` | `conversation_id` | integer | FK to conversations (report from chat) |
| `reports` | `post_id` | integer | FK to posts (report a post) |
| `reports` | `details` | text | Additional details text from reporter |
| `banners` | `image_url` | text | Optional image for banner (replaces text if set) |

### New Backend Routes

| Route | Purpose |
|-------|---------|
| `GET /api/support/agent` | Returns first user with `customer_support` role |
| `POST /api/support/conversation` | Creates/retrieves support chat conversation (auto-accepted) |
| `POST /api/feedback` | Submit feedback or suggestion with optional image |
| `GET /api/admin/feedback` | Admin: list all feedback with user info |
| `PUT /api/admin/feedback/:id` | Admin: update status + add note |
| `DELETE /api/admin/feedback/:id` | Admin: delete feedback |
| `GET /api/sitemap.xml` | Dynamic sitemap from live exam data |

### Mobile App Changes

1. **OnboardingPopup** (`components/OnboardingPopup.tsx`)
   - Delay: 2s → **10 seconds** after login
   - Uses `userRef` to read latest server-refreshed user data

2. **Chat Screen** (`app/chat/[id].tsx`)
   - `KeyboardAvoidingView` behavior: `"height"` → **`"padding"`** (both platforms)

3. **Reel Access** (`app/apply-for-reels.tsx`)
   - Application status auto-syncs `canPostReels` into AuthContext

4. **AuthContext** (`contexts/AuthContext.tsx`)
   - `customUid` added; `AppState` listener refreshes user on foreground

5. **Wallet / Share** (`app/wallet/transaction-detail.tsx`, `app/exam/result.tsx`)
   - Android: `IntentLauncher` for share image+text; iOS: `Share.share()`

6. **Profile Screen** (`app/(tabs)/profile.tsx`)
   - Displays `customUid`; headphones 🎧 header button opens Customer Support
   - Support section in menu has "Customer Support" as first item

7. **Support Screen** (`app/(tabs)/support.tsx`) — **NEW**
   - Tab 1 Live Chat: opens conversation with support agent via existing chat system
   - Tab 2 Feedback: submit text + optional image as feedback/suggestion

8. **Tab Layout** (`app/(tabs)/_layout.tsx`)
   - Support tab hidden from tab bar (`href: null`)
   - Navigate to support via profile header or profile menu

9. **Home Screen** (`app/(tabs)/index.tsx`)
   - Full-width image banners when `imageUrl` is set on a banner

10. **Leaderboard** — Skill level badges added (Beginner/Explorer/Warrior/Advanced/Champion)

11. **Referral** (`app/referral.tsx`)
    - Referred users list with avatar, status pill, join date

### Web App (Admin) Changes

1. **AdminBanners** — Text/image toggle, image upload (1200×375px PNG recommended), preview
2. **AdminFeedback** (`/admin/feedback`) — **NEW** — full CRUD with status management, filter tabs, image viewer, admin notes drawer
3. **AdminDashboard** — "Feedback & Suggestions" quick link button added
4. **AdminUserDetail** — **Live Support** role added to ASSIGN ROLES section (headphones icon, blue)
5. **AdminRoles** — Live Support filter tab added, shown in role holders list
6. **Home** (`src/pages/Home.tsx`) — Image banners rendered full-width

### API Server Changes

1. **deposits.ts** — `GET /wallet/deposits/:id` now calls Instamojo API live for pending deposits → instant payment confirmation
2. **roles.ts** — `customer_support` added to `validRoles` list for assign/revoke
3. **banners.ts** — `imageUrl` field added; image upload endpoint for banners
4. **support.ts** — New route file for customer support + feedback
5. **sitemap.ts** — Dynamic sitemap generation from DB

### SEO Setup (rankyatra.in)

- `index.html`: `lang=hi`, canonical, JSON-LD (Organization + WebApplication + FAQPage), OG tags
- `robots.txt`, `manifest.json`, `sitemap.xml` added to `public/`
- Dynamic `/api/sitemap.xml` from backend
- Google Search Console: verified + sitemap submitted

---

## Recent Changes (Session 2 — April 2026)

### New Columns Added to Existing Tables

| Table | New Column | Type | Notes |
|-------|-----------|------|-------|
| `conversations` | `is_accepted` | boolean | Whether message request has been accepted |
| `conversations` | `initiated_by` | integer | User ID who started the conversation |

### API Server Changes

1. **posts.ts** — All 3 post queries (`feed`, `user posts`, `single post`) now return `isPremium: boolean` via SQL EXISTS subquery on `user_roles`
2. **users.ts** — Public user profile endpoint now returns `isPremium: boolean` for the profile user
3. **chat.ts** — Both `/chat/conversations` and `/chat/requests` endpoints now return `isPremium: boolean` in the `otherUser` object
4. **deposits.ts** — Deposit limit calculation (`getDepositTotal`) changed from blacklist to **whitelist** approach: only `instamojo` and `manual` payment methods count toward the ₹100/day and ₹3000/month limit. Rewards, admin credits, referral bonuses are automatically excluded.

### Mobile App Changes

12. **Premium PostCard animation** (`app/(tabs)/moments.tsx`, `app/user/[id].tsx`)
    - Premium user posts show animated gold border cycling through `#f59e0b → #fbbf24 → #f97316 → #fbbf24 → #f59e0b`
    - Animation uses `useNativeDriver: false` (borderColor not supported by native driver)
    - Crown emoji 👑 removed from all premium avatar locations

13. **Premium hero card** (`app/(tabs)/profile.tsx`, `app/user/[id].tsx`)
    - Premium users get luxury deep purple gradient hero background (`#0f0a1e → #4c1d95`)
    - Animated gold ring around avatar (`Animated.View` with `position: absolute, top/left/right/bottom: -2.5`)
    - Ring cycles gold → yellow → orange → yellow → gold
    - Outer plain `View` wrapper handles margins; `Animated.View` uses `position: absolute` to show border outside `overflow: hidden` card
    - Removed static `borderWidth` from `avatarImage` style to fix double-ring bug

14. **Chat premium indicators** (`app/(tabs)/chat.tsx`, `app/chat/[id].tsx`)
    - Chat list: premium contacts show gold avatar ring, gold left border strip on conversation row, ⭐ badge next to name
    - Chat screen header: premium contact's avatar shows gold ring, ⭐ badge next to name in header
    - Received message bubbles from premium users: dark purple background (`#1a0a2e`) with gold border (`#f59e0b`)
    - Small inline avatar next to received messages also shows gold ring for premium senders
    - `OtherUser` interface in both files extended with `isPremium?: boolean`

### Key Business Logic Updates

**Deposit Limits (Whitelist Approach):**
- Daily limit: ₹100 per user
- Monthly limit: ₹3,000 per user
- Counted: only `paymentMethod IN ('instamojo', 'manual')` and `status != 'rejected'`
- NOT counted: referral bonuses, admin wallet credits, winning rewards, any future payment type

**Premium User Display:**
- `isPremium` is computed server-side via `EXISTS(SELECT 1 FROM user_roles WHERE user_id = ? AND role = 'premium')`
- Returned in: feed posts, user profiles, chat conversations
- Mobile app shows gold borders/badges wherever premium users appear
