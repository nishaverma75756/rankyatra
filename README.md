# RankYatra — Project Reference

Full-stack exam management + social platform. pnpm monorepo with Express backend, React web app, and Expo mobile app.

---

## Architecture Overview

```
rankyatra/ (pnpm monorepo)
├── artifacts/
│   ├── api-server/          → Express.js REST API + WebSocket server
│   ├── rankyatra/           → React + Vite web admin/dashboard
│   └── rankyatra-mobile/    → Expo (React Native) mobile app
├── lib/
│   ├── db/                  → Drizzle ORM schema + migrations
│   ├── api-spec/            → Shared OpenAPI spec
│   ├── api-zod/             → Zod validation schemas
│   └── api-client-react/    → React Query hooks (auto-generated)
```

---

## Production Environment (EC2)

| Item | Value |
|------|-------|
| Domain | `rankyatra.in` |
| Process Manager | PM2 (`rankyatra-api`) |
| Database | PostgreSQL (`rankyatradb`) |
| DB User | `rankyatra` |
| DB Password | `StrongPass123` |
| DB URL | `postgresql://rankyatra:StrongPass123@localhost:5432/rankyatradb` |

### Deploy Commands (EC2)

```bash
# Deploy latest code
cd ~/rankyatra && setsid bash deploy.sh > deploy.log 2>&1 &

# Watch deploy logs
tail -f ~/rankyatra/deploy.log

# Push DB schema changes (only if schema changed)
cd ~/rankyatra/lib/db && DATABASE_URL="postgresql://rankyatra:StrongPass123@localhost:5432/rankyatradb" pnpm run push
```

---

## Critical Rules & Constants

| Item | Value |
|------|-------|
| Brand Color | `#f97316` (orange) |
| JWT / Session Secret | `rankyatra-secret-key` |
| App Bundle ID | `com.niskutech.rankyatra` |
| Commission Rate | `5%` (`COMMISSION_RATE = 0.05`) |
| Reel Upload URL | Always `https://rankyatra.in/api/reels/upload` — NEVER Replit dev proxy |
| Alert System | NEVER use `Alert.alert()` — always use `showError/showConfirm/showAlert/showSuccess` from `@/utils/alert` |

### `showConfirm` Signature
```ts
showConfirm(title, message, onConfirm, confirmText?, cancelText?, type?)
```

---

## Environment Secrets (Replit)

| Secret | Purpose |
|--------|---------|
| `GOOGLE_CLIENT_ID` | Google OAuth (web) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth (web) |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth (mobile) |
| `EXPO_TOKEN` | EAS Build authentication |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Push notifications via Firebase |
| `INSTAMOJO_API_KEY` | Payment gateway |
| `INSTAMOJO_AUTH_TOKEN` | Payment gateway |
| `INSTAMOJO_SALT` | Payment webhook verification |
| `SMTP_USER` | Email sending |
| `SMTP_PASS` | Email sending |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | Object/file storage |
| `PRIVATE_OBJECT_DIR` | Private file storage path |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Public file storage paths |

---

## API Server (`artifacts/api-server`)

- **Framework:** Express.js v5, TypeScript, ESM
- **Auth:** JWT (Bearer token) — secret: `rankyatra-secret-key`
- **WebSocket:** `ws` library for real-time chat
- **ORM:** Drizzle ORM with PostgreSQL
- **Port:** Reads from `PORT` env var
- **Body Limit:** 50MB (for base64 image/video uploads)

### Route Files

| File | Handles |
|------|---------|
| `auth.ts` | Login, signup, password hashing |
| `oauth.ts` | Google + Facebook OAuth |
| `users.ts` | User profile, search, follow |
| `exams.ts` | Exam CRUD, status management |
| `questions.ts` | Exam questions CRUD |
| `registrations.ts` | Exam registrations + fee deduction |
| `submissions.ts` | Exam submissions, scoring, ranking |
| `wallet.ts` | Wallet balance, transactions |
| `deposits.ts` | Deposit requests (Instamojo + manual) |
| `withdrawals.ts` | Withdrawal requests |
| `roles.ts` | User roles (teacher/influencer/promoter/partner/premium) + commission |
| `groups.ts` | Group creation, members, invites |
| `chat.ts` | DM conversations + messages |
| `notifications.ts` | In-app notifications |
| `posts.ts` | Social feed posts |
| `reels.ts` | Short video reels |
| `leaderboard.ts` | Exam + global leaderboards |
| `categories.ts` | Exam categories |
| `banners.ts` | Home screen banners |
| `admin.ts` | Admin panel endpoints |
| `reports.ts` | User reports |
| `blocks.ts` | User blocking |
| `avatar.ts` | Avatar upload |
| `storage.ts` | File storage/upload |
| `verify.ts` | KYC verification |
| `email-verification.ts` | OTP email verification |
| `password-reset.ts` | Password reset flow |
| `health.ts` | Health check |

---

## Mobile App (`artifacts/rankyatra-mobile`)

- **Framework:** Expo SDK 54, React Native
- **Router:** Expo Router (file-based routing)
- **State:** React Context + local `useState`
- **Styling:** StyleSheet + custom `useTheme()` hook

### Key Files

| File | Purpose |
|------|---------|
| `app/(tabs)/index.tsx` | Home screen — banners, exams |
| `app/(tabs)/profile.tsx` | Own profile — stats dashboard, hero card |
| `app/(tabs)/explore.tsx` | Explore/search |
| `app/user/[id].tsx` | Public user profile — posts/reels tabs, self: create boxes + delete |
| `app/chat/[id].tsx` | DM chat — inverted FlatList (WhatsApp style) |
| `app/group-dashboard.tsx` | Group admin + member management |
| `app/groups-explore.tsx` | Browse/join/leave groups |
| `app/exam/[id].tsx` | Live exam screen |
| `app/wallet/` | Wallet, deposits, withdrawals |
| `app/notifications.tsx` | Notifications list |
| `contexts/ReelsUploadContext.tsx` | Reel video upload (XHR to production URL) |
| `components/ExamCard.tsx` | Exam card — answer sheet button (live vs ended) |
| `utils/alert.ts` | Custom alert helpers (ALWAYS use instead of Alert.alert) |

### Chat Implementation Details
- `inverted` FlatList with `data={reversedMessages}`
- Typing indicator in `ListHeaderComponent`
- `KeyboardAvoidingView` behavior: `padding` (iOS) / `undefined` (Android)
- `softwareKeyboardLayoutMode: "resize"` in app.json (Android)
- Date label logic: `reversedMessages[index + 1]` = visually above message

### Expo File System Note
- SDK 54: use `expo-file-system/legacy` import
- Reel upload uses XHR (not fetch) for progress tracking

---

## Web App (`artifacts/rankyatra`)

- **Framework:** React + Vite
- **Styling:** Tailwind CSS v4
- **State:** TanStack React Query

---

## Database Schema (Drizzle ORM / PostgreSQL)

### Tables Summary

| Table | Description |
|-------|-------------|
| `users` | Core user accounts |
| `exams` | Exam definitions |
| `questions` | MCQ questions per exam |
| `registrations` | User exam registrations (fee paid) |
| `submissions` | Exam submissions + scores |
| `user_answers` | Per-question answers per user per exam |
| `categories` | Exam categories |
| `banners` | Home screen promotional banners |
| `posts` | Social feed posts |
| `post_likes` | Post likes (userId + postId) |
| `post_comments` | Post comments |
| `reels` | Short video reels |
| `reel_likes` | Reel likes |
| `follows` | User follow relationships |
| `conversations` | DM conversations (user pairs) |
| `messages` | Chat messages |
| `notifications` | In-app notifications |
| `groups` | Study groups |
| `group_members` | Group membership (pending/accepted/declined) |
| `group_commission_withdrawals` | Group owner commission withdrawal requests |
| `user_roles` | Special roles (teacher/influencer/promoter/partner/premium) |
| `wallet_transactions` | All wallet credit/debit history |
| `wallet_deposits` | Deposit requests |
| `wallet_withdrawals` | Withdrawal requests |
| `payment_settings` | Admin UPI / QR code config |
| `verifications` | KYC (govt ID + PAN card) |
| `email_verifications` | OTP verification codes |
| `password_resets` | Password reset tokens |
| `push_tokens` | Firebase FCM tokens per device |
| `user_blocks` | Blocked users |
| `reports` | User reports |

### User Roles
```
teacher | influencer | promoter | partner | premium
```
- Commission rate: **5%** of exam fees from referred users
- Commission only counts for registrations **after** user joined (i.e. `registeredAt >= joinedAt`)

### Group Logic
- Self-join: auto-accepted (status = 'accepted', joinedAt = now)
- Group owners CANNOT join/leave their own group
- Commission filter: `registeredAt >= joinedAt` (applied in all 4 role commission endpoints)

---

## Payments

- **Gateway:** Instamojo (for deposits)
- **Manual Deposits:** Admin approves with UTR number
- **Withdrawals:** UPI only, admin processes manually
- **Wallet:** Two balances — `walletBalance` (deposited) + `winningBalance` (prize earnings)

---

## Push Notifications

- **Provider:** Firebase Cloud Messaging (FCM)
- **Service Account:** `FIREBASE_SERVICE_ACCOUNT_JSON` secret
- Tokens stored in `push_tokens` table per device

---

## Email

- **Library:** Nodemailer
- **Credentials:** `SMTP_USER` + `SMTP_PASS` secrets
- Used for: OTP verification, password reset

---

## Recent Changes (Latest Session)

1. **Chat UX** — Inverted FlatList, WhatsApp-style scroll, typing indicator in header
2. **Profile Page** — Removed 3-tab layout; stats always visible; hero card navigates to own public profile; "View Profile →" button
3. **User Profile (`/user/[id]`)** — Create Post + Create Reel dashed boxes (own profile); 3-dot delete menu on own posts/reels with confirmation; instant local removal via `deletedPostIds`/`deletedReelIds`
4. **Hinglish → English** — All user-facing text converted to professional English across: login, signup, oauth-callback, notifications, group-dashboard, groups-explore, ReelsUploadContext, user/[id]
5. **Commission Fix** — All 4 role commission endpoints now filter `registeredAt >= joinedAt`

---

## Useful Commands (Replit Dev)

```bash
# Start all services
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/rankyatra run dev
pnpm --filter @workspace/rankyatra-mobile run dev

# Push DB schema to local DB
cd lib/db && pnpm run push

# Type check all packages
pnpm run typecheck
```
