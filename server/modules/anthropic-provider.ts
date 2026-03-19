/**
 * Anthropic Provider — Claude 3.5 Sonnet, Claude 3 Haiku
 * Best for: Deep analysis, long-form content, nuanced reasoning
 */

import type { Express } from "express";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1";

export const ANTHROPIC_MODELS = {
  sonnet: "claude-3-5-sonnet-20241022",   // Most capable
  haiku: "claude-3-5-haiku-20241022",     // Fast + cheap
} as const;

export type AnthropicModel = (typeof ANTHROPIC_MODELS)[keyof typeof ANTHROPIC_MODELS];

export async function anthropicGenerate(opts: {
  prompt: string;
  systemInstruction?: string;
  model?: AnthropicModel;
  maxTokens?: number;
  temperature?: number;
}): Promise<{ text: string; error?: string; latencyMs?: number }> {
  if (!ANTHROPIC_API_KEY) return { text: "", error: "ANTHROPIC_API_KEY not configured" };

  const model = opts.model || ANTHROPIC_MODELS.haiku;
  const start = Date.now();

  try {
    const body: any = {
      model,
      max_tokens: opts.maxTokens || 1024,
      temperature: opts.temperature ?? 0.7,
      messages: [{ role: "user", content: opts.prompt }],
    };
    if (opts.systemInstruction) body.system = opts.systemInstruction;

    const res = await fetch(`${ANTHROPIC_BASE_URL}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[Anthropic] ❌ HTTP ${res.status}: ${errText.slice(0, 200)}`);
      return { text: "", error: `Anthropic API error: ${res.status}` };
    }

    const data = (await res.json()) as any;
    const text = data.content?.[0]?.text || "";
    return { text, latencyMs: Date.now() - start };
  } catch (err) {
    return { text: "", error: err instanceof Error ? err.message : String(err) };
  }
}

export function isAnthropicConfigured(): boolean { return !!ANTHROPIC_API_KEY; }

export async function testAnthropicConnection(): Promise<{ ok: boolean; model: string; message: string; latencyMs?: number }> {
  if (!ANTHROPIC_API_KEY) return { ok: false, model: "", message: "ANTHROPIC_API_KEY not set" };
  const result = await anthropicGenerate({ prompt: "ตอบสั้นๆ 1 ประโยค: AI พร้อมทำงาน", model: ANTHROPIC_MODELS.haiku, maxTokens: 50 });
  return { ok: !result.error, model: ANTHROPIC_MODELS.haiku, message: result.text || result.error || "No response", latencyMs: result.latencyMs };
}

export function registerAnthropicRoutes(app: Express): void {
  app.get("/api/anthropic/status", async (_req, res) => {
    const result = await testAnthropicConnection();
    res.json({ ok: true, anthropic: result, configured: isAnthropicConfigured() });
  });

  app.post("/api/anthropic/generate", async (req, res) => {
    const { prompt, model, systemInstruction, maxTokens } = req.body || {};
    if (!prompt) return res.status(400).json({ ok: false, error: "prompt required" });
    const result = await anthropicGenerate({ prompt, model, systemInstruction, maxTokens });
    res.json({ ok: !result.error, ...result });
  });

  app.get("/api/anthropic/models", (_req, res) => {
    res.json({ ok: true, models: Object.entries(ANTHROPIC_MODELS).map(([key, id]) => ({ key, id })) });
  });

  console.log(`[Anthropic] ✅ Provider ready (configured: ${isAnthropicConfigured()})`);
}
