/**
 * Agent Learning System — Agents learn from AI Review feedback
 * Stores feedback → analyzes patterns → improves agent prompts
 */

import type { Express } from "express";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FeedbackEntry {
  agentId: string;
  taskId: string;
  taskType: string;
  score: number;
  grade: string;
  strengths: string[];
  improvements: string[];
  recordedAt: string;
}

interface AgentLearning {
  agentId: string;
  agentName: string;
  totalFeedback: number;
  avgScore: number;
  scoreTrend: "improving" | "stable" | "declining";
  topStrengths: string[];
  topWeaknesses: string[];
  customInstructions: string;
  lastUpdated: string;
}

// In-memory stores
const feedbackHistory: FeedbackEntry[] = [];
const agentLearnings: Map<string, AgentLearning> = new Map();

// ---------------------------------------------------------------------------
// Core: Record & Learn
// ---------------------------------------------------------------------------

export function recordFeedback(entry: FeedbackEntry): void {
  feedbackHistory.push(entry);
  // Keep last 500
  if (feedbackHistory.length > 500) feedbackHistory.splice(0, feedbackHistory.length - 500);
  updateAgentLearning(entry.agentId);
}

function updateAgentLearning(agentId: string): void {
  const entries = feedbackHistory.filter(f => f.agentId === agentId);
  if (entries.length === 0) return;

  const existing = agentLearnings.get(agentId) || {
    agentId,
    agentName: agentId,
    totalFeedback: 0,
    avgScore: 0,
    scoreTrend: "stable" as const,
    topStrengths: [],
    topWeaknesses: [],
    customInstructions: "",
    lastUpdated: new Date().toISOString(),
  };

  // Calculate stats
  const scores = entries.map(e => e.score);
  existing.totalFeedback = entries.length;
  existing.avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  // Trend: compare last 3 vs first 3
  if (scores.length >= 6) {
    const recent = scores.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const early = scores.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    existing.scoreTrend = recent > early + 5 ? "improving" : recent < early - 5 ? "declining" : "stable";
  }

  // Aggregate strengths and weaknesses
  const strengthCount: Record<string, number> = {};
  const weaknessCount: Record<string, number> = {};
  for (const e of entries) {
    for (const s of e.strengths) { strengthCount[s] = (strengthCount[s] || 0) + 1; }
    for (const w of e.improvements) { weaknessCount[w] = (weaknessCount[w] || 0) + 1; }
  }

  existing.topStrengths = Object.entries(strengthCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([s]) => s);

  existing.topWeaknesses = Object.entries(weaknessCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([w]) => w);

  existing.lastUpdated = new Date().toISOString();
  agentLearnings.set(agentId, existing);
}

// Generate improved prompt based on learnings
async function generateImprovedPrompt(agentId: string): Promise<string> {
  const learning = agentLearnings.get(agentId);
  if (!learning || learning.totalFeedback < 3) {
    return "ข้อมูลยังไม่เพียงพอ (ต้องมี feedback อย่างน้อย 3 ครั้ง)";
  }

  const { geminiGenerate } = await import("./gemini-provider.ts");

  const prompt = `จากข้อมูล learning ของ agent "${learning.agentName}":

จุดแข็ง: ${learning.topStrengths.join(", ") || "ไม่มีข้อมูล"}
จุดอ่อน: ${learning.topWeaknesses.join(", ") || "ไม่มีข้อมูล"}
คะแนนเฉลี่ย: ${learning.avgScore}/100
แนวโน้ม: ${learning.scoreTrend}

กรุณาเขียน system prompt ที่ปรับปรุงแล้วสำหรับ agent นี้:
1. เสริมจุดแข็งที่มี
2. แก้ไขจุดอ่อนที่พบ
3. เพิ่มกฎเฉพาะเพื่อปรับปรุงคุณภาพ

ตอบเป็น system prompt เท่านั้น (2-4 บรรทัด)`;

  const result = await geminiGenerate({ prompt, maxTokens: 512 });
  const improved = result.text || "Unable to generate — please review manually";

  learning.customInstructions = improved;
  learning.lastUpdated = new Date().toISOString();
  agentLearnings.set(agentId, learning);

  return improved;
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

export function registerAgentLearningRoutes(app: Express): void {
  // Record feedback from AI Review
  app.post("/api/agents/learning/feedback", (req, res) => {
    const { agentId, taskId, taskType, score, grade, strengths, improvements } = req.body || {};
    if (!agentId || score === undefined) {
      return res.status(400).json({ ok: false, error: "agentId and score required" });
    }

    recordFeedback({
      agentId,
      taskId: taskId || "",
      taskType: taskType || "unknown",
      score,
      grade: grade || "?",
      strengths: strengths || [],
      improvements: improvements || [],
      recordedAt: new Date().toISOString(),
    });

    res.json({ ok: true, totalFeedback: feedbackHistory.filter(f => f.agentId === agentId).length });
  });

  // Get agent learning profile
  app.get("/api/agents/:id/learning", (req, res) => {
    const learning = agentLearnings.get(req.params.id);
    if (!learning) return res.json({ ok: true, learning: null, message: "No learning data yet" });
    res.json({ ok: true, learning });
  });

  // Get all agent learnings
  app.get("/api/agents/learning/all", (_req, res) => {
    const all = Array.from(agentLearnings.values()).sort((a, b) => b.avgScore - a.avgScore);
    res.json({ ok: true, agents: all, total: all.length });
  });

  // Generate improved prompt
  app.post("/api/agents/:id/learning/improve", async (req, res) => {
    try {
      const improved = await generateImprovedPrompt(req.params.id);
      res.json({ ok: true, improvedPrompt: improved });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // Get feedback history
  app.get("/api/agents/learning/history", (_req, res) => {
    const recent = feedbackHistory.slice(-50).reverse();
    res.json({ ok: true, history: recent, total: feedbackHistory.length });
  });

  console.log("[Agent Learning] ✅ Feedback loop and prompt improvement ready");
}
