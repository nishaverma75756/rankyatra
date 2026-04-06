import { db, pushTokensTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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

    const messages: PushMessage[] = tokens
      .filter((t) => t.token.startsWith("ExponentPushToken"))
      .map((t) => ({
        to: t.token,
        title,
        body,
        data: data ?? {},
        sound: "default",
      }));

    if (messages.length === 0) return;

    await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });
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
