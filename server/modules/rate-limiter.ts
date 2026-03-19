/**
 * API Rate Limiter — Queue system with per-provider limits + retry
 * Prevents rate limit errors across all AI providers
 */

import type { Express } from "express";

// ---------------------------------------------------------------------------
// Types & Config
// ---------------------------------------------------------------------------

interface RateLimit {
  provider: string;
  maxRPM: number;   // requests per minute
  maxRPD: number;   // requests per day
  currentRPM: number;
  currentRPD: number;
  queue: Array<{ id: string; resolve: (v: boolean) => void; addedAt: number }>;
  lastMinuteReset: number;
  lastDayReset: number;
}

const LIMITS: Record<string, { rpm: number; rpd: number }> = {
  gemini: { rpm: 15, rpd: 1500 },
  groq: { rpm: 30, rpd: 14400 },
  openai: { rpm: 500, rpd: 10000 },
  anthropic: { rpm: 50, rpd: 1000 },
  kimi: { rpm: 10, rpd: 500 },
};

const rateLimits: Map<string, RateLimit> = new Map();

// Stats
let totalQueued = 0;
let totalProcessed = 0;
let totalRejected = 0;

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

function getOrCreateLimit(provider: string): RateLimit {
  let rl = rateLimits.get(provider);
  if (!rl) {
    const config = LIMITS[provider] || { rpm: 30, rpd: 5000 };
    rl = {
      provider,
      maxRPM: config.rpm,
      maxRPD: config.rpd,
      currentRPM: 0,
      currentRPD: 0,
      queue: [],
      lastMinuteReset: Date.now(),
      lastDayReset: Date.now(),
    };
    rateLimits.set(provider, rl);
  }

  // Reset counters
  const now = Date.now();
  if (now - rl.lastMinuteReset >= 60_000) {
    rl.currentRPM = 0;
    rl.lastMinuteReset = now;
    processQueue(provider);
  }
  if (now - rl.lastDayReset >= 86_400_000) {
    rl.currentRPD = 0;
    rl.lastDayReset = now;
  }

  return rl;
}

export async function acquireSlot(provider: string): Promise<boolean> {
  const rl = getOrCreateLimit(provider);

  if (rl.currentRPM < rl.maxRPM && rl.currentRPD < rl.maxRPD) {
    rl.currentRPM++;
    rl.currentRPD++;
    totalProcessed++;
    return true;
  }

  // Queue the request
  if (rl.queue.length >= 50) {
    totalRejected++;
    return false; // Queue full
  }

  totalQueued++;
  return new Promise<boolean>((resolve) => {
    const id = `q_${Date.now()}_${Math.random().toString(36).slice(2, 4)}`;
    rl.queue.push({ id, resolve, addedAt: Date.now() });

    // Timeout after 30s
    setTimeout(() => {
      const idx = rl.queue.findIndex(q => q.id === id);
      if (idx !== -1) {
        rl.queue.splice(idx, 1);
        totalRejected++;
        resolve(false);
      }
    }, 30_000);
  });
}

export function releaseSlot(provider: string): void {
  // After request completes, no-op for now
}

function processQueue(provider: string): void {
  const rl = rateLimits.get(provider);
  if (!rl || rl.queue.length === 0) return;

  while (rl.queue.length > 0 && rl.currentRPM < rl.maxRPM && rl.currentRPD < rl.maxRPD) {
    const item = rl.queue.shift();
    if (item) {
      rl.currentRPM++;
      rl.currentRPD++;
      totalProcessed++;
      item.resolve(true);
    }
  }
}

// Retry wrapper
export async function withRetry<T>(
  provider: string,
  fn: () => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const hasSlot = await acquireSlot(provider);
    if (!hasSlot) {
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      throw new Error(`Rate limit: ${provider} queue full after ${maxRetries} retries`);
    }

    try {
      return await fn();
    } catch (err: any) {
      if (err?.status === 429 && attempt < maxRetries - 1) {
        const waitMs = 5000 * (attempt + 1);
        console.log(`[Rate Limiter] ⚠️ ${provider} 429, retrying in ${waitMs}ms`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded");
}

// ---------------------------------------------------------------------------
// Monitor - periodic queue processing
// ---------------------------------------------------------------------------

setInterval(() => {
  for (const [provider] of rateLimits) {
    getOrCreateLimit(provider); // triggers reset
  }
}, 10_000);

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

export function registerRateLimiterRoutes(app: Express): void {
  app.get("/api/rate-limits/status", (_req, res) => {
    const limits = Array.from(rateLimits.values()).map(rl => ({
      provider: rl.provider,
      rpm: `${rl.currentRPM}/${rl.maxRPM}`,
      rpd: `${rl.currentRPD}/${rl.maxRPD}`,
      queueSize: rl.queue.length,
      utilizationPct: Math.round((rl.currentRPM / rl.maxRPM) * 100),
    }));

    res.json({
      ok: true,
      limits,
      stats: { totalQueued, totalProcessed, totalRejected },
    });
  });

  app.get("/api/rate-limits/config", (_req, res) => {
    res.json({ ok: true, config: LIMITS });
  });

  // Initialize all providers
  for (const provider of Object.keys(LIMITS)) {
    getOrCreateLimit(provider);
  }

  console.log("[Rate Limiter] ✅ Queue system active for", Object.keys(LIMITS).join(", "));
}
