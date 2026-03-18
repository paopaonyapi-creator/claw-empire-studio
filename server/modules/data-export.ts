/**
 * Data Export — CSV/JSON export + analytics summary
 *
 * Exports: revenue, tasks, calendar, links
 * TG: /export <type>
 * API: GET /api/export/:type (csv), GET /api/analytics
 */

import type { Express, Request, Response } from "express";
import { existsSync, readFileSync } from "node:fs";
import path from "path";

function loadJson(f: string): unknown[] {
  try { const p = path.resolve(`data/${f}`); if (existsSync(p)) return JSON.parse(readFileSync(p, "utf-8")) || []; } catch {} return [];
}

// ---------------------------------------------------------------------------
// CSV Generation
// ---------------------------------------------------------------------------

function toCsv(headers: string[], rows: string[][]): string {
  const escape = (v: string) => `"${(v || "").replace(/"/g, '""')}"`;
  return [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
}

function exportRevenue(): string {
  const data = loadJson("revenue.json") as Array<Record<string, unknown>>;
  return toCsv(
    ["Date", "Product", "Platform", "Amount", "Commission"],
    data.map((r) => [
      String(r.timestamp || "").split("T")[0],
      String(r.productName || ""),
      String(r.platform || ""),
      String(r.amount || 0),
      String(r.commission || 0),
    ])
  );
}

function exportTasks(): string {
  const data = loadJson("tasks.json") as Array<Record<string, unknown>>;
  return toCsv(
    ["ID", "Title", "Status", "Agent", "Priority", "Created"],
    data.map((t) => [
      String(t.id || ""),
      String(t.title || ""),
      String(t.status || ""),
      String(t.assignedAgent || ""),
      String(t.priority || ""),
      String(t.createdAt || ""),
    ])
  );
}

function exportCalendar(): string {
  const data = loadJson("calendar.json") as Array<Record<string, unknown>>;
  return toCsv(
    ["Day", "Time", "Product", "Platform", "Status"],
    data.map((c) => [
      String(c.day || ""),
      String(c.time || ""),
      String(c.productName || ""),
      String(c.platform || ""),
      String(c.status || ""),
    ])
  );
}

function exportLinks(): string {
  const data = loadJson("affiliate-links.json") as Array<Record<string, unknown>>;
  return toCsv(
    ["Code", "Product", "Platform", "URL", "Clicks"],
    data.map((l) => [
      String(l.code || ""),
      String(l.productName || ""),
      String(l.platform || ""),
      String(l.url || ""),
      String(l.clicks || 0),
    ])
  );
}

// ---------------------------------------------------------------------------
// Analytics Summary
// ---------------------------------------------------------------------------

interface AnalyticsSummary {
  overview: { totalRevenue: number; totalOrders: number; totalTasks: number; tasksDone: number; totalLinks: number; totalClicks: number };
  revenueByPlatform: Record<string, number>;
  revenueByDay: Array<{ date: string; amount: number }>;
  topProducts: Array<{ name: string; revenue: number; orders: number }>;
  tasksByStatus: Record<string, number>;
  platformPerformance: Array<{ platform: string; revenue: number; clicks: number; roi: string }>;
}

function generateAnalytics(): AnalyticsSummary {
  const revenue = loadJson("revenue.json") as Array<Record<string, unknown>>;
  const tasks = loadJson("tasks.json") as Array<Record<string, unknown>>;
  const links = loadJson("affiliate-links.json") as Array<Record<string, unknown>>;

  // Revenue by platform
  const byPlatform: Record<string, number> = {};
  const byDay: Record<string, number> = {};
  const byProduct: Record<string, { revenue: number; orders: number }> = {};

  for (const r of revenue) {
    const plat = String(r.platform || "other");
    const day = String(r.timestamp || "").split("T")[0];
    const prod = String(r.productName || "unknown");
    const amt = Number(r.amount || 0);

    byPlatform[plat] = (byPlatform[plat] || 0) + amt;
    byDay[day] = (byDay[day] || 0) + amt;
    if (!byProduct[prod]) byProduct[prod] = { revenue: 0, orders: 0 };
    byProduct[prod].revenue += amt;
    byProduct[prod].orders += 1;
  }

  // Tasks by status
  const tasksByStatus: Record<string, number> = {};
  for (const t of tasks) { const s = String(t.status || "unknown"); tasksByStatus[s] = (tasksByStatus[s] || 0) + 1; }

  // Platform performance (revenue + clicks)
  const clicksByPlatform: Record<string, number> = {};
  for (const l of links) {
    const plat = String(l.platform || "other");
    clicksByPlatform[plat] = (clicksByPlatform[plat] || 0) + Number(l.clicks || 0);
  }

  const totalClicks = links.reduce((s, l) => s + Number(l.clicks || 0), 0);
  const totalRevenue = revenue.reduce((s, r) => s + Number(r.amount || 0), 0);

  return {
    overview: {
      totalRevenue,
      totalOrders: revenue.length,
      totalTasks: tasks.length,
      tasksDone: tasks.filter((t) => t.status === "done").length,
      totalLinks: links.length,
      totalClicks,
    },
    revenueByPlatform: byPlatform,
    revenueByDay: Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([date, amount]) => ({ date, amount })),
    topProducts: Object.entries(byProduct).sort(([, a], [, b]) => b.revenue - a.revenue).slice(0, 10)
      .map(([name, data]) => ({ name, ...data })),
    tasksByStatus,
    platformPerformance: Object.keys({ ...byPlatform, ...clicksByPlatform }).map((plat) => ({
      platform: plat,
      revenue: byPlatform[plat] || 0,
      clicks: clicksByPlatform[plat] || 0,
      roi: clicksByPlatform[plat] ? `${((byPlatform[plat] || 0) / clicksByPlatform[plat]).toFixed(1)} ฿/click` : "—",
    })),
  };
}

// ---------------------------------------------------------------------------
// TG Command
// ---------------------------------------------------------------------------

export function handleExportCommand(arg: string): string {
  const type = arg.trim().toLowerCase();

  if (!type) {
    return "📤 Data Export\n\nใช้: /export <type>\n\nTypes:\n  revenue — รายได้ทั้งหมด\n  tasks — งานทั้งหมด\n  calendar — ตาราง\n  links — ลิงก์\n  analytics — สรุปวิเคราะห์\n\nดาวน์โหลดจาก: /api/export/revenue (CSV)";
  }

  if (type === "analytics") {
    const a = generateAnalytics();
    let msg = "📊 Analytics Summary\n";
    msg += `${"═".repeat(24)}\n\n`;
    msg += `💰 Revenue: ฿${a.overview.totalRevenue.toLocaleString()}\n`;
    msg += `📦 Orders: ${a.overview.totalOrders}\n`;
    msg += `📋 Tasks: ${a.overview.tasksDone}/${a.overview.totalTasks} done\n`;
    msg += `🔗 Links: ${a.overview.totalLinks} (${a.overview.totalClicks} clicks)\n\n`;

    if (Object.keys(a.revenueByPlatform).length > 0) {
      msg += "📊 Revenue by Platform:\n";
      for (const [p, v] of Object.entries(a.revenueByPlatform)) {
        msg += `  ${p}: ฿${v.toLocaleString()}\n`;
      }
      msg += "\n";
    }

    if (a.topProducts.length > 0) {
      msg += "🏆 Top Products:\n";
      for (const p of a.topProducts.slice(0, 5)) {
        msg += `  ${p.name}: ฿${p.revenue.toLocaleString()} (${p.orders} orders)\n`;
      }
    }

    msg += "\n💡 CSV: /api/export/revenue";
    return msg;
  }

  const validTypes = ["revenue", "tasks", "calendar", "links"];
  if (!validTypes.includes(type)) {
    return `❌ ไม่รู้จัก type "${type}"\n\nTypes: ${validTypes.join(", ")}, analytics`;
  }

  return `📤 Download CSV: /api/export/${type}\n\nเปิดลิงก์นี้ในเบราว์เซอร์เพื่อดาวน์โหลด`;
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

export function registerDataExportRoutes(app: Express): void {
  // CSV exports
  app.get("/api/export/:type", (req: Request, res: Response) => {
    const type = String(req.params.type);
    let csv = "";
    let filename = "";

    switch (type) {
      case "revenue": csv = exportRevenue(); filename = "revenue-export.csv"; break;
      case "tasks": csv = exportTasks(); filename = "tasks-export.csv"; break;
      case "calendar": csv = exportCalendar(); filename = "calendar-export.csv"; break;
      case "links": csv = exportLinks(); filename = "links-export.csv"; break;
      default: res.status(400).json({ error: "invalid type" }); return;
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send("\uFEFF" + csv); // BOM for Excel Thai encoding
  });

  // Analytics JSON
  app.get("/api/analytics", (_req: Request, res: Response) => {
    res.json(generateAnalytics());
  });
}
