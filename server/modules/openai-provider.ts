/**
 * OpenAI Provider — GPT-4o, GPT-4o-mini
 * Best for: Complex content, creative writing, nuanced Thai
 */

import type { Express } from "express";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_BASE_URL = "https://api.openai.com/v1";

export const OPENAI_MODELS = {
  gpt4o: "gpt-4o",                   // Most capable
  gpt4o_mini: "gpt-4o-mini",         // Fast + cheap
  gpt4_turbo: "gpt-4-turbo",         // Good balance
} as const;

export type OpenAIModel = (typeof OPENAI_MODELS)[keyof typeof OPENAI_MODELS];

export async function openaiGenerate(opts: {
  prompt: string;
  systemInstruction?: string;
  model?: OpenAIModel;
  maxTokens?: number;
  temperature?: number;
}): Promise<{ text: string; error?: string; latencyMs?: number }> {
  if (!OPENAI_API_KEY) return { text: "", error: "OPENAI_API_KEY not configured" };

  const model = opts.model || OPENAI_MODELS.gpt4o_mini;
  const start = Date.now();
  const messages: any[] = [];
  if (opts.systemInstruction) messages.push({ role: "system", content: opts.systemInstruction });
  messages.push({ role: "user", content: opts.prompt });

  try {
    const res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({ model, messages, max_tokens: opts.maxTokens || 1024, temperature: opts.temperature ?? 0.7 }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[OpenAI] ❌ HTTP ${res.status}: ${errText.slice(0, 200)}`);
      return { text: "", error: `OpenAI API error: ${res.status}` };
    }

    const data = (await res.json()) as any;
    return { text: data.choices?.[0]?.message?.content || "", latencyMs: Date.now() - start };
  } catch (err) {
    return { text: "", error: err instanceof Error ? err.message : String(err) };
  }
}

export function isOpenAIConfigured(): boolean { return !!OPENAI_API_KEY; }

export async function testOpenAIConnection(): Promise<{ ok: boolean; model: string; message: string; latencyMs?: number }> {
  if (!OPENAI_API_KEY) return { ok: false, model: "", message: "OPENAI_API_KEY not set" };
  const result = await openaiGenerate({ prompt: "ตอบสั้นๆ 1 ประโยค: AI พร้อมทำงาน", model: OPENAI_MODELS.gpt4o_mini, maxTokens: 50 });
  return { ok: !result.error, model: OPENAI_MODELS.gpt4o_mini, message: result.text || result.error || "No response", latencyMs: result.latencyMs };
}

export async function openaiGenerateImage(prompt: string): Promise<{ url: string; error?: string }> {
  if (!OPENAI_API_KEY) return { url: "", error: "OPENAI_API_KEY not configured" };
  try {
    const res = await fetch(`${OPENAI_BASE_URL}/images/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: prompt.substring(0, 4000), // DALL-E 3 prompt limit
        n: 1,
        size: "1024x1024",
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[OpenAI-Image] ❌ HTTP ${res.status}: ${errText.slice(0, 200)}`);
      return { url: "", error: `DALL-E 3 API error: ${res.status}` };
    }
    const data = await res.json() as any;
    return { url: data.data?.[0]?.url || "" };
  } catch (err) {
    return { url: "", error: err instanceof Error ? err.message : String(err) };
  }
}

export function registerOpenAIRoutes(app: Express): void {
  app.get("/api/openai/status", async (_req, res) => {
    const result = await testOpenAIConnection();
    res.json({ ok: true, openai: result, configured: isOpenAIConfigured() });
  });

  app.post("/api/openai/generate", async (req, res) => {
    const { prompt, model, systemInstruction, maxTokens } = req.body || {};
    if (!prompt) return res.status(400).json({ ok: false, error: "prompt required" });
    const result = await openaiGenerate({ prompt, model, systemInstruction, maxTokens });
    res.json({ ok: !result.error, ...result });
  });

  app.get("/api/openai/models", (_req, res) => {
    res.json({ ok: true, models: Object.entries(OPENAI_MODELS).map(([key, id]) => ({ key, id })) });
  });

  console.log(`[OpenAI] ✅ Provider ready (configured: ${isOpenAIConfigured()})`);
}
