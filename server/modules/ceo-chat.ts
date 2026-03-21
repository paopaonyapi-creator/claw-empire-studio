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
import { handlePipelineCommand } from "./auto-pipeline.ts";
import { handleLinkCommand } from "./link-tracker.ts";
import { handleReportCommand } from "./daily-report.ts";
import { handleProductCommand } from "./product-manager.ts";
import { handleSyncCommand } from "./supabase-backup.ts";
import { handleRevenueCommand } from "./revenue-tracker.ts";
import { handleScheduleCommand } from "./content-calendar.ts";
import { handleInsightsCommand } from "./insights-engine.ts";
import { handleBriefCommand } from "./morning-brief.ts";
import { handleGenerateCommand } from "./content-generator.ts";
import { handleAlertsCommand } from "./performance-alerts.ts";
import { handleExportCommand } from "./data-export.ts";
import { handleFbCommand } from "./facebook-publisher.ts";
import { handleGoalCommand } from "./goal-tracker.ts";
import { handleShortCommand } from "./link-shortener.ts";
import { handleHealthCommand } from "./api-health.ts";
import { handleMultiPostCommand, handleSheetsCommand, handleAbTestCommand, handleAutoScheduleCommand, handleCompetitorCommand } from "./multi-platform.ts";
import { handlePipelineCommand as handleContentPipelineCommand, handleIncomeReportCommand, handleTeamCommand } from "./content-pipeline.ts";
import { handleHelpCommand, handleOrderCommand } from "./studio-utils.ts";
import { geminiChat, isGeminiConfigured } from "./gemini-provider.ts";
import { getStudioDb } from "./studio-db.ts";
import { handleNotifCommand } from "./tg-notifier.ts";
import { handleSummaryCommand } from "./auto-summary.ts";
import { startAffiliatePipeline } from "./affiliate-pipeline.ts";

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
    // Pull real data from our working endpoints
    const [healthRes, goalsRes, linksRes] = await Promise.allSettled([
      fetch(`http://127.0.0.1:${PORT}/api/health/apis`).then((r) => r.json()),
      fetch(`http://127.0.0.1:${PORT}/api/goals`).then((r) => r.json()),
      fetch(`http://127.0.0.1:${PORT}/api/links`).then((r) => r.json()),
    ]);

    const health = healthRes.status === "fulfilled" ? (healthRes.value as { upCount?: number; total?: number }) : null;
    const goals = goalsRes.status === "fulfilled" ? (goalsRes.value as { goals?: unknown[] }) : null;
    const links = linksRes.status === "fulfilled" ? (linksRes.value as { links?: unknown[] }) : null;

    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const mins = Math.floor((uptime % 3600) / 60);

    return (
      `📊 <b>Studio Status</b>\n\n` +
      `🚀 Server uptime: ${hours}h ${mins}m\n` +
      `🏥 APIs: ${health?.upCount || "?"}/${health?.total || "?"} operational\n` +
      `🎯 Goals: ${(goals?.goals as unknown[])?.length || 0} active\n` +
      `🔗 Short links: ${(links?.links as unknown[])?.length || 0}\n\n` +
      `⏰ ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}`
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

function handleUsersCommand(): string {
  try {
    const db = getStudioDb();
    const rows = db.prepare("SELECT username, display_name, role, created_at FROM studio_users ORDER BY created_at").all() as any[];
    if (rows.length === 0) return "📭 ไม่มีผู้ใช้ในระบบ";

    const roleIcons: Record<string, string> = { ceo: "👑", admin: "⚙️", viewer: "👁️" };
    const list = rows.map((r: any) => {
      const icon = roleIcons[r.role] || "👤";
      return `${icon} <b>${r.display_name || r.username}</b> (@${r.username}) — ${r.role.toUpperCase()}`;
    }).join("\n");
    return `👥 <b>รายชื่อผู้ใช้</b> (${rows.length})\n\n${list}`;
  } catch {
    return "❌ ไม่สามารถดึงข้อมูลผู้ใช้ได้";
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
  } else if (trimmed === "/template" || trimmed === "/templates" || trimmed === "/t") {
    reply = await handleTemplateListCommand();
  } else if (trimmed === "/report" || trimmed === "/รายงาน") {
    reply = await handleReportCommand();
  } else if (trimmed === "/sync" || trimmed === "/backup") {
    reply = await handleSyncCommand();
  } else if (trimmed === "/leaderboard" || trimmed === "/rank") {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/api/agents`);
      const data = (await res.json()) as { agents?: Array<{ name: string; tasks_done?: number; tasks_total?: number }> };
      const agents = (data.agents || [])
        .map(a => ({ name: a.name, done: a.tasks_done || 0, total: a.tasks_total || 0 }))
        .sort((a, b) => b.done - a.done)
        .slice(0, 10);
      const medals = ["🥇", "🥈", "🥉"];
      const list = agents
        .map((a, i) => `${medals[i] || `#${i + 1}`} ${a.name} — ${a.done} tasks`)
        .join("\n");
      reply = `🏆 <b>Agent Leaderboard</b>\n\n${list || "ยังไม่มี tasks"}`;
    } catch { reply = "❌ Error fetching leaderboard"; }
  } else if (trimmed === "/help" || trimmed === "/ช่วย") {
    reply =
      `🤖 <b>CEO Commands</b>\n\n` +
      `📊 /status — ดูสถานะ\n` +
      `📈 /today — สรุปวันนี้\n` +
      `🚀 /run <task> — สั่งงาน\n\n` +
      `<b>📝 Templates:</b>\n` +
      `/template — ดูรายการ\n` +
      `/tiktok /review /trend /thumbnail /compare /unbox\n\n` +
      `<b>🔄 Pipelines (auto-chain):</b>\n` +
      `/pipeline — ดูรายการ\n` +
      `/pipeline-tiktok <สินค้า>\n` +
      `/pipeline-review <สินค้า>\n` +
      `/pipeline-unbox <สินค้า>\n\n` +
      `<b>🚀 Affiliate Pipeline:</b>\n` +
      `/aff <shopee-url> — เริ่ม 10-Agent Pipeline\n` +
      `หรือวางลิงก์ Shopee ตรงๆ — auto-start!\n\n` +
      `<b>📎 Links:</b>\n` +
      `/link — ดู links\n` +
      `/link <url> — สร้าง short link\n` +
      `/link stats — สถิติ\n\n` +
      `<b>🔐 Admin:</b>\n` +
      `/users — รายชื่อ users\n` +
      `/revenue — สรุปรายได้\n\n` +
      `💬 หรือพิมพ์อะไรก็ได้ — Gemini ✨`;
  } else {
    // Check template shortcuts
    const cmdMatch = trimmed.match(/^(\/[\w-]+)\s*(.*)/s);
    if (cmdMatch) {
      const [, cmd, arg] = cmdMatch;

      // Template shortcuts
      const shortcut = TEMPLATE_SHORTCUTS[cmd];
      if (shortcut) {
        reply = await handleTemplateCommand(shortcut.templateId, shortcut.variableKey, arg, shortcut.label);
        await sendTg(reply);
        return;
      }

      // Pipeline commands
      if (cmd === "/pipeline" || cmd.startsWith("/pipeline-")) {
        reply = await handlePipelineCommand(cmd, arg);
        if (reply) { await sendTg(reply); return; }
      }

      // Link commands
      if (cmd === "/link") {
        reply = handleLinkCommand(arg);
        await sendTg(reply);
        return;
      }

      // Product commands
      if (cmd === "/product") {
        reply = handleProductCommand(arg);
        await sendTg(reply);
        return;
      }

      // Revenue commands
      if (cmd === "/revenue") {
        reply = handleRevenueCommand(arg);
        await sendTg(reply);
        return;
      }

      // Schedule commands
      if (cmd === "/schedule") {
        reply = await handleScheduleCommand(arg);
        await sendTg(reply);
        return;
      }

      // Insights commands
      if (cmd === "/insights") {
        reply = handleInsightsCommand();
        await sendTg(reply);
        return;
      }

      // Brief command
      if (cmd === "/brief") {
        reply = handleBriefCommand();
        await sendTg(reply);
        return;
      }

      // Generate command
      if (cmd === "/generate") {
        reply = await handleGenerateCommand(arg);
        await sendTg(reply);
        return;
      }

      // Alerts command
      if (cmd === "/alerts") {
        reply = handleAlertsCommand(arg);
        await sendTg(reply);
        return;
      }

      // Export command
      if (cmd === "/export") {
        reply = handleExportCommand(arg);
        await sendTg(reply);
        return;
      }

      // Facebook command
      if (cmd === "/fb") {
        reply = await handleFbCommand(arg);
        await sendTg(reply);
        return;
      }

      // Goal command
      if (cmd === "/goal") {
        reply = handleGoalCommand(arg);
        await sendTg(reply);
        return;
      }

      // Link shortener command
      if (cmd === "/short") {
        reply = handleShortCommand(arg);
        await sendTg(reply);
        return;
      }

      // Health check command
      if (cmd === "/health") {
        reply = await handleHealthCommand();
        await sendTg(reply);
        return;
      }

      // Multi-platform post
      if (cmd === "/multipost") {
        reply = await handleMultiPostCommand(arg);
        await sendTg(reply);
        return;
      }

      // Sheets sync
      if (cmd === "/sheets") {
        reply = await handleSheetsCommand();
        await sendTg(reply);
        return;
      }

      // A/B Testing
      if (cmd === "/ab") {
        reply = handleAbTestCommand(arg);
        await sendTg(reply);
        return;
      }

      // AI Auto-Schedule
      if (cmd === "/autoschedule") {
        reply = await handleAutoScheduleCommand();
        await sendTg(reply);
        return;
      }

      // Competitor Monitor
      if (cmd === "/competitor") {
        reply = handleCompetitorCommand(arg);
        await sendTg(reply);
        return;
      }

      // Auto Content Pipeline
      if (cmd === "/pipeline") {
        reply = await handleContentPipelineCommand(arg);
        await sendTg(reply);
        return;
      }

      // Income Report
      if (cmd === "/income") {
        reply = await handleIncomeReportCommand(arg);
        await sendTg(reply);
        return;
      }

      // Team Management
      if (cmd === "/team") {
        reply = handleTeamCommand(arg);
        await sendTg(reply);
        return;
      }

      // Help command
      if (cmd === "/help" || cmd === "/start") {
        reply = handleHelpCommand();
        await sendTg(reply);
        return;
      }

      // Order alerts
      if (cmd === "/order") {
        reply = handleOrderCommand(arg);
        await sendTg(reply);
        return;
      }

      // Users command
      if (cmd === "/users") {
        reply = handleUsersCommand();
        await sendTg(reply);
        return;
      }

      // Notification settings
      if (cmd === "/notif") {
        reply = handleNotifCommand(arg);
        await sendTg(reply);
        return;
      }

      // Daily summary
      if (cmd === "/summary") {
        reply = await handleSummaryCommand();
        await sendTg(reply);
        return;
      }

      // Mini Dashboard
      if (cmd === "/dash") {
        reply = await buildDashReply();
        await sendTg(reply);
        return;
      }
      // Affiliate Pipeline command
      if (cmd === "/aff") {
        reply = await handleAffCommand(arg);
        await sendTg(reply);
        return;
      }
    }

    // Auto-detect Shopee URLs in plain messages (supports multiple URLs!)
    const shopeeMatches = [...trimmed.matchAll(/https?:\/\/(?:s\.shopee\.co\.th|shopee\.co\.th)\/\S+/gi)];
    if (shopeeMatches.length > 0) {
      if (shopeeMatches.length === 1) {
        reply = await handleAffCommand(shopeeMatches[0][0]);
      } else {
        // Multiple URLs — start all
        const results: string[] = [];
        results.push(`🚀 <b>เริ่ม ${shopeeMatches.length} Pipelines!</b>\n`);
        for (let i = 0; i < shopeeMatches.length; i++) {
          const url = shopeeMatches[i][0];
          try {
            const pipeline = await startAffiliatePipeline({
              productName: `สินค้า #${i + 1}`,
              productUrl: url,
              priceMin: 0,
              priceMax: 0,
            });
            results.push(`✅ #${i + 1} — ${url.slice(0, 40)}... → ${pipeline.id}`);
          } catch {
            results.push(`❌ #${i + 1} — ${url.slice(0, 40)}... → ล้มเหลว`);
          }
        }
        results.push(`\n⏱ ${shopeeMatches.length * 10} Agents กำลังทำงาน...`);
        reply = results.join("\n");
      }
      await sendTg(reply);
      return;
    }

    reply = await handleSmartReply(trimmed);
  }

  await sendTg(reply);
}

// ---------------------------------------------------------------------------
// /aff — Affiliate Content Pipeline via TG
// ---------------------------------------------------------------------------
async function handleAffCommand(arg: string): Promise<string> {
  const url = (arg || "").trim();
  if (!url) {
    return `🚀 <b>Affiliate Pipeline</b>\n\nUsage:\n/aff <shopee-url>\n\nหรือวางลิงก์ Shopee ตรงๆ เลย!\n\nตัวอย่าง:\n/aff https://s.shopee.co.th/1gE2uEm6oX`;
  }

  // Validate it's a Shopee URL
  if (!url.includes("shopee.co.th") && !url.includes("shopee.com")) {
    return `❌ ลิงก์ไม่ใช่ Shopee\n\nกรุณาใช้ลิงก์จาก Shopee เท่านั้น\nตัวอย่าง: https://s.shopee.co.th/xxx`;
  }

  // Try to scrape product info from the URL
  let productName = "สินค้า Shopee";
  let priceMin = 0;
  let priceMax = 0;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      redirect: "follow",
    });
    const html = await res.text();

    // Try to extract title from meta tags or page title
    const titleMatch =
      html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) ||
      html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch?.[1]) {
      // Clean up the title
      productName = titleMatch[1]
        .replace(/ \| shopee.*/i, "")
        .replace(/ - shopee.*/i, "")
        .trim()
        .slice(0, 80);
    }

    // Try to extract price from meta or structured data
    const priceMatch =
      html.match(/<meta\s+property="product:price:amount"\s+content="(\d+)"/i) ||
      html.match(/"price":\s*"?(\d+)"?/i) ||
      html.match(/฿\s*(\d[\d,]*)/);
    if (priceMatch?.[1]) {
      const p = parseInt(priceMatch[1].replace(/,/g, ""));
      priceMin = p;
      priceMax = p;
    }

    // Try price range
    const rangeMatch = html.match(/฿\s*(\d[\d,]*)\s*[-–]\s*฿?\s*(\d[\d,]*)/);
    if (rangeMatch) {
      priceMin = parseInt(rangeMatch[1].replace(/,/g, ""));
      priceMax = parseInt(rangeMatch[2].replace(/,/g, ""));
    }
  } catch {
    // Scraping failed — use defaults, pipeline will still work
  }

  // Start the pipeline
  try {
    const pipeline = await startAffiliatePipeline({
      productName,
      productUrl: url,
      priceMin,
      priceMax,
    });

    return (
      `🚀 <b>Affiliate Pipeline เริ่มแล้ว!</b>\n\n` +
      `🛍️ ${productName}\n` +
      `💰 ${priceMin > 0 ? `฿${priceMin}` : ""}${priceMax > 0 && priceMax !== priceMin ? `-${priceMax}` : ""}\n` +
      `🔗 ${url}\n` +
      `📋 Pipeline ID: <code>${pipeline.id}</code>\n\n` +
      `⏱ 10 Agents กำลังทำงาน...\n` +
      `จะส่ง preview ให้อนุมัติเมื่อเสร็จ 👆`
    );
  } catch (e) {
    return `❌ เริ่ม Pipeline ไม่สำเร็จ: ${e instanceof Error ? e.message : String(e)}`;
  }
}

// ---------------------------------------------------------------------------
// /dash — Mini Dashboard for TG
// ---------------------------------------------------------------------------
async function buildDashReply(): Promise<string> {
  let text = "📱 <b>Mini Dashboard</b>\n━━━━━━━━━━━━━━━\n";
  try {
    const kpiRes = await fetch(`http://127.0.0.1:${PORT}/api/kpi-goals`);
    const kpiData = await kpiRes.json() as any;
    if (kpiData.ok && kpiData.goals?.length > 0) {
      text += "\n🎯 <b>KPI Goals:</b>\n";
      for (const g of kpiData.goals.slice(0, 5)) {
        const bar = "█".repeat(Math.floor(g.percent / 10)) + "░".repeat(10 - Math.floor(g.percent / 10));
        text += `  ${g.icon} ${g.metric}: ${bar} ${g.percent}%\n`;
      }
    }
  } catch {}
  try {
    const gamiRes = await fetch(`http://127.0.0.1:${PORT}/api/gamification`);
    const gamiData = await gamiRes.json() as any;
    if (gamiData.ok) {
      const s = gamiData.stats;
      text += `\n🏆 <b>Level:</b> ${s.badge} ${s.title} (Lv.${s.level})\n`;
      text += `  ⭐ ${s.totalXp} XP | 🔥 ${s.currentStreak} day streak\n`;
    }
  } catch {}
  try {
    const revRes = await fetch(`http://127.0.0.1:${PORT}/api/revenue/chart?period=7d`);
    const revData = await revRes.json() as any;
    if (revData.ok) {
      text += `\n💰 <b>Revenue (7d):</b>\n`;
      text += `  Total: ฿${revData.summary.totalRevenue.toLocaleString()}\n`;
      text += `  Orders: ${revData.summary.totalOrders} | Avg: ฿${revData.summary.avgDaily.toLocaleString()}/day\n`;
    }
  } catch {}
  try {
    const insRes = await fetch(`http://127.0.0.1:${PORT}/api/smart-insights`);
    const insData = await insRes.json() as any;
    if (insData.ok && insData.totalInsights > 0) {
      const high = insData.insights.filter((i: any) => i.priority === "high").length;
      text += `\n🧠 <b>Insights:</b> ${insData.totalInsights} total`;
      if (high > 0) text += ` (${high} ⚠️ high priority)`;
      text += "\n";
    }
  } catch {}

  text += "\n━━━━━━━━━━━━━━━\n";
  text += "🖥️ Full dashboard: http://localhost:8800";
  return text;
}
