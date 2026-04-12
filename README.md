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
| `deposits.ts` | Deposit requests (Instamojo + manual) |
| `withdrawals.ts` | Withdrawal requests |
| `roles.ts` | Special roles (teacher/influencer/promoter/partner/premium) + 5% commission |
| `groups.ts` | Study groups — creation, members, invites |
| `chat.ts` | DM conversations + messages (REST + WS) |
| `notifications.ts` | In-app notifications (push via FCM) |
| `posts.ts` | Social feed posts + likes + comments |
| `reels.ts` | Short video reels + likes + comments |
| `referral.ts` | Referral codes, link clicks, ₹20 reward |
| `leaderboard.ts` | Exam leaderboard + global leaderboard |
| `categories.ts` | Exam categories |
| `banners.ts` | Home screen promotional banners |
| `admin.ts` | Admin panel — user management, approvals, KYC |
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

### Key Files

| File | Purpose |
|------|---------|
| `contexts/AuthContext.tsx` | Auth state, token, user (includes customUid, AppState refresh) |
| `app/(tabs)/_layout.tsx` | Tab layout + OnboardingPopup |
| `app/(tabs)/index.tsx` | Home screen — banners, exams |
| `app/(tabs)/profile.tsx` | Own profile — stats, hero card, edit name, KYC badge |
| `app/(tabs)/moments.tsx` | Social feed — posts + reels |
| `app/(tabs)/joined.tsx` | My Exams tab |
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

---

## Database Schema (Drizzle ORM / PostgreSQL)

Schema path: `lib/db/src/schema/`

### Tables

| Table | Description |
|-------|-------------|
| `users` | Core user accounts (email, phone, password hash, wallet balances, customUid, referralCode) |
| `exams` | Exam definitions (title, fees, prize, duration, category, status) |
| `questions` | MCQ questions per exam (4 options, correct answer) |
| `registrations` | User exam registrations (fee paid, registered timestamp) |
| `submissions` | Exam submissions + scores + rank |
| `user_answers` | Per-question answers per user per exam |
| `categories` | Exam categories |
| `banners` | Home screen promotional banners |
| `posts` | Social feed posts (text + optional image) |
| `post_likes` | Post likes (userId + postId) |
| `post_comments` | Post comments (supports replies via parentId) |
| `reels` | Short video reels |
| `reel_likes` | Reel likes |
| `reel_comments` | Reel comments |
| `reel_applications` | Applications to get reel posting access |
| `follows` | User follow relationships |
| `conversations` | DM conversations (user pairs) |
| `messages` | Chat messages (edit + soft-delete support) |
| `notifications` | In-app notifications |
| `groups` | Study groups |
| `group_members` | Group membership (pending/accepted/declined) |
| `group_commission_withdrawals` | Group owner commission withdrawal requests |
| `user_roles` | Special roles (teacher/influencer/promoter/partner/premium) |
| `wallet_transactions` | All wallet credit/debit history |
| `wallet_deposits` | Deposit requests (Instamojo + manual) |
| `wallet_withdrawals` | Withdrawal requests |
| `payment_settings` | Admin UPI / QR code config |
| `verifications` | KYC (govt ID + PAN card photos) |
| `email_verifications` | OTP verification codes |
| `password_resets` | Password reset tokens |
| `push_tokens` | Firebase FCM tokens per device |
| `user_blocks` | Blocked users |
| `reports` | User reports |
| `referrals` | Referral relationships (referrer → referred user) |
| `referral_clicks` | Link click tracking (device fingerprint) |

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

---

## Payments

- **Gateway:** Instamojo (Indian payment gateway for deposits)
- **Manual Deposits:** Admin approves with UTR number
- **Withdrawals:** UPI only, admin processes manually
- **Webhook:** Instamojo sends callback to `/api/deposits/webhook`

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

---

## Recent Changes (Latest Sessions)

1. **OnboardingPopup** — 10s delay, reads latest user data via `userRef`, timer cleanup on logout
2. **Chat KAV** — Changed behavior from `"height"` to `"padding"` on Android — fixes blank space after keyboard close
3. **Referred Users UI** — Redesigned with avatar initials, icon+count header, cleaner status pills
4. **Reel Access Notifications** — Admin approve/reject sends FCM push + in-app notification
5. **customUid** — Added to AuthUser interface, `AppState` listener refreshes user on foreground
6. **Wallet + Result Share** — Image+text share: Android uses `IntentLauncher`, iOS uses `Share.share`
7. **Commission Fix** — All 4 role commission endpoints filter `registeredAt >= joinedAt`
