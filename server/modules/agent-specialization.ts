/**
 * Agent Specialization — Assign optimal AI models per role
 *
 * Primary: Google Gemini 2.0 Flash (free!)
 * Fallback: OpenRouter (paid)
 *
 * Gemini handles all roles efficiently with free tier.
 * OpenRouter kept as fallback if Gemini is unavailable.
 */

import type { DatabaseSync } from "node:sqlite";
import { isGeminiConfigured, testGeminiConnection, GEMINI_MODELS } from "./gemini-provider.ts";

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";

// ---------------------------------------------------------------------------
// Model Mapping: agent name pattern → optimal model
// ---------------------------------------------------------------------------

interface ModelSpec {
  provider: string;
  model: string;
  reason: string;
}

const GEMINI_AGENT_MAP: Array<{ pattern: RegExp; spec: ModelSpec }> = [
  // Strategy & Research — Gemini Flash is excellent at analysis
  {
    pattern: /chief.*content|strategist/i,
    spec: { provider: "gemini", model: GEMINI_MODELS.flash, reason: "strategic planning (Gemini)" },
  },
  {
    pattern: /trend.*hunter/i,
    spec: { provider: "gemini", model: GEMINI_MODELS.flash, reason: "trend research (Gemini)" },
  },
  {
    pattern: /audience.*insight|planner/i,
    spec: { provider: "gemini", model: GEMINI_MODELS.flash, reason: "audience analysis (Gemini)" },
  },

  // Content Production — Gemini Flash great for Thai content
  {
    pattern: /content.*writer/i,
    spec: { provider: "gemini", model: GEMINI_MODELS.flash, reason: "creative writing (Gemini)" },
  },
  {
    pattern: /hook.*copy|specialist/i,
    spec: { provider: "gemini", model: GEMINI_MODELS.flash, reason: "copywriting (Gemini)" },
  },

  // Creative Studio
  {
    pattern: /visual.*designer/i,
    spec: { provider: "gemini", model: GEMINI_MODELS.flash, reason: "visual concepts (Gemini)" },
  },
  {
    pattern: /video.*script|producer/i,
    spec: { provider: "gemini", model: GEMINI_MODELS.flash, reason: "video scripting (Gemini)" },
  },

  // Distribution & Analytics
  {
    pattern: /calendar.*manager/i,
    spec: { provider: "gemini", model: GEMINI_MODELS.flash, reason: "scheduling (Gemini)" },
  },
  {
    pattern: /publisher|community/i,
    spec: { provider: "gemini", model: GEMINI_MODELS.flash, reason: "publishing (Gemini)" },
  },
  {
    pattern: /performance.*analyst/i,
    spec: { provider: "gemini", model: GEMINI_MODELS.flash, reason: "analytics (Gemini)" },
  },
];

// OpenRouter fallback map
const OPENROUTER_AGENT_MAP: Array<{ pattern: RegExp; spec: ModelSpec }> = [
  { pattern: /chief.*content|strategist/i, spec: { provider: "openrouter", model: "anthropic/claude-3.5-sonnet", reason: "strategic planning" } },
  { pattern: /trend.*hunter/i, spec: { provider: "openrouter", model: "openai/gpt-4o", reason: "trend research" } },
  { pattern: /audience.*insight|planner/i, spec: { provider: "openrouter", model: "openai/gpt-4o", reason: "audience analysis" } },
  { pattern: /content.*writer/i, spec: { provider: "openrouter", model: "anthropic/claude-3.5-sonnet", reason: "creative writing" } },
  { pattern: /hook.*copy|specialist/i, spec: { provider: "openrouter", model: "anthropic/claude-3.5-sonnet", reason: "copywriting" } },
  { pattern: /visual.*designer/i, spec: { provider: "openrouter", model: "openai/gpt-4o", reason: "visual concepts" } },
  { pattern: /video.*script|producer/i, spec: { provider: "openrouter", model: "openai/gpt-4o", reason: "video scripting" } },
  { pattern: /calendar.*manager/i, spec: { provider: "openrouter", model: "openai/gpt-4o-mini", reason: "scheduling" } },
  { pattern: /publisher|community/i, spec: { provider: "openrouter", model: "openai/gpt-4o-mini", reason: "publishing" } },
  { pattern: /performance.*analyst/i, spec: { provider: "openrouter", model: "openai/gpt-4o-mini", reason: "analytics" } },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getModelForAgent(agentName: string): ModelSpec | null {
  // Prefer Gemini if configured
  const map = isGeminiConfigured() ? GEMINI_AGENT_MAP : OPENROUTER_AGENT_MAP;
  for (const entry of map) {
    if (entry.pattern.test(agentName)) {
      return entry.spec;
    }
  }
  return null;
}

export function applyAgentSpecialization(db: DatabaseSync): void {
  const hasGemini = isGeminiConfigured();
  const hasOpenRouter = !!OPENROUTER_KEY;

  if (!hasGemini && !hasOpenRouter) {
    console.log("[AgentSpec] ⏭️ Skipped: no AI API key configured");
    return;
  }

  const providerLabel = hasGemini ? "Gemini 2.0 Flash ✨" : "OpenRouter";
  console.log(`[AgentSpec] 🧠 Using ${providerLabel} as primary AI provider`);

  const agents = db
    .prepare("SELECT id, name, cli_provider FROM agents")
    .all() as Array<{ id: string; name: string; cli_provider: string | null }>;

  let updated = 0;
  const targetProvider = hasGemini ? "opencode" : "openrouter";

  for (const agent of agents) {
    const spec = getModelForAgent(agent.name);
    if (!spec) continue;

    // Update provider if needed
    if (agent.cli_provider !== targetProvider) {
      db.prepare("UPDATE agents SET cli_provider = ? WHERE id = ?").run(targetProvider, agent.id);
      console.log(`[AgentSpec] 🧠 ${agent.name}: ${agent.cli_provider || "none"} → ${targetProvider} (${spec.model}) — ${spec.reason}`);
      updated++;
    }
  }

  if (updated > 0) {
    console.log(`[AgentSpec] ✅ Specialized ${updated}/${agents.length} agents with ${providerLabel}`);
  } else {
    console.log(`[AgentSpec] ℹ️ All agents already specialized`);
  }
}

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------

export function registerSpecializationRoutes(app: any): void {
  // GET /api/agent-models — list all model assignments
  app.get("/api/agent-models", (_req: any, res: any) => {
    const hasGemini = isGeminiConfigured();
    const map = hasGemini ? GEMINI_AGENT_MAP : OPENROUTER_AGENT_MAP;
    const assignments = map.map((entry) => ({
      pattern: entry.pattern.source,
      provider: entry.spec.provider,
      model: entry.spec.model,
      reason: entry.spec.reason,
    }));
    res.json({
      models: assignments,
      primary_provider: hasGemini ? "gemini" : "openrouter",
      gemini_configured: hasGemini,
      openrouter_configured: !!OPENROUTER_KEY,
    });
  });

  // GET /api/gemini/status — check Gemini connection
  app.get("/api/gemini/status", async (_req: any, res: any) => {
    const result = await testGeminiConnection();
    res.json(result);
  });

  // POST /api/gemini/test — test generate with Gemini
  app.post("/api/gemini/test", async (req: any, res: any) => {
    const { prompt = "สวัสดี ระบบพร้อมทำงาน" } = req.body || {};

    if (!isGeminiConfigured()) {
      return res.status(400).json({ error: "GEMINI_API_KEY not configured" });
    }

    const { geminiGenerate } = await import("./gemini-provider.ts");
    const result = await geminiGenerate({ prompt, maxTokens: 200 });
    res.json({
      ok: !result.error,
      model: GEMINI_MODELS.flash,
      response: result.text,
      error: result.error,
    });
  });
}
