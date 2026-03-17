/**
 * CEO Chat Enhancement — Smart Telegram Command Router
 *
 * Intercepts Telegram messages and provides:
 * 1. Smart command parsing (สร้าง task, สั่ง agent, ดูสถิติ)
 * 2. Quick status check via /status
 * 3. OpenRouter-powered smart replies
 *
 * Hooks into the existing telegram-receiver.ts
 */

import { PORT } from "../config/runtime.ts";
import { geminiChat, isGeminiConfigured } from "./gemini-provider.ts";

const TG_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TG_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";

async function sendTg(text: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT_ID, text, parse_mode: "HTML" }),
    });
  } catch {
    // silent
  }
}

// ---------------------------------------------------------------------------
// Command Handlers
// ---------------------------------------------------------------------------

async function handleStatusCommand(): Promise<string> {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/stats`);
    if (!res.ok) return "❌ ไม่สามารถดึง stats ได้";
    const data = (await res.json()) as {
      stats?: {
        tasks?: { total?: number; done?: number; in_progress?: number; review?: number; completion_rate?: number };
        agents?: { total?: number; working?: number; idle?: number };
      };
    };
    const t = data.stats?.tasks;
    const a = data.stats?.agents;

    return (
      `📊 <b>Studio Status</b>\n\n` +
      `📋 Tasks: ${t?.total || 0}\n` +
      `   ✅ Done: ${t?.done || 0} (${t?.completion_rate || 0}%)\n` +
      `   🔄 In progress: ${t?.in_progress || 0}\n` +
      `   🔍 Review: ${t?.review || 0}\n\n` +
      `🤖 Agents: ${a?.total || 0}\n` +
      `   💼 Working: ${a?.working || 0}\n` +
      `   😴 Idle: ${a?.idle || 0}`
    );
  } catch {
    return "❌ Error fetching status";
  }
}

async function handleTodayCommand(): Promise<string> {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/dashboard/today`);
    if (!res.ok) return "❌ ไม่สามารถดึง today ได้";
    const data = (await res.json()) as {
      today?: { done: number; created: number };
      week?: { done: number; created: number };
      pipeline?: { trend_reports: number; scripts: number; thumbnails: number };
    };

    return (
      `📈 <b>วันนี้</b>\n\n` +
      `✅ Done: ${data.today?.done || 0}\n` +
      `📝 Created: ${data.today?.created || 0}\n\n` +
      `📅 <b>สัปดาห์นี้</b>\n` +
      `✅ Done: ${data.week?.done || 0}\n` +
      `📝 Created: ${data.week?.created || 0}\n\n` +
      `🔄 <b>Pipeline</b>\n` +
      `🔍 Trends: ${data.pipeline?.trend_reports || 0}\n` +
      `✍️ Scripts: ${data.pipeline?.scripts || 0}\n` +
      `🎨 Thumbnails: ${data.pipeline?.thumbnails || 0}`
    );
  } catch {
    return "❌ Error fetching today";
  }
}

async function handleRunCommand(taskTitle: string): Promise<string> {
  const content = `$${taskTitle}`;
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/directives`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, source: "ceo-telegram" }),
    });
    if (res.ok) {
      return `🚀 สั่งงานแล้ว: "${taskTitle}"\nAgent จะเริ่มทำงานอัตโนมัติ`;
    }
    return `⚠️ ไม่สามารถสั่งงานได้ (HTTP ${res.status})`;
  } catch {
    return "❌ Error creating task";
  }
}

async function handleSmartReply(message: string): Promise<string> {
  const systemPrompt =
    "คุณเป็น CEO Assistant ของ Content Studio ที่ทำ affiliate marketing" +
    " ตอบสั้นๆ ตรงประเด็น ภาษาไทย พร้อมแนะนำ action ที่ CEO ควรทำ" +
    " คำสั่งที่ใช้ได้: /status, /today, /run <task>, /help";

  // Try Gemini first (free!)
  if (isGeminiConfigured()) {
    const result = await geminiChat({
      messages: [{ role: "user", content: message }],
      systemInstruction: systemPrompt,
      maxTokens: 300,
    });

    if (result.text) {
      return `🤖✨ ${result.text}`;
    }
    console.log("[CeoChat] Gemini failed, falling back to OpenRouter:", result.error);
  }

  // Fallback to OpenRouter
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_KEY}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        max_tokens: 300,
      }),
    });

    if (!res.ok) return "🤖 ใช้คำสั่ง:\n/status — ดูสถานะ\n/today — สรุปวันนี้\n/run <งาน> — สั่งงาน";

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content || "🤖 ไม่เข้าใจคำสั่ง";
  } catch {
    return "🤖 ใช้คำสั่ง:\n/status — ดูสถานะ\n/today — สรุปวันนี้\n/run <งาน> — สั่งงาน";
  }
}

// ---------------------------------------------------------------------------
// Template Quick Commands — create & run from TG
// ---------------------------------------------------------------------------

const TEMPLATE_SHORTCUTS: Record<string, { templateId: string; variableKey: string; label: string }> = {
  "/tiktok": { templateId: "tiktok-script", variableKey: "product", label: "TikTok Script" },
  "/review": { templateId: "product-review", variableKey: "product", label: "Product Review" },
  "/trend": { templateId: "trend-research", variableKey: "category", label: "Trend Research" },
  "/thumbnail": { templateId: "thumbnail-brief", variableKey: "topic", label: "Thumbnail Brief" },
  "/compare": { templateId: "comparison-post", variableKey: "product_list", label: "Comparison Post" },
  "/unbox": { templateId: "unboxing-script", variableKey: "product", label: "Unboxing Script" },
};

async function handleTemplateCommand(templateId: string, variableKey: string, value: string, label: string): Promise<string> {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/templates/${templateId}/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variables: { [variableKey]: value } }),
    });

    if (!res.ok) return `⚠️ ไม่สามารถสร้าง ${label} ได้ (HTTP ${res.status})`;

    const data = (await res.json()) as { ok?: boolean; task?: { id: string; title: string } };
    if (data.ok && data.task) {
      // Auto-run the task
      fetch(`http://127.0.0.1:${PORT}/api/tasks/${data.task.id}/run`, { method: "POST" }).catch(() => {});
      return `🚀 <b>${label}</b> สร้างแล้ว!\n\n📝 "${value}"\n🤖 Agent กำลังทำงาน...\n\nดู progress ได้ที่ Dashboard`;
    }
    return `⚠️ Error creating ${label}`;
  } catch {
    return `❌ Error creating ${label}`;
  }
}

async function handleTemplateListCommand(): Promise<string> {
  return (
    `📝 <b>Quick Templates</b>\n\n` +
    `🎬 /tiktok <สินค้า> — TikTok Script\n` +
    `⭐ /review <สินค้า> — Product Review\n` +
    `🔍 /trend <หมวด> — Trend Research\n` +
    `🎨 /thumbnail <หัวข้อ> — Thumbnail Brief\n` +
    `⚖️ /compare <สินค้า> — Comparison\n` +
    `📦 /unbox <สินค้า> — Unboxing\n\n` +
    `💡 ตัวอย่าง: /tiktok เครื่องปั่น Philips`
  );
}

// ---------------------------------------------------------------------------
// Public: Process incoming TG message
// ---------------------------------------------------------------------------

export async function processCeoTelegramMessage(text: string): Promise<void> {
  const trimmed = (text || "").trim();
  if (!trimmed) return;

  let reply: string;

  if (trimmed === "/status" || trimmed === "/สถานะ") {
    reply = await handleStatusCommand();
  } else if (trimmed === "/today" || trimmed === "/วันนี้") {
    reply = await handleTodayCommand();
  } else if (trimmed.startsWith("/run ") || trimmed.startsWith("/สั่ง ")) {
    const taskTitle = trimmed.replace(/^\/(run|สั่ง)\s+/, "");
    reply = await handleRunCommand(taskTitle);
  } else if (trimmed === "/template" || trimmed === "/templates" || trimmed === "/t") {
    reply = await handleTemplateListCommand();
  } else if (trimmed === "/help" || trimmed === "/ช่วย") {
    reply =
      `🤖 <b>CEO Commands</b>\n\n` +
      `📊 /status — ดูสถานะ Studio\n` +
      `📈 /today — สรุปวันนี้\n` +
      `🚀 /run <task> — สั่งงาน\n` +
      `📝 /template — ดู quick templates\n\n` +
      `<b>Quick Templates:</b>\n` +
      `🎬 /tiktok <สินค้า>\n` +
      `⭐ /review <สินค้า>\n` +
      `🔍 /trend <หมวด>\n` +
      `🎨 /thumbnail <หัวข้อ>\n` +
      `⚖️ /compare <สินค้า>\n` +
      `📦 /unbox <สินค้า>\n\n` +
      `💬 หรือพิมพ์อะไรก็ได้ — Gemini AI จะตอบ ✨`;
  } else {
    // Check template shortcuts
    const cmdMatch = trimmed.match(/^(\/\w+)\s+(.+)/);
    if (cmdMatch) {
      const [, cmd, arg] = cmdMatch;
      const shortcut = TEMPLATE_SHORTCUTS[cmd];
      if (shortcut) {
        reply = await handleTemplateCommand(shortcut.templateId, shortcut.variableKey, arg, shortcut.label);
        await sendTg(reply);
        return;
      }
    }

    reply = await handleSmartReply(trimmed);
  }

  await sendTg(reply);
}

