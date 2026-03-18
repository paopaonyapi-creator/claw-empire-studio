/**
 * Link Shortener — Create trackable short links + click analytics
 *
 * TG: /short <url> [alias], /short stats
 * API: GET /api/links, POST /api/links, GET /s/:code (redirect)
 */

import type { Express, Request, Response } from "express";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "path";

interface ShortLink {
  id: string;
  code: string;
  url: string;
  alias?: string;
  clicks: number;
  clickLog: Array<{ timestamp: string; ip?: string; ua?: string }>;
  createdAt: string;
}

const LINKS_FILE = path.resolve("data/short-links.json");

function loadLinks(): ShortLink[] {
  try { if (existsSync(LINKS_FILE)) return JSON.parse(readFileSync(LINKS_FILE, "utf-8")) || []; } catch {} return [];
}
function saveLinks(d: ShortLink[]): void {
  mkdirSync(path.dirname(LINKS_FILE), { recursive: true });
  writeFileSync(LINKS_FILE, JSON.stringify(d, null, 2));
}

function generateCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function createShortLink(url: string, alias?: string): ShortLink {
  const links = loadLinks();
  const code = alias || generateCode();

  // Check if code already exists
  const existing = links.find((l) => l.code === code);
  if (existing) {
    existing.url = url;
    saveLinks(links);
    return existing;
  }

  const link: ShortLink = {
    id: `link-${Date.now()}`,
    code,
    url,
    alias: alias || undefined,
    clicks: 0,
    clickLog: [],
    createdAt: new Date().toISOString(),
  };
  links.push(link);
  saveLinks(links);
  return link;
}

function recordClick(code: string, ip?: string, ua?: string): string | null {
  const links = loadLinks();
  const link = links.find((l) => l.code === code);
  if (!link) return null;

  link.clicks += 1;
  link.clickLog.push({ timestamp: new Date().toISOString(), ip, ua });
  // Keep only last 100 clicks in log
  if (link.clickLog.length > 100) link.clickLog = link.clickLog.slice(-100);
  saveLinks(links);
  return link.url;
}

// ---------------------------------------------------------------------------
// TG Command
// ---------------------------------------------------------------------------

export function handleShortCommand(arg: string): string {
  const trimmed = arg.trim();

  if (!trimmed || trimmed === "help") {
    return "🔗 Link Shortener\n\nคำสั่ง:\n  /short <url> [alias] — สร้าง short link\n  /short stats — สถิติทั้งหมด\n  /short list — รายการลิงก์\n\nตัวอย่าง:\n  /short https://shopee.co.th/product123 shopee1";
  }

  if (trimmed === "stats") {
    const links = loadLinks();
    const totalClicks = links.reduce((s, l) => s + l.clicks, 0);
    const topLink = [...links].sort((a, b) => b.clicks - a.clicks)[0];

    let msg = "📊 Link Stats\n";
    msg += `${"═".repeat(24)}\n\n`;
    msg += `🔗 Total Links: ${links.length}\n`;
    msg += `👆 Total Clicks: ${totalClicks}\n`;
    if (topLink) {
      msg += `\n🏆 Top Link:\n`;
      msg += `   /${topLink.code} → ${topLink.clicks} clicks\n`;
      msg += `   ${topLink.url.substring(0, 50)}...`;
    }
    return msg;
  }

  if (trimmed === "list") {
    const links = loadLinks().slice(0, 10);
    if (links.length === 0) return "📭 ยังไม่มี links\n\nใช้: /short <url>";

    let msg = "🔗 Short Links:\n\n";
    for (const l of links) {
      msg += `📎 /s/${l.code} (${l.clicks} clicks)\n   → ${l.url.substring(0, 50)}${l.url.length > 50 ? "..." : ""}\n\n`;
    }
    return msg;
  }

  // /short <url> [alias]
  const parts = trimmed.split(/\s+/);
  const url = parts[0];
  const alias = parts[1];

  if (!url.startsWith("http")) {
    return "❌ URL ต้องเริ่มต้นด้วย http:// หรือ https://";
  }

  const link = createShortLink(url, alias);
  const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : "https://claw-empire-studio-production.up.railway.app";

  return `✅ Short link สร้างสำเร็จ!\n\n🔗 ${baseUrl}/s/${link.code}\n📎 ${url.substring(0, 60)}${url.length > 60 ? "..." : ""}\n\n📊 Track: /short stats`;
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

export function registerLinkShortenerRoutes(app: Express): void {
  // Redirect handler (must be registered early)
  app.get("/s/:code", (req: Request, res: Response) => {
    const code = String(req.params.code);
    const ip = String(req.headers["x-forwarded-for"] || req.ip || "");
    const ua = String(req.headers["user-agent"] || "");
    const url = recordClick(code, ip, ua);
    if (url) {
      res.redirect(302, url);
    } else {
      res.status(404).send("Link not found");
    }
  });

  // Create short link
  app.post("/api/links", (req: Request, res: Response) => {
    const { url = "", alias = "" } = req.body || {};
    if (!url) { res.status(400).json({ error: "url required" }); return; }
    const link = createShortLink(url, alias || undefined);
    const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "";
    res.json({ ...link, shortUrl: `${baseUrl}/s/${link.code}` });
  });

  // List links
  app.get("/api/links", (_req: Request, res: Response) => {
    const links = loadLinks().map((l) => ({
      ...l,
      clickLog: undefined, // Don't expose full log
    }));
    res.json({ links });
  });

  // Link stats
  app.get("/api/links/:code/stats", (req: Request, res: Response) => {
    const code = String(req.params.code);
    const links = loadLinks();
    const link = links.find((l) => l.code === code);
    if (!link) { res.status(404).json({ error: "not found" }); return; }

    // Click analytics by day
    const byDay: Record<string, number> = {};
    for (const c of link.clickLog) {
      const day = c.timestamp.split("T")[0];
      byDay[day] = (byDay[day] || 0) + 1;
    }

    res.json({
      code: link.code, url: link.url, clicks: link.clicks,
      createdAt: link.createdAt,
      clicksByDay: Object.entries(byDay).map(([date, count]) => ({ date, count })),
    });
  });
}
