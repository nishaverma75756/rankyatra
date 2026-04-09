// Load .env from project root using dotenv (already installed in api-server)
try {
  require("/home/ubuntu/rankyatra/artifacts/api-server/node_modules/dotenv").config({
    path: "/home/ubuntu/rankyatra/.env",
  });
} catch (_) {}

// Load Firebase service account JSON directly from file (avoids dotenv multiline issues)
let FIREBASE_JSON = "";
try {
  const fs = require("fs");
  const path = "/home/ubuntu/rankyatra/service-account.json";
  if (fs.existsSync(path)) {
    const raw = fs.readFileSync(path, "utf8");
    FIREBASE_JSON = JSON.stringify(JSON.parse(raw));
    console.log("[ecosystem] Firebase JSON loaded from file, length:", FIREBASE_JSON.length);
  } else {
    console.warn("[ecosystem] service-account.json NOT FOUND at:", path);
  }
} catch (e) {
  console.error("[ecosystem] Firebase JSON load error:", e.message);
}

module.exports = {
  apps: [
    {
      name: "rankyatra-api",
      script: "/home/ubuntu/rankyatra/artifacts/api-server/dist/index.mjs",
      env: {
        NODE_ENV: "production",
        PORT: 8080,
        APP_URL: "https://rankyatra.in",
        DATABASE_URL: "postgresql://rankyatra:StrongPass123@localhost:5432/rankyatradb",
        SESSION_SECRET: "rankyatra-secret-key",
        OAUTH_CALLBACK_HOST: "https://rankyatra.niskutech.com",
        // INSTAMOJO, FIREBASE, GOOGLE, SMTP are loaded from .env above via dotenv
        INSTAMOJO_API_KEY: process.env.INSTAMOJO_API_KEY || "a6c2c2c60308188017b86271f147931e",
        INSTAMOJO_AUTH_TOKEN: process.env.INSTAMOJO_AUTH_TOKEN || "d49007c9da5701653b5a1fbd097649d6",
        INSTAMOJO_SALT: process.env.INSTAMOJO_SALT || "e18d3b6ba1ec4f02ae9b5beb1b0a8365",
        FIREBASE_SERVICE_ACCOUNT_JSON: FIREBASE_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "",
        GOOGLE_CLIENT_ID: "781971539091-qon9vjmlnpvsjvijfs1oimthbo33ec0b.apps.googleusercontent.com",
        GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
        SMTP_USER: process.env.SMTP_USER || "",
        SMTP_PASS: process.env.SMTP_PASS || "",
      },
    },
  ],
};
