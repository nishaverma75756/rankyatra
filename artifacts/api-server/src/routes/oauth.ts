import { Router, type IRouter, type Request, type Response } from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";
import { db, usersTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { generateToken } from "../middlewares/auth";

const router: IRouter = Router();

// Debug endpoint: check OAuth config (no secrets exposed)
router.get("/auth/debug", (_req, res) => {
  res.json({
    googleConfigured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    callbackURL: `${process.env.OAUTH_CALLBACK_HOST || process.env.APP_URL || "https://rankyatra.in"}/api/auth/google/callback`,
    clientIdPrefix: process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.slice(0, 12) + "..." : "NOT SET",
    appUrl: process.env.APP_URL || "NOT SET",
    oauthCallbackHost: process.env.OAUTH_CALLBACK_HOST || "NOT SET",
  });
});

const FRONTEND_URL = "https://rankyatra.in";
const APP_URL = process.env.APP_URL || FRONTEND_URL;
const CALLBACK_HOST = process.env.OAUTH_CALLBACK_HOST || APP_URL;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || "";
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET || "";

async function findOrCreateOAuthUser(opts: {
  provider: "google" | "facebook";
  providerId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}) {
  const { provider, providerId, email, name, avatarUrl } = opts;
  const idField = provider === "google" ? usersTable.googleId : usersTable.facebookId;

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(or(eq(idField, providerId), eq(usersTable.email, email)));

  if (existing) {
    const updateFields =
      provider === "google"
        ? { googleId: providerId, ...(avatarUrl && !existing.avatarUrl ? { avatarUrl } : {}) }
        : { facebookId: providerId, ...(avatarUrl && !existing.avatarUrl ? { avatarUrl } : {}) };
    await db.update(usersTable).set(updateFields).where(eq(usersTable.id, existing.id));
    console.log("[OAuth] Updated existing user:", existing.id, existing.email);
    return existing;
  }

  if (!email) throw new Error("Google account ne email provide nahi ki. Please kisi doosre Google account se try karo.");

  console.log("[OAuth] Creating new user for:", email);
  try {
    const [created] = await db
      .insert(usersTable)
      .values({
        name,
        email,
        passwordHash: null,
        emailVerified: true,
        googleId: provider === "google" ? providerId : null,
        facebookId: provider === "facebook" ? providerId : null,
        avatarUrl: avatarUrl || null,
      })
      .returning();
    return created;
  } catch (insertErr: any) {
    console.error("[OAuth] DB insert failed:", insertErr?.message);
    const msg = insertErr?.message || "";
    if (msg.includes("unique") && msg.includes("email")) {
      throw new Error("Yeh email pehle se registered hai. Please password se login karo.");
    }
    throw new Error("Account create nahi ho saka. Please dobara try karo.");
  }
}

// Mobile OAuth: expo-web-browser's openAuthSessionAsync watches for redirects to rankyatra://.
// We redirect DIRECTLY to rankyatra:// — no intermediate HTML page needed.
// openAuthSessionAsync intercepts the redirect and returns the URL to the app.
function handleOAuthCallback(provider: "google" | "facebook") {
  return async (req: Request, res: Response): Promise<void> => {
    const isMobile = (req as any).oauthIsMobile === true;
    try {
      const oauthUser = (req as any).oauthUser;
      if (!oauthUser) throw new Error("OAuth failed");

      const token = generateToken({
        id: oauthUser.id,
        email: oauthUser.email,
        name: oauthUser.name,
        isAdmin: oauthUser.isAdmin,
        isBlocked: oauthUser.isBlocked,
      });

      if (isMobile) {
        // Direct deep link redirect — openAuthSessionAsync catches this automatically
        res.redirect(`rankyatra://oauth-callback?token=${encodeURIComponent(token)}`);
      } else {
        res.redirect(`${FRONTEND_URL}/oauth-callback?token=${encodeURIComponent(token)}`);
      }
    } catch (err: any) {
      if ((req as any).oauthIsMobile) {
        res.redirect(`rankyatra://oauth-callback?error=${encodeURIComponent(err.message || "OAuth failed")}`);
      } else {
        res.redirect(`${FRONTEND_URL}/oauth-callback?error=${encodeURIComponent(err.message || "OAuth failed")}`);
      }
    }
  };
}

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: `${CALLBACK_HOST}/api/auth/google/callback`,
        scope: ["profile", "email"],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value || "";
          const avatarUrl = profile.photos?.[0]?.value || "";
          console.log("[OAuth Google] Attempting login for:", email, "profileId:", profile.id);
          const user = await findOrCreateOAuthUser({
            provider: "google",
            providerId: profile.id,
            email,
            name: profile.displayName || email.split("@")[0],
            avatarUrl,
          });
          console.log("[OAuth Google] User found/created:", user.id, user.email);
          done(null, user);
        } catch (err: any) {
          console.error("[OAuth Google] Error:", err?.message, err?.stack);
          done(err);
        }
      }
    )
  );

  router.get("/auth/google", (req: Request, res: Response, next: any) => {
    const isMobile = req.query.mobile === "1";
    passport.authenticate("google", {
      scope: ["profile", "email"],
      session: false,
      state: isMobile ? "mobile" : "web",
    } as any)(req, res, next);
  });

  router.get(
    "/auth/google/callback",
    (req: Request, res: Response, next: any) => {
      const stateParam = (req.query.state as string) || "";
      const isMobile = stateParam === "mobile";
      const errorBase = isMobile ? "rankyatra://oauth-callback" : `${FRONTEND_URL}/oauth-callback`;
      passport.authenticate("google", { session: false }, (err: any, user: any) => {
        if (err || !user) {
          console.error("[OAuth Google] Callback error:", err?.message || "No user returned");
          return res.redirect(`${errorBase}?error=${encodeURIComponent(err?.message || "Google login failed")}`);
        }
        (req as any).oauthUser = user;
        (req as any).oauthIsMobile = isMobile;
        next();
      })(req, res, next);
    },
    handleOAuthCallback("google")
  );
}

if (FACEBOOK_APP_ID && FACEBOOK_APP_SECRET) {
  passport.use(
    new FacebookStrategy(
      {
        clientID: FACEBOOK_APP_ID,
        clientSecret: FACEBOOK_APP_SECRET,
        callbackURL: `${CALLBACK_HOST}/api/auth/facebook/callback`,
        profileFields: ["id", "displayName", "emails", "photos"],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value || `fb_${profile.id}@rankyatra.in`;
          const avatarUrl = profile.photos?.[0]?.value || "";
          const user = await findOrCreateOAuthUser({
            provider: "facebook",
            providerId: profile.id,
            email,
            name: profile.displayName || "User",
            avatarUrl,
          });
          done(null, user as any);
        } catch (err: any) {
          done(err);
        }
      }
    )
  );

  router.get("/auth/facebook", passport.authenticate("facebook", { scope: ["email"], session: false }));

  router.get(
    "/auth/facebook/callback",
    (req: Request, res: Response, next: any) => {
      passport.authenticate("facebook", { session: false }, (err: any, user: any) => {
        if (err || !user) {
          return res.redirect(`${FRONTEND_URL}/oauth-callback?error=${encodeURIComponent(err?.message || "Facebook login failed")}`);
        }
        (req as any).oauthUser = user;
        next();
      })(req, res, next);
    },
    handleOAuthCallback("facebook")
  );
}

export default router;
