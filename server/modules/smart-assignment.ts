/**
 * Smart Task Assignment — Auto-match tasks to best-fit agents
 * Scoring: department match (40%) + workload (30%) + skill match (20%) + performance (10%)
 */

import type { Express } from "express";

const PORT = process.env.PORT || 8790;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentData {
  id: string;
  name: string;
  department_id: string;
  role: string;
  status: string;
  stats_tasks_done: number;
  stats_xp: number;
  current_task_id: string | null;
}

interface TaskData {
  id: string;
  title: string;
  department_id?: string;
  task_type?: string;
  priority?: number;
  assigned_agent_id?: string;
}

interface AssignmentScore {
  agentId: string;
  agentName: string;
  score: number;
  breakdown: {
    departmentMatch: number;
    workload: number;
    skillMatch: number;
    performance: number;
  };
  reason: string;
}

// ---------------------------------------------------------------------------
// Scoring Algorithm
// ---------------------------------------------------------------------------

// Map task types to relevant department keywords
const TASK_DEPT_MAP: Record<string, string[]> = {
  "trend-research": ["strategy", "research", "insight"],
  "tiktok-script": ["content", "production", "writer"],
  "product-review": ["content", "production", "writer"],
  "thumbnail-brief": ["creative", "design", "studio"],
  "comparison-post": ["content", "production"],
  "unboxing-script": ["content", "production", "writer"],
  "competitor-spy-rewrite": ["strategy", "research"],
  "publish": ["distribution", "analytics", "publishing"],
  "seo": ["strategy", "research", "seo"],
};

// Map roles to skill keywords
const ROLE_SKILL_MAP: Record<string, string[]> = {
  "content_strategist": ["strategy", "research", "trend", "seo"],
  "trend_hunter": ["trend", "research", "spy", "competitor"],
  "audience_planner": ["audience", "insight", "research"],
  "content_writer": ["script", "review", "comparison", "unboxing", "content"],
  "hook_specialist": ["hook", "copy", "script", "tiktok"],
  "visual_designer": ["thumbnail", "design", "creative", "visual"],
  "video_producer": ["video", "script", "producer"],
  "publisher": ["publish", "distribution", "schedule"],
  "analytics": ["analytics", "performance", "report"],
  "seo_specialist": ["seo", "keyword", "optimization"],
};

function scoreAgent(agent: AgentData, task: TaskData, allAgents: AgentData[]): AssignmentScore {
  let departmentMatch = 0;
  let workload = 0;
  let skillMatch = 0;
  let performance = 0;

  // 1. Department Match (40 points max)
  if (task.department_id && agent.department_id === task.department_id) {
    departmentMatch = 40;
  } else if (task.task_type) {
    const relevantDepts = TASK_DEPT_MAP[task.task_type] || [];
    const deptLower = (agent.department_id || "").toLowerCase();
    if (relevantDepts.some(d => deptLower.includes(d))) {
      departmentMatch = 30;
    }
  }

  // 2. Workload (30 points max — idle agents get more points)
  if (agent.status === "idle" && !agent.current_task_id) {
    workload = 30;
  } else if (agent.status === "idle") {
    workload = 20;
  } else if (agent.status === "working") {
    workload = 5;
  }

  // 3. Skill Match (20 points max)
  if (task.task_type) {
    const roleLower = (agent.role || "").toLowerCase().replace(/[^a-z_]/g, "_");
    const skills = ROLE_SKILL_MAP[roleLower] || [];
    const taskType = task.task_type.toLowerCase();
    const taskTitle = (task.title || "").toLowerCase();
    
    const matchCount = skills.filter(s => taskType.includes(s) || taskTitle.includes(s)).length;
    skillMatch = Math.min(20, matchCount * 7);
  }

  // 4. Performance (10 points max)
  const maxXp = Math.max(...allAgents.map(a => a.stats_xp), 1);
  performance = Math.round((agent.stats_xp / maxXp) * 10);

  const score = departmentMatch + workload + skillMatch + performance;

  // Build reason
  const reasons: string[] = [];
  if (departmentMatch >= 30) reasons.push("แผนกตรง");
  if (workload >= 20) reasons.push("ว่างอยู่");
  if (skillMatch >= 10) reasons.push("ทักษะตรง");
  if (performance >= 7) reasons.push("ผลงานดี");

  return {
    agentId: agent.id,
    agentName: agent.name,
    score,
    breakdown: { departmentMatch, workload, skillMatch, performance },
    reason: reasons.join(", ") || "พร้อมรับงาน",
  };
}

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

async function fetchAgents(): Promise<AgentData[]> {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/agents`);
    if (!res.ok) return [];
    const data = await res.json() as any;
    return data.agents || [];
  } catch {
    return [];
  }
}

async function fetchTask(taskId: string): Promise<TaskData | null> {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/tasks/${taskId}`);
    if (!res.ok) return null;
    const data = await res.json() as any;
    return data.task || null;
  } catch {
    return null;
  }
}

export async function findBestAgent(task: TaskData): Promise<AssignmentScore | null> {
  const agents = await fetchAgents();
  if (agents.length === 0) return null;

  const scores = agents.map(a => scoreAgent(a, task, agents));
  scores.sort((a, b) => b.score - a.score);

  return scores[0] || null;
}

export async function findBestAgentForStep(templateId: string, stepLabel: string): Promise<string | null> {
  const task: TaskData = {
    id: "auto",
    title: stepLabel,
    task_type: templateId,
  };
  const best = await findBestAgent(task);
  return best ? best.agentId : null;
}

export async function autoAssignTask(taskId: string): Promise<AssignmentScore | null> {
  const task = await fetchTask(taskId);
  if (!task) return null;

  const best = await findBestAgent(task);
  if (!best) return null;

  // Assign via API
  try {
    await fetch(`http://127.0.0.1:${PORT}/api/tasks/${taskId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: best.agentId }),
    });
  } catch {}

  return best;
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

export function registerSmartAssignmentRoutes(app: Express): void {
  // Auto-assign a task
  app.post("/api/tasks/:id/auto-assign", async (req, res) => {
    const { id } = req.params;
    const result = await autoAssignTask(id);
    if (!result) {
      return res.status(404).json({ ok: false, error: "No suitable agent found" });
    }
    res.json({
      ok: true,
      assignment: result,
    });
  });

  // Preview best agent for a task (without assigning)
  app.post("/api/tasks/preview-assignment", async (req, res) => {
    const { title, department_id, task_type, priority } = req.body || {};
    const task: TaskData = { id: "preview", title: title || "", department_id, task_type, priority };
    
    const agents = await fetchAgents();
    if (agents.length === 0) {
      return res.json({ ok: true, candidates: [] });
    }

    const scores = agents.map(a => scoreAgent(a, task, agents));
    scores.sort((a, b) => b.score - a.score);

    res.json({
      ok: true,
      candidates: scores.slice(0, 5),
    });
  });

  console.log("[Smart Assignment] ✅ Auto-assignment engine ready");
}
