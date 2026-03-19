/**
 * Affiliate Link Tracker — Short URL generation + click tracking
 *
 * NOW BACKED BY SQLite (via studio-db.ts).
 * Generate short links, track clicks, view analytics
 */

import type { Express, Request, Response } from "express";
import { randomBytes } from "node:crypto";
import {
  dbCreateLink,
  dbGetAllLinks,
  dbGetLinkByShortCode,
  dbGetLinkById,
  dbRecordClick,
  dbUpdateRevenue,
  dbGetClicksByLinkId,
  dbGetTotalClicks,
  dbGetUnderperformingLinks,
  getStudioDb,
  type StudioLink,
} from "./studio-db.ts";

// ---------------------------------------------------------------------------
// Short Code Generation
// ---------------------------------------------------------------------------

function generateShortCode(): string {
  return randomBytes(4).toString("base64url").slice(0, 6);
}

export function getBaseUrl(): string {
  const domain = process.env.RAILWAY_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  return `http://127.0.0.1:${process.env.PORT || 3000}`;
}

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

export function createTrackedLink(originalUrl: string, label?: string, imageUrl?: string): StudioLink {
  const shortCode = generateShortCode();
  const id = `lnk_${Date.now()}`;
  const finalLabel = label || (() => { try { return new URL(originalUrl).hostname; } catch { return "Unknown"; } })();
  return dbCreateLink(id, shortCode, originalUrl, finalLabel, imageUrl);
}

function recordClick(shortCode: string, req: Request): StudioLink | null {
  const link = dbGetLinkByShortCode(shortCode);
  if (!link) return null;

  dbRecordClick(
    link.id,
    req.headers["user-agent"]?.slice(0, 200) || "",
    String(req.headers.referer || req.headers.referrer || "").slice(0, 200),
  );

  // Re-fetch to get updated click count
  return dbGetLinkByShortCode(shortCode);
}

export async function auditLinks(): Promise<{ audited: number; underperforming: StudioLink[] }> {
  const allLinks = dbGetAllLinks();
  const underperforming = dbGetUnderperformingLinks();
  return { audited: allLinks.length, underperforming };
}

export function getLinkByShortCode(shortCode: string): StudioLink | undefined {
  return dbGetLinkByShortCode(shortCode) || undefined;
}

// ---------------------------------------------------------------------------
// TG Command Handler
// ---------------------------------------------------------------------------

export function handleLinkCommand(args: string): string {
  const parts = args.trim().split(/\s+/);

  // /link — list all links
  if (!parts[0] || parts[0] === "list") {
    const links = dbGetAllLinks();
    if (links.length === 0) return "📎 ยังไม่มี affiliate link\n\nสร้าง: /link <url> [label]";

    const sorted = [...links].sort((a, b) => b.clicks - a.clicks).slice(0, 10);
    const list = sorted
      .map((l, i) => `${i + 1}. <b>${l.label}</b>\n   🔗 ${getBaseUrl()}/go/${l.shortCode}\n   👆 ${l.clicks} clicks`)
      .join("\n\n");

    return `📎 <b>Affiliate Links</b> (${links.length})\n\n${list}`;
  }

  // /link stats — summary
  if (parts[0] === "stats") {
    const links = dbGetAllLinks();
    const totalClicks = dbGetTotalClicks();
    const today = new Date().toISOString().slice(0, 10);
    // We can't easily query today's clicks without a more complex query, so approximate
    const topLink = [...links].sort((a, b) => b.clicks - a.clicks)[0];

    return (
      `📊 <b>Link Stats</b>\n\n` +
      `📎 Total Links: ${links.length}\n` +
      `👆 Total Clicks: ${totalClicks}\n` +
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
  // Initialize DB on first route registration
  getStudioDb();

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
    const links = dbGetAllLinks();
    const totalClicks = dbGetTotalClicks();
    res.json({
      ok: true,
      total: links.length,
      totalClicks,
      links: links.map((l) => ({
        id: l.id,
        shortCode: l.shortCode,
        shortUrl: `${getBaseUrl()}/go/${l.shortCode}`,
        originalUrl: l.originalUrl,
        label: l.label,
        imageUrl: l.imageUrl,
        revenue: l.revenue || 0,
        clicks: l.clicks,
        createdAt: l.createdAt,
      })),
    });
  });

  // Dynamic Landing Page
  app.get("/p/:code", (req: Request, res: Response) => {
    const link = dbGetLinkByShortCode(String(req.params.code));
    if (!link) {
      return res.status(404).send("Page not found");
    }

    const shortUrl = `${getBaseUrl()}/go/${link.shortCode}`;
    const escapedLabel = link.label.replace(/"/g, '&quot;');
    const html = `
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapedLabel} | โปรโมชั่นพิเศษ</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
      body { background: #0f172a; color: white; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
      .glass { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.05); }
    </style>
</head>
<body class="min-h-screen flex flex-col justify-center items-center p-4">
    <div class="glass w-full max-w-sm sm:max-w-md rounded-[2rem] p-6 text-center shadow-2xl relative overflow-hidden">
        <div class="absolute -top-20 -left-20 w-40 h-40 bg-blue-500 rounded-full mix-blend-screen filter blur-[50px] opacity-20"></div>
        <div class="absolute -bottom-20 -right-20 w-40 h-40 bg-cyan-500 rounded-full mix-blend-screen filter blur-[50px] opacity-20"></div>
        
        <div class="relative z-10">
          ${link.imageUrl ? `<img src="${link.imageUrl}" alt="${escapedLabel}" class="w-full h-auto aspect-square object-cover rounded-2xl mb-6 shadow-lg border border-white/10">` : `<div class="w-full h-64 bg-slate-800/50 border border-white/5 rounded-2xl mb-6 flex items-center justify-center text-6xl">🛍️</div>`}
          
          <h1 class="text-xl sm:text-2xl font-bold mb-3 text-white leading-tight">${escapedLabel}</h1>
          <p class="text-slate-400 text-sm mb-8 px-2">แตะปุ่มด้านล่างเพื่อดูรายละเอียดราคาและรับโปรโมชั่นพิเศษก่อนใคร</p>
          
          <a href="${shortUrl}" class="flex items-center justify-center gap-2 w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-[0_4px_20px_rgba(56,189,248,0.4)] transition-all transform hover:scale-[1.02] active:scale-95">
              🛒 สั่งซื้อสินค้าเลย
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>
          
          <div class="mt-8 text-xs text-slate-500 flex justify-center items-center gap-4">
              <span class="flex items-center gap-1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> ปลอดภัยชัวร์</span>
              <span class="flex items-center gap-1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12l5 5L20 7"></path></svg> สินค้าพร้อมส่ง</span>
          </div>
        </div>
    </div>
</body>
</html>`;
    res.send(html);
  });

  // Update Revenue
  app.post("/api/links/:code/revenue", (req: Request, res: Response) => {
    const { revenue } = req.body;
    if (typeof revenue !== "number") {
      return res.status(400).json({ ok: false, error: "Invalid revenue value" });
    }
    const link = dbUpdateRevenue(String(req.params.code), revenue);
    if (!link) {
      return res.status(404).json({ ok: false, error: "Link not found" });
    }
    return res.json({ ok: true, link });
  });

  // Create link
  app.post("/api/links", (req, res) => {
    const { url, label, imageUrl } = req.body as { url?: string; label?: string; imageUrl?: string };
    if (!url?.startsWith("http")) {
      return res.status(400).json({ ok: false, error: "valid URL required" });
    }

    const link = createTrackedLink(url, label, imageUrl);
    res.json({
      ok: true,
      link: {
        id: link.id,
        shortCode: link.shortCode,
        shortUrl: `${getBaseUrl()}/go/${link.shortCode}`,
        originalUrl: link.originalUrl,
        label: link.label,
        imageUrl: link.imageUrl,
        revenue: link.revenue || 0,
      },
    });
  });

  // Link stats
  app.get("/api/links/:id/stats", (req, res) => {
    const link = dbGetLinkById(req.params.id);
    if (!link) return res.status(404).json({ ok: false, error: "not found" });

    // Get click logs from SQLite
    const clicks = dbGetClicksByLinkId(link.id);
    
    // Group clicks by day
    const daily: Record<string, number> = {};
    for (const click of clicks) {
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
        recentClicks: clicks.slice(0, 20),
      },
    });
  });

  // Audit links for low performance
  app.get("/api/links/audit", async (_req, res) => {
    try {
      const result = await auditLinks();
      
      // Auto-notify CEO about underperforming links
      if (result.underperforming.length > 0) {
        const target = result.underperforming[0];
        const { sendTgNotification } = await import("./auto-pipeline.ts");
        
        await sendTgNotification(
          `📉 <b>[Analytics Alert] ยอดคลิกตก!</b>\n\n` +
          `📝 <b>สินค้า:</b> ${target.label}\n` +
          `👆 <b>คลิกทั้งหมด:</b> ${target.clicks} ครั้ง\n` +
          `📅 <b>สร้างเมื่อ:</b> ${new Date(target.createdAt).toLocaleDateString("en-GB")}\n\n` +
          `บอสครับ โพสต์นี้คนแทบไม่คลิกเลย สนใจให้ระบบใช้ A/B Testing เขียนแคปชันฮุกแบบใหม่เพื่อกู้ยอดกลับมาไหมครับ?`,
          {
            inline_keyboard: [[
              { text: "🔄 เริ่ม A/B Testing (แคปชันใหม่)", callback_data: `optimize_${target.shortCode}` }
            ]]
          }
        );
      }

      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  const links = dbGetAllLinks();
  console.log(`[Link Tracker] ✅ ${links.length} links loaded from SQLite, redirect at /go/:code`);
}
