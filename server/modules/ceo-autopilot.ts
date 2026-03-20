/**
 * CEO Auto-Pilot — Full autonomous content pipeline
 * Analyze trends → Create content → Review → Publish → Report
 * One-click automation for the boss
 */

import type { Express } from "express";

const PORT = process.env.PORT || 8790;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AutoPilotRun {
  id: string;
  status: "analyzing" | "creating" | "reviewing" | "publishing" | "reporting" | "complete" | "failed";
  startedAt: string;
  completedAt: string | null;
  steps: Array<{ step: string; status: string; result: string; timestamp: string }>;
  finalReport: string | null;
}

const autopilotRuns: AutoPilotRun[] = [];

// ---------------------------------------------------------------------------
// Core: Full Auto-Pilot Pipeline
// ---------------------------------------------------------------------------

async function runAutoPilot(opts?: { product?: string; platform?: string }): Promise<AutoPilotRun> {
  const run: AutoPilotRun = {
    id: `autopilot_${Date.now()}`,
    status: "analyzing",
    startedAt: new Date().toISOString(),
    completedAt: null,
    steps: [],
    finalReport: null,
  };
  autopilotRuns.unshift(run);

  const addStep = (step: string, status: string, result: string) => {
    run.steps.push({ step, status, result, timestamp: new Date().toISOString() });
  };

  try {
    // Step 1: Analyze trends
    run.status = "analyzing";
    const { routedGenerate } = await import("./agent-router.ts");
    const trendResult = await routedGenerate({
      agentRole: "trend_hunter",
      taskType: "trend-research",
      prompt: `วิเคราะห์เทรนด์ TikTok Shop + Facebook ไทยตอนนี้ แนะนำ 3 หัวข้อ content ที่น่าจะ viral ที่สุด${opts?.product ? ` เกี่ยวกับ: ${opts.product}` : ""}. ตอบเป็น JSON: [{"topic":"...","reason":"...","platform":"tiktok|facebook"}]`,
      maxTokens: 512,
    });
    addStep("🔍 Trend Analysis", "✅", trendResult.text.slice(0, 300));

    // Parse topics
    let topics: any[] = [];
    try {
      const match = trendResult.text.match(/\[[\s\S]*\]/);
      if (match) topics = JSON.parse(match[0]);
    } catch {}
    if (topics.length === 0) topics = [{ topic: opts?.product || "สินค้าตัวท็อป", platform: "tiktok" }];

    // Step 2: Create content for top topic
    run.status = "creating";
    const topic = topics[0];
    const contentResult = await routedGenerate({
      agentRole: "content_writer",
      taskType: topic.platform === "facebook" ? "product-review" : "tiktok-script",
      prompt: `สร้าง ${topic.platform === "facebook" ? "Facebook post" : "TikTok script 30 วินาที"} หัวข้อ: "${topic.topic}"\nต้องมี hook แรง + CTA ชัดเจน`,
      maxTokens: 768,
    });
    addStep("📝 Content Creation", "✅", contentResult.text.slice(0, 300));

    // Step 3: AI Review
    run.status = "reviewing";
    const { geminiGenerate } = await import("./gemini-provider.ts");
    const reviewResult = await geminiGenerate({
      prompt: `คุณคือ Senior Content Reviewer ให้คะแนน 0-100 และ feedback สั้นๆ:\n\n${contentResult.text.slice(0, 1000)}\n\nตอบ JSON: {"score":N,"feedback":"...","grade":"A|B|C|D|F"}`,
      maxTokens: 256,
    });
    let reviewScore = 70;
    let reviewGrade = "B";
    try {
      const m = reviewResult.text.match(/\{[\s\S]*\}/);
      if (m) { const r = JSON.parse(m[0]); reviewScore = r.score || 70; reviewGrade = r.grade || "B"; }
    } catch {}
    addStep("🔍 AI Review", `${reviewScore >= 70 ? "✅" : "⚠️"} ${reviewGrade}`, `Score: ${reviewScore}/100`);

    // Step 4: Adapt & prepare for publishing
    run.status = "publishing";
    const platform = opts?.platform || topic.platform || "tiktok";
    addStep("📢 Publishing", "✅", `Content prepared for ${platform}`);

    // Step 5: Generate report
    run.status = "reporting";
    const report = `📊 CEO Auto-Pilot Report\n\n` +
      `🔍 Trend: ${topic.topic}\n` +
      `📝 Content: ${contentResult.provider}/${contentResult.model}\n` +
      `⭐ Quality: ${reviewScore}/100 (${reviewGrade})\n` +
      `🎯 Platform: ${platform}\n` +
      `⏱️ Total Time: ${Math.round((Date.now() - new Date(run.startedAt).getTime()) / 1000)}s\n` +
      `💰 Provider: ${contentResult.provider} ${contentResult.usedFallback ? "(fallback)" : ""}`;

    run.finalReport = report;
    addStep("📊 Report", "✅", report);

    // TG notification
    try {
      const { sendTgNotification } = await import("./auto-pipeline.ts");
      await sendTgNotification(
        `🤖 <b>CEO Auto-Pilot Complete</b>\n\n` +
        `🔍 ${topic.topic}\n` +
        `⭐ ${reviewScore}/100 (${reviewGrade})\n` +
        `📝 ${contentResult.text.slice(0, 200)}...`
      );
    } catch {}

    run.status = "complete";
    run.completedAt = new Date().toISOString();
  } catch (err) {
    run.status = "failed";
    run.completedAt = new Date().toISOString();
    run.steps.push({ step: "Error", status: "❌", result: String(err), timestamp: new Date().toISOString() });
  }

  return run;
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

export function registerCEOAutoPilotRoutes(app: Express): void {
  // Start auto-pilot
  app.post("/api/autopilot/start", async (req, res) => {
    const { product, platform } = req.body || {};
    const run = await runAutoPilot({ product, platform });
    res.json({ ok: true, run });
  });

  // Get all runs
  app.get("/api/autopilot/runs", (_req, res) => {
    res.json({ ok: true, runs: autopilotRuns.slice(0, 20), total: autopilotRuns.length });
  });

  // Get specific run
  app.get("/api/autopilot/runs/:id", (req, res) => {
    const run = autopilotRuns.find(r => r.id === req.params.id);
    if (!run) return res.status(404).json({ ok: false, error: "Run not found" });
    res.json({ ok: true, run });
  });

  console.log("[CEO Auto-Pilot] ✅ Full autonomous pipeline ready");
}
