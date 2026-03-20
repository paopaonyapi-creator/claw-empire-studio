/**
 * TikTok Ideas API — AI-powered TikTok content ideas generator
 *
 * POST /api/tiktok/ideas — receive product name, return Hook/Caption/Hashtag/Script
 * Supports: Gemini → KIMI (Moonshot) → Error fallback
 */

import type { Express, Request, Response } from "express";
import { getStudioDb } from "./studio-db.ts";

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const KIMI_KEY = process.env.KIMI_API_KEY || "";

export function registerTikTokIdeasRoutes(app: Express): void {
  // POST /api/tiktok/ideas — Generate TikTok content ideas via AI
  app.post("/api/tiktok/ideas", async (req: Request, res: Response) => {
    try {
      const { productName, productUrl, targetAudience, commission } = req.body;
      if (!productName) return res.status(400).json({ ok: false, error: "productName required" });

      // Build prompt
      const prompt = `คุณเป็น TikTok Content Creator สายขายของ Affiliate Marketing ระดับ Top 1% ในไทย

สินค้า: "${productName}"
${productUrl ? `ลิงก์: ${productUrl}` : ""}
${targetAudience ? `กลุ่มเป้าหมาย: ${targetAudience}` : ""}
${commission ? `ค่าคอม: ${commission}` : ""}

สร้าง TikTok Content ที่ทำให้คนกดสั่งซื้อในวิดีโอเดียว ในรูปแบบ JSON:
{
  "hooks": ["hook 1 เน้น pain point", "hook 2 เน้น result", "hook 3 เน้น deal"],
  "caption": "caption สั้น กระชับ พร้อม CTA",
  "hashtags": ["#tag1", "#tag2", ... 10 tags รวม trending + niche],
  "script": {
    "sec0_5": "Hook แรก 5 วินาที (ต้องหยุด scroll)",
    "sec5_15": "ปัญหา/สภาพก่อน ใช้สินค้า",
    "sec15_25": "วิธีใช้/ผลลัพธ์",
    "sec25_30": "CTA + ราคา + ลิงก์"
  },
  "postingTips": ["เวลาโพสต์ที่ดีที่สุด", "tip เพิ่ม reach"]
}

ตอบ JSON เท่านั้น ไม่ต้องอธิบาย`;

      let rawText: string | null = null;
      let usedProvider = "";

      // --- Provider 1: Gemini (env var or db) ---
      const geminiKey = GEMINI_KEY || (() => {
        try {
          const db = getStudioDb();
          const row = db.prepare(
            "SELECT api_key FROM api_providers WHERE provider = 'google' AND is_active = 1 LIMIT 1"
          ).get() as { api_key: string } | undefined;
          return row?.api_key || "";
        } catch { return ""; }
      })();

      if (geminiKey) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
          const geminiRes = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.9, maxOutputTokens: 2048 },
            }),
          });
          if (geminiRes.ok) {
            const data = await geminiRes.json() as any;
            rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
            if (rawText) usedProvider = "Gemini";
          }
        } catch { /* fallthrough */ }
      }

      // --- Provider 2: KIMI (Moonshot) ---
      if (!rawText && KIMI_KEY) {
        try {
          const kimiRes = await fetch("https://api.moonshot.cn/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${KIMI_KEY}` },
            body: JSON.stringify({
              model: "moonshot-v1-8k",
              messages: [{ role: "user", content: prompt }],
              temperature: 0.7,
            }),
          });
          if (kimiRes.ok) {
            const data = await kimiRes.json() as any;
            rawText = data?.choices?.[0]?.message?.content ?? null;
            if (rawText) usedProvider = "KIMI";
          }
        } catch { /* fallthrough */ }
      }

      if (!rawText) {
        return res.status(503).json({ ok: false, error: "No AI provider available. Set GEMINI_API_KEY or KIMI_API_KEY." });
      }

      // Parse JSON from response
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return res.status(500).json({ ok: false, error: "AI returned invalid format" });

      const ideas = JSON.parse(jsonMatch[0]);
      res.json({ ok: true, ideas, productName, provider: usedProvider });
    } catch (err: any) {
      console.error("[TikTokIdeas] Error:", err.message);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  console.log("[TikTokIdeas] 💡 API ready (Gemini + KIMI): POST /api/tiktok/ideas");
}
