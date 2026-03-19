/**
 * API Middleware — Central Error Handler + Rate Limiter
 *
 * Provides:
 * 1. Centralized error-handling middleware (consistent JSON error responses)
 * 2. In-memory rate limiter for AI endpoints (/api/ai/*)
 */

import type { Express, Request, Response, NextFunction } from "express";

// ---------------------------------------------------------------------------
// Rate Limiter (In-memory, per-IP)
// ---------------------------------------------------------------------------

interface RateEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateEntry>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10;           // max 10 requests per minute for AI endpoints

function getRateKey(req: Request): string {
  return req.ip || req.headers["x-forwarded-for"]?.toString() || "unknown";
}

function checkRateLimit(req: Request): { allowed: boolean; remaining: number; resetIn: number } {
  const key = getRateKey(req);
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now >= entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetIn: RATE_LIMIT_WINDOW_MS };
  }

  entry.count++;
  const remaining = Math.max(0, RATE_LIMIT_MAX - entry.count);
  const resetIn = entry.resetAt - now;

  if (entry.count > RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, resetIn };
  }
  return { allowed: true, remaining, resetIn };
}

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now >= entry.resetAt) rateLimitStore.delete(key);
  }
}, 5 * 60_000);

// ---------------------------------------------------------------------------
// Rate Limiter Middleware
// ---------------------------------------------------------------------------

export function rateLimiterMiddleware(req: Request, res: Response, next: NextFunction): void {
  const { allowed, remaining, resetIn } = checkRateLimit(req);
  
  res.setHeader("X-RateLimit-Limit", String(RATE_LIMIT_MAX));
  res.setHeader("X-RateLimit-Remaining", String(remaining));
  res.setHeader("X-RateLimit-Reset", String(Math.ceil(resetIn / 1000)));

  if (!allowed) {
    res.status(429).json({
      ok: false,
      error: "Too many requests. Please wait before trying again.",
      retryAfter: Math.ceil(resetIn / 1000),
    });
    return;
  }
  next();
}

// ---------------------------------------------------------------------------
// Central Error Handler
// ---------------------------------------------------------------------------

export function centralErrorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  const statusCode = (err as any).statusCode || 500;
  const message = err.message || "Internal Server Error";

  console.error(`[API Error] ${_req.method} ${_req.path}:`, message);
  
  // Don't leak stack traces in production
  res.status(statusCode).json({
    ok: false,
    error: message,
    ...(process.env.NODE_ENV === "development" ? { stack: err.stack } : {}),
  });
}

// ---------------------------------------------------------------------------
// Register all middleware
// ---------------------------------------------------------------------------

export function registerApiMiddleware(app: Express): void {
  // Rate limit AI endpoints
  app.use("/api/ai", rateLimiterMiddleware);

  console.log("[API Middleware] ✅ Rate limiter active on /api/ai/* (max 10 req/min)");
  console.log("[API Middleware] ✅ Central error handler registered");
}

export function registerErrorHandler(app: Express): void {
  // This MUST be registered after all routes
  app.use(centralErrorHandler);
}
