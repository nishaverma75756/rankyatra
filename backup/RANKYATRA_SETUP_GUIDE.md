# RankYatra — Complete New Replit Setup Guide

## Project Structure

```
rankyatra/ (pnpm monorepo)
├── artifacts/
│   ├── api-server/        ← Express backend (port 8080)
│   ├── rankyatra/         ← React + Vite web frontend
│   └── rankyatra-mobile/  ← Expo React Native mobile app
├── lib/
│   ├── db/                ← Drizzle ORM schema + DB client
│   ├── api-client-react/  ← Shared API fetch utilities
│   └── shared/            ← Shared types/utils
└── backup/                ← DB backups (this folder)
```

---

## Step 1 — Replit Setup

1. Naya Replit banao (Node.js template ya blank)
2. Git se project clone karo ya zip upload karo
3. Replit mein **Secrets** tab mein ye sab environment variables add karo:

### Required Environment Variables (Secrets)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (neeche dekho) |
| `SESSION_SECRET` | Random 64-char string (kuch bhi type karo) |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | Replit Object Storage Bucket ID |
| `PRIVATE_OBJECT_DIR` | Private storage directory name |
| `PUBLIC_OBJECT_SEARCH_KEY` | Public storage search key |

---

## Step 2 — Database Setup

### Option A: Replit PostgreSQL (Recommended)
1. Replit ke **Database** tab mein jao
2. "Create Database" click karo
3. Automatically `DATABASE_URL` secret set ho jayega

### Option B: External DB (Neon, Supabase, etc.)
```
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
```

### Database Restore (Backup se)
```bash
# Naya fresh DB mein full backup restore karo:
psql $DATABASE_URL < backup/rankyatra_full_backup.sql

# Ya sirf schema chahiye (bina data ke):
psql $DATABASE_URL < backup/rankyatra_schema_only.sql
```

### Database Push (Schema sync — fresh DB mein)
```bash
cd lib/db && pnpm run push
```

---

## Step 3 — Dependencies Install

```bash
# Root se saari packages install karo
pnpm install
```

---

## Step 4 — Google OAuth Setup

1. [Google Cloud Console](https://console.cloud.google.com/) jao
2. New Project banao ya existing use karo
3. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client IDs**
4. Application type: **Web application**
5. Authorized redirect URIs mein add karo:
   ```
   https://YOUR_REPLIT_DOMAIN/api/auth/google/callback
   https://rankyatra.in/api/auth/google/callback   ← production ke liye
   ```
6. Client ID aur Secret Replit Secrets mein daalo

---

## Step 5 — Replit Object Storage Setup

1. Replit ke **Storage** tab mein jao
2. "Create Bucket" click karo
3. Bucket ID copy karo → `DEFAULT_OBJECT_STORAGE_BUCKET_ID` secret mein daalo
4. `PRIVATE_OBJECT_DIR` = `"private"` (ya kuch bhi)
5. `PUBLIC_OBJECT_SEARCH_KEY` = bucket ka public search key

---

## Step 6 — Workflows Configure

Replit mein 4 workflows banao:

### Workflow 1: API Server
- **Name**: `artifacts/api-server: API Server`
- **Command**: `pnpm --filter @workspace/api-server run dev`

### Workflow 2: Web Frontend
- **Name**: `artifacts/rankyatra: web`
- **Command**: `pnpm --filter @workspace/rankyatra run dev`

### Workflow 3: Mobile (Expo)
- **Name**: `artifacts/rankyatra-mobile: expo`
- **Command**: `pnpm --filter @workspace/rankyatra-mobile run dev`

### Workflow 4: Component Preview (Canvas)
- **Name**: `artifacts/mockup-sandbox: Component Preview Server`
- **Command**: `pnpm --filter @workspace/mockup-sandbox run dev`

---

## Step 7 — Mobile App (EAS + Push Notifications)

### EAS Account Setup
```bash
# EAS CLI install karo
npm install -g eas-cli

# Login karo (rankyatra account se)
eas login

# EAS se link karo
cd artifacts/rankyatra-mobile
eas init --id bbb5d5c2-3437-47d7-b53b-9d438e859888
```

### app.json mein ye hona chahiye:
```json
{
  "expo": {
    "name": "RankYatra",
    "slug": "rankyatra",
    "owner": "rankyatra",
    "extra": {
      "eas": {
        "projectId": "bbb5d5c2-3437-47d7-b53b-9d438e859888"
      }
    }
  }
}
```

### EAS Build
```bash
# Development build (Expo Go alternative)
eas build --platform android --profile development

# Production APK
eas build --platform android --profile preview

# Production AAB (Play Store ke liye)
eas build --platform android --profile production
```

### Push Notifications
- Push notifications **automatic** kaam kare ga jab EAS build ho
- `expo-notifications` already installed hai
- DB mein `push_tokens` table hai
- API endpoint: `POST /api/users/push-token`
- Push token format: `ExponentPushToken[...]`

---

## Step 8 — EC2 Production Deploy

### EC2 Server pe ye commands:
```bash
# Pehli baar setup
ssh ubuntu@YOUR_EC2_IP
cd ~
git clone https://github.com/YOUR_REPO/rankyatra.git
cd rankyatra
npm install -g pnpm
pnpm install

# .env file banao EC2 pe
cat > .env << 'EOF'
DATABASE_URL=postgresql://...
SESSION_SECRET=your_secret_here
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
# etc...
EOF

# Deploy script chalao
bash deploy.sh
```

### Regular updates (EC2 pe):
```bash
cd ~/rankyatra && git pull origin main && bash deploy.sh
```

---

## Key Config Files

### `artifacts/api-server/src/index.ts`
- API server entry point
- Port: `process.env.PORT || 8080`
- WebSocket server yahan start hota hai
- Exam reminder scheduler yahan start hota hai

### `artifacts/rankyatra-mobile/app.json`
```json
{
  "expo": {
    "slug": "rankyatra",        ← MUST be "rankyatra"
    "owner": "rankyatra",      ← MUST be "rankyatra"
    "projectId": "bbb5d5c2-3437-47d7-b53b-9d438e859888"
  }
}
```

### `artifacts/rankyatra-mobile/.env` (local dev)
```
EXPO_PUBLIC_DOMAIN=YOUR_REPLIT_DOMAIN_WITHOUT_HTTPS
```

---

## Important Notes

### UID Format
```typescript
`UID-RY${String(id).padStart(10, "0")}`
// Example: UID-RY0000000014
```

### Tier System
| Points | Tier |
|--------|------|
| 0–100 | Beginner 🌱 |
| 101–200 | Explorer ⚡ |
| 201–400 | Warrior ⚔️ |
| 401–700 | Advanced 🔥 |
| 700+ | Champion 🏆 |

### Brand Color
- Orange: `#f97316`

### Custom Alert System (Mobile)
- **NEVER use** `Alert.alert` from react-native
- **ALWAYS use** `showAlert/showSuccess/showError/showConfirm` from `@/utils/alert`
- `AppAlert` component `_layout.tsx` mein mounted hai

### EAS-Only Packages (Expo Go mein KAAM NAHI KARTE)
- `expo-glass-effect`
- `expo-symbols`
- `react-native-keyboard-controller`

### Exam Reminder Schedule
- 15 min pehle → push notification
- 10 min pehle → push notification
- 5 min pehle → push notification
- Live hone pe → push notification
- Dedup in-memory set ke through (restart pe reset)

---

## Database Tables List

```
users               ← user accounts
exams               ← exam/contest data
questions           ← exam questions
submissions         ← exam submissions
user_answers        ← per-question answers
registrations       ← exam registrations
categories          ← exam categories
posts               ← moments/social posts
post_comments       ← post comments + replies
post_likes          ← post likes
post_comment_likes  ← comment likes
follows             ← follow relationships
notifications       ← in-app notifications
push_tokens         ← expo push tokens
conversations       ← chat conversations
messages            ← chat messages
user_blocks         ← block list
reports             ← post/user reports
wallet_transactions ← wallet history
wallet_deposits     ← deposit requests
wallet_withdrawals  ← withdrawal requests
banners             ← homepage banners
verifications       ← KYC documents
email_verifications ← email OTP
password_resets     ← password reset tokens
```

---

## Troubleshooting

### DB push error
```bash
cd lib/db && pnpm run push
# Agar error aaye:
cd lib/db && pnpm run push --force
```

### pnpm install fail
```bash
# Cache clear karo
pnpm store prune
pnpm install
```

### Expo app domain change
`artifacts/rankyatra-mobile/.env` mein update karo:
```
EXPO_PUBLIC_DOMAIN=new-replit-domain.replit.dev
```

### WebSocket not connecting
API server ka domain `EXPO_PUBLIC_DOMAIN` se match karna chahiye

### Google OAuth redirect error
Google Cloud Console mein naya Replit domain add karo authorized redirect URIs mein

---

*Backup created: April 2026*
*Database: PostgreSQL 16*
*Stack: Node.js 24, pnpm, Drizzle ORM, Expo SDK 52, React 19, Vite 7*
