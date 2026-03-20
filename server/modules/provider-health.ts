/**
 * Provider Health Check — Monitor AI providers and auto-switch on failure
 * Checks: Gemini, Groq, OpenAI, Anthropic, KIMI
 * Uses LIGHTWEIGHT calls (model listing) instead of full generation
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
    status: configured ? "unchecked" : "down",
    statusEmoji: configured ? "⚪" : "⚫",
    latencyMs: null,
    lastChecked: null,
    lastError: configured ? null : "API key not configured",
    configured,
    uptime: 0,
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
// Lightweight Health Checks (use model listing, not generation)
// ---------------------------------------------------------------------------

async function fetchWithTimeout(url: string, opts: RequestInit, timeoutMs: number = 8000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...opts, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
}

async function checkGemini(): Promise<void> {
  const key = process.env.GEMINI_API_KEY || "";
  const health = initProvider("gemini", !!key);
  if (!key) { health.status = "down"; health.statusEmoji = "🔴"; health.lastError = "No API key"; return; }

  const start = Date.now();
  try {
    const res = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
      { method: "GET" }
    );
    updateStatus(health, res.ok, Date.now() - start, res.ok ? undefined : `HTTP ${res.status}`);
  } catch (err) {
    updateStatus(health, false, Date.now() - start, String(err));
  }
}

async function checkGroq(): Promise<void> {
  const key = process.env.GROQ_API_KEY || "";
  const health = initProvider("groq", !!key);
  if (!key) { health.status = "down"; health.statusEmoji = "🔴"; health.lastError = "No API key"; return; }

  const start = Date.now();
  try {
    const res = await fetchWithTimeout(
      "https://api.groq.com/openai/v1/models",
      { method: "GET", headers: { "Authorization": `Bearer ${key}` } }
    );
    updateStatus(health, res.ok, Date.now() - start, res.ok ? undefined : `HTTP ${res.status}`);
  } catch (err) {
    updateStatus(health, false, Date.now() - start, String(err));
  }
}

async function checkOpenAI(): Promise<void> {
  const key = process.env.OPENAI_API_KEY || "";
  const health = initProvider("openai", !!key);
  if (!key) { health.status = "down"; health.statusEmoji = "🔴"; health.lastError = "No API key"; return; }

  const start = Date.now();
  try {
    const res = await fetchWithTimeout(
      "https://api.openai.com/v1/models",
      { method: "GET", headers: { "Authorization": `Bearer ${key}` } }
    );
    updateStatus(health, res.ok, Date.now() - start, res.ok ? undefined : `HTTP ${res.status}`);
  } catch (err) {
    updateStatus(health, false, Date.now() - start, String(err));
  }
}

async function checkAnthropic(): Promise<void> {
  const key = process.env.ANTHROPIC_API_KEY || "";
  const health = initProvider("anthropic", !!key);
  if (!key) { health.status = "down"; health.statusEmoji = "🔴"; health.lastError = "No API key"; return; }

  const start = Date.now();
  try {
    // Anthropic doesn't have a /models endpoint; use a small messages call
    const res = await fetchWithTimeout(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-20241022",
          max_tokens: 5,
          messages: [{ role: "user", content: "hi" }],
        }),
      }
    );
    // 200 = success, 401 = bad key, 429 = rate limit (still means reachable)
    const reachable = res.ok || res.status === 429;
    updateStatus(health, reachable, Date.now() - start, reachable ? undefined : `HTTP ${res.status}`);
  } catch (err) {
    updateStatus(health, false, Date.now() - start, String(err));
  }
}

async function checkKimi(): Promise<void> {
  const key = process.env.KIMI_API_KEY || "";
  const health = initProvider("kimi", !!key);
  if (!key) { health.status = "down"; health.statusEmoji = "🔴"; health.lastError = "No API key"; return; }

  const start = Date.now();
  try {
    const res = await fetchWithTimeout(
      "https://api.moonshot.cn/v1/models",
      { method: "GET", headers: { "Authorization": `Bearer ${key}` } }
    );
    updateStatus(health, res.ok, Date.now() - start, res.ok ? undefined : `HTTP ${res.status}`);
  } catch (err) {
    updateStatus(health, false, Date.now() - start, String(err));
  }
}

// Run all checks
async function runAllChecks(): Promise<ProviderHealth[]> {
  await Promise.allSettled([checkGemini(), checkGroq(), checkOpenAI(), checkAnthropic(), checkKimi()]);
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
  // Initial check after 5 seconds
  setTimeout(runAllChecks, 5000);

  // Check every 5 minutes
  healthInterval = setInterval(runAllChecks, 5 * 60 * 1000);

  // Initialize all providers
  initProvider("gemini", !!process.env.GEMINI_API_KEY);
  initProvider("groq", !!process.env.GROQ_API_KEY);
  initProvider("openai", !!process.env.OPENAI_API_KEY);
  initProvider("anthropic", !!process.env.ANTHROPIC_API_KEY);
  initProvider("kimi", !!process.env.KIMI_API_KEY);

  console.log("[Health Monitor] ✅ Provider health checks active (lightweight, 5 min interval)");
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

export function registerProviderHealthRoutes(app: Express): void {
  // Get all provider status
  app.get("/api/providers/health", async (_req, res) => {
    const results = await runAllChecks();
    const configured = results.filter(r => r.configured);
    const allHealthy = configured.length > 0 && configured.every(r => r.status === "healthy");
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
      kimi: checkKimi,
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
