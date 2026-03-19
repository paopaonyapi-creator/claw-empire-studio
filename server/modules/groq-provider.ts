/**
 * Groq Provider — Free ultra-fast inference (Llama 3, Mixtral, Gemma)
 * Free tier: 30 RPM, 14,400 RPD
 * Used for: Agent Chat quick replies, fast summarization
 */

import type { Express } from "express";

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

// Available Groq models
export const GROQ_MODELS = {
  llama3_70b: "llama-3.3-70b-versatile",     // Best quality, 30 RPM
  llama3_8b: "llama-3.1-8b-instant",          // Ultra-fast, light tasks
  mixtral: "mixtral-8x7b-32768",              // Good for code/analysis
  gemma2: "gemma2-9b-it",                     // Google's model on Groq
} as const;

export type GroqModel = (typeof GROQ_MODELS)[keyof typeof GROQ_MODELS];

// ---------------------------------------------------------------------------
// Core: Generate with Groq
// ---------------------------------------------------------------------------

export async function groqGenerate(opts: {
  prompt: string;
  systemInstruction?: string;
  model?: GroqModel;
  maxTokens?: number;
  temperature?: number;
}): Promise<{ text: string; error?: string; latencyMs?: number }> {
  if (!GROQ_API_KEY) {
    return { text: "", error: "GROQ_API_KEY not configured" };
  }

  const model = opts.model || GROQ_MODELS.llama3_70b;
  const start = Date.now();

  const messages: any[] = [];
  if (opts.systemInstruction) {
    messages.push({ role: "system", content: opts.systemInstruction });
  }
  messages.push({ role: "user", content: opts.prompt });

  try {
    const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
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
      console.error(`[Groq] ❌ HTTP ${res.status}: ${errText.slice(0, 200)}`);
      return { text: "", error: `Groq API error: ${res.status}` };
    }

    const data = (await res.json()) as any;
    const text = data.choices?.[0]?.message?.content || "";
    const latencyMs = Date.now() - start;

    return { text, latencyMs };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Groq] ❌ Error:", msg);
    return { text: "", error: msg };
  }
}

// ---------------------------------------------------------------------------
// Chat: Multi-turn with Groq
// ---------------------------------------------------------------------------

export async function groqChat(opts: {
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  model?: GroqModel;
  maxTokens?: number;
}): Promise<{ text: string; error?: string; latencyMs?: number }> {
  if (!GROQ_API_KEY) {
    return { text: "", error: "GROQ_API_KEY not configured" };
  }

  const start = Date.now();
  try {
    const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: opts.model || GROQ_MODELS.llama3_70b,
        messages: opts.messages,
        max_tokens: opts.maxTokens || 1024,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      return { text: "", error: `Groq API error: ${res.status}` };
    }

    const data = (await res.json()) as any;
    const text = data.choices?.[0]?.message?.content || "";
    return { text, latencyMs: Date.now() - start };
  } catch (err) {
    return { text: "", error: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------------
// Status & Routes
// ---------------------------------------------------------------------------

export function isGroqConfigured(): boolean {
  return !!GROQ_API_KEY;
}

export async function testGroqConnection(): Promise<{ ok: boolean; model: string; message: string; latencyMs?: number }> {
  if (!GROQ_API_KEY) {
    return { ok: false, model: "", message: "GROQ_API_KEY not set" };
  }

  const result = await groqGenerate({
    prompt: "ตอบสั้นๆ 1 ประโยค: AI พร้อมทำงาน",
    model: GROQ_MODELS.llama3_8b,
    maxTokens: 50,
  });

  return {
    ok: !result.error,
    model: GROQ_MODELS.llama3_8b,
    message: result.text || result.error || "No response",
    latencyMs: result.latencyMs,
  };
}

export function registerGroqRoutes(app: Express): void {
  // Test connection
  app.get("/api/groq/status", async (_req, res) => {
    const result = await testGroqConnection();
    res.json({ ok: true, groq: result, configured: isGroqConfigured() });
  });

  // Generate with Groq
  app.post("/api/groq/generate", async (req, res) => {
    const { prompt, model, systemInstruction, maxTokens } = req.body || {};
    if (!prompt) return res.status(400).json({ ok: false, error: "prompt required" });

    const result = await groqGenerate({ prompt, model, systemInstruction, maxTokens });
    res.json({ ok: !result.error, ...result });
  });

  // List models
  app.get("/api/groq/models", (_req, res) => {
    res.json({
      ok: true,
      models: Object.entries(GROQ_MODELS).map(([key, id]) => ({
        key,
        id,
        description: key === "llama3_70b" ? "Best quality (30 RPM)"
          : key === "llama3_8b" ? "Ultra-fast (free)"
          : key === "mixtral" ? "Good for code/analysis"
          : "Google Gemma on Groq",
      })),
    });
  });

  console.log(`[Groq] ✅ Provider ready (configured: ${isGroqConfigured()})`);
}
