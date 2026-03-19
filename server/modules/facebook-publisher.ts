/**
 * Facebook Publisher — Auto-post to Facebook Pages via Graph API
 * NOW BACKED BY SQLite (via studio-db.ts).
 */

import type { Express, Request, Response } from "express";
import {
  dbAddFbPost, dbGetFbPosts, dbGetScheduledFbPosts, dbUpdateFbPostStatus,
  getStudioDb, type StudioFbPost,
} from "./studio-db.ts";

const FB_ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN || "";
const GRAPH_API = "https://graph.facebook.com/v19.0";

// ---------------------------------------------------------------------------
// Facebook Graph API Helpers
// ---------------------------------------------------------------------------
async function fbGet(endpoint: string): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: string }> {
  if (!FB_ACCESS_TOKEN) return { ok: false, error: "FACEBOOK_ACCESS_TOKEN not configured" };
  try {
    const url = `${GRAPH_API}${endpoint}${endpoint.includes("?") ? "&" : "?"}access_token=${FB_ACCESS_TOKEN}`;
    const res = await fetch(url);
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) return { ok: false, error: String((data as { error?: { message?: string } }).error?.message || "Unknown error") };
    return { ok: true, data };
  } catch (e) { return { ok: false, error: String(e) }; }
}

async function getPageId(): Promise<string | null> {
  const result = await fbGet("/me/accounts");
  if (!result.ok || !result.data) return null;
  const accounts = result.data.data as Array<{ id: string; name: string; access_token: string }> | undefined;
  if (accounts && accounts.length > 0) return accounts[0].id;
  const me = await fbGet("/me");
  if (me.ok && me.data?.id) return String(me.data.id);
  return null;
}

async function postToPage(message: string, link?: string): Promise<{ ok: boolean; postId?: string; error?: string }> {
  if (!FB_ACCESS_TOKEN) return { ok: false, error: "FACEBOOK_ACCESS_TOKEN not set" };

  const pagesResult = await fbGet("/me/accounts");
  let pageId: string | null = null;
  let pageToken = FB_ACCESS_TOKEN;

  if (pagesResult.ok && pagesResult.data) {
    const accounts = pagesResult.data.data as Array<{ id: string; name: string; access_token: string }> | undefined;
    if (accounts && accounts.length > 0) {
      pageId = accounts[0].id;
      pageToken = accounts[0].access_token || FB_ACCESS_TOKEN;
    }
  }

  if (!pageId) {
    const me = await fbGet("/me");
    if (me.ok && me.data?.id) pageId = String(me.data.id);
  }
  if (!pageId) return { ok: false, error: "Cannot determine page ID" };

  try {
    const body: Record<string, string> = { message, access_token: pageToken };
    if (link) body.link = link;
    const res = await fetch(`${GRAPH_API}/${pageId}/feed`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) return { ok: false, error: String((data as { error?: { message?: string } }).error?.message || "Post failed") };
    return { ok: true, postId: String(data.id || "") };
  } catch (e) { return { ok: false, error: String(e) }; }
}

async function getRecentPosts(limit = 5): Promise<Array<{ id: string; message: string; created_time: string }>> {
  const pageId = await getPageId();
  if (!pageId) return [];
  const result = await fbGet(`/${pageId}/posts?limit=${limit}&fields=id,message,created_time`);
  if (!result.ok || !result.data) return [];
  return (result.data.data as Array<{ id: string; message: string; created_time: string }>) || [];
}

// ---------------------------------------------------------------------------
// TG Command: /fb <subcommand>
// ---------------------------------------------------------------------------
export async function handleFbCommand(arg: string): Promise<string> {
  const trimmed = arg.trim();

  if (!trimmed || trimmed === "help") {
    return `📘 Facebook Publisher\n\nคำสั่ง:\n  /fb status — เช็คสถานะ connection\n  /fb pages — ดู pages ที่เชื่อมต่อ\n  /fb post <ข้อความ> — โพสต์ลง Facebook\n  /fb schedule <HH:MM> <ข้อความ> — ตั้งเวลาโพสต์\n  /fb posts — ดู 5 โพสต์ล่าสุด\n  /fb history — ประวัติการโพสต์\n\nตัวอย่าง:\n  /fb post 🔥 หมวกกันน็อคลดราคา! กดลิงก์ในโปรไฟล์`;
  }

  if (trimmed === "status") {
    if (!FB_ACCESS_TOKEN) return "❌ FACEBOOK_ACCESS_TOKEN ยังไม่ได้ตั้ง\n\nเพิ่มบน Railway → Variables";
    const me = await fbGet("/me?fields=id,name");
    if (!me.ok) return `❌ Connection failed: ${me.error}`;
    return `✅ Facebook Connected!\n\n👤 ${me.data?.name || "Unknown"}\n🆔 ${me.data?.id || ""}`;
  }

  if (trimmed === "pages") {
    const result = await fbGet("/me/accounts?fields=id,name,category,fan_count");
    if (!result.ok) return `❌ Error: ${result.error}`;
    const pages = result.data?.data as Array<{ id: string; name: string; category: string; fan_count: number }> | undefined;
    if (!pages || pages.length === 0) return "📭 ไม่พบ pages — token อาจเป็น page token (ไม่ใช่ user token)";
    let msg = "📘 Facebook Pages:\n\n";
    for (const p of pages) msg += `📄 ${p.name}\n   Category: ${p.category}\n   Fans: ${(p.fan_count || 0).toLocaleString()}\n   ID: ${p.id}\n\n`;
    return msg;
  }

  if (trimmed === "posts") {
    const posts = await getRecentPosts(5);
    if (posts.length === 0) return "📭 ไม่พบโพสต์";
    let msg = "📘 Recent Posts:\n\n";
    for (const p of posts) {
      const preview = (p.message || "").substring(0, 60);
      msg += `📝 ${preview}${p.message?.length > 60 ? "..." : ""}\n   📅 ${p.created_time}\n\n`;
    }
    return msg;
  }

  if (trimmed === "history") {
    const history = dbGetFbPosts(10);
    if (history.length === 0) return "📭 ยังไม่มีประวัติการโพสต์\n\nใช้: /fb post <ข้อความ>";
    let msg = "📋 Post History:\n\n";
    for (const h of history) {
      const icon = h.status === "posted" ? "✅" : "❌";
      msg += `${icon} ${h.message.substring(0, 50)}...\n   ${h.timestamp.split("T")[0]} | ${h.status}\n\n`;
    }
    return msg;
  }

  if (trimmed.startsWith("post ")) {
    const message = trimmed.slice(5).trim();
    if (!message) return "❌ ใส่ข้อความด้วย: /fb post <ข้อความ>";

    const urlMatch = message.match(/(https?:\/\/[^\s]+)/);
    const link = urlMatch ? urlMatch[1] : undefined;
    const result = await postToPage(message, link);

    const record: StudioFbPost = {
      id: `fb-${Date.now()}`, fbPostId: result.postId || "", message, link,
      platform: "facebook", status: result.ok ? "posted" : "failed",
      timestamp: new Date().toISOString(), error: result.error,
    };
    dbAddFbPost(record);

    if (result.ok) return `✅ โพสต์สำเร็จ!\n\n📝 ${message.substring(0, 80)}\n🆔 ${result.postId}`;
    else return `❌ โพสต์ไม่สำเร็จ: ${result.error}\n\n💡 เช็ค token: /fb status`;
  }

  if (trimmed.startsWith("schedule ")) {
    const match = trimmed.match(/^schedule\s+(\d{1,2}[:.:]?\d{2})\s+(.+)/);
    if (!match) return "❌ ใช้: /fb schedule 18:00 ข้อความ";
    const [, timeStr, message] = match;
    const scheduledTime = timeStr.replace(".", ":");

    const record: StudioFbPost = {
      id: `fb-sched-${Date.now()}`, fbPostId: "", message, platform: "facebook",
      status: "scheduled", timestamp: new Date().toISOString(), scheduledTime,
    };
    dbAddFbPost(record);
    return `⏰ Scheduled!\n\n📝 ${message.substring(0, 60)}\n🕐 จะโพสต์เวลา ${scheduledTime}\n\n💡 /fb history ดูรายการ`;
  }

  return `❓ ไม่รู้จักคำสั่ง "${trimmed}"\n\nใช้ /fb help ดูคำสั่งทั้งหมด`;
}

// ---------------------------------------------------------------------------
// External API for other modules
// ---------------------------------------------------------------------------
export function scheduleFbPostExternal(message: string, scheduledTime: string): void {
  const record: StudioFbPost = {
    id: `fb-sched-${Date.now()}`, fbPostId: "", message, platform: "facebook",
    status: "scheduled", timestamp: new Date().toISOString(), scheduledTime,
  };
  dbAddFbPost(record);
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------
export function registerFacebookRoutes(app: Express): void {
  getStudioDb();

  app.post("/api/fb/post", async (req: Request, res: Response) => {
    const { message = "", link = "" } = req.body || {};
    if (!message) { res.status(400).json({ error: "message required" }); return; }

    const result = await postToPage(message, link || undefined);
    const record: StudioFbPost = {
      id: `fb-${Date.now()}`, fbPostId: result.postId || "", message,
      link: link || undefined, platform: "facebook",
      status: result.ok ? "posted" : "failed",
      timestamp: new Date().toISOString(), error: result.error,
    };
    dbAddFbPost(record);

    if (result.ok) res.json({ success: true, postId: result.postId });
    else res.status(500).json({ error: result.error });
  });

  app.get("/api/fb/status", async (_req: Request, res: Response) => {
    if (!FB_ACCESS_TOKEN) { res.json({ connected: false, error: "Token not set" }); return; }
    const me = await fbGet("/me?fields=id,name");
    if (!me.ok) { res.json({ connected: false, error: me.error }); return; }
    const pages = await fbGet("/me/accounts?fields=id,name,fan_count");
    res.json({
      connected: true, name: me.data?.name, id: me.data?.id,
      pages: (pages.data?.data as Array<Record<string, unknown>>) || [],
    });
  });

  app.get("/api/fb/posts", async (_req: Request, res: Response) => {
    const posts = await getRecentPosts(10);
    res.json({ posts });
  });

  app.get("/api/fb/history", (_req: Request, res: Response) => {
    res.json({ history: dbGetFbPosts(20) });
  });
}

// ---------------------------------------------------------------------------
// FB Scheduler — posts scheduled items at their time
// ---------------------------------------------------------------------------
const TG_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TG_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

async function sendTg(text: string): Promise<void> {
  if (!TG_BOT_TOKEN || !TG_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT_ID, text }),
    });
  } catch {}
}

export function startFbScheduler(): void {
  setInterval(async () => {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const scheduled = dbGetScheduledFbPosts();

    for (const h of scheduled) {
      if (h.scheduledTime === currentTime) {
        const result = await postToPage(h.message);
        dbUpdateFbPostStatus(h.id, result.ok ? "posted" : "failed", result.postId, result.error);

        if (result.ok) {
          sendTg(`✅ Scheduled post published!\n\n📝 ${h.message.substring(0, 60)}`);
          console.log(`[fb-scheduler] ✅ Posted: ${h.message.substring(0, 40)}`);
        }
      }
    }
  }, 30000);
  console.log("[fb-scheduler] ⏰ Active — checking scheduled posts");
}
