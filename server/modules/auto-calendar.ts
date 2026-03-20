/**
 * Auto Content Calendar — AI-powered scheduling based on performance data
 * Analyzes best posting times, content mix, and agent capacity
 */

import type { Express } from "express";

const PORT = process.env.PORT || 8790;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScheduledSlot {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  platform: "tiktok" | "facebook" | "instagram" | "all";
  contentType: string;
  suggestedAgent: string | null;
  suggestedTopic: string;
  priority: "high" | "medium" | "low";
  status: "scheduled" | "draft" | "published" | "missed";
  pipelineId: string | null;
}

// In-memory schedule
const schedule: ScheduledSlot[] = [];

// ---------------------------------------------------------------------------
// AI Scheduling
// ---------------------------------------------------------------------------

async function generateWeeklySchedule(preferences?: { platforms?: string[]; postsPerDay?: number }): Promise<ScheduledSlot[]> {
  const postsPerDay = preferences?.postsPerDay || 3;
  const platforms = preferences?.platforms || ["tiktok", "facebook"];

  const { geminiGenerate } = await import("./gemini-provider.ts");

  // Get current products/trends for context
  let productContext = "";
  try {
    const { dbGetProducts } = await import("./studio-db.ts");
    const products = dbGetProducts().slice(0, 10);
    if (products.length > 0) {
      productContext = "\n\nสินค้าในระบบ:\n" + products.map(p => `- ${p.name} (${p.platform})`).join("\n");
    }
  } catch {}

  const today = new Date();
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }

  const prompt = `คุณคือ Content Calendar Strategist มืออาชีพ
กรุณาวางแผน Content Calendar 7 วันข้างหน้า

วันที่: ${days.join(", ")}
แพลตฟอร์ม: ${platforms.join(", ")}
โพสต์ต่อวัน: ${postsPerDay}
${productContext}

ตอบเป็น JSON Array ดังนี้:
[{
  "date": "YYYY-MM-DD",
  "time": "HH:mm",
  "platform": "tiktok|facebook|instagram",
  "contentType": "review|unboxing|comparison|tips|trend|story",
  "suggestedTopic": "หัวข้อที่แนะนำ",
  "priority": "high|medium|low"
}]

เคล็ดลับ posting time:
- TikTok: 12:00, 18:00, 21:00 (engagement สูงสุด)
- Facebook: 09:00, 13:00, 19:00
- IG: 11:00, 15:00, 20:00

กรุณาสร้าง ${postsPerDay * 7} entries ตอบ JSON เท่านั้น`;

  const response = await geminiGenerate({ prompt, maxTokens: 2048 });
  
  let slots: any[] = [];
  try {
    const jsonMatch = response.text.match(/\[[\s\S]*\]/);
    if (jsonMatch) slots = JSON.parse(jsonMatch[0]);
  } catch {}

  // Convert to ScheduledSlot
  const newSlots: ScheduledSlot[] = slots.slice(0, postsPerDay * 7).map((s: any, i: number) => ({
    id: `slot_${Date.now()}_${i}`,
    date: s.date || days[Math.floor(i / postsPerDay)],
    time: s.time || "12:00",
    platform: s.platform || "tiktok",
    contentType: s.contentType || "review",
    suggestedAgent: null,
    suggestedTopic: s.suggestedTopic || `Content #${i + 1}`,
    priority: s.priority || "medium",
    status: "scheduled",
    pipelineId: null,
  }));

  // Auto-assign agents
  try {
    const { findBestAgentForStep } = await import("./smart-assignment.ts");
    for (const slot of newSlots) {
      const agentId = await findBestAgentForStep(
        slot.contentType === "review" ? "product-review" : "tiktok-script",
        slot.suggestedTopic
      );
      slot.suggestedAgent = agentId;
    }
  } catch {}

  // Store
  schedule.push(...newSlots);

  return newSlots;
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

export function registerAutoCalendarRoutes(app: Express): void {
  // Generate AI schedule
  app.post("/api/calendar/auto-schedule", async (req, res) => {
    try {
      const { platforms, postsPerDay } = req.body || {};
      const slots = await generateWeeklySchedule({ platforms, postsPerDay });
      res.json({ ok: true, slots, total: slots.length });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // Get current schedule
  app.get("/api/calendar/schedule", (_req, res) => {
    const sorted = [...schedule].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
    res.json({ ok: true, schedule: sorted, total: sorted.length });
  });

  // Update a slot
  app.patch("/api/calendar/slots/:id", (req, res) => {
    const slot = schedule.find(s => s.id === req.params.id);
    if (!slot) return res.status(404).json({ ok: false, error: "Slot not found" });
    Object.assign(slot, req.body);
    res.json({ ok: true, slot });
  });

  // Execute a slot (start pipeline)
  app.post("/api/calendar/slots/:id/execute", async (req, res) => {
    const slot = schedule.find(s => s.id === req.params.id);
    if (!slot) return res.status(404).json({ ok: false, error: "Slot not found" });

    try {
      const pipelineRes = await fetch(`http://127.0.0.1:${PORT}/api/pipelines/tiktok-full/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: slot.suggestedTopic }),
      });
      const pipelineData = (await pipelineRes.json()) as any;
      slot.status = "draft";
      slot.pipelineId = pipelineData.pipeline?.id || null;
      res.json({ ok: true, slot, pipeline: pipelineData.pipeline });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  console.log("[Auto Calendar] ✅ AI-powered content scheduling ready");
}
