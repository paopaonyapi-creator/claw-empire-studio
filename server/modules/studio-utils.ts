/**
 * Studio Utilities — Help, Daily Report, Analytics, Order Alerts
 *
 * Features:
 * E — /help (grouped command list)
 * F — TG Bot Menu (setMyCommands on startup)
 * K — Automated Daily Report at 08:00 Bangkok time
 * L — Webhook Order Alert
 * I — Page view analytics tracking
 */

import type { Express, Request, Response } from "express";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "path";

const TG_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TG_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

// ---------------------------------------------------------------------------
// Feature E: /help command — grouped 30+ commands
// ---------------------------------------------------------------------------

export function handleHelpCommand(): string {
  return `📋 <b>Claw Empire Commands</b>\n\n` +

    `📊 <b>สถานะ & รายงาน</b>\n` +
    `  /status — ดูสถานะระบบ\n` +
    `  /health — เช็ค API ทั้งหมด\n` +
    `  /brief — สรุปงานวันนี้\n` +
    `  /today — สถิติวันนี้\n` +
    `  /insights — วิเคราะห์ข้อมูล\n` +
    `  /income — รายงานรายได้\n` +
    `  /report — Daily report\n\n` +

    `📝 <b>Content</b>\n` +
    `  /generate <topic> — AI สร้าง content\n` +
    `  /pipeline <topic> — AI สร้าง pipeline\n` +
    `  /schedule — ปฏิทิน content\n` +
    `  /multipost <msg> — โพสต์หลาย platform\n\n` +

    `📘 <b>Facebook</b>\n` +
    `  /fb status — เช็ค connection\n` +
    `  /fb post <msg> — โพสต์\n` +
    `  /fb posts — ดูโพสต์ล่าสุด\n` +
    `  /fb schedule <HH:MM> <msg> — ตั้งเวลา\n\n` +

    `💰 <b>Revenue & Links</b>\n` +
    `  /revenue — ยอดรายได้\n` +
    `  /short <url> — ย่อ link\n` +
    `  /link — สถิติ link\n\n` +

    `🎯 <b>เครื่องมือ</b>\n` +
    `  /goal — เป้าหมาย\n` +
    `  /ab create A | B — A/B test\n` +
    `  /autoschedule — AI แนะนำเวลาโพสต์\n` +
    `  /competitor — ติดตามคู่แข่ง\n` +
    `  /sheets — sync ข้อมูล\n` +
    `  /alerts — แจ้งเตือน\n\n` +

    `👥 <b>ทีม & ระบบ</b>\n` +
    `  /team — จัดการทีม\n` +
    `  /export — export ข้อมูล\n` +
    `  /sync — backup Supabase\n` +
    `  /product — จัดการสินค้า\n\n` +

    `💡 พิมพ์อะไรก็ได้ → AI ตอบอัตโนมัติ`;
}

// ---------------------------------------------------------------------------
// Feature F: TG Bot Menu (setMyCommands)
// ---------------------------------------------------------------------------

export async function setupTelegramBotMenu(): Promise<void> {
  if (!TG_BOT_TOKEN) return;

  const commands = [
    { command: "help", description: "📋 ดูคำสั่งทั้งหมด" },
    { command: "status", description: "📊 สถานะระบบ" },
    { command: "health", description: "🏥 เช็ค API" },
    { command: "brief", description: "☀️ สรุปงานวันนี้" },
    { command: "income", description: "💰 รายงานรายได้" },
    { command: "pipeline", description: "🚀 AI สร้าง content" },
    { command: "generate", description: "✨ สร้าง content" },
    { command: "fb", description: "📘 Facebook commands" },
    { command: "multipost", description: "📢 โพสต์หลาย platform" },
    { command: "schedule", description: "📅 ปฏิทิน content" },
    { command: "revenue", description: "💵 ยอดรายได้" },
    { command: "goal", description: "🎯 เป้าหมาย" },
    { command: "team", description: "👥 จัดการทีม" },
    { command: "ab", description: "🧪 A/B testing" },
    { command: "competitor", description: "🔍 ติดตามคู่แข่ง" },
    { command: "autoschedule", description: "⏰ AI แนะนำเวลาโพสต์" },
    { command: "short", description: "🔗 ย่อ link" },
    { command: "sheets", description: "📊 sync ข้อมูล" },
    { command: "export", description: "📤 export ข้อมูล" },
    { command: "insights", description: "🧠 วิเคราะห์ข้อมูล" },
  ];

  try {
    const res = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/setMyCommands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commands }),
    });
    const data = await res.json() as { ok?: boolean };
    if (data.ok) {
      console.log(`[TG-Menu] ✅ Bot menu set (${commands.length} commands)`);
    } else {
      console.log("[TG-Menu] ⚠️ Failed to set bot menu");
    }
  } catch (err) {
    console.error("[TG-Menu] ❌ Error:", err instanceof Error ? err.message : err);
  }
}

// ---------------------------------------------------------------------------
// Feature K: Automated Daily Report at 08:00 Bangkok time
// ---------------------------------------------------------------------------

async function sendDailyReport(): Promise<void> {
  if (!TG_BOT_TOKEN || !TG_CHAT_ID) return;

  // Collect data from files
  let revenue = 0, fbPosts = 0, clicks = 0, goals = 0;

  try {
    const revFile = path.resolve("data/revenue.json");
    if (existsSync(revFile)) {
      const data = JSON.parse(readFileSync(revFile, "utf-8")) as { entries?: Array<{ amount?: number }> };
      revenue = (data.entries || []).reduce((s: number, e: { amount?: number }) => s + (e.amount || 0), 0);
    }
  } catch {}
  try {
    const fbFile = path.resolve("data/fb-posts.json");
    if (existsSync(fbFile)) {
      const data = JSON.parse(readFileSync(fbFile, "utf-8")) as Array<{ status?: string }>;
      fbPosts = data.filter((p) => p.status === "posted").length;
    }
  } catch {}
  try {
    const linksFile = path.resolve("data/short-links.json");
    if (existsSync(linksFile)) {
      const data = JSON.parse(readFileSync(linksFile, "utf-8")) as Array<{ clicks?: number }>;
      clicks = data.reduce((s: number, l: { clicks?: number }) => s + (l.clicks || 0), 0);
    }
  } catch {}
  try {
    const goalsFile = path.resolve("data/goals.json");
    if (existsSync(goalsFile)) {
      const data = JSON.parse(readFileSync(goalsFile, "utf-8")) as { goals?: unknown[] };
      goals = (data.goals || []).length;
    }
  } catch {}

  // Get API health
  let apiUp = 0, apiTotal = 0;
  try {
    const healthFile = path.resolve("data/api-health.json");
    if (existsSync(healthFile)) {
      const data = JSON.parse(readFileSync(healthFile, "utf-8")) as Record<string, { status?: string }>;
      const apis = Object.values(data);
      apiUp = apis.filter((a) => a.status === "up").length;
      apiTotal = apis.filter((a) => a.status !== "unconfigured").length;
    }
  } catch {}

  const today = new Date().toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const msg = `☀️ <b>Daily Report</b>\n` +
    `📅 ${today}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `💰 Revenue: ฿${revenue.toLocaleString()}\n` +
    `📘 FB Posts: ${fbPosts}\n` +
    `👆 Link Clicks: ${clicks}\n` +
    `🎯 Goals: ${goals}\n` +
    `🏥 APIs: ${apiUp}/${apiTotal} operational\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `มีอะไรให้ช่วยวันนี้พิมพ์มาเลย! 🚀`;

  try {
    await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT_ID, text: msg, parse_mode: "HTML" }),
    });
    console.log("[Daily-Report] ✅ Sent");
  } catch (err) {
    console.error("[Daily-Report] ❌:", err instanceof Error ? err.message : err);
  }
}

export function startDailyReportCron(): void {
  // Check every minute if it's 08:00 Bangkok time
  setInterval(() => {
    const now = new Date();
    const bangkokTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
    const hours = bangkokTime.getHours();
    const mins = bangkokTime.getMinutes();

    if (hours === 8 && mins === 0) {
      sendDailyReport().catch(() => {});
    }
  }, 60000); // Check every minute

  console.log("[Daily-Report] ⏰ Cron active — will send at 08:00 Bangkok time");
}

// ---------------------------------------------------------------------------
// Feature L: Webhook Order Alert
// ---------------------------------------------------------------------------

const ORDERS_FILE = path.resolve("data/orders.json");

interface OrderAlert {
  id: string;
  platform: string;
  productName: string;
  amount: number;
  buyerName: string;
  timestamp: string;
}

function loadOrders(): OrderAlert[] {
  try { if (existsSync(ORDERS_FILE)) return JSON.parse(readFileSync(ORDERS_FILE, "utf-8")) || []; } catch {} return [];
}
function saveOrders(d: OrderAlert[]): void {
  mkdirSync(path.dirname(ORDERS_FILE), { recursive: true });
  writeFileSync(ORDERS_FILE, JSON.stringify(d, null, 2));
}

async function sendOrderAlert(order: OrderAlert): Promise<void> {
  if (!TG_BOT_TOKEN || !TG_CHAT_ID) return;

  const platformIcon = order.platform.toLowerCase().includes("shopee") ? "🟠"
    : order.platform.toLowerCase().includes("lazada") ? "🔵"
    : order.platform.toLowerCase().includes("tiktok") ? "🎵"
    : "🛒";

  const msg = `${platformIcon} <b>New Order!</b>\n\n` +
    `📦 ${order.productName}\n` +
    `💰 ฿${order.amount.toLocaleString()}\n` +
    `👤 ${order.buyerName}\n` +
    `🏪 ${order.platform}\n` +
    `⏰ ${new Date(order.timestamp).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}`;

  try {
    await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT_ID, text: msg, parse_mode: "HTML" }),
    });
  } catch {}
}

export function handleOrderCommand(arg: string): string {
  const trimmed = arg.trim();

  if (!trimmed || trimmed === "help") {
    return `🛒 Order Alerts\n\n` +
      `คำสั่ง:\n` +
      `  /order list — ดูออเดอร์ล่าสุด\n` +
      `  /order add <platform> <product> <amount> — บันทึกออเดอร์\n` +
      `  /order stats — สรุปยอด\n\n` +
      `Webhook: POST /api/orders/webhook\n` +
      `(ใช้กับ Shopee/Lazada webhook)`;
  }

  if (trimmed === "list") {
    const orders = loadOrders();
    if (orders.length === 0) return "📭 ยังไม่มีออเดอร์";

    let msg = "🛒 Recent Orders:\n\n";
    for (const o of orders.slice(0, 10)) {
      msg += `📦 ${o.productName}\n   💰 ฿${o.amount.toLocaleString()} | ${o.platform}\n   ${o.timestamp.split("T")[0]}\n\n`;
    }
    return msg;
  }

  if (trimmed.startsWith("add ")) {
    const parts = trimmed.slice(4).trim().split(/\s+/);
    if (parts.length < 3) return "❌ ใช้: /order add <platform> <product> <amount>";

    const platform = parts[0];
    const amount = Number(parts[parts.length - 1]) || 0;
    const productName = parts.slice(1, -1).join(" ");

    const order: OrderAlert = {
      id: `ord-${Date.now().toString(36)}`,
      platform,
      productName,
      amount,
      buyerName: "Manual Entry",
      timestamp: new Date().toISOString(),
    };

    const orders = loadOrders();
    orders.unshift(order);
    if (orders.length > 500) orders.length = 500;
    saveOrders(orders);

    sendOrderAlert(order).catch(() => {});
    return `✅ บันทึกออเดอร์: ${productName}\n💰 ฿${amount.toLocaleString()} | ${platform}`;
  }

  if (trimmed === "stats") {
    const orders = loadOrders();
    const totalRevenue = orders.reduce((s, o) => s + o.amount, 0);
    const platforms: Record<string, { count: number; revenue: number }> = {};

    for (const o of orders) {
      if (!platforms[o.platform]) platforms[o.platform] = { count: 0, revenue: 0 };
      platforms[o.platform].count += 1;
      platforms[o.platform].revenue += o.amount;
    }

    let msg = `🛒 Order Stats\n\n`;
    msg += `📦 Total: ${orders.length} orders\n`;
    msg += `💰 Revenue: ฿${totalRevenue.toLocaleString()}\n\n`;

    for (const [plat, data] of Object.entries(platforms)) {
      msg += `🏪 ${plat}: ${data.count} orders (฿${data.revenue.toLocaleString()})\n`;
    }
    return msg;
  }

  return '❓ ไม่รู้จักคำสั่ง\n\nใช้ /order help';
}

// ---------------------------------------------------------------------------
// Feature I: Analytics Tracking (page views, events)
// ---------------------------------------------------------------------------

const ANALYTICS_FILE = path.resolve("data/analytics.json");

interface AnalyticsData {
  pageViews: Record<string, number>;
  events: Array<{ name: string; data?: Record<string, unknown>; timestamp: string }>;
  dailyViews: Record<string, number>;
}

function loadAnalytics(): AnalyticsData {
  try {
    if (existsSync(ANALYTICS_FILE)) return JSON.parse(readFileSync(ANALYTICS_FILE, "utf-8"));
  } catch {}
  return { pageViews: {}, events: [], dailyViews: {} };
}
function saveAnalytics(d: AnalyticsData): void {
  mkdirSync(path.dirname(ANALYTICS_FILE), { recursive: true });
  writeFileSync(ANALYTICS_FILE, JSON.stringify(d, null, 2));
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

export function registerUtilityRoutes(app: Express): void {
  // Analytics: track page view
  app.post("/api/analytics/pageview", (req: Request, res: Response) => {
    const { page } = req.body as { page?: string };
    if (!page) return res.status(400).json({ error: "page required" });

    const analytics = loadAnalytics();
    analytics.pageViews[page] = (analytics.pageViews[page] || 0) + 1;

    const today = new Date().toISOString().split("T")[0];
    analytics.dailyViews[today] = (analytics.dailyViews[today] || 0) + 1;

    saveAnalytics(analytics);
    res.json({ ok: true });
  });

  // Analytics: track event
  app.post("/api/analytics/event", (req: Request, res: Response) => {
    const { name, data: eventData } = req.body as { name?: string; data?: Record<string, unknown> };
    if (!name) return res.status(400).json({ error: "name required" });

    const analytics = loadAnalytics();
    analytics.events.push({ name, data: eventData, timestamp: new Date().toISOString() });
    if (analytics.events.length > 1000) analytics.events.splice(0, analytics.events.length - 1000);
    saveAnalytics(analytics);
    res.json({ ok: true });
  });

  // Analytics: get stats
  app.get("/api/analytics", (_req: Request, res: Response) => {
    const analytics = loadAnalytics();
    const totalViews = Object.values(analytics.pageViews).reduce((s, v) => s + v, 0);
    res.json({
      ok: true,
      totalViews,
      pageViews: analytics.pageViews,
      dailyViews: analytics.dailyViews,
      recentEvents: analytics.events.slice(-20),
    });
  });

  // Order webhook (for Shopee/Lazada)
  app.post("/api/orders/webhook", async (req: Request, res: Response) => {
    const { platform, productName, amount, buyerName } = req.body as {
      platform?: string; productName?: string; amount?: number; buyerName?: string;
    };

    if (!productName || !amount) {
      return res.status(400).json({ error: "productName and amount required" });
    }

    const order: OrderAlert = {
      id: `ord-${Date.now().toString(36)}`,
      platform: platform || "Unknown",
      productName,
      amount,
      buyerName: buyerName || "Customer",
      timestamp: new Date().toISOString(),
    };

    const orders = loadOrders();
    orders.unshift(order);
    if (orders.length > 500) orders.length = 500;
    saveOrders(orders);

    await sendOrderAlert(order);
    res.json({ ok: true, orderId: order.id });
  });

  // Orders list
  app.get("/api/orders", (_req: Request, res: Response) => {
    res.json({ ok: true, orders: loadOrders() });
  });
}
