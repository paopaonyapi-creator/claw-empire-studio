/**
 * Google Gemini Provider — Direct integration with Google AI Studio
 *
 * Uses Gemini 2.0 Flash (free tier) for all AI tasks:
 * - Content generation
 * - Trend analysis
 * - Script writing
 * - Smart CEO replies
 *
 * Free tier: 15 RPM, 1M tokens/day
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

// Available Gemini models
export const GEMINI_MODELS = {
  flash: "gemini-2.0-flash",           // Fast, free, great for most tasks
  flashLite: "gemini-2.0-flash-lite",   // Ultra-fast, lighter tasks
  pro: "gemini-2.0-pro-exp-02-05",     // Most capable (experimental)
} as const;

export type GeminiModel = (typeof GEMINI_MODELS)[keyof typeof GEMINI_MODELS];

interface GeminiMessage {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
    finishReason?: string;
  }>;
  error?: { message?: string; code?: number };
}

// ---------------------------------------------------------------------------
// Core: Generate content with Gemini
// ---------------------------------------------------------------------------

export async function geminiGenerate(opts: {
  prompt: string;
  systemInstruction?: string;
  model?: GeminiModel;
  maxTokens?: number;
  temperature?: number;
}): Promise<{ text: string; error?: string }> {
  if (!GEMINI_API_KEY) {
    return { text: "", error: "GEMINI_API_KEY not configured" };
  }

  const model = opts.model || GEMINI_MODELS.flash;
  const url = `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const contents: GeminiMessage[] = [
    { role: "user", parts: [{ text: opts.prompt }] },
  ];

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: opts.maxTokens || 2048,
      temperature: opts.temperature ?? 0.7,
    },
  };

  if (opts.systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: opts.systemInstruction }],
    };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[Gemini] ❌ HTTP ${res.status}: ${errText.slice(0, 200)}`);
      return { text: "", error: `Gemini API error: ${res.status}` };
    }

    const data = (await res.json()) as GeminiResponse;

    if (data.error) {
      return { text: "", error: data.error.message || "Gemini error" };
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return { text };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Gemini] ❌ Error:", msg);
    return { text: "", error: msg };
  }
}

// ---------------------------------------------------------------------------
// Chat: Multi-turn conversation with Gemini
// ---------------------------------------------------------------------------

export async function geminiChat(opts: {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  systemInstruction?: string;
  model?: GeminiModel;
  maxTokens?: number;
}): Promise<{ text: string; error?: string }> {
  if (!GEMINI_API_KEY) {
    return { text: "", error: "GEMINI_API_KEY not configured" };
  }

  const model = opts.model || GEMINI_MODELS.flash;
  const url = `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const contents: GeminiMessage[] = opts.messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: opts.maxTokens || 1024,
      temperature: 0.7,
    },
  };

  if (opts.systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: opts.systemInstruction }],
    };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return { text: "", error: `Gemini API error: ${res.status}` };
    }

    const data = (await res.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return { text };
  } catch (err) {
    return { text: "", error: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------------
// Status check
// ---------------------------------------------------------------------------

export function isGeminiConfigured(): boolean {
  return !!GEMINI_API_KEY;
}

export async function testGeminiConnection(): Promise<{ ok: boolean; model: string; message: string }> {
  if (!GEMINI_API_KEY) {
    return { ok: false, model: "", message: "GEMINI_API_KEY not set" };
  }

  const result = await geminiGenerate({
    prompt: "ตอบสั้นๆ 1 ประโยค: ระบบ AI พร้อมทำงานแล้ว",
    model: GEMINI_MODELS.flash,
    maxTokens: 50,
  });

  return {
    ok: !result.error,
    model: GEMINI_MODELS.flash,
    message: result.text || result.error || "No response",
  };
}
