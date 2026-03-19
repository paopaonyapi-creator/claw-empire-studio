/**
 * Agent-Model Router — Maps each agent to their optimal AI model
 * Content writers → GPT-4o/Gemini, Researchers → Gemini, Chat → Groq
 */

import type { Express } from "express";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProviderName = "gemini" | "groq" | "openai" | "anthropic";

interface ModelRoute {
  provider: ProviderName;
  model: string;
  reason: string;
}

interface AgentModelConfig {
  agentRole: string;
  taskType: string;
  primary: ModelRoute;
  fallback: ModelRoute;
}

// ---------------------------------------------------------------------------
// Routing Table — Agent Role × Task Type → Best Model
// ---------------------------------------------------------------------------

const ROUTING_TABLE: AgentModelConfig[] = [
  // Content Writers → Gemini (free, good Thai)
  {
    agentRole: "content_writer",
    taskType: "tiktok-script",
    primary: { provider: "gemini", model: "gemini-2.0-flash", reason: "ฟรี + Thai content เก่ง" },
    fallback: { provider: "groq", model: "llama-3.3-70b-versatile", reason: "Backup เร็วมาก" },
  },
  {
    agentRole: "content_writer",
    taskType: "product-review",
    primary: { provider: "gemini", model: "gemini-2.0-flash", reason: "Long-form review ดี" },
    fallback: { provider: "groq", model: "llama-3.3-70b-versatile", reason: "Fallback" },
  },
  {
    agentRole: "hook_specialist",
    taskType: "tiktok-script",
    primary: { provider: "gemini", model: "gemini-2.0-flash", reason: "Creative hooks" },
    fallback: { provider: "groq", model: "llama-3.3-70b-versatile", reason: "Fast creative" },
  },

  // Researchers → Gemini (large context, free)
  {
    agentRole: "trend_hunter",
    taskType: "trend-research",
    primary: { provider: "gemini", model: "gemini-2.0-flash", reason: "Research + analysis" },
    fallback: { provider: "groq", model: "llama-3.3-70b-versatile", reason: "Quick research" },
  },
  {
    agentRole: "content_strategist",
    taskType: "trend-research",
    primary: { provider: "gemini", model: "gemini-2.0-flash", reason: "Strategic analysis" },
    fallback: { provider: "groq", model: "mixtral-8x7b-32768", reason: "Analytical fallback" },
  },
  {
    agentRole: "audience_planner",
    taskType: "trend-research",
    primary: { provider: "gemini", model: "gemini-2.0-flash", reason: "Audience insights" },
    fallback: { provider: "groq", model: "llama-3.3-70b-versatile", reason: "Quick insights" },
  },

  // Creative → Gemini (visual descriptions)
  {
    agentRole: "visual_designer",
    taskType: "thumbnail-brief",
    primary: { provider: "gemini", model: "gemini-2.0-flash", reason: "Visual descriptions" },
    fallback: { provider: "groq", model: "llama-3.3-70b-versatile", reason: "Backup creative" },
  },

  // Quick tasks → Groq (ultra-fast, free)
  {
    agentRole: "*",
    taskType: "chat",
    primary: { provider: "groq", model: "llama-3.1-8b-instant", reason: "Ultra-fast chat" },
    fallback: { provider: "gemini", model: "gemini-2.0-flash", reason: "Chat fallback" },
  },
  {
    agentRole: "*",
    taskType: "summary",
    primary: { provider: "groq", model: "llama-3.1-8b-instant", reason: "Fast summarization" },
    fallback: { provider: "gemini", model: "gemini-2.0-flash", reason: "Summary fallback" },
  },

  // Publisher/Analytics → Gemini
  {
    agentRole: "publisher",
    taskType: "*",
    primary: { provider: "gemini", model: "gemini-2.0-flash", reason: "Publishing tasks" },
    fallback: { provider: "groq", model: "llama-3.3-70b-versatile", reason: "Publish fallback" },
  },
  {
    agentRole: "analytics",
    taskType: "*",
    primary: { provider: "gemini", model: "gemini-2.0-flash", reason: "Data analysis" },
    fallback: { provider: "groq", model: "mixtral-8x7b-32768", reason: "Analysis fallback" },
  },
];

// Default fallback
const DEFAULT_ROUTE: AgentModelConfig = {
  agentRole: "*",
  taskType: "*",
  primary: { provider: "gemini", model: "gemini-2.0-flash", reason: "Default provider (free)" },
  fallback: { provider: "groq", model: "llama-3.3-70b-versatile", reason: "Default fallback" },
};

// ---------------------------------------------------------------------------
// Core Router
// ---------------------------------------------------------------------------

export function routeAgentToModel(agentRole: string, taskType: string): AgentModelConfig {
  // Exact match
  const exact = ROUTING_TABLE.find(
    r => r.agentRole === agentRole && r.taskType === taskType
  );
  if (exact) return exact;

  // Role match with wildcard task
  const roleMatch = ROUTING_TABLE.find(
    r => r.agentRole === agentRole && r.taskType === "*"
  );
  if (roleMatch) return roleMatch;

  // Task match with wildcard role
  const taskMatch = ROUTING_TABLE.find(
    r => r.agentRole === "*" && r.taskType === taskType
  );
  if (taskMatch) return taskMatch;

  return DEFAULT_ROUTE;
}

// Generate using the routed provider
export async function routedGenerate(opts: {
  agentRole: string;
  taskType: string;
  prompt: string;
  systemInstruction?: string;
  maxTokens?: number;
}): Promise<{ text: string; provider: string; model: string; latencyMs: number; usedFallback: boolean; error?: string }> {
  const route = routeAgentToModel(opts.agentRole, opts.taskType);
  const start = Date.now();

  // Try primary
  const primaryResult = await callProvider(route.primary, opts);
  if (primaryResult.text && !primaryResult.error) {
    return {
      text: primaryResult.text,
      provider: route.primary.provider,
      model: route.primary.model,
      latencyMs: Date.now() - start,
      usedFallback: false,
    };
  }

  // Try fallback
  console.log(`[Router] ⚠️ Primary ${route.primary.provider} failed, trying fallback ${route.fallback.provider}`);
  const fallbackResult = await callProvider(route.fallback, opts);

  return {
    text: fallbackResult.text,
    provider: route.fallback.provider,
    model: route.fallback.model,
    latencyMs: Date.now() - start,
    usedFallback: true,
    error: fallbackResult.error,
  };
}

async function callProvider(
  route: ModelRoute,
  opts: { prompt: string; systemInstruction?: string; maxTokens?: number }
): Promise<{ text: string; error?: string }> {
  try {
    switch (route.provider) {
      case "gemini": {
        const { geminiGenerate } = await import("./gemini-provider.ts");
        return await geminiGenerate({ prompt: opts.prompt, systemInstruction: opts.systemInstruction, maxTokens: opts.maxTokens });
      }
      case "groq": {
        const { groqGenerate } = await import("./groq-provider.ts");
        return await groqGenerate({ prompt: opts.prompt, systemInstruction: opts.systemInstruction, model: route.model as any, maxTokens: opts.maxTokens });
      }
      default:
        return { text: "", error: `Provider ${route.provider} not implemented yet` };
    }
  } catch (err) {
    return { text: "", error: String(err) };
  }
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

export function registerAgentRouterRoutes(app: Express): void {
  // Get routing table
  app.get("/api/agent-router/routes", (_req, res) => {
    res.json({
      ok: true,
      routes: ROUTING_TABLE.map(r => ({
        agentRole: r.agentRole,
        taskType: r.taskType,
        primary: `${r.primary.provider}/${r.primary.model}`,
        fallback: `${r.fallback.provider}/${r.fallback.model}`,
        reason: r.primary.reason,
      })),
      default: {
        primary: `${DEFAULT_ROUTE.primary.provider}/${DEFAULT_ROUTE.primary.model}`,
        fallback: `${DEFAULT_ROUTE.fallback.provider}/${DEFAULT_ROUTE.fallback.model}`,
      },
    });
  });

  // Preview route for an agent + task
  app.get("/api/agent-router/resolve", (req, res) => {
    const role = (req.query.role as string) || "*";
    const taskType = (req.query.task as string) || "*";
    const route = routeAgentToModel(role, taskType);
    res.json({ ok: true, route });
  });

  // Generate via router
  app.post("/api/agent-router/generate", async (req, res) => {
    const { agentRole, taskType, prompt, systemInstruction, maxTokens } = req.body || {};
    if (!prompt) return res.status(400).json({ ok: false, error: "prompt required" });

    const result = await routedGenerate({
      agentRole: agentRole || "*",
      taskType: taskType || "*",
      prompt,
      systemInstruction,
      maxTokens,
    });

    res.json({ ok: !result.error, ...result });
  });

  console.log(`[Agent Router] ✅ ${ROUTING_TABLE.length} routes configured`);
}
