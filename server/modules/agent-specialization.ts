/**
 * Agent Specialization — Assign optimal AI models per role
 *
 * Maps each agent role to the best model via OpenRouter:
 * - Research roles → GPT-4o (best at analysis & search)
 * - Writing roles → Claude 3.5 Sonnet (best at creative writing)
 * - Design roles → GPT-4o (best at visual descriptions)
 * - Analytics roles → GPT-4o-mini (cost-efficient for data)
 *
 * Runs on startup and can be triggered via API.
 */

import type { DatabaseSync } from "node:sqlite";

const OPENROUTER_KEY =
  process.env.OPENROUTER_API_KEY || "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";

// ---------------------------------------------------------------------------
// Model Mapping: agent name pattern → optimal model
// ---------------------------------------------------------------------------

interface ModelSpec {
  provider: string;
  model: string;
  reason: string;
}

const AGENT_MODEL_MAP: Array<{ pattern: RegExp; spec: ModelSpec }> = [
  // Strategy & Research — need strong reasoning
  {
    pattern: /chief.*content|strategist/i,
    spec: { provider: "openrouter", model: "anthropic/claude-3.5-sonnet", reason: "strategic planning" },
  },
  {
    pattern: /trend.*hunter/i,
    spec: { provider: "openrouter", model: "openai/gpt-4o", reason: "trend research & analysis" },
  },
  {
    pattern: /audience.*insight|planner/i,
    spec: { provider: "openrouter", model: "openai/gpt-4o", reason: "audience data analysis" },
  },

  // Content Production — need creative writing
  {
    pattern: /content.*writer/i,
    spec: { provider: "openrouter", model: "anthropic/claude-3.5-sonnet", reason: "creative writing" },
  },
  {
    pattern: /hook.*copy|specialist/i,
    spec: { provider: "openrouter", model: "anthropic/claude-3.5-sonnet", reason: "copywriting & hooks" },
  },

  // Creative Studio — visual descriptions
  {
    pattern: /visual.*designer/i,
    spec: { provider: "openrouter", model: "openai/gpt-4o", reason: "visual concept generation" },
  },
  {
    pattern: /video.*script|producer/i,
    spec: { provider: "openrouter", model: "openai/gpt-4o", reason: "video production scripting" },
  },

  // Distribution & Analytics — cost-efficient
  {
    pattern: /calendar.*manager/i,
    spec: { provider: "openrouter", model: "openai/gpt-4o-mini", reason: "scheduling (cost-efficient)" },
  },
  {
    pattern: /publisher|community/i,
    spec: { provider: "openrouter", model: "openai/gpt-4o-mini", reason: "publishing tasks (cost-efficient)" },
  },
  {
    pattern: /performance.*analyst/i,
    spec: { provider: "openrouter", model: "openai/gpt-4o-mini", reason: "analytics (cost-efficient)" },
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getModelForAgent(agentName: string): ModelSpec | null {
  for (const entry of AGENT_MODEL_MAP) {
    if (entry.pattern.test(agentName)) {
      return entry.spec;
    }
  }
  return null;
}

export function applyAgentSpecialization(db: DatabaseSync): void {
  if (!OPENROUTER_KEY) {
    console.log("[AgentSpec] ⏭️ Skipped: no OpenRouter API key");
    return;
  }

  const agents = db
    .prepare("SELECT id, name, cli_provider FROM agents")
    .all() as Array<{ id: string; name: string; cli_provider: string | null }>;

  let updated = 0;

  for (const agent of agents) {
    const spec = getModelForAgent(agent.name);
    if (!spec) continue;

    // Only update if currently using default claude or no provider
    if (agent.cli_provider === "claude" || !agent.cli_provider) {
      db.prepare("UPDATE agents SET cli_provider = ? WHERE id = ?").run(spec.provider, agent.id);
      console.log(
        `[AgentSpec] 🧠 ${agent.name}: ${agent.cli_provider || "none"} → ${spec.provider} (${spec.model}) — ${spec.reason}`,
      );
      updated++;
    }
  }

  if (updated > 0) {
    console.log(`[AgentSpec] ✅ Specialized ${updated}/${agents.length} agents with OpenRouter models`);
  } else {
    console.log(`[AgentSpec] ℹ️ All agents already specialized`);
  }
}

// ---------------------------------------------------------------------------
// API: Register routes for specialization
// ---------------------------------------------------------------------------

export function registerSpecializationRoutes(app: any): void {
  // GET /api/agent-models — list all model assignments
  app.get("/api/agent-models", (_req: any, res: any) => {
    const assignments = AGENT_MODEL_MAP.map((entry) => ({
      pattern: entry.pattern.source,
      provider: entry.spec.provider,
      model: entry.spec.model,
      reason: entry.spec.reason,
    }));
    res.json({ models: assignments, openrouter_configured: !!OPENROUTER_KEY });
  });
}
