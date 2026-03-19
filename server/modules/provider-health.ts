/**
 * Provider Health Check — Monitor AI providers and auto-switch on failure
 * Checks: Gemini, Groq, OpenAI, Anthropic
 * Auto-failover when primary provider is down
 */

import type { Express } from "express";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProviderStatus = "healthy" | "degraded" | "down" | "unchecked";

interface ProviderHealth {
  name: string;
  status: ProviderStatus;
  statusEmoji: string;
  latencyMs: number | null;
  lastChecked: string | null;
  lastError: string | null;
  configured: boolean;
  uptime: number; // percentage
  checksTotal: number;
  checksSuccess: number;
}

// In-memory health store
const healthStore: Map<string, ProviderHealth> = new Map();

// Initialize providers
function initProvider(name: string, configured: boolean): ProviderHealth {
  const existing = healthStore.get(name);
  if (existing) return existing;
  
  const health: ProviderHealth = {
    name,
    status: "unchecked",
    statusEmoji: "⚪",
    latencyMs: null,
    lastChecked: null,
    lastError: null,
    configured,
    uptime: 100,
    checksTotal: 0,
    checksSuccess: 0,
  };
  healthStore.set(name, health);
  return health;
}

function updateStatus(health: ProviderHealth, ok: boolean, latencyMs: number, error?: string): void {
  health.checksTotal++;
  if (ok) {
    health.checksSuccess++;
    health.latencyMs = latencyMs;
    health.lastError = null;
    health.status = latencyMs > 5000 ? "degraded" : "healthy";
    health.statusEmoji = health.status === "healthy" ? "🟢" : "🟡";
  } else {
    health.lastError = error || "Unknown error";
    health.status = "down";
    health.statusEmoji = "🔴";
  }
  health.lastChecked = new Date().toISOString();
  health.uptime = health.checksTotal > 0
    ? Math.round((health.checksSuccess / health.checksTotal) * 100)
    : 0;
}

// ---------------------------------------------------------------------------
// Health Checks
// ---------------------------------------------------------------------------

async function checkGemini(): Promise<void> {
  const health = initProvider("gemini", !!process.env.GEMINI_API_KEY);
  if (!health.configured) { health.status = "unchecked"; health.statusEmoji = "⚪"; return; }

  const start = Date.now();
  try {
    const { testGeminiConnection } = await import("./gemini-provider.ts");
    const result = await testGeminiConnection();
    updateStatus(health, result.ok, Date.now() - start, result.ok ? undefined : result.message);
  } catch (err) {
    updateStatus(health, false, Date.now() - start, String(err));
  }
}

async function checkGroq(): Promise<void> {
  const health = initProvider("groq", !!process.env.GROQ_API_KEY);
  if (!health.configured) { health.status = "unchecked"; health.statusEmoji = "⚪"; return; }

  const start = Date.now();
  try {
    const { testGroqConnection } = await import("./groq-provider.ts");
    const result = await testGroqConnection();
    updateStatus(health, result.ok, Date.now() - start, result.ok ? undefined : result.message);
  } catch (err) {
    updateStatus(health, false, Date.now() - start, String(err));
  }
}

async function checkOpenAI(): Promise<void> {
  const health = initProvider("openai", !!process.env.OPENAI_API_KEY);
  if (!health.configured) { health.status = "unchecked"; health.statusEmoji = "⚪"; return; }

  const start = Date.now();
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}` },
      signal: AbortSignal.timeout(10000),
    });
    updateStatus(health, res.ok, Date.now() - start, res.ok ? undefined : `HTTP ${res.status}`);
  } catch (err) {
    updateStatus(health, false, Date.now() - start, String(err));
  }
}

async function checkAnthropic(): Promise<void> {
  const health = initProvider("anthropic", !!process.env.ANTHROPIC_API_KEY);
  if (!health.configured) { health.status = "unchecked"; health.statusEmoji = "⚪"; return; }

  const start = Date.now();
  try {
    const res = await fetch("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      signal: AbortSignal.timeout(10000),
    });
    updateStatus(health, res.ok, Date.now() - start, res.ok ? undefined : `HTTP ${res.status}`);
  } catch (err) {
    updateStatus(health, false, Date.now() - start, String(err));
  }
}

// Run all checks
async function runAllChecks(): Promise<ProviderHealth[]> {
  await Promise.allSettled([checkGemini(), checkGroq(), checkOpenAI(), checkAnthropic()]);
  return Array.from(healthStore.values());
}

// Get best available provider
export function getBestProvider(): string {
  const providers = Array.from(healthStore.values())
    .filter(p => p.configured && p.status === "healthy")
    .sort((a, b) => (a.latencyMs || 9999) - (b.latencyMs || 9999));

  return providers[0]?.name || "gemini"; // default to gemini
}

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

let healthInterval: ReturnType<typeof setInterval> | null = null;

export function startHealthMonitor(): void {
  // Initial check after 10 seconds
  setTimeout(runAllChecks, 10000);

  // Check every 5 minutes
  healthInterval = setInterval(runAllChecks, 5 * 60 * 1000);

  // Initialize all providers
  initProvider("gemini", !!process.env.GEMINI_API_KEY);
  initProvider("groq", !!process.env.GROQ_API_KEY);
  initProvider("openai", !!process.env.OPENAI_API_KEY);
  initProvider("anthropic", !!process.env.ANTHROPIC_API_KEY);

  console.log("[Health Monitor] ✅ Provider health checks active (5 min interval)");
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

export function registerProviderHealthRoutes(app: Express): void {
  // Get all provider status
  app.get("/api/providers/health", async (_req, res) => {
    const results = await runAllChecks();
    const allHealthy = results.filter(r => r.configured).every(r => r.status === "healthy");
    res.json({
      ok: true,
      overall: allHealthy ? "🟢 All Systems Operational" : "⚠️ Some Issues Detected",
      providers: results,
      bestProvider: getBestProvider(),
    });
  });

  // Check single provider
  app.post("/api/providers/:name/check", async (req, res) => {
    const name = req.params.name;
    const checkers: Record<string, () => Promise<void>> = {
      gemini: checkGemini,
      groq: checkGroq,
      openai: checkOpenAI,
      anthropic: checkAnthropic,
    };

    const checker = checkers[name];
    if (!checker) return res.status(404).json({ ok: false, error: "Unknown provider" });

    await checker();
    const health = healthStore.get(name);
    res.json({ ok: true, health });
  });

  // Get best available provider
  app.get("/api/providers/best", (_req, res) => {
    const best = getBestProvider();
    const health = healthStore.get(best);
    res.json({ ok: true, provider: best, health });
  });

  startHealthMonitor();
}
