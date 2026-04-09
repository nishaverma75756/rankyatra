import { db, pushTokensTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import admin from "firebase-admin";
import { existsSync, readFileSync } from "fs";

let firebaseInitialized = false;

// Known file paths to try for Firebase service account (EC2 production)
const FIREBASE_FILE_PATHS = [
  "/home/ubuntu/rankyatra/service-account.json",
  process.env.FIREBASE_SERVICE_ACCOUNT_FILE,
].filter(Boolean) as string[];

function loadFirebaseServiceAccount(): object | null {
  // 1. Try reading from known file paths (avoids PM2 env var encoding issues)
  for (const filePath of FIREBASE_FILE_PATHS) {
    try {
      if (existsSync(filePath)) {
        const data = JSON.parse(readFileSync(filePath, "utf8"));
        console.log("[Push] Firebase service account loaded from file:", filePath);
        return data;
      }
    } catch {}
  }
  // 2. Fall back to env var
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getFirebaseApp(): admin.app.App | null {
  if (firebaseInitialized) return admin.app();
  const serviceAccount = loadFirebaseServiceAccount();
  if (!serviceAccount) {
    console.warn("[Push] FIREBASE_SERVICE_ACCOUNT_JSON not set — FCM direct send disabled");
    return null;
  }
  try {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount as admin.ServiceAccount) });
    firebaseInitialized = true;
    console.log("[Push] Firebase Admin initialized successfully ✓");
    return admin.app();
  } catch (err) {
    console.error("[Push] Failed to initialize Firebase Admin:", (err as Error).message);
    return null;
  }
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type PushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
};

export async function sendPushToUser(
  userId: number,
  title: string,
  body: string,
  data?: Record<string, unknown>
) {
  try {
    const tokens = await db
      .select({ token: pushTokensTable.token })
      .from(pushTokensTable)
      .where(eq(pushTokensTable.userId, userId));

    if (tokens.length === 0) return;

    const expoTokens: string[] = [];
    const fcmTokens: string[] = [];

    for (const { token } of tokens) {
      if (token.startsWith("ExponentPushToken")) {
        expoTokens.push(token);
      } else if (token.length > 20) {
        fcmTokens.push(token);
      }
    }

    // Send via Firebase Admin SDK (direct FCM) — works when app is offline
    if (fcmTokens.length > 0) {
      const app = getFirebaseApp();
      if (app) {
        const messaging = admin.messaging(app);
        const results = await Promise.allSettled(
          fcmTokens.map((token) =>
            messaging.send({
              token,
              notification: { title, body },
              data: data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : {},
              android: {
                priority: "high",
                notification: {
                  sound: "default",
                  channelId: "default",
                },
              },
            })
          )
        );
        results.forEach((r, i) => {
          if (r.status === "rejected") {
            console.error(`[Push] FCM failed for token ${fcmTokens[i]}:`, r.reason);
          }
        });
      }
    }

    // Send via Expo push service (fallback for ExponentPushTokens)
    if (expoTokens.length > 0) {
      const messages: PushMessage[] = expoTokens.map((token) => ({
        to: token,
        title,
        body,
        data: data ?? {},
        sound: "default",
      }));
      const expoRes = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
      });
      const expoJson = await expoRes.json().catch(() => null);
      console.log(`[Push] Expo push sent to ${expoTokens.length} token(s):`, JSON.stringify(expoJson));
    }

    if (expoTokens.length === 0 && fcmTokens.length === 0) {
      console.warn(`[Push] No tokens found for user ${userId}`);
    }
  } catch (err) {
    console.error("[Push] Failed to send push notification:", err);
  }
}

export async function getDisplayName(fromUserId: number): Promise<string> {
  try {
    const [user] = await db
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, fromUserId))
      .limit(1);
    return user?.name ?? "Someone";
  } catch {
    return "Someone";
  }
}
