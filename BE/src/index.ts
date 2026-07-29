import "dotenv/config";

import { createApp } from "./gateway/index.js";

const DEFAULT_PORT = 3000;

function resolvePort(): number {
  const raw = process.env.PORT;
  if (raw === undefined || raw.trim() === "") {
    return DEFAULT_PORT;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid PORT value: ${raw}`);
  }

  return parsed;
}

const port = resolvePort();
const { app, db, ownsDatabase } = createApp();

const server = app.listen(port, () => {
  console.log(`[gateway] OurCrowd API listening on http://localhost:${port}`);
});

function shutdown(signal: string): void {
  console.log(`[gateway] Received ${signal}, shutting down...`);
  server.close(() => {
    if (ownsDatabase) {
      db.close();
    }
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
