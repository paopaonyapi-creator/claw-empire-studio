/**
 * Auto Content Pipeline — One command → AI generates script + post + schedule
 *
 * TG: /pipeline <topic> — AI สร้าง content pipeline อัตโนมัติ
 * API: POST /api/pipeline/generate
 */

import type { Express, Request, Response } from "express";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "path";

const PIPELINE_FILE = path.resolve("data/content-pipelines.json");

interface PipelineItem {
  id: string;
  topic: string;
  script: string;
  hookLine: string;
  hashtags: string[];
  scheduledTime: string;
  platform: string;
  status: "draft" | "posted" | "scheduled";
  created: string;
}

function loadPipelines(): PipelineItem[] {
  try { if (existsSync(PIPELINE_FILE)) return JSON.parse(readFileSync(PIPELINE_FILE, "utf-8")) || []; } catch {} return [];
}
function savePipelines(d: PipelineItem[]): void {
  mkdirSync(path.dirname(PIPELINE_FILE), { recursive: true });
  writeFileSync(PIPELINE_FILE, JSON.stringify(d, null, 2));
}

async function generateContentWithAI(topic: string): Promise<{
  script: string; hookLine: string; hashtags: string[];
} | null> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return null;

  const prompt = `สร้าง content สำหรับขายของออนไลน์ในหัวข้อ "${topic}" โดยให้ผลลัพธ์เป็น JSON ดังนี้:
{
  "script": "สคริปต์พูดในวิดีโอ 30 วินาที (ภาษาไทย ใช้ emoji)",
  "hookLine": "ข้อความเปิดที่ดึงดูดให้คนหยุดดู (1 บรรทัด)",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"]
}
ตอบเป็น JSON เท่านั้น ไม่ต้องมีข้อความอื่น`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!res.ok) return null;
    const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as { script?: string; hookLine?: string; hashtags?: string[] };
    return {
      script: parsed.script || "Script not generated",
      hookLine: parsed.hookLine || topic,
      hashtags: parsed.hashtags || ["#ขายออนไลน์"],
    };
  } catch {
    return null;
  }
}

export async function handlePipelineGenerateCommand(topic: string): Promise<string> {
  if (!topic) return "❌ ใส่หัวข้อ: /pipeline <topic>\n\nตัวอย่าง:\n  /pipeline หมวกกันน็อค\n  /pipeline ครีมกันแดด\n  /pipeline เสื้อผ้าแฟชั่น";

  const content = await generateContentWithAI(topic);
  if (!content) {
    return "❌ ไม่สามารถสร้าง content ได้ (GEMINI_API_KEY ไม่ทำงาน)";
  }

  // Suggest optimal posting time
  const now = new Date();
  const hour = now.getHours();
  let suggestedHour = 18; // Default 6 PM
  if (hour < 9) suggestedHour = 9;
  else if (hour < 12) suggestedHour = 12;
  else if (hour < 18) suggestedHour = 18;
  else suggestedHour = 20;

  const scheduledTime = `${String(suggestedHour).padStart(2, "0")}:00`;

  const item: PipelineItem = {
    id: `pipe-${Date.now().toString(36)}`,
    topic,
    script: content.script,
    hookLine: content.hookLine,
    hashtags: content.hashtags,
    scheduledTime,
    platform: "facebook",
    status: "draft",
    created: new Date().toISOString(),
  };

  const pipelines = loadPipelines();
  pipelines.unshift(item);
  if (pipelines.length > 50) pipelines.length = 50;
  savePipelines(pipelines);

  let msg = `🚀 Content Pipeline: ${topic}\n\n`;
  msg += `🎣 Hook:\n${content.hookLine}\n\n`;
  msg += `📝 Script:\n${content.script}\n\n`;
  msg += `#️⃣ ${content.hashtags.join(" ")}\n\n`;
  msg += `⏰ Suggested: ${scheduledTime}\n`;
  msg += `🆔 ${item.id}\n\n`;
  msg += `📌 Actions:\n`;
  msg += `  /pipeline post ${item.id} — โพสต์ทันที\n`;
  msg += `  /pipeline list — ดูทั้งหมด`;

  return msg;
}

export async function handlePipelineCommand(arg: string): Promise<string> {
  const trimmed = arg.trim();

  if (!trimmed || trimmed === "help") {
    return `🚀 Auto Content Pipeline\n\n` +
      `คำสั่ง:\n` +
      `  /pipeline <หัวข้อ> — AI สร้าง content\n` +
      `  /pipeline list — ดู pipelines ทั้งหมด\n` +
      `  /pipeline post <id> — โพสต์ทันที\n` +
      `  /pipeline clear — ลบ drafts\n\n` +
      `ตัวอย่าง:\n  /pipeline ครีมกันแดด\n  /pipeline กระเป๋าหนังแท้`;
  }

  if (trimmed === "list") {
    const pipelines = loadPipelines();
    if (pipelines.length === 0) return "📭 ยังไม่มี pipelines\n\nสร้างด้วย: /pipeline <หัวข้อ>";

    let msg = "🚀 Content Pipelines:\n\n";
    for (const p of pipelines.slice(0, 10)) {
      const icon = p.status === "posted" ? "✅" : p.status === "scheduled" ? "⏰" : "📝";
      msg += `${icon} ${p.topic}\n   🆔 ${p.id} | ${p.status}\n   🎣 ${p.hookLine.substring(0, 40)}...\n\n`;
    }
    return msg;
  }

  if (trimmed.startsWith("post ")) {
    const id = trimmed.slice(5).trim();
    const pipelines = loadPipelines();
    const item = pipelines.find((p) => p.id === id);
    if (!item) return `❌ ไม่พบ pipeline: ${id}`;

    // Post to Facebook
    const token = process.env.FACEBOOK_ACCESS_TOKEN;
    if (!token) return "❌ FACEBOOK_ACCESS_TOKEN not set";

    const message = `${item.hookLine}\n\n${item.script}\n\n${item.hashtags.join(" ")}`;

    try {
      const meRes = await fetch(`https://graph.facebook.com/v19.0/me?fields=id&access_token=${token}`);
      const meData = await meRes.json() as { id?: string };
      const pageId = meData.id;

      const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, access_token: token }),
      });

      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) {
        return `❌ Post failed: ${(data as { error?: { message?: string } }).error?.message || "Unknown"}`;
      }

      item.status = "posted";
      savePipelines(pipelines);
      return `✅ Posted to Facebook!\n\n📝 ${item.topic}\n🆔 ${String(data.id || "").substring(0, 30)}`;
    } catch (e) {
      return `❌ Error: ${String(e)}`;
    }
  }

  if (trimmed === "clear") {
    const pipelines = loadPipelines();
    const kept = pipelines.filter((p) => p.status === "posted");
    savePipelines(kept);
    return `✅ Cleared ${pipelines.length - kept.length} drafts`;
  }

  // Default: treat as topic
  return handlePipelineGenerateCommand(trimmed);
}

// ---------------------------------------------------------------------------
// Feature 7: Income Report (text-based, TG-friendly)
// ---------------------------------------------------------------------------

export async function handleIncomeReportCommand(arg: string): Promise<string> {
  const period = arg.trim() || "month";

  // Collect data
  let totalRevenue = 0;
  let totalEntries = 0;
  const platformBreakdown: Record<string, number> = {};

  try {
    const revFile = path.resolve("data/revenue.json");
    if (existsSync(revFile)) {
      const data = JSON.parse(readFileSync(revFile, "utf-8")) as {
        entries?: Array<{ amount?: number; platform?: string; date?: string }>;
      };
      const entries = data.entries || [];

      const now = new Date();
      const periodStart = period === "week"
        ? new Date(now.getTime() - 7 * 86400000)
        : period === "year"
        ? new Date(now.getFullYear(), 0, 1)
        : new Date(now.getFullYear(), now.getMonth(), 1);

      for (const e of entries) {
        const entryDate = new Date(e.date || "");
        if (entryDate >= periodStart) {
          totalRevenue += e.amount || 0;
          totalEntries += 1;
          const plat = e.platform || "Other";
          platformBreakdown[plat] = (platformBreakdown[plat] || 0) + (e.amount || 0);
        }
      }
    }
  } catch {}

  // Collect link clicks
  let totalClicks = 0;
  try {
    const linksFile = path.resolve("data/short-links.json");
    if (existsSync(linksFile)) {
      const data = JSON.parse(readFileSync(linksFile, "utf-8")) as Array<{ clicks?: number }>;
      totalClicks = data.reduce((sum: number, l: { clicks?: number }) => sum + (l.clicks || 0), 0);
    }
  } catch {}

  // Collect FB posts
  let fbPosts = 0;
  try {
    const fbFile = path.resolve("data/fb-posts.json");
    if (existsSync(fbFile)) {
      const data = JSON.parse(readFileSync(fbFile, "utf-8")) as Array<{ status?: string }>;
      fbPosts = data.filter((p) => p.status === "posted").length;
    }
  } catch {}

  const periodLabel = period === "week" ? "สัปดาห์นี้" : period === "year" ? "ปีนี้" : "เดือนนี้";

  let msg = `💰 Income Report — ${periodLabel}\n\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `💵 Total Revenue: ฿${totalRevenue.toLocaleString()}\n`;
  msg += `📊 Entries: ${totalEntries}\n`;
  msg += `👆 Total Clicks: ${totalClicks}\n`;
  msg += `📘 FB Posts: ${fbPosts}\n\n`;

  if (Object.keys(platformBreakdown).length > 0) {
    msg += `📊 Platform Breakdown:\n`;
    for (const [plat, amount] of Object.entries(platformBreakdown).sort((a, b) => b[1] - a[1])) {
      const pct = totalRevenue > 0 ? Math.round((amount / totalRevenue) * 100) : 0;
      msg += `  ${plat}: ฿${amount.toLocaleString()} (${pct}%)\n`;
    }
    msg += "\n";
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📅 Generated: ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}\n\n`;
  msg += `Options: /income week | /income month | /income year`;

  // Save report
  try {
    const reportsDir = path.resolve("data/reports");
    mkdirSync(reportsDir, { recursive: true });
    const filename = `income-${new Date().toISOString().split("T")[0]}.txt`;
    writeFileSync(path.join(reportsDir, filename), msg);
  } catch {}

  return msg;
}

// ---------------------------------------------------------------------------
// Feature 8: Team Member Access
// ---------------------------------------------------------------------------

const TEAM_FILE = path.resolve("data/team-members.json");

interface TeamMember {
  id: string;
  name: string;
  role: "admin" | "editor" | "viewer";
  telegramId?: string;
  email?: string;
  added: string;
  lastActive?: string;
}

function loadTeam(): TeamMember[] {
  try { if (existsSync(TEAM_FILE)) return JSON.parse(readFileSync(TEAM_FILE, "utf-8")) || []; } catch {} return [];
}
function saveTeam(d: TeamMember[]): void {
  mkdirSync(path.dirname(TEAM_FILE), { recursive: true });
  writeFileSync(TEAM_FILE, JSON.stringify(d, null, 2));
}

export function handleTeamCommand(arg: string): string {
  const trimmed = arg.trim();

  if (!trimmed || trimmed === "help") {
    return `👥 Team Management\n\n` +
      `คำสั่ง:\n` +
      `  /team list — ดูสมาชิก\n` +
      `  /team add <name> <role> — เพิ่มสมาชิก\n` +
      `  /team remove <name> — ลบสมาชิก\n` +
      `  /team role <name> <role> — เปลี่ยน role\n\n` +
      `Roles: admin, editor, viewer\n\n` +
      `ตัวอย่าง:\n  /team add สมชาย editor`;
  }

  if (trimmed === "list") {
    const team = loadTeam();
    if (team.length === 0) return "👥 ยังไม่มีสมาชิก\n\nเพิ่มด้วย: /team add <name> <role>";

    let msg = "👥 Team Members:\n\n";
    for (const m of team) {
      const roleIcon = m.role === "admin" ? "👑" : m.role === "editor" ? "✏️" : "👁️";
      msg += `${roleIcon} ${m.name}\n`;
      msg += `   Role: ${m.role}\n`;
      if (m.email) msg += `   📧 ${m.email}\n`;
      if (m.lastActive) msg += `   ⏰ Last: ${m.lastActive.split("T")[0]}\n`;
      msg += "\n";
    }
    return msg;
  }

  if (trimmed.startsWith("add ")) {
    const parts = trimmed.slice(4).trim().split(/\s+/);
    const name = parts[0];
    const role = (parts[1] || "viewer") as "admin" | "editor" | "viewer";
    if (!name) return "❌ ใส่ชื่อ: /team add <name> <role>";
    if (!["admin", "editor", "viewer"].includes(role)) return "❌ Role ต้องเป็น: admin, editor, viewer";

    const team = loadTeam();
    if (team.find((m) => m.name.toLowerCase() === name.toLowerCase())) {
      return `❌ ${name} มีอยู่แล้ว`;
    }

    team.push({
      id: `team-${Date.now().toString(36)}`,
      name,
      role,
      added: new Date().toISOString(),
    });
    saveTeam(team);

    const roleIcon = role === "admin" ? "👑" : role === "editor" ? "✏️" : "👁️";
    return `✅ เพิ่มสมาชิก: ${name}\n${roleIcon} Role: ${role}`;
  }

  if (trimmed.startsWith("remove ")) {
    const name = trimmed.slice(7).trim();
    const team = loadTeam();
    const idx = team.findIndex((m) => m.name.toLowerCase() === name.toLowerCase());
    if (idx < 0) return `❌ ไม่พบ: ${name}`;
    team.splice(idx, 1);
    saveTeam(team);
    return `✅ ลบสมาชิก: ${name}`;
  }

  if (trimmed.startsWith("role ")) {
    const parts = trimmed.slice(5).trim().split(/\s+/);
    const name = parts[0];
    const newRole = parts[1] as "admin" | "editor" | "viewer";
    if (!name || !newRole) return "❌ ใช้: /team role <name> <role>";
    if (!["admin", "editor", "viewer"].includes(newRole)) return "❌ Role ต้องเป็น: admin, editor, viewer";

    const team = loadTeam();
    const member = team.find((m) => m.name.toLowerCase() === name.toLowerCase());
    if (!member) return `❌ ไม่พบ: ${name}`;
    member.role = newRole;
    saveTeam(team);
    return `✅ เปลี่ยน role ${name} → ${newRole}`;
  }

  return '❓ ไม่รู้จักคำสั่ง\n\nใช้ /team help ดูคำสั่งทั้งหมด';
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

export function registerPipelineRoutes(app: Express): void {
  // Pipeline
  app.get("/api/pipelines", (_req: Request, res: Response) => {
    res.json({ ok: true, pipelines: loadPipelines() });
  });

  app.post("/api/pipeline/generate", async (req: Request, res: Response) => {
    const { topic } = req.body as { topic?: string };
    if (!topic) return res.status(400).json({ error: "topic required" });
    const result = await handlePipelineGenerateCommand(topic);
    res.json({ ok: true, result });
  });

  // Income Report
  app.get("/api/income", async (req: Request, res: Response) => {
    const period = (req.query.period as string) || "month";
    const report = await handleIncomeReportCommand(period);
    res.json({ ok: true, report, period });
  });

  // Income Report as downloadable text
  app.get("/api/income/download", async (req: Request, res: Response) => {
    const period = (req.query.period as string) || "month";
    const report = await handleIncomeReportCommand(period);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="income-report-${period}-${new Date().toISOString().split("T")[0]}.txt"`);
    res.send(report);
  });

  // Team
  app.get("/api/team", (_req: Request, res: Response) => {
    res.json({ ok: true, members: loadTeam() });
  });

  app.post("/api/team/add", (req: Request, res: Response) => {
    const { name, role } = req.body as { name?: string; role?: string };
    if (!name) return res.status(400).json({ error: "name required" });
    const result = handleTeamCommand(`add ${name} ${role || "viewer"}`);
    res.json({ ok: true, result });
  });
}
