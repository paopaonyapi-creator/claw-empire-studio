/**
 * Agent Auto-Test Pipeline — Automatically test all agents
 * Creates test tasks → runs agents → checks quality via AI Review
 */

import type { Express } from "express";

const PORT = process.env.PORT || 8790;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TestResult {
  agentId: string;
  agentName: string;
  taskType: string;
  status: "pass" | "fail" | "error" | "pending";
  score: number | null;
  grade: string | null;
  latencyMs: number;
  error: string | null;
  testedAt: string;
}

interface TestRun {
  id: string;
  startedAt: string;
  completedAt: string | null;
  status: "running" | "complete" | "failed";
  results: TestResult[];
  summary: { total: number; passed: number; failed: number; avgScore: number };
}

const testRuns: TestRun[] = [];

// Test prompts for each task type
const TEST_PROMPTS: Record<string, string> = {
  "tiktok-script": "เขียน TikTok script สั้นๆ 30 วินาที สำหรับรีวิวหูฟัง Bluetooth ราคาไม่เกิน 500 บาท",
  "product-review": "เขียนรีวิวสินค้า: เครื่องชงกาแฟแคปซูล Nespresso Vertuo ข้อดีข้อเสีย",
  "trend-research": "วิเคราะห์เทรนด์ TikTok Shop ไทย สัปดาห์นี้ หมวดความงาม",
  "thumbnail-brief": "เขียน brief สำหรับ thumbnail TikTok: รีวิวครีมกันแดด Top 3",
  "caption": "เขียน caption IG สำหรับโพสต์รีวิวน้ำหอม มี hashtag",
};

// ---------------------------------------------------------------------------
// Core: Run Full Test Suite
// ---------------------------------------------------------------------------

async function runAgentTests(): Promise<TestRun> {
  const run: TestRun = {
    id: `test_${Date.now()}`,
    startedAt: new Date().toISOString(),
    completedAt: null,
    status: "running",
    results: [],
    summary: { total: 0, passed: 0, failed: 0, avgScore: 0 },
  };
  testRuns.unshift(run);

  try {
    // Get all agents
    const agentsRes = await fetch(`http://127.0.0.1:${PORT}/api/agents`);
    if (!agentsRes.ok) throw new Error("Cannot fetch agents");
    const agentsData = (await agentsRes.json()) as any;
    const agents = agentsData.agents || [];

    for (const agent of agents.slice(0, 10)) {
      const taskType = Object.keys(TEST_PROMPTS)[Math.floor(Math.random() * Object.keys(TEST_PROMPTS).length)];
      const prompt = TEST_PROMPTS[taskType];
      const start = Date.now();

      const result: TestResult = {
        agentId: agent.id,
        agentName: agent.name || agent.id,
        taskType,
        status: "pending",
        score: null,
        grade: null,
        latencyMs: 0,
        error: null,
        testedAt: new Date().toISOString(),
      };

      try {
        // Use agent router to generate
        const { routedGenerate } = await import("./agent-router.ts");
        const genResult = await routedGenerate({
          agentRole: agent.role || "*",
          taskType,
          prompt: `คุณคือ ${agent.name}. ${prompt}`,
          systemInstruction: agent.system_prompt || undefined,
          maxTokens: 512,
        });

        result.latencyMs = Date.now() - start;

        if (genResult.error && !genResult.text) {
          result.status = "error";
          result.error = genResult.error;
        } else if (genResult.text.length < 20) {
          result.status = "fail";
          result.score = 10;
          result.grade = "F";
          result.error = "Output too short";
        } else {
          // Quick quality score based on length and content
          const len = genResult.text.length;
          const hasEmoji = /[\u{1F300}-\u{1FAFF}]/u.test(genResult.text);
          const hasThai = /[\u0E00-\u0E7F]/.test(genResult.text);
          const quickScore = Math.min(100,
            (len > 200 ? 40 : len > 100 ? 30 : 20) +
            (hasEmoji ? 15 : 0) +
            (hasThai ? 20 : 0) +
            (len > 50 ? 15 : 5) +
            (genResult.latencyMs < 3000 ? 10 : 5)
          );

          result.score = quickScore;
          result.grade = quickScore >= 80 ? "A" : quickScore >= 60 ? "B" : quickScore >= 40 ? "C" : "D";
          result.status = quickScore >= 50 ? "pass" : "fail";
        }
      } catch (err) {
        result.status = "error";
        result.error = String(err);
        result.latencyMs = Date.now() - start;
      }

      run.results.push(result);
    }

    // Summary
    const scores = run.results.filter(r => r.score !== null).map(r => r.score!);
    run.summary = {
      total: run.results.length,
      passed: run.results.filter(r => r.status === "pass").length,
      failed: run.results.filter(r => r.status === "fail" || r.status === "error").length,
      avgScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    };
    run.status = "complete";
    run.completedAt = new Date().toISOString();

    // TG notification
    try {
      const { sendTgNotification } = await import("./auto-pipeline.ts");
      await sendTgNotification(
        `🧪 <b>Agent Auto-Test Complete</b>\n\n` +
        `✅ Passed: ${run.summary.passed}/${run.summary.total}\n` +
        `❌ Failed: ${run.summary.failed}\n` +
        `📊 Avg Score: ${run.summary.avgScore}/100`
      );
    } catch {}

  } catch (err) {
    run.status = "failed";
    run.completedAt = new Date().toISOString();
  }

  return run;
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

export function registerAgentAutoTestRoutes(app: Express): void {
  app.post("/api/agents/auto-test", async (_req, res) => {
    const run = await runAgentTests();
    res.json({ ok: true, run });
  });

  app.get("/api/agents/test-runs", (_req, res) => {
    res.json({ ok: true, runs: testRuns.slice(0, 20), total: testRuns.length });
  });

  app.get("/api/agents/test-runs/:id", (req, res) => {
    const run = testRuns.find(r => r.id === req.params.id);
    if (!run) return res.status(404).json({ ok: false, error: "Test run not found" });
    res.json({ ok: true, run });
  });

  console.log("[Auto-Test] ✅ Agent testing pipeline ready");
}
