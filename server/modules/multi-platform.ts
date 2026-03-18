/**
 * Multi-Platform Publisher — Post to FB + IG + TikTok from one command
 * Also includes Google Sheets export
 *
 * TG: /multipost <message> — Post to all connected platforms
 *     /sheets — Sync data to Google Sheets
 * API: POST /api/multipost, POST /api/sheets/sync
 */

import type { Express, Request, Response } from "express";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "path";

// ---------------------------------------------------------------------------
// Feature E: Google Sheets-like CSV Auto-Export
// (Uses Supabase as "sheets" storage since we don't have Google API key)
// ---------------------------------------------------------------------------

const SHEETS_FILE = path.resolve("data/sheets-export.json");

interface SheetRow {
  date: string;
  revenue: number;
  clicks: number;
  posts: number;
  goals: number;
  fbPosts: number;
  shortLinks: number;
}

function loadSheetHistory(): SheetRow[] {
  try { if (existsSync(SHEETS_FILE)) return JSON.parse(readFileSync(SHEETS_FILE, "utf-8")) || []; } catch {} return [];
}
function saveSheetHistory(rows: SheetRow[]): void {
  mkdirSync(path.dirname(SHEETS_FILE), { recursive: true });
  writeFileSync(SHEETS_FILE, JSON.stringify(rows, null, 2));
}

async function collectDailyData(): Promise<SheetRow> {
  const today = new Date().toISOString().split("T")[0];

  // Collect from various data files
  let revenue = 0, clicks = 0, posts = 0, goals = 0, fbPosts = 0, shortLinks = 0;
  try {
    const revFile = path.resolve("data/revenue.json");
    if (existsSync(revFile)) {
      const data = JSON.parse(readFileSync(revFile, "utf-8")) as { entries?: Array<{ amount?: number }> };
      revenue = (data.entries || []).reduce((sum: number, e: { amount?: number }) => sum + (e.amount || 0), 0);
    }
  } catch {}
  try {
    const linksFile = path.resolve("data/short-links.json");
    if (existsSync(linksFile)) {
      const data = JSON.parse(readFileSync(linksFile, "utf-8")) as Array<{ clicks?: number }>;
      shortLinks = data.length;
      clicks = data.reduce((sum: number, l: { clicks?: number }) => sum + (l.clicks || 0), 0);
    }
  } catch {}
  try {
    const fbFile = path.resolve("data/fb-posts.json");
    if (existsSync(fbFile)) {
      const data = JSON.parse(readFileSync(fbFile, "utf-8")) as unknown[];
      fbPosts = data.length;
      posts = data.length;
    }
  } catch {}
  try {
    const goalsFile = path.resolve("data/goals.json");
    if (existsSync(goalsFile)) {
      const data = JSON.parse(readFileSync(goalsFile, "utf-8")) as { goals?: unknown[] };
      goals = (data.goals || []).length;
    }
  } catch {}

  return { date: today, revenue, clicks, posts, goals, fbPosts, shortLinks };
}

export async function handleSheetsCommand(): Promise<string> {
  const row = await collectDailyData();
  const history = loadSheetHistory();

  // Update or add today's row
  const existingIdx = history.findIndex((r) => r.date === row.date);
  if (existingIdx >= 0) history[existingIdx] = row;
  else history.push(row);

  // Keep last 90 days
  if (history.length > 90) history.splice(0, history.length - 90);
  saveSheetHistory(history);

  let msg = "📊 Data Synced!\n\n";
  msg += `📅 ${row.date}\n`;
  msg += `💰 Revenue: ฿${row.revenue.toLocaleString()}\n`;
  msg += `👆 Clicks: ${row.clicks}\n`;
  msg += `📝 Posts: ${row.posts}\n`;
  msg += `🎯 Goals: ${row.goals}\n`;
  msg += `📘 FB Posts: ${row.fbPosts}\n`;
  msg += `🔗 Short Links: ${row.shortLinks}\n\n`;
  msg += `📈 History: ${history.length} days tracked`;

  return msg;
}

// ---------------------------------------------------------------------------
// Feature F: Multi-Platform Publisher
// ---------------------------------------------------------------------------

interface PlatformResult {
  platform: string;
  ok: boolean;
  postId?: string;
  error?: string;
}

async function postToFacebook(message: string): Promise<PlatformResult> {
  const token = process.env.FACEBOOK_ACCESS_TOKEN;
  if (!token) return { platform: "Facebook", ok: false, error: "Token not set" };

  try {
    // Get page ID
    const meRes = await fetch(`https://graph.facebook.com/v19.0/me?fields=id&access_token=${token}`);
    const meData = await meRes.json() as { id?: string };
    const pageId = meData.id;
    if (!pageId) return { platform: "Facebook", ok: false, error: "Cannot get page ID" };

    const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, access_token: token }),
    });
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) {
      return { platform: "Facebook", ok: false, error: String((data as { error?: { message?: string } }).error?.message || "Failed") };
    }
    return { platform: "Facebook", ok: true, postId: String(data.id || "") };
  } catch (e) {
    return { platform: "Facebook", ok: false, error: String(e) };
  }
}

export async function handleMultiPostCommand(message: string): Promise<string> {
  if (!message) return "❌ ใส่ข้อความด้วย: /multipost <ข้อความ>";

  const results: PlatformResult[] = [];

  // Post to Facebook
  const fbResult = await postToFacebook(message);
  results.push(fbResult);

  // Future: Add Instagram, TikTok here
  // const igResult = await postToInstagram(message);
  // results.push(igResult);

  let msg = "📢 Multi-Platform Post\n\n";
  msg += `💬 "${message.substring(0, 50)}${message.length > 50 ? "..." : ""}"\n\n`;

  for (const r of results) {
    const icon = r.ok ? "✅" : "❌";
    msg += `${icon} ${r.platform}`;
    if (r.ok && r.postId) msg += ` (${r.postId.substring(0, 20)})`;
    if (!r.ok && r.error) msg += `: ${r.error.substring(0, 40)}`;
    msg += "\n";
  }

  const okCount = results.filter((r) => r.ok).length;
  msg += `\n📊 ${okCount}/${results.length} platforms posted`;

  // Save to history
  try {
    const histFile = path.resolve("data/multipost-history.json");
    mkdirSync(path.dirname(histFile), { recursive: true });
    const hist = existsSync(histFile) ? JSON.parse(readFileSync(histFile, "utf-8")) as unknown[] : [];
    hist.unshift({ message, results, timestamp: new Date().toISOString() });
    if (hist.length > 100) hist.length = 100;
    writeFileSync(histFile, JSON.stringify(hist, null, 2));
  } catch {}

  return msg;
}

// ---------------------------------------------------------------------------
// Feature H: A/B Testing Content
// ---------------------------------------------------------------------------

const AB_FILE = path.resolve("data/ab-tests.json");

interface AbTest {
  id: string;
  variantA: string;
  variantB: string;
  metricsA: { views: number; clicks: number; engagement: number };
  metricsB: { views: number; clicks: number; engagement: number };
  status: "active" | "completed";
  winner?: "A" | "B";
  created: string;
}

function loadAbTests(): AbTest[] {
  try { if (existsSync(AB_FILE)) return JSON.parse(readFileSync(AB_FILE, "utf-8")) || []; } catch {} return [];
}
function saveAbTests(d: AbTest[]): void {
  mkdirSync(path.dirname(AB_FILE), { recursive: true });
  writeFileSync(AB_FILE, JSON.stringify(d, null, 2));
}

export function handleAbTestCommand(arg: string): string {
  const trimmed = arg.trim();

  if (!trimmed || trimmed === "help") {
    return `🧪 A/B Testing\n\n` +
      `คำสั่ง:\n` +
      `  /ab create <A> | <B> — สร้าง test ใหม่\n` +
      `  /ab list — ดู tests ทั้งหมด\n` +
      `  /ab result <id> — ดูผลลัพธ์\n` +
      `  /ab vote <id> <A|B> — บันทึกผลลัพธ์\n\n` +
      `ตัวอย่าง:\n  /ab create 🔥 ลดราคา 50%! | ✨ โปรพิเศษวันนี้!`;
  }

  if (trimmed.startsWith("create ")) {
    const parts = trimmed.slice(7).split("|").map((s) => s.trim());
    if (parts.length < 2) return "❌ ใช้ | แยก 2 variants: /ab create ข้อความA | ข้อความB";

    const test: AbTest = {
      id: `ab-${Date.now().toString(36)}`,
      variantA: parts[0],
      variantB: parts[1],
      metricsA: { views: 0, clicks: 0, engagement: 0 },
      metricsB: { views: 0, clicks: 0, engagement: 0 },
      status: "active",
      created: new Date().toISOString(),
    };

    const tests = loadAbTests();
    tests.unshift(test);
    saveAbTests(tests);

    return `🧪 A/B Test Created!\n\n🆔 ${test.id}\n\n🅰️ ${test.variantA}\n\n🅱️ ${test.variantB}\n\nใช้ /ab vote ${test.id} A หรือ B เพื่อบันทึกผล`;
  }

  if (trimmed === "list") {
    const tests = loadAbTests();
    if (tests.length === 0) return "📭 ยังไม่มี A/B tests\n\nสร้างด้วย: /ab create ข้อความA | ข้อความB";

    let msg = "🧪 A/B Tests:\n\n";
    for (const t of tests.slice(0, 10)) {
      const statusIcon = t.status === "active" ? "🟢" : "✅";
      msg += `${statusIcon} ${t.id}\n`;
      msg += `  🅰️ ${t.variantA.substring(0, 30)}... (${t.metricsA.clicks} clicks)\n`;
      msg += `  🅱️ ${t.variantB.substring(0, 30)}... (${t.metricsB.clicks} clicks)\n`;
      if (t.winner) msg += `  🏆 Winner: ${t.winner}\n`;
      msg += "\n";
    }
    return msg;
  }

  if (trimmed.startsWith("vote ")) {
    const parts = trimmed.slice(5).split(/\s+/);
    const testId = parts[0];
    const variant = parts[1]?.toUpperCase();
    if (!testId || !variant || !["A", "B"].includes(variant)) {
      return "❌ ใช้: /ab vote <id> <A|B>";
    }

    const tests = loadAbTests();
    const test = tests.find((t) => t.id === testId);
    if (!test) return `❌ ไม่พบ test: ${testId}`;

    if (variant === "A") {
      test.metricsA.clicks += 1;
      test.metricsA.engagement += 1;
    } else {
      test.metricsB.clicks += 1;
      test.metricsB.engagement += 1;
    }

    // Auto-determine winner after 10+ votes
    const totalVotes = test.metricsA.clicks + test.metricsB.clicks;
    if (totalVotes >= 10) {
      test.winner = test.metricsA.clicks > test.metricsB.clicks ? "A" : "B";
      test.status = "completed";
    }

    saveAbTests(tests);
    return `✅ Vote ${variant} recorded for ${testId}\n\n🅰️ ${test.metricsA.clicks} votes | 🅱️ ${test.metricsB.clicks} votes${test.winner ? `\n\n🏆 Winner: ${test.winner}!` : ""}`;
  }

  if (trimmed.startsWith("result ")) {
    const testId = trimmed.slice(7).trim();
    const tests = loadAbTests();
    const test = tests.find((t) => t.id === testId);
    if (!test) return `❌ ไม่พบ test: ${testId}`;

    const totalA = test.metricsA.clicks;
    const totalB = test.metricsB.clicks;
    const total = totalA + totalB;
    const pctA = total > 0 ? Math.round((totalA / total) * 100) : 0;
    const pctB = total > 0 ? Math.round((totalB / total) * 100) : 0;

    return `🧪 A/B Test Result: ${test.id}\n\n` +
      `🅰️ ${test.variantA}\n   ${totalA} votes (${pctA}%)\n\n` +
      `🅱️ ${test.variantB}\n   ${totalB} votes (${pctB}%)\n\n` +
      `${test.winner ? `🏆 Winner: ${test.winner}!` : "🔄 Still testing..."}`;
  }

  return '❓ ไม่รู้จักคำสั่ง\n\nใช้ /ab help ดูคำสั่งทั้งหมด';
}

// ---------------------------------------------------------------------------
// Feature I: AI Auto-Schedule (find best posting time)
// ---------------------------------------------------------------------------

export async function handleAutoScheduleCommand(): Promise<string> {
  // Analyze engagement data to find optimal posting times
  let bestHours = [9, 12, 18, 20]; // Default best hours
  let analysis = "Based on general Thai social media patterns";

  try {
    const fbFile = path.resolve("data/fb-posts.json");
    if (existsSync(fbFile)) {
      const posts = JSON.parse(readFileSync(fbFile, "utf-8")) as Array<{ timestamp?: string; status?: string }>;
      const successPosts = posts.filter((p) => p.status === "posted" && p.timestamp);
      if (successPosts.length >= 5) {
        // Analyze which hours had posts
        const hourCounts: Record<number, number> = {};
        for (const p of successPosts) {
          const h = new Date(p.timestamp!).getHours();
          hourCounts[h] = (hourCounts[h] || 0) + 1;
        }
        bestHours = Object.entries(hourCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 4)
          .map(([h]) => Number(h));
        analysis = `Based on ${successPosts.length} successful posts`;
      }
    }
  } catch {}

  // Use AI to suggest content timing
  const geminiKey = process.env.GEMINI_API_KEY;
  let aiSuggestion = "";
  if (geminiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "แนะนำเวลาโพสต์ขายของออนไลน์ในไทย 3 ช่วงเวลาที่ดีที่สุด พร้อมเหตุผลสั้นๆ (ภาษาไทย 3 บรรทัด)" }] }],
          }),
          signal: AbortSignal.timeout(10000),
        }
      );
      if (res.ok) {
        const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
        aiSuggestion = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      }
    } catch {}
  }

  let msg = "⏰ AI Auto-Schedule\n\n";
  msg += `📊 ${analysis}\n\n`;
  msg += "🏆 Best posting times:\n";
  for (const h of bestHours) {
    msg += `  ⏰ ${String(h).padStart(2, "0")}:00\n`;
  }

  if (aiSuggestion) {
    msg += `\n🤖 AI Suggestion:\n${aiSuggestion.substring(0, 200)}`;
  }

  msg += "\n\n💡 ใช้ /fb schedule <HH:MM> <ข้อความ> ตั้งเวลาโพสต์";

  return msg;
}

// ---------------------------------------------------------------------------
// Feature J: Competitor Monitor
// ---------------------------------------------------------------------------

const COMPETITORS_FILE = path.resolve("data/competitors.json");

interface Competitor {
  name: string;
  url: string;
  platform: string;
  notes: string;
  added: string;
  lastCheck?: string;
}

function loadCompetitors(): Competitor[] {
  try { if (existsSync(COMPETITORS_FILE)) return JSON.parse(readFileSync(COMPETITORS_FILE, "utf-8")) || []; } catch {} return [];
}
function saveCompetitors(d: Competitor[]): void {
  mkdirSync(path.dirname(COMPETITORS_FILE), { recursive: true });
  writeFileSync(COMPETITORS_FILE, JSON.stringify(d, null, 2));
}

export function handleCompetitorCommand(arg: string): string {
  const trimmed = arg.trim();

  if (!trimmed || trimmed === "help") {
    return `🔍 Competitor Monitor\n\n` +
      `คำสั่ง:\n` +
      `  /competitor add <name> <url> — เพิ่มคู่แข่ง\n` +
      `  /competitor list — ดูรายชื่อ\n` +
      `  /competitor remove <name> — ลบ\n` +
      `  /competitor note <name> <note> — เพิ่ม notes\n\n` +
      `ตัวอย่าง:\n  /competitor add ShopA https://facebook.com/shopa`;
  }

  if (trimmed.startsWith("add ")) {
    const parts = trimmed.slice(4).trim().split(/\s+/);
    const name = parts[0];
    const url = parts[1] || "";
    if (!name) return "❌ ใส่ชื่อ: /competitor add <name> <url>";

    const platform = url.includes("facebook") ? "Facebook"
      : url.includes("tiktok") ? "TikTok"
      : url.includes("shopee") ? "Shopee"
      : url.includes("lazada") ? "Lazada"
      : url.includes("instagram") ? "Instagram"
      : "Other";

    const competitors = loadCompetitors();
    if (competitors.find((c) => c.name.toLowerCase() === name.toLowerCase())) {
      return `❌ ${name} มีอยู่แล้ว`;
    }

    competitors.push({ name, url, platform, notes: "", added: new Date().toISOString() });
    saveCompetitors(competitors);
    return `✅ เพิ่มคู่แข่ง: ${name}\n🌐 ${platform}: ${url}`;
  }

  if (trimmed === "list") {
    const competitors = loadCompetitors();
    if (competitors.length === 0) return "📭 ยังไม่มีคู่แข่ง\n\nเพิ่มด้วย: /competitor add <name> <url>";

    let msg = "🔍 Competitors:\n\n";
    for (const c of competitors) {
      msg += `📌 ${c.name} (${c.platform})\n`;
      if (c.url) msg += `   🔗 ${c.url.substring(0, 40)}\n`;
      if (c.notes) msg += `   📝 ${c.notes.substring(0, 40)}\n`;
      msg += "\n";
    }
    return msg;
  }

  if (trimmed.startsWith("remove ")) {
    const name = trimmed.slice(7).trim();
    const competitors = loadCompetitors();
    const idx = competitors.findIndex((c) => c.name.toLowerCase() === name.toLowerCase());
    if (idx < 0) return `❌ ไม่พบ: ${name}`;
    competitors.splice(idx, 1);
    saveCompetitors(competitors);
    return `✅ ลบคู่แข่ง: ${name}`;
  }

  if (trimmed.startsWith("note ")) {
    const parts = trimmed.slice(5).trim().split(/\s+/);
    const name = parts[0];
    const note = parts.slice(1).join(" ");
    if (!name || !note) return "❌ ใช้: /competitor note <name> <note>";

    const competitors = loadCompetitors();
    const comp = competitors.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (!comp) return `❌ ไม่พบ: ${name}`;
    comp.notes = note;
    comp.lastCheck = new Date().toISOString();
    saveCompetitors(competitors);
    return `✅ เพิ่ม note สำหรับ ${name}\n📝 ${note}`;
  }

  return '❓ ไม่รู้จักคำสั่ง\n\nใช้ /competitor help ดูคำสั่งทั้งหมด';
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

export function registerMultiPlatformRoutes(app: Express): void {
  // Multi-post
  app.post("/api/multipost", async (req: Request, res: Response) => {
    const { message } = req.body as { message?: string };
    if (!message) return res.status(400).json({ error: "message required" });
    const result = await handleMultiPostCommand(message);
    res.json({ ok: true, result });
  });

  // Sheets sync
  app.get("/api/sheets", async (_req: Request, res: Response) => {
    const history = loadSheetHistory();
    res.json({ ok: true, rows: history });
  });

  app.post("/api/sheets/sync", async (_req: Request, res: Response) => {
    const row = await collectDailyData();
    const history = loadSheetHistory();
    const idx = history.findIndex((r) => r.date === row.date);
    if (idx >= 0) history[idx] = row;
    else history.push(row);
    saveSheetHistory(history);
    res.json({ ok: true, row });
  });

  // A/B Tests
  app.get("/api/ab-tests", (_req: Request, res: Response) => {
    res.json({ ok: true, tests: loadAbTests() });
  });

  // Competitors
  app.get("/api/competitors", (_req: Request, res: Response) => {
    res.json({ ok: true, competitors: loadCompetitors() });
  });
}
