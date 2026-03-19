/**
 * AI Auto-Review — Gemini reviews agent task drafts
 * Scores quality, suggests improvements, auto-approves if high quality
 */

import type { Express } from "express";

const PORT = process.env.PORT || 8800;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReviewResult {
  taskId: string;
  score: number; // 0-100
  grade: "A" | "B" | "C" | "D" | "F";
  gradeEmoji: string;
  summary: string;
  strengths: string[];
  improvements: string[];
  autoApproved: boolean;
  reviewedAt: string;
}

// Store reviews (in-memory)
const reviews: Map<string, ReviewResult> = new Map();

// ---------------------------------------------------------------------------
// Core Review Function
// ---------------------------------------------------------------------------

async function reviewTask(taskId: string): Promise<ReviewResult> {
  // Fetch task
  const taskRes = await fetch(`http://127.0.0.1:${PORT}/api/tasks/${taskId}`);
  if (!taskRes.ok) throw new Error("Task not found");
  const taskData = (await taskRes.json()) as any;
  const task = taskData.task;
  
  if (!task?.result) throw new Error("Task has no result to review");

  const { geminiGenerate } = await import("./gemini-provider.ts");

  const prompt = `คุณคือ Senior Content Reviewer ระดับมืออาชีพ กรุณาตรวจสอบงานนี้:

ชื่องาน: ${task.title || "Untitled"}
ผลลัพธ์:
${task.result.slice(0, 3000)}

ให้คะแนนและ review ตาม JSON format นี้:
{
  "score": 0-100,
  "summary": "สรุปภาพรวมคุณภาพงาน (1-2 ประโยค ภาษาไทย)",
  "strengths": ["จุดเด่น 1", "จุดเด่น 2"],
  "improvements": ["ข้อเสนอแนะ 1", "ข้อเสนอแนะ 2"]
}

เกณฑ์ให้คะแนน:
- ความถูกต้อง (30%): ข้อมูลถูกต้อง ไม่ misleading
- ความน่าสนใจ (25%): Hook ดี ดึงดูด target audience
- ความครบถ้วน (25%): ครอบคลุมทุกประเด็น มี CTA ชัดเจน
- ภาษา/สไตล์ (20%): เหมาะกับแพลตฟอร์ม tone เข้ากับ brand

ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น`;

  const response = await geminiGenerate({ prompt, maxTokens: 1024 });
  
  let parsed: any = { score: 50, summary: "ระบบ review ไม่สามารถประเมินได้", strengths: [], improvements: [] };
  try {
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
  } catch {}

  const score = Math.max(0, Math.min(100, parsed.score || 50));
  const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";
  const gradeEmoji = { A: "🌟", B: "✅", C: "⚠️", D: "📝", F: "❌" }[grade];

  const result: ReviewResult = {
    taskId,
    score,
    grade,
    gradeEmoji,
    summary: parsed.summary || "No summary",
    strengths: parsed.strengths || [],
    improvements: parsed.improvements || [],
    autoApproved: score >= 80,
    reviewedAt: new Date().toISOString(),
  };

  reviews.set(taskId, result);

  // Send agent chat notification
  try {
    const { sendAgentMessage } = await import("./agent-chat.ts");
    sendAgentMessage({
      fromAgentId: "ai_reviewer",
      fromAgentName: "🤖 AI Reviewer",
      content: `${gradeEmoji} Review: "${task.title}" — ${score}/100 (${grade})\n${result.summary}${result.autoApproved ? "\n✅ Auto-approved!" : ""}`,
      type: "review_response",
      taskId,
    });
  } catch {}

  // TG notification for important reviews
  if (score < 60) {
    try {
      const { sendTgNotification } = await import("./auto-pipeline.ts");
      await sendTgNotification(
        `${gradeEmoji} <b>AI Review: ${grade}</b>\n\n📝 "${task.title}"\n📊 Score: ${score}/100\n\n💡 ${result.improvements.slice(0, 2).join("\n💡 ")}`
      );
    } catch {}
  }

  return result;
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

export function registerAiReviewRoutes(app: Express): void {
  // Review a specific task
  app.post("/api/tasks/:id/ai-review", async (req, res) => {
    try {
      const result = await reviewTask(req.params.id);
      res.json({ ok: true, review: result });
    } catch (err) {
      res.status(400).json({ ok: false, error: String(err) });
    }
  });

  // Get review for a task
  app.get("/api/tasks/:id/review", (req, res) => {
    const review = reviews.get(req.params.id);
    if (!review) return res.status(404).json({ ok: false, error: "No review found" });
    res.json({ ok: true, review });
  });

  // Get all reviews
  app.get("/api/reviews", (_req, res) => {
    const all = Array.from(reviews.values()).sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt));
    res.json({ ok: true, reviews: all, total: all.length });
  });

  // Review stats
  app.get("/api/reviews/stats", (_req, res) => {
    const all = Array.from(reviews.values());
    const avgScore = all.length > 0 ? Math.round(all.reduce((s, r) => s + r.score, 0) / all.length) : 0;
    const gradeCount = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    all.forEach(r => gradeCount[r.grade]++);
    res.json({ ok: true, total: all.length, avgScore, grades: gradeCount, autoApproved: all.filter(r => r.autoApproved).length });
  });

  console.log("[AI Review] ✅ Gemini-powered content review ready");
}
