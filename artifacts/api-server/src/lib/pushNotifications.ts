import { db, pushTokensTable, usersTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
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
  categoryId?: string;
  image?: string;
};

type PushOptions = {
  category?: "message" | "default";
  channelId?: string;
  imageUrl?: string;
};

export async function sendPushToUser(
  userId: number,
  title: string,
  body: string,
  data?: Record<string, unknown>,
  options: PushOptions = {}
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

    const isMessage = options.category === "message";
    const channelId = options.channelId ?? (isMessage ? "messages" : "default");

    // Send via Firebase Admin SDK (direct FCM) — works when app is offline
    if (fcmTokens.length > 0) {
      const app = getFirebaseApp();
      if (app) {
        const messaging = admin.messaging(app);
        const fcmData: Record<string, string> = data
          ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
          : {};
        if (options.category) fcmData["categoryId"] = options.category;

        const androidNotif: admin.messaging.AndroidNotification = {
          sound: "default",
          channelId,
          ...(options.imageUrl ? { imageUrl: options.imageUrl } : {}),
        };

        const results = await Promise.allSettled(
          fcmTokens.map((token) =>
            messaging.send({
              token,
              notification: {
                title,
                body,
                ...(options.imageUrl ? { imageUrl: options.imageUrl } : {}),
              },
              data: fcmData,
              android: {
                priority: "high",
                notification: androidNotif,
              },
            })
          )
        );
        const staleTokens: string[] = [];
        results.forEach((r, i) => {
          if (r.status === "rejected") {
            const errCode = (r.reason as any)?.code ?? "";
            if (
              errCode === "messaging/registration-token-not-registered" ||
              errCode === "messaging/invalid-registration-token"
            ) {
              staleTokens.push(fcmTokens[i]);
            } else {
              console.error(`[Push] FCM failed for token ${fcmTokens[i]}:`, r.reason);
            }
          }
        });
        if (staleTokens.length > 0) {
          await db.delete(pushTokensTable).where(inArray(pushTokensTable.token, staleTokens)).catch(() => {});
          console.log(`[Push] Removed ${staleTokens.length} stale FCM token(s)`);
        }
      }
    }

    // Send via Expo push service (fallback for ExponentPushTokens)
    // Send each token individually to avoid PUSH_TOO_MANY_EXPERIENCE_IDS error
    if (expoTokens.length > 0) {
      const staleExpoTokens: string[] = [];
      await Promise.allSettled(expoTokens.map(async (token) => {
        const message: PushMessage = {
          to: token,
          title,
          body,
          data: data ?? {},
          sound: "default",
          ...(options.category ? { categoryId: options.category } : {}),
          ...(options.imageUrl ? { image: options.imageUrl } : {}),
        };
        try {
          const expoRes = await fetch(EXPO_PUSH_URL, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Accept-Encoding": "gzip, deflate",
              "Content-Type": "application/json",
            },
            body: JSON.stringify([message]),
          });
          const expoJson = await expoRes.json().catch(() => null);
          const result = expoJson?.data?.[0];
          if (result?.status === "error") {
            const errCode = result?.details?.error;
            if (errCode === "DeviceNotRegistered" || errCode === "InvalidCredentials") {
              staleExpoTokens.push(token);
            } else {
              console.warn(`[Push] Expo error for token ${token.slice(0, 30)}:`, errCode, result?.message);
            }
          }
        } catch (e) {
          console.error(`[Push] Expo fetch failed for token ${token.slice(0, 30)}:`, e);
        }
      }));
      console.log(`[Push] Expo push attempted for ${expoTokens.length} token(s)`);
      if (staleExpoTokens.length > 0) {
        await db.delete(pushTokensTable).where(inArray(pushTokensTable.token, staleExpoTokens)).catch(() => {});
        console.log(`[Push] Removed ${staleExpoTokens.length} stale Expo token(s)`);
      }
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

export async function getSenderInfo(fromUserId: number): Promise<{ name: string; avatarUrl: string | null }> {
  try {
    const [user] = await db
      .select({ name: usersTable.name, avatarUrl: usersTable.avatarUrl })
      .from(usersTable)
      .where(eq(usersTable.id, fromUserId))
      .limit(1);
    return { name: user?.name ?? "Someone", avatarUrl: user?.avatarUrl ?? null };
  } catch {
    return { name: "Someone", avatarUrl: null };
  }
}
