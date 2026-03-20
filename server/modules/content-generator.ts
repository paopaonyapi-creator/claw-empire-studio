/**
 * AI Content Generator — Auto-create captions, hashtags, hooks
 *
 * Uses OpenRouter/Gemini API to generate platform-specific content
 * TG: /generate <product> [platform] 
 * API: POST /api/generate { product, platform }
 */

import type { Express, Request, Response } from "express";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "path";

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const KIMI_KEY = process.env.KIMI_API_KEY || "";

interface GeneratedContent {
  id: string;
  product: string;
  platform: string;
  hook: string;
  caption: string;
  hashtags: string[];
  cta: string;
  timestamp: string;
}

const DATA_FILE = path.resolve("data/generated-content.json");

function loadHistory(): GeneratedContent[] {
  try {
    if (existsSync(DATA_FILE)) return JSON.parse(readFileSync(DATA_FILE, "utf-8")) || [];
  } catch { /* ignore */ }
  return [];
}

function saveHistory(data: GeneratedContent[]): void {
  mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Platform-specific prompt templates
const PLATFORM_PROMPTS: Record<string, string> = {
  tiktok: `สร้าง TikTok script สำหรับขายสินค้า:
- Hook (3 วินาทีแรก): ประโยคดึงดูดสั้นๆ กระชับ เน้นอารมณ์
- Caption: ข้อความสั้น 2-3 ประโยค ภาษาไม่เป็นทางการ ใส่อีโมจิ
- Hashtags: 5-7 hashtags ที่เกี่ยวข้อง ผสม trending + niche
- CTA: ชวนกด ปักตะกร้า/กดลิงก์`,

  facebook: `สร้าง Facebook post สำหรับขายสินค้า:
- Hook: ประโยคเปิดที่ดึงดูดให้หยุดเลื่อน
- Caption: ข้อความ 3-5 ประโยค อธิบายจุดเด่น ใส่อีโมจิ เล่าเรื่อง
- Hashtags: 3-5 hashtags
- CTA: ชวนกดดูสินค้า/สั่งซื้อ`,

  instagram: `สร้าง Instagram caption:
- Hook: ประโยคแรกที่ทำให้อยากอ่านต่อ
- Caption: 2-4 ประโยค aesthetic vibes ใส่อีโมจิ
- Hashtags: 10-15 hashtags ผสม popular + niche
- CTA: ชวน save, share, comment`,

  default: `สร้าง social media content:
- Hook: ประโยคดึงดูดสั้นๆ
- Caption: ข้อความ 2-3 ประโยค
- Hashtags: 5 hashtags
- CTA: call to action`,
};

async function generateWithAI(product: string, platform: string): Promise<GeneratedContent | null> {
  const prompt = PLATFORM_PROMPTS[platform] || PLATFORM_PROMPTS.default;
  const fullPrompt = `${prompt}\n\nสินค้า: ${product}\nPlatform: ${platform}\n\nตอบเป็น JSON format:\n{"hook":"...","caption":"...","hashtags":["..."],"cta":"..."}`;

  // Try OpenRouter first, then Gemini
  let result: string | null = null;

  if (OPENROUTER_KEY) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENROUTER_KEY}` },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-001",
          messages: [{ role: "user", content: fullPrompt }],
          max_tokens: 500,
        }),
      });
      if (res.ok) {
        const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
        result = data.choices?.[0]?.message?.content || null;
      }
    } catch { /* ignore */ }
  }

  if (!result && GEMINI_KEY) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] }),
        }
      );
      if (res.ok) {
        const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
        result = data.candidates?.[0]?.content?.parts?.[0]?.text || null;
      }
    } catch { /* ignore */ }
  }

  // Try KIMI (Moonshot) as third provider
  if (!result && KIMI_KEY) {
    try {
      const res = await fetch("https://api.moonshot.cn/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${KIMI_KEY}` },
        body: JSON.stringify({
          model: "moonshot-v1-8k",
          messages: [{ role: "user", content: fullPrompt }],
          temperature: 0.7,
        }),
      });
      if (res.ok) {
        const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
        result = data.choices?.[0]?.message?.content || null;
      }
    } catch { /* ignore */ }
  }

  if (!result) {
    // Fallback: generate simple template
    return {
      id: `gen-${Date.now()}`,
      product,
      platform,
      hook: `🔥 ${product} ใครยังไม่มี พลาดแล้ว!`,
      caption: `✨ ${product} คุณภาพดี ราคาโดน ใช้แล้วจะติดใจ 💯\nสินค้าขายดี อย่าพลาดนะ!`,
      hashtags: [`#${product.replace(/\s/g, "")}`, "#ของดีบอกต่อ", "#ขายดี", "#affiliate", `#${platform}`],
      cta: platform === "tiktok" ? "🛒 กดปักตะกร้าเลย!" : "🔗 กดลิงก์ในโปรไฟล์เลย!",
      timestamp: new Date().toISOString(),
    };
  }

  try {
    // Extract JSON from response
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        id: `gen-${Date.now()}`,
        product,
        platform,
        hook: parsed.hook || "",
        caption: parsed.caption || "",
        hashtags: parsed.hashtags || [],
        cta: parsed.cta || "",
        timestamp: new Date().toISOString(),
      };
    }
  } catch { /* ignore */ }

  return null;
}

// ---------------------------------------------------------------------------
// TG Command: /generate <product> [platform]
// ---------------------------------------------------------------------------

export async function handleGenerateCommand(arg: string): Promise<string> {
  if (!arg.trim()) {
    return "✨ AI Content Generator\n\nใช้: /generate <สินค้า> [platform]\n\nPlatforms: tiktok, facebook, instagram\n\nตัวอย่าง:\n/generate หมวกกันน็อค tiktok\n/generate ครีมกันแดด facebook";
  }

  const parts = arg.trim().split(/\s+/);
  const lastWord = parts[parts.length - 1].toLowerCase();
  const platforms = ["tiktok", "facebook", "instagram", "ig", "fb", "tt"];
  let platform = "tiktok";
  let product = arg.trim();

  if (platforms.includes(lastWord)) {
    platform = lastWord === "ig" ? "instagram" : lastWord === "fb" ? "facebook" : lastWord === "tt" ? "tiktok" : lastWord;
    product = parts.slice(0, -1).join(" ");
  }

  const content = await generateWithAI(product, platform);
  if (!content) return "❌ ไม่สามารถ generate ได้ ลองใหม่อีกครั้ง";

  // Save to history
  const history = loadHistory();
  history.unshift(content);
  if (history.length > 100) history.length = 100;
  saveHistory(history);

  let msg = `✨ Generated Content for "${product}"\n`;
  msg += `Platform: ${platform.toUpperCase()}\n`;
  msg += `${"─".repeat(24)}\n\n`;
  msg += `🎣 HOOK:\n${content.hook}\n\n`;
  msg += `📝 CAPTION:\n${content.caption}\n\n`;
  msg += `#️⃣ HASHTAGS:\n${content.hashtags.join(" ")}\n\n`;
  msg += `📢 CTA:\n${content.cta}`;

  return msg;
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

export function registerContentGeneratorRoutes(app: Express): void {
  // Generate content
  app.post("/api/generate", async (req: Request, res: Response) => {
    const { product = "", platform = "tiktok" } = req.body || {};
    if (!product) { res.status(400).json({ error: "product required" }); return; }
    const content = await generateWithAI(product, platform);
    if (!content) { res.status(500).json({ error: "generation failed" }); return; }

    const history = loadHistory();
    history.unshift(content);
    if (history.length > 100) history.length = 100;
    saveHistory(history);

    res.json(content);
  });

  // Get history
  app.get("/api/generate/history", (_req: Request, res: Response) => {
    res.json({ history: loadHistory().slice(0, 20) });
  });
}
