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

const TG_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8614741415:AAFUSyh1gwnbFIQU_9SqYI11GipLJex_P3Y";
const TG_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "7724670451";
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "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";

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
          {
            role: "system",
            content:
              "คุณเป็น CEO Assistant ของ Content Studio ที่ทำ affiliate marketing" +
              " ตอบสั้นๆ ตรงประเด็น ภาษาไทย พร้อมแนะนำ action ที่ CEO ควรทำ" +
              " คำสั่งที่ใช้ได้: /status, /today, /run <task>",
          },
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
  } else if (trimmed === "/help" || trimmed === "/ช่วย") {
    reply =
      `🤖 <b>CEO Commands</b>\n\n` +
      `/status — ดูสถานะ Studio\n` +
      `/today — สรุปวันนี้\n` +
      `/run <task> — สั่งงาน agent\n` +
      `/help — คำสั่งทั้งหมด\n\n` +
      `💬 หรือพิมพ์อะไรก็ได้ — AI จะตอบ`;
  } else {
    reply = await handleSmartReply(trimmed);
  }

  await sendTg(reply);
}
