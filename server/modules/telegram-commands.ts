/**
 * Telegram Bot Commands — Control agents via Telegram
 * /create, /status, /rank, /autopilot, /health
 */

import type { Express } from "express";

const PORT = process.env.PORT || 8790;
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TG_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

// ---------------------------------------------------------------------------
// Command Handlers
// ---------------------------------------------------------------------------

type CommandHandler = (args: string) => Promise<string>;

const COMMANDS: Record<string, { handler: CommandHandler; description: string }> = {
  "/start": {
    description: "เริ่มต้นใช้งาน Bot",
    handler: async () => {
      return `🤖 <b>Claw-Empire Content Studio Bot</b>\n\n` +
        `Available Commands:\n` +
        `/create [สินค้า] — สร้าง content อัตโนมัติ\n` +
        `/review [สินค้า] — เขียนรีวิว\n` +
        `/status — สถานะระบบ\n` +
        `/rank — อันดับ agents\n` +
        `/health — สถานะ AI providers\n` +
        `/autopilot [สินค้า] — Auto-Pilot เต็มรูปแบบ\n` +
        `/costs — สรุปค่าใช้จ่าย AI\n` +
        `/test — ทดสอบระบบ agents`;
    },
  },

  "/create": {
    description: "สร้าง TikTok script",
    handler: async (args: string) => {
      const product = args || "สินค้ายอดนิยม";
      try {
        const { routedGenerate } = await import("./agent-router.ts");
        const result = await routedGenerate({
          agentRole: "content_writer",
          taskType: "tiktok-script",
          prompt: `เขียน TikTok script 30 วินาที สำหรับรีวิว: ${product}\nต้องมี hook แรง + CTA ปักตะกร้า`,
          maxTokens: 512,
        });
        return `🎬 <b>TikTok Script</b>\n📦 ${product}\n🤖 ${result.provider}/${result.model}\n⏱️ ${result.latencyMs}ms\n\n${result.text}`;
      } catch (err) {
        return `❌ Error: ${err}`;
      }
    },
  },

  "/review": {
    description: "เขียนรีวิวสินค้า",
    handler: async (args: string) => {
      const product = args || "สินค้าแนะนำ";
      try {
        const { routedGenerate } = await import("./agent-router.ts");
        const result = await routedGenerate({
          agentRole: "content_writer",
          taskType: "product-review",
          prompt: `เขียนรีวิวสินค้า: ${product}\nรวมข้อดี ข้อเสีย + CTA`,
          maxTokens: 768,
        });
        return `📝 <b>Product Review</b>\n📦 ${product}\n🤖 ${result.provider}\n\n${result.text.slice(0, 1500)}`;
      } catch (err) {
        return `❌ Error: ${err}`;
      }
    },
  },

  "/status": {
    description: "สถานะระบบ",
    handler: async () => {
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/api/analytics/dashboard`);
        if (!res.ok) return "❌ Cannot fetch status";
        const data = (await res.json()) as any;
        const o = data.overview || {};
        return `📊 <b>System Status</b>\n\n` +
          `👥 Agents: ${o.totalAgents} (${o.activeAgents} active)\n` +
          `✅ Tasks Done: ${o.totalTasksDone}\n` +
          `⭐ Total XP: ${o.totalXP}\n` +
          `📝 Today: ${o.completedToday} tasks`;
      } catch {
        return "❌ System unavailable";
      }
    },
  },

  "/rank": {
    description: "อันดับ agents",
    handler: async () => {
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/api/agent-performance`);
        if (!res.ok) return "❌ Cannot fetch rankings";
        const data = (await res.json()) as any;
        const agents = (data.agents || []).slice(0, 5);
        if (agents.length === 0) return "📊 No agent data yet";
        let msg = `🏆 <b>Agent Rankings</b>\n\n`;
        agents.forEach((a: any) => {
          msg += `${a.rank}. ${a.tierEmoji} ${a.agentName} — ${a.score}pts\n`;
        });
        return msg;
      } catch {
        return "❌ Cannot fetch rankings";
      }
    },
  },

  "/health": {
    description: "สถานะ AI providers",
    handler: async () => {
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/api/providers/health`);
        if (!res.ok) return "❌ Cannot fetch health";
        const data = (await res.json()) as any;
        let msg = `🏥 <b>AI Provider Health</b>\n\n`;
        (data.providers || []).forEach((p: any) => {
          msg += `${p.statusEmoji} ${p.name}: ${p.status}${p.latencyMs ? ` (${p.latencyMs}ms)` : ""}\n`;
        });
        msg += `\n🏆 Best: ${data.bestProvider}`;
        return msg;
      } catch {
        return "❌ Cannot fetch health";
      }
    },
  },

  "/autopilot": {
    description: "Full auto-pilot pipeline",
    handler: async (args: string) => {
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/api/autopilot/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product: args || undefined }),
        });
        const data = (await res.json()) as any;
        const run = data.run;
        if (!run) return "❌ Auto-pilot failed";
        return `🤖 <b>Auto-Pilot Complete</b>\n\n${run.finalReport || "No report"}\n\nSteps: ${run.steps?.length || 0}`;
      } catch (err) {
        return `❌ Error: ${err}`;
      }
    },
  },

  "/costs": {
    description: "API cost summary",
    handler: async () => {
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/api/costs/summary`);
        const data = (await res.json()) as any;
        let msg = `💰 <b>API Costs</b>\n\nTotal: $${data.totalCost || 0}\n\n`;
        for (const [provider, info] of Object.entries(data.byProvider || {}) as any) {
          msg += `📊 ${provider}: $${info.cost.toFixed(4)} (${info.calls} calls)\n`;
        }
        if (data.recommendations?.length) {
          msg += `\n${data.recommendations.join("\n")}`;
        }
        return msg;
      } catch {
        return "❌ Cannot fetch costs";
      }
    },
  },

  "/test": {
    description: "Test all agents",
    handler: async () => {
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/api/agents/auto-test`, { method: "POST" });
        const data = (await res.json()) as any;
        const run = data.run;
        if (!run) return "❌ Test failed";
        return `🧪 <b>Agent Test Complete</b>\n\n✅ ${run.summary.passed}/${run.summary.total} passed\n❌ ${run.summary.failed} failed\n📊 Avg: ${run.summary.avgScore}/100`;
      } catch (err) {
        return `❌ Error: ${err}`;
      }
    },
  },
};

// ---------------------------------------------------------------------------
// Process incoming TG message
// ---------------------------------------------------------------------------

async function processMessage(text: string): Promise<string> {
  const trimmed = text.trim();
  const parts = trimmed.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1).join(" ");

  const handler = COMMANDS[cmd];
  if (!handler) {
    return `❓ Unknown command: ${cmd}\n\nใช้ /start เพื่อดู commands ทั้งหมด`;
  }

  return handler.handler(args);
}

async function sendTgMessage(text: string, chatId?: string): Promise<void> {
  if (!TG_TOKEN) return;
  const cid = chatId || TG_CHAT_ID;
  if (!cid) return;

  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: cid, text, parse_mode: "HTML" }),
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// API Routes + Webhook
// ---------------------------------------------------------------------------

export function registerTelegramCommandRoutes(app: Express): void {
  // TG webhook endpoint
  app.post("/api/telegram/webhook", async (req, res) => {
    const update = req.body || {};
    const message = update.message;
    if (!message?.text) return res.json({ ok: true });

    const chatId = String(message.chat?.id || TG_CHAT_ID);
    const response = await processMessage(message.text);
    await sendTgMessage(response, chatId);

    res.json({ ok: true });
  });

  // Manual command trigger
  app.post("/api/telegram/command", async (req, res) => {
    const { command } = req.body || {};
    if (!command) return res.status(400).json({ ok: false, error: "command required" });
    const response = await processMessage(command);
    await sendTgMessage(response);
    res.json({ ok: true, response });
  });

  // List available commands
  app.get("/api/telegram/commands", (_req, res) => {
    const cmds = Object.entries(COMMANDS).map(([cmd, info]) => ({ command: cmd, description: info.description }));
    res.json({ ok: true, commands: cmds });
  });

  // Set webhook URL
  app.post("/api/telegram/set-webhook", async (req, res) => {
    const { url } = req.body || {};
    if (!url || !TG_TOKEN) return res.status(400).json({ ok: false, error: "url and TG token required" });
    try {
      const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: `${url}/api/telegram/webhook` }),
      });
      const data = await r.json();
      res.json({ ok: true, telegram: data });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  console.log("[TG Commands] ✅ /create /review /status /rank /health /autopilot /costs /test");
}
