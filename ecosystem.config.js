module.exports = {
  apps: [
    {
      name: "rankyatra-api",
      script: "/home/ubuntu/rankyatra/artifacts/api-server/dist/index.mjs",
      env_file: "/home/ubuntu/rankyatra/.env",
      env: {
        NODE_ENV: "production",
        PORT: 8080,
        APP_URL: "https://rankyatra.in",
        DATABASE_URL: "postgresql://rankyatra:StrongPass123@localhost:5432/rankyatradb",
        SESSION_SECRET: "rankyatra-secret-key",
        OAUTH_CALLBACK_HOST: "https://rankyatra.niskutech.com",
      },
    },
  ],
};
