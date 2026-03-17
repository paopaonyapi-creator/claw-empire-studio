/**
 * Auto-Retry Engine for Failed Tasks
 *
 * Periodically scans for recently failed tasks (status = 'inbox' with recent failure logs)
 * and auto-retries them up to MAX_RETRIES times.
 *
 * Also provides content archival: stores completed task outputs for search/reference.
 */

import type { DatabaseSync } from "node:sqlite";
import { PORT } from "../config/runtime.ts";
import { notifyTelegramAutoRetry, notifyTelegramTaskFailed } from "./telegram-notifier.ts";

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 30_000; // Wait 30s before retry
const RETRY_CHECK_INTERVAL_MS = 120_000; // Check every 2 min

// Track retry counts (in-memory, resets on restart)
const retryCounts = new Map<string, number>();

// ---------------------------------------------------------------------------
// Auto-Retry Scanner
// ---------------------------------------------------------------------------

function createAutoRetryScanner(db: DatabaseSync) {
  return function scanAndRetry(): void {
    try {
      // Find recently failed tasks: status = 'inbox' with a failure log in the last 5 minutes
      const fiveMinAgo = Date.now() - 5 * 60 * 1000;
      const failedTasks = db
        .prepare(
          `
          SELECT DISTINCT t.id, t.title, t.assigned_agent_id, t.department_id
          FROM tasks t
          INNER JOIN task_logs tl ON tl.task_id = t.id
          WHERE t.status = 'inbox'
            AND tl.content LIKE '%RUN failed%'
            AND tl.created_at > ?
          ORDER BY tl.created_at DESC
          LIMIT 5
          `,
        )
        .all(fiveMinAgo) as Array<{ id: string; title: string; assigned_agent_id: string | null; department_id: string | null }>;

      for (const task of failedTasks) {
        const count = retryCounts.get(task.id) || 0;
        if (count >= MAX_RETRIES) continue;

        retryCounts.set(task.id, count + 1);
        const attempt = count + 1;

        console.log(`[AutoRetry] 🔄 Retrying "${task.title}" (attempt ${attempt}/${MAX_RETRIES})`);
        notifyTelegramAutoRetry(task.id, task.title, attempt);

        // Re-run the task by calling the execution endpoint
        setTimeout(async () => {
          try {
            const url = `http://127.0.0.1:${PORT}/api/tasks/${task.id}/run`;
            const res = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
            });
            console.log(
              `[AutoRetry] ${res.ok ? "✅" : "⚠️"} "${task.title}" retry ${attempt} → HTTP ${res.status}`,
            );
          } catch (err) {
            console.error(`[AutoRetry] ❌ Failed to retry "${task.title}":`, err instanceof Error ? err.message : err);
          }
        }, RETRY_DELAY_MS);
      }
    } catch {
      // Silent — best-effort
    }
  };
}

// ---------------------------------------------------------------------------
// Content Archive: Store completed task outputs
// ---------------------------------------------------------------------------

function createContentArchiver(db: DatabaseSync) {
  // Create archive table if not exists
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS content_archive (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        task_type TEXT,
        department_id TEXT,
        agent_name TEXT,
        created_at INTEGER NOT NULL,
        UNIQUE(task_id)
      )
    `);
  } catch {
    // Table may already exist
  }

  return function archiveCompletedTasks(): void {
    try {
      // Find recently completed tasks not yet archived
      const doneTasks = db
        .prepare(
          `
          SELECT t.id, t.title, t.result, t.task_type, t.department_id, t.completed_at,
                 a.name as agent_name
          FROM tasks t
          LEFT JOIN agents a ON t.assigned_agent_id = a.id
          WHERE t.status = 'done'
            AND t.completed_at > ?
            AND t.id NOT IN (SELECT task_id FROM content_archive)
          ORDER BY t.completed_at DESC
          LIMIT 20
          `,
        )
        .all(Date.now() - 24 * 60 * 60 * 1000) as Array<{
        id: string;
        title: string;
        result: string | null;
        task_type: string | null;
        department_id: string | null;
        completed_at: number;
        agent_name: string | null;
      }>;

      for (const task of doneTasks) {
        if (!task.result) continue;
        try {
          db.prepare(
            `INSERT OR IGNORE INTO content_archive (id, task_id, title, content, task_type, department_id, agent_name, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            `ca-${task.id}`,
            task.id,
            task.title,
            task.result,
            task.task_type,
            task.department_id,
            task.agent_name,
            task.completed_at,
          );
          console.log(`[ContentArchive] 📦 Archived: "${task.title}"`);
        } catch {
          // Ignore duplicates
        }
      }
    } catch {
      // Silent
    }
  };
}

// ---------------------------------------------------------------------------
// Content Archive API Routes
// ---------------------------------------------------------------------------

export function registerContentArchiveRoutes(app: any, db: DatabaseSync): void {
  // Create table
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS content_archive (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        task_type TEXT,
        department_id TEXT,
        agent_name TEXT,
        created_at INTEGER NOT NULL,
        UNIQUE(task_id)
      )
    `);
  } catch {
    // Already exists
  }

  // GET /api/content-archive — list archived content
  app.get("/api/content-archive", (_req: any, res: any) => {
    const search = typeof _req.query?.q === "string" ? _req.query.q.trim() : "";
    const limit = Math.min(Number(_req.query?.limit) || 50, 100);

    let rows;
    if (search) {
      rows = db
        .prepare(
          `SELECT * FROM content_archive
           WHERE title LIKE ? OR content LIKE ?
           ORDER BY created_at DESC LIMIT ?`,
        )
        .all(`%${search}%`, `%${search}%`, limit);
    } else {
      rows = db.prepare("SELECT * FROM content_archive ORDER BY created_at DESC LIMIT ?").all(limit);
    }

    res.json({ ok: true, archive: rows, total: (rows as any[]).length });
  });

  // GET /api/content-archive/:id
  app.get("/api/content-archive/:id", (req: any, res: any) => {
    const id = String(req.params.id || "");
    const row = db.prepare("SELECT * FROM content_archive WHERE id = ? OR task_id = ?").get(id, id);
    if (!row) return res.status(404).json({ error: "not_found" });
    res.json({ ok: true, item: row });
  });
}

// ---------------------------------------------------------------------------
// Public: Start all background services
// ---------------------------------------------------------------------------

export function startAutoRetryAndArchive(db: DatabaseSync): void {
  const scanAndRetry = createAutoRetryScanner(db);
  const archiveTasks = createContentArchiver(db);

  // Start with delay
  setTimeout(() => {
    scanAndRetry();
    archiveTasks();
  }, 20_000);

  // Run periodically
  setInterval(scanAndRetry, RETRY_CHECK_INTERVAL_MS);
  setInterval(archiveTasks, 300_000); // Archive every 5 min

  console.log("[AutoRetry] ✅ Started (max retries: " + MAX_RETRIES + ", check every " + RETRY_CHECK_INTERVAL_MS / 1000 + "s)");
  console.log("[ContentArchive] ✅ Started (archive every 5min)");
}
