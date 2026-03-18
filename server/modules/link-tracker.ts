/**
 * Affiliate Link Tracker — Short URL generation + click tracking
 *
 * Generate short links, track clicks, view analytics
 */

import type { Express, Request, Response } from "express";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Data Store (JSON file for persistence)
// ---------------------------------------------------------------------------

interface TrackedLink {
  id: string;
  shortCode: string;
  originalUrl: string;
  label: string;
  createdAt: string;
  clicks: number;
  clickLog: Array<{
    timestamp: string;
    userAgent?: string;
    referer?: string;
  }>;
}

const DATA_DIR = process.env.DB_PATH ? join(process.env.DB_PATH, "..") : "./data";
const LINKS_FILE = join(DATA_DIR, "affiliate-links.json");

function loadLinks(): TrackedLink[] {
  try {
    if (existsSync(LINKS_FILE)) {
      return JSON.parse(readFileSync(LINKS_FILE, "utf-8")) as TrackedLink[];
    }
  } catch {
    /* ignore */
  }
  return [];
}

function saveLinks(links: TrackedLink[]): void {
  try {
    writeFileSync(LINKS_FILE, JSON.stringify(links, null, 2), "utf-8");
  } catch {
    /* ignore */
  }
}

let links: TrackedLink[] = loadLinks();

// ---------------------------------------------------------------------------
// Short Code Generation
// ---------------------------------------------------------------------------

function generateShortCode(): string {
  return randomBytes(4).toString("base64url").slice(0, 6);
}

function getBaseUrl(): string {
  const domain = process.env.RAILWAY_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  return `http://127.0.0.1:${process.env.PORT || 3000}`;
}

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

export function createTrackedLink(originalUrl: string, label?: string): TrackedLink {
  const shortCode = generateShortCode();
  const link: TrackedLink = {
    id: `lnk_${Date.now()}`,
    shortCode,
    originalUrl,
    label: label || new URL(originalUrl).hostname,
    createdAt: new Date().toISOString(),
    clicks: 0,
    clickLog: [],
  };

  links.push(link);
  saveLinks(links);
  return link;
}

function recordClick(shortCode: string, req: Request): TrackedLink | null {
  const link = links.find((l) => l.shortCode === shortCode);
  if (!link) return null;

  link.clicks++;
  link.clickLog.push({
    timestamp: new Date().toISOString(),
    userAgent: req.headers["user-agent"]?.slice(0, 100),
    referer: String(req.headers.referer || req.headers.referrer || "").slice(0, 200),
  });

  // Keep only last 1000 clicks in log
  if (link.clickLog.length > 1000) {
    link.clickLog = link.clickLog.slice(-1000);
  }

  saveLinks(links);
  return link;
}

// ---------------------------------------------------------------------------
// TG Command Handler
// ---------------------------------------------------------------------------

export function handleLinkCommand(args: string): string {
  const parts = args.trim().split(/\s+/);

  // /link — list all links
  if (!parts[0] || parts[0] === "list") {
    if (links.length === 0) return "📎 ยังไม่มี affiliate link\n\nสร้าง: /link <url> [label]";

    const sorted = [...links].sort((a, b) => b.clicks - a.clicks).slice(0, 10);
    const list = sorted
      .map((l, i) => `${i + 1}. <b>${l.label}</b>\n   🔗 ${getBaseUrl()}/go/${l.shortCode}\n   👆 ${l.clicks} clicks`)
      .join("\n\n");

    return `📎 <b>Affiliate Links</b> (${links.length})\n\n${list}`;
  }

  // /link stats — summary
  if (parts[0] === "stats") {
    const totalClicks = links.reduce((sum, l) => sum + l.clicks, 0);
    const today = new Date().toISOString().slice(0, 10);
    const todayClicks = links.reduce(
      (sum, l) => sum + l.clickLog.filter((c) => c.timestamp.startsWith(today)).length,
      0,
    );
    const topLink = [...links].sort((a, b) => b.clicks - a.clicks)[0];

    return (
      `📊 <b>Link Stats</b>\n\n` +
      `📎 Total Links: ${links.length}\n` +
      `👆 Total Clicks: ${totalClicks}\n` +
      `📅 Today: ${todayClicks} clicks\n` +
      (topLink ? `🏆 Top: ${topLink.label} (${topLink.clicks} clicks)` : "")
    );
  }

  // /link <url> [label] — create new
  const url = parts[0];
  if (!url.startsWith("http")) return "⚠️ URL ต้องเริ่มด้วย http:// หรือ https://";

  const label = parts.slice(1).join(" ") || undefined;
  const link = createTrackedLink(url, label);

  return (
    `✅ <b>Link Created!</b>\n\n` +
    `📝 ${link.label}\n` +
    `🔗 Short: ${getBaseUrl()}/go/${link.shortCode}\n` +
    `🎯 Original: ${link.originalUrl.slice(0, 60)}...\n\n` +
    `แชร์ link สั้นเพื่อ track clicks!`
  );
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

export function registerLinkTrackerRoutes(app: Express): void {
  // Redirect endpoint (public, no auth)
  app.get("/go/:code", (req: Request, res: Response) => {
    const link = recordClick(String(req.params.code), req);
    if (!link) {
      return res.status(404).send("Link not found");
    }
    res.redirect(302, link.originalUrl);
  });

  // List links
  app.get("/api/links", (_req, res) => {
    const sorted = [...links].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({
      ok: true,
      total: sorted.length,
      totalClicks: sorted.reduce((sum, l) => sum + l.clicks, 0),
      links: sorted.map((l) => ({
        id: l.id,
        shortCode: l.shortCode,
        shortUrl: `${getBaseUrl()}/go/${l.shortCode}`,
        originalUrl: l.originalUrl,
        label: l.label,
        clicks: l.clicks,
        createdAt: l.createdAt,
      })),
    });
  });

  // Create link
  app.post("/api/links", (req, res) => {
    const { url, label } = req.body as { url?: string; label?: string };
    if (!url?.startsWith("http")) {
      return res.status(400).json({ ok: false, error: "valid URL required" });
    }

    const link = createTrackedLink(url, label);
    res.json({
      ok: true,
      link: {
        id: link.id,
        shortCode: link.shortCode,
        shortUrl: `${getBaseUrl()}/go/${link.shortCode}`,
        originalUrl: link.originalUrl,
        label: link.label,
      },
    });
  });

  // Link stats
  app.get("/api/links/:id/stats", (req, res) => {
    const link = links.find((l) => l.id === req.params.id || l.shortCode === req.params.id);
    if (!link) return res.status(404).json({ ok: false, error: "not found" });

    // Group clicks by day
    const daily: Record<string, number> = {};
    for (const click of link.clickLog) {
      const day = click.timestamp.slice(0, 10);
      daily[day] = (daily[day] || 0) + 1;
    }

    res.json({
      ok: true,
      link: {
        id: link.id,
        shortCode: link.shortCode,
        shortUrl: `${getBaseUrl()}/go/${link.shortCode}`,
        originalUrl: link.originalUrl,
        label: link.label,
        clicks: link.clicks,
        createdAt: link.createdAt,
        daily,
        recentClicks: link.clickLog.slice(-20).reverse(),
      },
    });
  });

  // Add /go/:code to public paths
  console.log(`[Link Tracker] ✅ ${links.length} links loaded, redirect at /go/:code`);
}
