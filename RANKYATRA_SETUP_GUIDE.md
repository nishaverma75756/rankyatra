# RankYatra — Dusre Replit Setup Guide

> Is guide ko follow karke naya Replit bilkul same taraf se setup kar sakte ho jaise ye wala hai.

---

## STEP 1: GitHub Se Code Clone Karo

Naye Replit mein **Import from GitHub** karo:
```
https://github.com/[your-repo]/rankyatra
```

---

## STEP 2: Database Restore Karo (Replit PostgreSQL)

Replit mein **PostgreSQL database** already available hai.  
Backup file: `backups/rankyatra_full_backup_20260409.sql`

### Restore command (Replit Shell mein):
```bash
psql $DATABASE_URL < backups/rankyatra_full_backup_20260409.sql
```

---

## STEP 3: Secrets Set Karo

Replit ke **Secrets** (Environment Variables) section mein ye sab add karo:

| Secret Name | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | `781971539091-qon9vjmlnpvsjvijfs1oimthbo33ec0b.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | *(EC2 `.env` file se lo)* |
| `INSTAMOJO_API_KEY` | `a6c2c2c60308188017b86271f147931e` |
| `INSTAMOJO_AUTH_TOKEN` | `d49007c9da5701653b5a1fbd097649d6` |
| `INSTAMOJO_SALT` | `e18d3b6ba1ec4f02ae9b5beb1b0a8365` |
| `SMTP_USER` | *(EC2 `.env` file se lo)* |
| `SMTP_PASS` | *(EC2 `.env` file se lo)* |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | *(EC2 `service-account.json` ka content paste karo)* |
| `EXPO_TOKEN` | *(expo.dev se generate karo — Account → Access Tokens)* |

---

## STEP 4: lib/db `.env` File Banao

```bash
# lib/db/.env
DATABASE_URL=postgresql://postgres:password@helium/heliumdb?sslmode=disable
```

> **Note:** Replit pe `helium` Postgres ka hostname hota hai, aur password `password` hoti hai (default Replit PostgreSQL).

---

## STEP 5: DB Schema Push Karo

```bash
cd lib/db && pnpm run push
```

---

## STEP 6: Dependencies Install Karo

```bash
pnpm install
```

---

## STEP 7: Workflows Setup Karo (Replit Workflows)

Replit mein 2 workflows banao:

### Workflow 1 — Web App
- **Name:** `artifacts/rankyatra: web`
- **Command:**
```bash
pnpm --filter @workspace/rankyatra run dev
```

### Workflow 2 — Mobile (Expo)
- **Name:** `artifacts/rankyatra-mobile: expo`
- **Command:**
```bash
pnpm --filter @workspace/rankyatra-mobile run dev
```

### Workflow 3 — API Server
- **Name:** `artifacts/api-server: API Server`
- **Command:**
```bash
pnpm --filter @workspace/api-server run dev
```

---

## STEP 8: EC2 Pe Deploy Karna

### EC2 `.env` file (~/rankyatra/.env) mein ye hona chahiye:
```env
GOOGLE_CLIENT_SECRET=your_google_client_secret
INSTAMOJO_API_KEY=a6c2c2c60308188017b86271f147931e
INSTAMOJO_AUTH_TOKEN=d49007c9da5701653b5a1fbd097649d6
INSTAMOJO_SALT=e18d3b6ba1ec4f02ae9b5beb1b0a8365
SMTP_USER=your_smtp_email
SMTP_PASS=your_smtp_password
```

### EC2 pe Firebase Service Account:
```bash
# Ye file banana hai EC2 pe
nano ~/rankyatra/service-account.json
# Firebase Console se download kiya hua JSON paste karo
```

### Deploy Command (EC2 SSH mein):
```bash
cd ~/rankyatra && git pull origin main && setsid bash deploy.sh > deploy.log 2>&1 &
```

### Deploy Log Check Karna:
```bash
tail -f ~/rankyatra/deploy.log
```

### Deploy Status Check:
```bash
pm2 status
pm2 logs rankyatra-api --lines 50
```

---

## STEP 9: Android APK Build Karna (Expo)

### Option A — expo.dev website se (Recommended):
1. [expo.dev](https://expo.dev) pe login karo (Account: `kundan7781`)
2. Project `rankyatra` open karo
3. **Builds → New Build** karo
4. Platform: **Android**, Profile: **preview**
5. 15-20 min mein APK ready

### Option B — Command se:
```bash
cd artifacts/rankyatra-mobile
npx eas-cli build --platform android --profile preview --non-interactive
```

---

## Important Info

| Item | Value |
|---|---|
| **EC2 API Port** | `8080` |
| **Production URL** | `https://rankyatra.in` |
| **OAuth Callback** | `https://rankyatra.niskutech.com` |
| **DB Name (EC2)** | `rankyatradb` |
| **DB User (EC2)** | `rankyatra` |
| **DB Pass (EC2)** | `StrongPass123` |
| **Expo Project ID** | `a04e437e-68e7-40e6-871c-15c6a209f2f3` |
| **Expo Owner** | `kundan7781` |
| **Android Package** | `com.kundan7781.rankyatra` |
| **PM2 App Name** | `rankyatra-api` |

---

## Mobile App — Important Rules

- **NEVER** use `Alert.alert()` — hamesha `showAlert/showConfirm/showError` use karo `@/utils/alert` se
- Brand color: `#f97316` (orange)
- `users` table mein `rank_points` column NAHI hai — kabhi query mat karna
- Middleware path: `../middlewares/auth` (with 's')
- Backend body limit: 50MB
- Video storage: base64 data URL directly `video_url` column mein store hoti hai

---

## Monorepo Structure

```
rankyatra/
├── artifacts/
│   ├── rankyatra/          ← React + Vite Web App
│   ├── rankyatra-mobile/   ← Expo React Native Mobile App
│   └── api-server/         ← Express.js Backend API
├── lib/
│   └── db/                 ← Drizzle ORM + PostgreSQL Schema
├── deploy.sh               ← EC2 Full Deploy Script
├── ecosystem.config.js     ← PM2 Config for EC2
└── backups/                ← Database Backups
```

---

## DB Schema Push (Naye Schema Changes Ke Liye)

```bash
cd lib/db && pnpm run push
```

> Kabhi manually SQL migration mat likhna — hamesha `pnpm run push` use karo.
