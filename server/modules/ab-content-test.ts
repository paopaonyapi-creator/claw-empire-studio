/**
 * A/B Content Testing — Generate content from 2 providers, compare quality
 * Pick the best version automatically
 */

import type { Express } from "express";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ABTestResult {
  id: string;
  prompt: string;
  taskType: string;
  variantA: { provider: string; model: string; text: string; score: number; latencyMs: number };
  variantB: { provider: string; model: string; text: string; score: number; latencyMs: number };
  winner: "A" | "B" | "tie";
  winnerReason: string;
  createdAt: string;
}

const abTests: ABTestResult[] = [];

// ---------------------------------------------------------------------------
// Core: Run A/B Test
// ---------------------------------------------------------------------------

async function runABTest(opts: {
  prompt: string;
  taskType?: string;
  providerA?: string;
  providerB?: string;
}): Promise<ABTestResult> {
  const { routedGenerate } = await import("./agent-router.ts");

  // Variant A — provider/default
  const startA = Date.now();
  const resultA = await routedGenerate({
    agentRole: opts.providerA || "content_writer",
    taskType: opts.taskType || "tiktok-script",
    prompt: opts.prompt,
    maxTokens: 512,
  });

  // Variant B — different provider
  const startB = Date.now();
  const resultB = await routedGenerate({
    agentRole: opts.providerB || "trend_hunter",
    taskType: opts.taskType || "product-review",
    prompt: opts.prompt,
    maxTokens: 512,
  });

  // Quick scoring
  const scoreA = quickScore(resultA.text);
  const scoreB = quickScore(resultB.text);
  const winner = scoreA > scoreB + 5 ? "A" : scoreB > scoreA + 5 ? "B" : "tie";

  const test: ABTestResult = {
    id: `ab_${Date.now()}`,
    prompt: opts.prompt.slice(0, 200),
    taskType: opts.taskType || "mixed",
    variantA: { provider: resultA.provider, model: resultA.model, text: resultA.text, score: scoreA, latencyMs: resultA.latencyMs },
    variantB: { provider: resultB.provider, model: resultB.model, text: resultB.text, score: scoreB, latencyMs: resultB.latencyMs },
    winner,
    winnerReason: winner === "A" ? `${resultA.provider} scored higher (${scoreA} vs ${scoreB})`
      : winner === "B" ? `${resultB.provider} scored higher (${scoreB} vs ${scoreA})`
      : `Tie — both scored ${scoreA}`,
    createdAt: new Date().toISOString(),
  };

  abTests.unshift(test);
  if (abTests.length > 100) abTests.length = 100;

  return test;
}

function quickScore(text: string): number {
  if (!text) return 0;
  const len = text.length;
  const hasEmoji = /[\u{1F300}-\u{1FAFF}]/u.test(text);
  const hasThai = /[\u0E00-\u0E7F]/.test(text);
  const hasHashtag = /#/.test(text);
  const hasCTA = /สั่งซื้อ|ลิงก์|คลิก|ดูเลย|ซื้อเลย|ปักตะกร้า/i.test(text);
  return Math.min(100,
    (len > 300 ? 35 : len > 150 ? 25 : len > 50 ? 15 : 5) +
    (hasEmoji ? 15 : 0) + (hasThai ? 20 : 0) +
    (hasHashtag ? 10 : 0) + (hasCTA ? 15 : 0) +
    (len > 100 ? 5 : 0)
  );
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

export function registerABTestRoutes(app: Express): void {
  app.post("/api/ab-test/run", async (req, res) => {
    const { prompt, taskType, providerA, providerB } = req.body || {};
    if (!prompt) return res.status(400).json({ ok: false, error: "prompt required" });
    try {
      const result = await runABTest({ prompt, taskType, providerA, providerB });
      res.json({ ok: true, test: result });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  app.get("/api/ab-test/history", (_req, res) => {
    res.json({ ok: true, tests: abTests.slice(0, 20), total: abTests.length });
  });

  app.get("/api/ab-test/stats", (_req, res) => {
    const wins: Record<string, number> = {};
    abTests.forEach(t => {
      const w = t.winner === "A" ? t.variantA.provider : t.winner === "B" ? t.variantB.provider : "tie";
      wins[w] = (wins[w] || 0) + 1;
    });
    res.json({ ok: true, total: abTests.length, wins });
  });

  console.log("[A/B Test] ✅ Multi-provider content comparison ready");
}
