/**
 * Auto-Pipeline — Chained content creation workflows
 *
 * One command → multiple tasks chained automatically
 * Research → Script → Thumbnail → Review
 */

import type { Express } from "express";

const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Pipeline Definitions
// ---------------------------------------------------------------------------

interface PipelineStep {
  order: number;
  templateId: string;
  label: string;
  icon: string;
  dependsOn: number | null; // order of previous step, null = first
}

interface PipelineTemplate {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  description: string;
  steps: PipelineStep[];
  estimatedTime: string;
}

const PIPELINES: PipelineTemplate[] = [
  {
    id: "tiktok-full",
    name: "TikTok Full Pipeline",
    nameEn: "TikTok Full Pipeline",
    icon: "🎬",
    description: "Research → Script → Thumbnail — ครบ flow TikTok",
    estimatedTime: "20-30 min",
    steps: [
      { order: 1, templateId: "trend-research", label: "🔍 Trend Research", icon: "🔍", dependsOn: null },
      { order: 2, templateId: "tiktok-script", label: "✍️ TikTok Script", icon: "✍️", dependsOn: 1 },
      { order: 3, templateId: "thumbnail-brief", label: "🎨 Thumbnail Brief", icon: "🎨", dependsOn: 2 },
    ],
  },
  {
    id: "review-full",
    name: "Review Full Pipeline",
    nameEn: "Review Full Pipeline",
    icon: "⭐",
    description: "Research → Review → Comparison — ครบ flow รีวิว",
    estimatedTime: "25-35 min",
    steps: [
      { order: 1, templateId: "trend-research", label: "🔍 Trend Research", icon: "🔍", dependsOn: null },
      { order: 2, templateId: "product-review", label: "⭐ Product Review", icon: "⭐", dependsOn: 1 },
      { order: 3, templateId: "comparison-post", label: "⚖️ Comparison Post", icon: "⚖️", dependsOn: 2 },
    ],
  },
  {
    id: "unbox-full",
    name: "Unboxing Full Pipeline",
    nameEn: "Unboxing Full Pipeline",
    icon: "📦",
    description: "Research → Unboxing → Thumbnail — ครบ flow แกะกล่อง",
    estimatedTime: "20-30 min",
    steps: [
      { order: 1, templateId: "trend-research", label: "🔍 Research", icon: "🔍", dependsOn: null },
      { order: 2, templateId: "unboxing-script", label: "📦 Unboxing Script", icon: "📦", dependsOn: 1 },
      { order: 3, templateId: "thumbnail-brief", label: "🎨 Thumbnail", icon: "🎨", dependsOn: 2 },
    ],
  },
];

// Active pipeline tracking
interface ActivePipeline {
  id: string;
  pipelineId: string;
  product: string;
  startedAt: string;
  status: "running" | "done" | "failed";
  currentStep: number;
  totalSteps: number;
  steps: Array<{
    order: number;
    label: string;
    taskId: string | null;
    status: "pending" | "running" | "done" | "failed";
    startedAt: string | null;
    completedAt: string | null;
  }>;
}

const activePipelines: Map<string, ActivePipeline> = new Map();

// ---------------------------------------------------------------------------
// Pipeline Execution
// ---------------------------------------------------------------------------

function getVariableKey(templateId: string): string {
  if (templateId === "trend-research") return "category";
  if (templateId === "thumbnail-brief") return "topic";
  if (templateId === "comparison-post") return "product_list";
  return "product";
}

async function createTaskFromTemplate(templateId: string, product: string): Promise<{ ok: boolean; taskId?: string; title?: string }> {
  try {
    const variableKey = getVariableKey(templateId);
    const res = await fetch(`http://127.0.0.1:${PORT}/api/templates/${templateId}/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variables: { [variableKey]: product } }),
    });

    if (!res.ok) return { ok: false };

    const data = (await res.json()) as { ok?: boolean; task?: { id: string; title: string } };
    if (data.ok && data.task) {
      // Auto-run the task
      fetch(`http://127.0.0.1:${PORT}/api/tasks/${data.task.id}/run`, { method: "POST" }).catch(() => {});
      return { ok: true, taskId: data.task.id, title: data.task.title };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

async function sendTgNotification(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  const chatId = process.env.TELEGRAM_CHAT_ID || "";
  if (!token || !chatId) return;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  }).catch(() => {});
}

async function executePipeline(pipelineId: string, product: string): Promise<ActivePipeline> {
  const template = PIPELINES.find((p) => p.id === pipelineId);
  if (!template) throw new Error(`Pipeline ${pipelineId} not found`);

  const id = `pl_${Date.now()}`;
  const pipeline: ActivePipeline = {
    id,
    pipelineId,
    product,
    startedAt: new Date().toISOString(),
    status: "running",
    currentStep: 1,
    totalSteps: template.steps.length,
    steps: template.steps.map((s) => ({
      order: s.order,
      label: s.label,
      taskId: null,
      status: "pending",
      startedAt: null,
      completedAt: null,
    })),
  };

  activePipelines.set(id, pipeline);

  // Notify start
  const stepsPreview = template.steps.map((s) => `  ${s.icon} ${s.label}`).join("\n");
  await sendTgNotification(
    `🚀 <b>Pipeline Started!</b>\n\n` +
      `📋 ${template.nameEn}\n` +
      `📝 "${product}"\n` +
      `⏱ ~${template.estimatedTime}\n\n` +
      `<b>Steps:</b>\n${stepsPreview}`,
  );

  // Execute steps sequentially with delays
  for (const step of template.steps) {
    const pipelineStep = pipeline.steps[step.order - 1];
    pipelineStep.status = "running";
    pipelineStep.startedAt = new Date().toISOString();
    pipeline.currentStep = step.order;

    const result = await createTaskFromTemplate(step.templateId, product);

    if (result.ok) {
      pipelineStep.taskId = result.taskId || null;
      pipelineStep.status = "done";
      pipelineStep.completedAt = new Date().toISOString();

      await sendTgNotification(`✅ Step ${step.order}/${template.steps.length}: ${step.label}\n📝 ${result.title || "Task created"}`);
    } else {
      pipelineStep.status = "failed";
      pipeline.status = "failed";
      await sendTgNotification(`❌ Step ${step.order} failed: ${step.label}`);
      break;
    }

    // Wait between steps (give agent time to process)
    if (step.order < template.steps.length) {
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  if (pipeline.status !== "failed") {
    pipeline.status = "done";
    await sendTgNotification(
      `🎉 <b>Pipeline Complete!</b>\n\n` +
        `📋 ${template.nameEn}\n` +
        `📝 "${product}"\n` +
        `✅ ${template.steps.length}/${template.steps.length} steps done\n\n` +
        `ดู progress ได้ที่ Dashboard 🏠`,
    );
  }

  return pipeline;
}

// ---------------------------------------------------------------------------
// TG Command Handler (exported for ceo-chat)
// ---------------------------------------------------------------------------

export async function handlePipelineCommand(command: string, arg: string): Promise<string> {
  if (command === "/pipeline" && !arg) {
    return (
      `🔄 <b>Auto-Pipelines</b>\n\n` +
      PIPELINES.map((p) => `${p.icon} /pipeline-${p.id.replace("-full", "")} <สินค้า>\n   ${p.description}`).join("\n\n") +
      `\n\n💡 ตัวอย่าง: /pipeline-tiktok เครื่องปั่น Philips`
    );
  }

  // Find matching pipeline
  const pipelineMap: Record<string, string> = {
    "/pipeline-tiktok": "tiktok-full",
    "/pipeline-review": "review-full",
    "/pipeline-unbox": "unbox-full",
  };

  const pipelineId = pipelineMap[command];
  if (!pipelineId) return "";

  if (!arg.trim()) return `⚠️ กรุณาใส่ชื่อสินค้า เช่น: ${command} เครื่องปั่น Philips`;

  // Execute in background
  executePipeline(pipelineId, arg.trim()).catch(() => {});

  const template = PIPELINES.find((p) => p.id === pipelineId);
  return `🚀 <b>Starting ${template?.nameEn || "Pipeline"}!</b>\n\n📝 "${arg.trim()}"\n⏱ ~${template?.estimatedTime || "20-30 min"}\n\nจะแจ้งทุก step ใน TG 📡`;
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

export function registerAutoPipelineRoutes(app: Express): void {
  // List available pipelines
  app.get("/api/pipelines", (_req, res) => {
    res.json({
      ok: true,
      pipelines: PIPELINES.map((p) => ({
        id: p.id,
        name: p.nameEn,
        icon: p.icon,
        description: p.description,
        estimatedTime: p.estimatedTime,
        steps: p.steps.length,
      })),
    });
  });

  // Start a pipeline
  app.post("/api/pipelines/:id/start", async (req, res) => {
    const { id } = req.params;
    const { product } = req.body as { product?: string };

    if (!product?.trim()) {
      return res.status(400).json({ ok: false, error: "product is required" });
    }

    const template = PIPELINES.find((p) => p.id === id);
    if (!template) {
      return res.status(404).json({ ok: false, error: "pipeline not found" });
    }

    // Execute in background
    const pipelineRunId = `pl_${Date.now()}`;
    executePipeline(id, product.trim()).catch(() => {});

    res.json({
      ok: true,
      pipeline: {
        id: pipelineRunId,
        template: template.nameEn,
        product: product.trim(),
        steps: template.steps.length,
        estimatedTime: template.estimatedTime,
      },
    });
  });

  // List active/recent pipelines
  app.get("/api/pipelines/active", (_req, res) => {
    const list = Array.from(activePipelines.values())
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, 20);
    res.json({ ok: true, pipelines: list });
  });

  console.log(`[Auto-Pipeline] ✅ ${PIPELINES.length} pipelines registered`);
}
