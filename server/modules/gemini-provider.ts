/**
 * Google Gemini Provider — Direct integration with Google AI Studio
 *
 * Uses Gemini 2.5 Flash (free tier) for all AI tasks:
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
  flash: "gemini-2.5-flash",           // Fast, free, great for most tasks
  flashLite: "gemini-2.5-flash-lite",   // Ultra-fast, lighter tasks
  pro: "gemini-2.5-pro",               // Most capable
  imageGen: "gemini-2.5-flash-image",  // Image generation (Nano Banana)
} as const;

export type GeminiModel = (typeof GEMINI_MODELS)[keyof typeof GEMINI_MODELS] | string;

interface GeminiMessage {
  role: "user" | "model";
  parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
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
// Image Generation with Gemini
// ---------------------------------------------------------------------------

export async function geminiGenerateImage(opts: {
  prompt: string;
  model?: string;
  inputImage?: { data: Buffer; mimeType: string };
}): Promise<{ imageData?: Buffer; mimeType?: string; error?: string }> {
  if (!GEMINI_API_KEY) {
    return { error: "GEMINI_API_KEY not configured" };
  }

  // Try multiple model names since availability varies
  const modelsToTry = opts.model
    ? [opts.model]
    : [
        GEMINI_MODELS.imageGen,
        "gemini-3.1-flash-image-preview",
        "gemini-3-pro-image-preview",
        "gemini-2.5-flash-image",
        "gemini-2.0-flash-exp",
      ];

  // Build parts: text prompt + optional input image
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
  if (opts.inputImage) {
    parts.push({
      inlineData: {
        mimeType: opts.inputImage.mimeType,
        data: opts.inputImage.data.toString("base64"),
      },
    });
    console.log(`[Gemini] 📷 Input image: ${opts.inputImage.data.length} bytes (${opts.inputImage.mimeType})`);
  }
  parts.push({ text: opts.prompt });

  const body = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ["IMAGE", "TEXT"],
      temperature: 1.0,
    },
  };

  let lastError = "";

  for (const model of modelsToTry) {
    try {
      const url = `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      console.log(`[Gemini] 🎨 Trying image gen with ${model}...`);
      
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        lastError = `${model}: HTTP ${res.status}`;
        console.log(`[Gemini] ⚠️ ${model} failed (${res.status}), trying next...`);
        continue; // Try next model
      }

      const data = (await res.json()) as GeminiResponse;
      if (data.error) {
        lastError = `${model}: ${data.error.message}`;
        continue;
      }

      // Find the image part in the response
      const parts = data.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          const imageBuffer = Buffer.from(part.inlineData.data, "base64");
          console.log(`[Gemini] ✅ Image generated with ${model}: ${imageBuffer.length} bytes (${part.inlineData.mimeType})`);
          return {
            imageData: imageBuffer,
            mimeType: part.inlineData.mimeType || "image/png",
          };
        }
      }
      lastError = `${model}: No image in response`;
    } catch (err) {
      lastError = `${model}: ${err instanceof Error ? err.message : String(err)}`;
      console.log(`[Gemini] ⚠️ ${model} error: ${lastError}`);
    }
  }

  console.error(`[Gemini] ❌ All image models failed. Last: ${lastError}`);
  return { error: `All image models failed: ${lastError}` };
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
