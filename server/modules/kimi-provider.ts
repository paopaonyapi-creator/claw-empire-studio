/**
 * KIMI Provider — Moonshot AI (Kimi k2.5)
 * OpenAI-compatible API for Chinese + multilingual tasks
 */

import type { Express } from "express";

const KIMI_API_KEY = process.env.KIMI_API_KEY || "";
const KIMI_BASE_URL = "https://api.moonshot.cn/v1";

export const KIMI_MODELS = {
  k2_5: "moonshot-v1-8k",        // Fast, 8K context
  k2_5_32k: "moonshot-v1-32k",   // Medium, 32K context
  k2_5_128k: "moonshot-v1-128k", // Large context
} as const;

export type KimiModel = (typeof KIMI_MODELS)[keyof typeof KIMI_MODELS];

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

export async function kimiGenerate(opts: {
  prompt: string;
  systemInstruction?: string;
  model?: KimiModel;
  maxTokens?: number;
  temperature?: number;
}): Promise<{ text: string; error?: string; latencyMs?: number }> {
  if (!KIMI_API_KEY) {
    return { text: "", error: "KIMI_API_KEY not configured" };
  }

  const model = opts.model || KIMI_MODELS.k2_5;
  const start = Date.now();

  const messages: any[] = [];
  if (opts.systemInstruction) {
    messages.push({ role: "system", content: opts.systemInstruction });
  }
  messages.push({ role: "user", content: opts.prompt });

  try {
    const res = await fetch(`${KIMI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${KIMI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: opts.maxTokens || 1024,
        temperature: opts.temperature ?? 0.7,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[Kimi] ❌ HTTP ${res.status}: ${errText.slice(0, 200)}`);
      return { text: "", error: `Kimi API error: ${res.status}` };
    }

    const data = (await res.json()) as any;
    const text = data.choices?.[0]?.message?.content || "";
    return { text, latencyMs: Date.now() - start };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { text: "", error: msg };
  }
}

export function isKimiConfigured(): boolean {
  return !!KIMI_API_KEY;
}

export async function testKimiConnection(): Promise<{ ok: boolean; model: string; message: string; latencyMs?: number }> {
  if (!KIMI_API_KEY) {
    return { ok: false, model: "", message: "KIMI_API_KEY not set" };
  }
  const result = await kimiGenerate({
    prompt: "ตอบสั้นๆ 1 ประโยค: AI พร้อมทำงาน",
    model: KIMI_MODELS.k2_5,
    maxTokens: 50,
  });
  return {
    ok: !result.error,
    model: KIMI_MODELS.k2_5,
    message: result.text || result.error || "No response",
    latencyMs: result.latencyMs,
  };
}

export function registerKimiRoutes(app: Express): void {
  app.get("/api/kimi/status", async (_req, res) => {
    const result = await testKimiConnection();
    res.json({ ok: true, kimi: result, configured: isKimiConfigured() });
  });

  app.post("/api/kimi/generate", async (req, res) => {
    const { prompt, model, systemInstruction, maxTokens } = req.body || {};
    if (!prompt) return res.status(400).json({ ok: false, error: "prompt required" });
    const result = await kimiGenerate({ prompt, model, systemInstruction, maxTokens });
    res.json({ ok: !result.error, ...result });
  });

  app.get("/api/kimi/models", (_req, res) => {
    res.json({
      ok: true,
      models: Object.entries(KIMI_MODELS).map(([key, id]) => ({ key, id })),
    });
  });

  console.log(`[Kimi] ✅ Provider ready (configured: ${isKimiConfigured()})`);
}
