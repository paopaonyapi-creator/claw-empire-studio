/**
 * Cost Optimizer — Track API costs, recommend cheapest routes
 * Monitors usage per provider and suggests optimizations
 */

import type { Express } from "express";

// ---------------------------------------------------------------------------
// Types & Pricing
// ---------------------------------------------------------------------------

interface UsageEntry {
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  timestamp: string;
}

// Pricing per 1M tokens (input/output)
const PRICING: Record<string, { input: number; output: number; currency: string }> = {
  "gpt-4o": { input: 2.50, output: 10.00, currency: "USD" },
  "gpt-4o-mini": { input: 0.15, output: 0.60, currency: "USD" },
  "gpt-4-turbo": { input: 10.00, output: 30.00, currency: "USD" },
  "claude-3-5-sonnet-20241022": { input: 3.00, output: 15.00, currency: "USD" },
  "claude-3-5-haiku-20241022": { input: 0.25, output: 1.25, currency: "USD" },
  "gemini-2.5-flash": { input: 0, output: 0, currency: "USD" }, // Free tier
  "llama-3.3-70b-versatile": { input: 0, output: 0, currency: "USD" }, // Groq free
  "llama-3.1-8b-instant": { input: 0, output: 0, currency: "USD" },
  "mixtral-8x7b-32768": { input: 0, output: 0, currency: "USD" },
  "moonshot-v1-8k": { input: 0.12, output: 0.12, currency: "CNY" },
  "moonshot-v1-32k": { input: 0.24, output: 0.24, currency: "CNY" },
};

// In-memory usage log
const usageLog: UsageEntry[] = [];

// ---------------------------------------------------------------------------
// Track & Calculate
// ---------------------------------------------------------------------------

export function trackUsage(provider: string, model: string, tokensIn: number, tokensOut: number): void {
  const pricing = PRICING[model] || { input: 0, output: 0, currency: "USD" };
  const cost = (tokensIn / 1_000_000) * pricing.input + (tokensOut / 1_000_000) * pricing.output;

  usageLog.push({
    provider,
    model,
    tokensIn,
    tokensOut,
    cost,
    timestamp: new Date().toISOString(),
  });

  if (usageLog.length > 2000) usageLog.splice(0, usageLog.length - 2000);
}

function getCostSummary(): {
  totalCost: number;
  byProvider: Record<string, { cost: number; calls: number; tokens: number }>;
  recommendations: string[];
} {
  const byProvider: Record<string, { cost: number; calls: number; tokens: number }> = {};

  for (const entry of usageLog) {
    if (!byProvider[entry.provider]) byProvider[entry.provider] = { cost: 0, calls: 0, tokens: 0 };
    byProvider[entry.provider].cost += entry.cost;
    byProvider[entry.provider].calls += 1;
    byProvider[entry.provider].tokens += entry.tokensIn + entry.tokensOut;
  }

  const totalCost = Object.values(byProvider).reduce((s, p) => s + p.cost, 0);

  // Generate recommendations
  const recommendations: string[] = [];
  if (byProvider["openai"]?.cost > 1) {
    recommendations.push("💡 OpenAI costs high — consider routing simple tasks to Groq (free)");
  }
  if (byProvider["anthropic"]?.cost > 1) {
    recommendations.push("💡 Anthropic costs high — use Claude Haiku instead of Sonnet for light tasks");
  }
  if (!byProvider["groq"]) {
    recommendations.push("💡 Groq not used yet — route chat/summary tasks there (free, ultra-fast)");
  }
  if (!byProvider["gemini"]) {
    recommendations.push("💡 Gemini not used yet — great free option for most content tasks");
  }
  if (totalCost === 0) {
    recommendations.push("✅ All free providers — zero cost!");
  }

  return { totalCost: Math.round(totalCost * 10000) / 10000, byProvider, recommendations };
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

export function registerCostOptimizerRoutes(app: Express): void {
  // Cost dashboard
  app.get("/api/costs/summary", (_req, res) => {
    const summary = getCostSummary();
    res.json({ ok: true, ...summary });
  });

  // Track usage manually
  app.post("/api/costs/track", (req, res) => {
    const { provider, model, tokensIn, tokensOut } = req.body || {};
    if (!provider || !model) return res.status(400).json({ ok: false, error: "provider and model required" });
    trackUsage(provider, model, tokensIn || 0, tokensOut || 0);
    res.json({ ok: true });
  });

  // Get pricing table
  app.get("/api/costs/pricing", (_req, res) => {
    const table = Object.entries(PRICING).map(([model, p]) => ({
      model,
      inputPer1M: p.input,
      outputPer1M: p.output,
      currency: p.currency,
      isFree: p.input === 0 && p.output === 0,
    }));
    res.json({ ok: true, pricing: table });
  });

  // Get usage log
  app.get("/api/costs/log", (_req, res) => {
    res.json({ ok: true, log: usageLog.slice(-50).reverse(), total: usageLog.length });
  });

  // Cost-optimized route suggestion
  app.get("/api/costs/optimize", (req, res) => {
    const taskType = (req.query.task as string) || "general";
    const freeModels = Object.entries(PRICING).filter(([, p]) => p.input === 0 && p.output === 0).map(([m]) => m);
    const cheapModels = Object.entries(PRICING).filter(([, p]) => p.input > 0 && p.input < 1).map(([m]) => m);

    res.json({
      ok: true,
      taskType,
      recommendation: {
        cheapest: { models: freeModels, note: "Free tier — $0" },
        balanced: { models: cheapModels, note: "Low cost + good quality" },
        premium: { models: ["gpt-4o", "claude-3-5-sonnet-20241022"], note: "Best quality, higher cost" },
      },
    });
  });

  console.log("[Cost Optimizer] ✅ API cost tracking and optimization ready");
}
