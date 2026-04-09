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
  const raw = fs.readFileSync("/home/ubuntu/rankyatra/service-account.json", "utf8");
  FIREBASE_JSON = JSON.stringify(JSON.parse(raw));
} catch (_) {}

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
        INSTAMOJO_API_KEY: process.env.INSTAMOJO_API_KEY || "",
        INSTAMOJO_AUTH_TOKEN: process.env.INSTAMOJO_AUTH_TOKEN || "",
        INSTAMOJO_SALT: process.env.INSTAMOJO_SALT || "",
        FIREBASE_SERVICE_ACCOUNT_JSON: FIREBASE_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "",
        GOOGLE_CLIENT_ID: "781971539091-qon9vjmlnpvsjvijfs1oimthbo33ec0b.apps.googleusercontent.com",
        GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
        SMTP_USER: process.env.SMTP_USER || "",
        SMTP_PASS: process.env.SMTP_PASS || "",
      },
    },
  ],
};
