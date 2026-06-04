import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { pool } from "./db";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

async function runStartupMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS waiver_questions (
        id SERIAL PRIMARY KEY,
        question TEXT NOT NULL,
        description TEXT,
        is_required BOOLEAN NOT NULL DEFAULT FALSE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS guest_waiver_answers (
        id SERIAL PRIMARY KEY,
        guest_waiver_id INTEGER NOT NULL REFERENCES guest_waivers(id) ON DELETE CASCADE,
        question_id INTEGER NOT NULL REFERENCES waiver_questions(id) ON DELETE CASCADE,
        answer BOOLEAN NOT NULL DEFAULT FALSE
      );
    `);
    log("Startup migrations completed");
  } catch (err: any) {
    log(`Startup migration warning: ${err.message}`);
  } finally {
    client.release();
  }
}

(async () => {
  await runStartupMigrations();
  const server = await registerRoutes(app);

  // Initialize the automatic backup scheduler after routes (and storage) are ready
  try {
    const { initBackupScheduler } = await import("./scheduler");
    await initBackupScheduler();
  } catch (err: any) {
    log(`[scheduler] Could not initialize backup scheduler: ${err.message}`);
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
})();
