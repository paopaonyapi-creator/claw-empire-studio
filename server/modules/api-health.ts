/**
 * API Health Monitor — Monitor all connected APIs every 5 minutes
 *
 * Checks: Telegram, Facebook, OpenRouter, Gemini, Supabase, Railway
 * Sends TG alert when API status changes (up → down or down → up)
 *
 * TG: /health — show all API statuses
 * API: GET /api/health — JSON status report
 */

import type { Express, Request, Response } from "express";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "path";

interface ApiStatus {
  name: string;
  icon: string;
  status: "up" | "down" | "degraded" | "unconfigured";
  latency: number; // ms
  lastCheck: string;
  lastError?: string;
  uptime: number; // percentage
  checksTotal: number;
  checksOk: number;
}

const HEALTH_FILE = path.resolve("data/api-health.json");

function loadHealth(): Record<string, ApiStatus> {
  try { if (existsSync(HEALTH_FILE)) return JSON.parse(readFileSync(HEALTH_FILE, "utf-8")) || {}; } catch {} return {};
}
function saveHealth(d: Record<string, ApiStatus>): void {
  mkdirSync(path.dirname(HEALTH_FILE), { recursive: true });
  writeFileSync(HEALTH_FILE, JSON.stringify(d, null, 2));
}

// ---------------------------------------------------------------------------
// Individual API Health Checks
// ---------------------------------------------------------------------------

async function checkTelegram(): Promise<{ ok: boolean; latency: number; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, latency: 0, error: "TELEGRAM_BOT_TOKEN not set" };
  const start = Date.now();
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: AbortSignal.timeout(10000) });
    const latency = Date.now() - start;
    if (!res.ok) return { ok: false, latency, error: `HTTP ${res.status}` };
    return { ok: true, latency };
  } catch (e) { return { ok: false, latency: Date.now() - start, error: String(e) }; }
}

async function checkFacebook(): Promise<{ ok: boolean; latency: number; error?: string }> {
  const token = process.env.FACEBOOK_ACCESS_TOKEN;
  if (!token) return { ok: false, latency: 0, error: "FACEBOOK_ACCESS_TOKEN not set" };
  const start = Date.now();
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${token}`, { signal: AbortSignal.timeout(10000) });
    const latency = Date.now() - start;
    if (!res.ok) {
      const data = await res.json() as { error?: { message?: string } };
      return { ok: false, latency, error: data.error?.message || `HTTP ${res.status}` };
    }
    return { ok: true, latency };
  } catch (e) { return { ok: false, latency: Date.now() - start, error: String(e) }; }
}

async function checkOpenRouter(): Promise<{ ok: boolean; latency: number; error?: string }> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return { ok: false, latency: 0, error: "OPENROUTER_API_KEY not set" };
  const start = Date.now();
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { "Authorization": `Bearer ${key}` },
      signal: AbortSignal.timeout(10000),
    });
    const latency = Date.now() - start;
    return { ok: res.ok, latency, error: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (e) { return { ok: false, latency: Date.now() - start, error: String(e) }; }
}

async function checkGemini(): Promise<{ ok: boolean; latency: number; error?: string }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, latency: 0, error: "GEMINI_API_KEY not set" };
  const start = Date.now();
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, {
      signal: AbortSignal.timeout(10000),
    });
    const latency = Date.now() - start;
    return { ok: res.ok, latency, error: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (e) { return { ok: false, latency: Date.now() - start, error: String(e) }; }
}

async function checkSupabase(): Promise<{ ok: boolean; latency: number; error?: string }> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return { ok: false, latency: 0, error: "SUPABASE_URL or SUPABASE_KEY not set" };
  const start = Date.now();
  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: { "apikey": key, "Authorization": `Bearer ${key}` },
      signal: AbortSignal.timeout(10000),
    });
    const latency = Date.now() - start;
    return { ok: res.ok || res.status === 404, latency }; // 404 is ok = no tables yet
  } catch (e) { return { ok: false, latency: Date.now() - start, error: String(e) }; }
}

async function checkRailway(): Promise<{ ok: boolean; latency: number; error?: string }> {
  const start = Date.now();
  try {
    const domain = process.env.RAILWAY_PUBLIC_DOMAIN;
    if (!domain) return { ok: true, latency: 0 }; // Running locally
    const res = await fetch(`https://${domain}/`, { signal: AbortSignal.timeout(10000) });
    const latency = Date.now() - start;
    return { ok: res.ok || res.status === 401, latency }; // 401 = auth gate = server is up
  } catch (e) { return { ok: false, latency: Date.now() - start, error: String(e) }; }
}

// ---------------------------------------------------------------------------
// Run All Checks
// ---------------------------------------------------------------------------

const API_CHECKS: Array<{ name: string; icon: string; fn: () => Promise<{ ok: boolean; latency: number; error?: string }> }> = [
  { name: "Telegram Bot", icon: "📱", fn: checkTelegram },
  { name: "Facebook Graph", icon: "📘", fn: checkFacebook },
  { name: "OpenRouter AI", icon: "🤖", fn: checkOpenRouter },
  { name: "Gemini AI", icon: "✨", fn: checkGemini },
  { name: "Supabase DB", icon: "🗄️", fn: checkSupabase },
  { name: "Railway Server", icon: "🚀", fn: checkRailway },
];

async function runAllChecks(): Promise<Record<string, ApiStatus>> {
  const current = loadHealth();
  const now = new Date().toISOString();

  for (const api of API_CHECKS) {
    const prev = current[api.name] || {
      name: api.name, icon: api.icon, status: "unconfigured" as const,
      latency: 0, lastCheck: "", checksTotal: 0, checksOk: 0, uptime: 0,
    };

    const envKey = getEnvKey(api.name);
    if (envKey && !process.env[envKey]) {
      current[api.name] = { ...prev, status: "unconfigured", lastCheck: now, latency: 0 };
      continue;
    }

    const result = await api.fn();
    const prevStatus = prev.status;
    const newStatus = result.ok ? (result.latency > 5000 ? "degraded" : "up") : "down";

    prev.checksTotal += 1;
    if (result.ok) prev.checksOk += 1;
    prev.uptime = prev.checksTotal > 0 ? Math.round((prev.checksOk / prev.checksTotal) * 100) : 0;
    prev.status = newStatus;
    prev.latency = result.latency;
    prev.lastCheck = now;
    prev.lastError = result.error;
    prev.icon = api.icon;
    prev.name = api.name;

    current[api.name] = prev;

    // Alert on status change
    if (prevStatus !== "unconfigured" && prevStatus !== newStatus) {
      const emoji = newStatus === "up" ? "✅" : newStatus === "degraded" ? "⚠️" : "🔴";
      sendHealthAlert(`${emoji} ${api.icon} ${api.name}: ${prevStatus} → ${newStatus}${result.error ? `\n   Error: ${result.error}` : ""}`);
    }
  }

  saveHealth(current);
  return current;
}

function getEnvKey(apiName: string): string {
  const map: Record<string, string> = {
    "Telegram Bot": "TELEGRAM_BOT_TOKEN",
    "Facebook Graph": "FACEBOOK_ACCESS_TOKEN",
    "OpenRouter AI": "OPENROUTER_API_KEY",
    "Gemini AI": "GEMINI_API_KEY",
    "Supabase DB": "SUPABASE_URL",
  };
  return map[apiName] || "";
}

// TG Alert
function sendHealthAlert(text: string): void {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: `🏥 API Health Alert\n\n${text}` }),
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// TG Command: /health
// ---------------------------------------------------------------------------

export async function handleHealthCommand(): Promise<string> {
  const results = await runAllChecks();
  const apis = Object.values(results);

  const statusIcon = (s: string) => s === "up" ? "🟢" : s === "degraded" ? "🟡" : s === "unconfigured" ? "⚪" : "🔴";

  let msg = "🏥 API HEALTH\n";
  msg += `${"═".repeat(26)}\n\n`;

  for (const api of apis) {
    msg += `${statusIcon(api.status)} ${api.icon} ${api.name}\n`;
    if (api.status === "unconfigured") {
      msg += `   ⚪ Not configured\n\n`;
    } else {
      msg += `   ${api.latency}ms | Uptime ${api.uptime}% | ${api.checksTotal} checks\n`;
      if (api.lastError) msg += `   ❗ ${api.lastError.substring(0, 50)}\n`;
      msg += "\n";
    }
  }

  const upCount = apis.filter((a) => a.status === "up").length;
  const total = apis.filter((a) => a.status !== "unconfigured").length;
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `✅ ${upCount}/${total} APIs operational`;

  return msg;
}

// ---------------------------------------------------------------------------
// Scheduler — check every 5 minutes
// ---------------------------------------------------------------------------

export function startHealthScheduler(): void {
  // Run first check after 30 seconds
  setTimeout(() => { runAllChecks().catch(() => {}); }, 30000);
  // Then every 5 minutes
  setInterval(() => { runAllChecks().catch(() => {}); }, 5 * 60 * 1000);
  console.log("[api-health] 🏥 Monitor active — checking every 5 minutes");
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

export function registerHealthRoutes(app: Express): void {
  app.get("/api/health", async (_req: Request, res: Response) => {
    const results = await runAllChecks();
    const apis = Object.values(results);
    const upCount = apis.filter((a) => a.status === "up").length;
    const total = apis.filter((a) => a.status !== "unconfigured").length;
    res.json({
      overall: upCount === total ? "healthy" : upCount > 0 ? "degraded" : "down",
      upCount, total,
      apis: results,
      lastCheck: new Date().toISOString(),
    });
  });
}
