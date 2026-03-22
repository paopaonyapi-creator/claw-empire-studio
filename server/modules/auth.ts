/**
 * Auth Module — RBAC Multi-Admin System
 * 
 * Roles: CEO (full access), Admin (limited), Viewer (read-only)
 * Uses SQLite for user storage and simple JWT-like session tokens.
 */

import type { Express, Request, Response, NextFunction } from "express";
import { randomBytes, createHash } from "node:crypto";
import { getStudioDb } from "./studio-db.ts";
import { logActivity } from "./activity-log.ts";

// ---------------------------------------------------------------------------
// Schema & Init
// ---------------------------------------------------------------------------

export type UserRole = "ceo" | "admin" | "viewer";

interface User {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
}

// In-memory session store (simple approach, no external deps)
const sessions = new Map<string, { userId: string; username: string; role: UserRole; expiresAt: number }>();

/**
 * Check if a Bearer token is a valid RBAC session token.
 * Used by security/auth.ts to accept Google OAuth + login tokens.
 */
export function isValidRbacToken(token: string | null | undefined): boolean {
  if (!token) return false;
  const session = sessions.get(token);
  if (!session) return false;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function initAuthTable(): void {
  const db = getStudioDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS studio_users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'viewer',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Create default CEO account if no users exist
  const count = db.prepare("SELECT COUNT(*) as cnt FROM studio_users").get() as { cnt: number };
  if (count.cnt === 0) {
    const hash = hashPassword("admin123");
    db.prepare(`INSERT INTO studio_users (id, username, password_hash, display_name, role) VALUES (?, ?, ?, ?, ?)`).run(
      `user_${Date.now()}`, "ceo", hash, "CEO บอส", "ceo"
    );
    console.log("[Auth] ✅ Default CEO account created (username: ceo, password: admin123)");
    console.log("[Auth] ⚠️ กรุณาเปลี่ยนรหัสผ่านหลัง login ครั้งแรก!");
  }
}

function hashPassword(password: string): string {
  return createHash("sha256").update(password + "claw-empire-salt-2026").digest("hex");
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

// ---------------------------------------------------------------------------
// Auth Functions
// ---------------------------------------------------------------------------

function login(username: string, password: string): { ok: boolean; token?: string; user?: User; error?: string } {
  const db = getStudioDb();
  const hash = hashPassword(password);
  const row = db.prepare("SELECT * FROM studio_users WHERE username = ? AND password_hash = ?").get(username, hash) as any;

  if (!row) return { ok: false, error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };

  const token = generateToken();
  sessions.set(token, {
    userId: row.id,
    username: row.username,
    role: row.role,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  });

  return {
    ok: true,
    token,
    user: { id: row.id, username: row.username, displayName: row.display_name, role: row.role, createdAt: row.created_at },
  };
}

function getSessionFromRequest(req: Request): { userId: string; username: string; role: UserRole } | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const session = sessions.get(token);
  if (!session) return null;

  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }

  return session;
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const session = getSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ ok: false, error: "กรุณา Login ก่อน" });
    return;
  }
  (req as any).user = session;
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const session = getSessionFromRequest(req);
    if (!session) {
      res.status(401).json({ ok: false, error: "กรุณา Login ก่อน" });
      return;
    }
    if (!roles.includes(session.role)) {
      res.status(403).json({ ok: false, error: `ต้องเป็น ${roles.join(" หรือ ")} เท่านั้น` });
      return;
    }
    (req as any).user = session;
    next();
  };
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

export function registerAuthRoutes(app: Express): void {
  initAuthTable();

  // Login
  app.post("/api/auth/login", (req: Request, res: Response) => {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!username?.trim() || !password?.trim()) {
      return res.status(400).json({ ok: false, error: "username and password required" });
    }
    const result = login(username.trim(), password);
    if (!result.ok) return res.status(401).json(result);
    logActivity({ action: "login", category: "auth", actor: username.trim(), detail: `Login สำเร็จ (${result.user?.role})` });
    res.json(result);
  });

  // Google OAuth Login
  app.post("/api/auth/google", async (req: Request, res: Response) => {
    const { credential } = req.body as { credential?: string };
    if (!credential) return res.status(400).json({ ok: false, error: "Google credential required" });

    try {
      // Verify Google ID token via Google's tokeninfo API
      const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
      if (!verifyRes.ok) return res.status(401).json({ ok: false, error: "Invalid Google token" });

      const payload = await verifyRes.json() as { email?: string; name?: string; picture?: string; sub?: string };
      if (!payload.email) return res.status(401).json({ ok: false, error: "No email in token" });

      const db = getStudioDb();
      // Check if user with this email (as username) exists
      let row = db.prepare("SELECT * FROM studio_users WHERE username = ?").get(payload.email) as any;

      if (!row) {
        // Auto-create as viewer by default (CEO can upgrade later)
        const userId = `guser_${Date.now()}`;
        const dummyHash = hashPassword(randomBytes(16).toString("hex")); // random password
        db.prepare(`INSERT INTO studio_users (id, username, password_hash, display_name, role) VALUES (?, ?, ?, ?, ?)`)
          .run(userId, payload.email, dummyHash, payload.name || payload.email, "viewer");
        row = db.prepare("SELECT * FROM studio_users WHERE id = ?").get(userId) as any;
        logActivity({ action: "create_user", category: "auth", detail: `Google user created: ${payload.email}` });
      }

      // Create session
      const token = generateToken();
      sessions.set(token, {
        userId: row.id,
        username: row.username,
        role: row.role,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      });

      logActivity({ action: "login", category: "auth", actor: payload.email, detail: `Google login สำเร็จ (${row.role})` });
      res.json({
        ok: true,
        token,
        user: { id: row.id, username: row.username, displayName: row.display_name, role: row.role, createdAt: row.created_at },
      });
    } catch (err) {
      console.error("[Auth] Google login error:", err);
      res.status(500).json({ ok: false, error: "Google login failed" });
    }
  });

  // Logout
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      sessions.delete(authHeader.slice(7));
    }
    res.json({ ok: true });
  });

  // Get current user
  app.get("/api/auth/me", (req: Request, res: Response) => {
    const session = getSessionFromRequest(req);
    if (!session) return res.status(401).json({ ok: false, error: "not logged in" });

    const db = getStudioDb();
    const row = db.prepare("SELECT * FROM studio_users WHERE id = ?").get(session.userId) as any;
    if (!row) return res.status(404).json({ ok: false, error: "user not found" });

    res.json({
      ok: true,
      user: { id: row.id, username: row.username, displayName: row.display_name, role: row.role, createdAt: row.created_at },
    });
  });

  // Change password (requires auth)
  app.post("/api/auth/change-password", (req: Request, res: Response) => {
    const session = getSessionFromRequest(req);
    if (!session) return res.status(401).json({ ok: false, error: "not logged in" });

    const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ ok: false, error: "รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร" });
    }

    const db = getStudioDb();
    const currentHash = hashPassword(currentPassword);
    const row = db.prepare("SELECT id FROM studio_users WHERE id = ? AND password_hash = ?").get(session.userId, currentHash) as any;
    if (!row) return res.status(401).json({ ok: false, error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" });

    const newHash = hashPassword(newPassword);
    db.prepare("UPDATE studio_users SET password_hash = ? WHERE id = ?").run(newHash, session.userId);
    res.json({ ok: true, message: "เปลี่ยนรหัสผ่านสำเร็จ" });
  });

  // Create user (CEO only)
  app.post("/api/auth/users", (req: Request, res: Response) => {
    const session = getSessionFromRequest(req);
    if (!session || session.role !== "ceo") {
      return res.status(403).json({ ok: false, error: "CEO เท่านั้นที่สร้างผู้ใช้ได้" });
    }

    const { username, password, displayName, role } = req.body as {
      username?: string; password?: string; displayName?: string; role?: UserRole;
    };

    if (!username?.trim() || !password || password.length < 6) {
      return res.status(400).json({ ok: false, error: "username and password (min 6 chars) required" });
    }

    const db = getStudioDb();
    const existing = db.prepare("SELECT id FROM studio_users WHERE username = ?").get(username.trim()) as any;
    if (existing) return res.status(409).json({ ok: false, error: "username นี้ถูกใช้แล้ว" });

    const validRoles: UserRole[] = ["ceo", "admin", "viewer"];
    const userRole = validRoles.includes(role as UserRole) ? role! : "viewer";

    const id = `user_${Date.now()}`;
    const hash = hashPassword(password);
    db.prepare(`INSERT INTO studio_users (id, username, password_hash, display_name, role) VALUES (?, ?, ?, ?, ?)`).run(
      id, username.trim(), hash, displayName || username.trim(), userRole
    );

    res.json({ ok: true, user: { id, username: username.trim(), displayName: displayName || username.trim(), role: userRole } });
    logActivity({ action: "create_user", category: "auth", actor: session.username, detail: `สร้าง user ${username.trim()} (${userRole})` });
  });

  // List users (CEO only)
  app.get("/api/auth/users", (req: Request, res: Response) => {
    const session = getSessionFromRequest(req);
    if (!session || session.role !== "ceo") {
      return res.status(403).json({ ok: false, error: "CEO เท่านั้น" });
    }

    const db = getStudioDb();
    const rows = db.prepare("SELECT id, username, display_name, role, created_at FROM studio_users ORDER BY created_at").all() as any[];
    res.json({
      ok: true,
      users: rows.map(r => ({ id: r.id, username: r.username, displayName: r.display_name, role: r.role, createdAt: r.created_at })),
    });
  });

  // Delete user (CEO only, can't delete self)
  app.delete("/api/auth/users/:id", (req: Request, res: Response) => {
    const session = getSessionFromRequest(req);
    if (!session || session.role !== "ceo") {
      return res.status(403).json({ ok: false, error: "CEO เท่านั้น" });
    }
    const targetId = String(req.params.id);
    if (targetId === session.userId) {
      return res.status(400).json({ ok: false, error: "ลบตัวเองไม่ได้!" });
    }

    const db = getStudioDb();
    const result = db.prepare("DELETE FROM studio_users WHERE id = ?").run(targetId);
    if ((result as any).changes > 0) {
      logActivity({ action: "delete_user", category: "auth", actor: session.username, detail: `ลบ user ${targetId}` });
    }
    res.json({ ok: (result as any).changes > 0 });
  });

  console.log("[Auth] ✅ RBAC routes registered (CEO/Admin/Viewer)");
}
