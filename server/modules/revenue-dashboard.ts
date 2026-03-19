/**
 * Revenue Dashboard Pro — Interactive revenue chart data API
 *
 * Provides daily/weekly/monthly aggregated revenue data for charts.
 */

import type { Express, Request, Response } from "express";
import { getStudioDb } from "./studio-db.ts";

export function registerRevenueDashboardRoutes(app: Express): void {
  // GET /api/revenue/chart — chart data for revenue over time
  app.get("/api/revenue/chart", (req: Request, res: Response) => {
    const period = String(req.query.period || "7d");
    const db = getStudioDb();

    let days = 7;
    if (period === "30d") days = 30;
    if (period === "90d") days = 90;

    try {
      // Try to get actual revenue data from SQLite
      const rows = db.prepare(`
        SELECT DATE(created_at) as date, 
               SUM(amount) as total, 
               COUNT(*) as orders,
               platform
        FROM studio_revenue 
        WHERE created_at >= datetime('now', '-${days} days')
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `).all() as any[];

      // Generate date range with 0 fills
      const dates: string[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        dates.push(d.toISOString().split("T")[0]);
      }

      const dataMap = new Map(rows.map(r => [r.date, { total: r.total, orders: r.orders }]));
      const chartData = dates.map(d => ({
        date: d,
        label: new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short" }),
        revenue: dataMap.get(d)?.total || 0,
        orders: dataMap.get(d)?.orders || 0,
      }));

      // Platform breakdown
      const platformRows = db.prepare(`
        SELECT platform, SUM(amount) as total, COUNT(*) as orders
        FROM studio_revenue
        WHERE created_at >= datetime('now', '-${days} days')
        GROUP BY platform
        ORDER BY total DESC
      `).all() as any[];

      // Summary stats
      const totalRevenue = chartData.reduce((s, d) => s + d.revenue, 0);
      const totalOrders = chartData.reduce((s, d) => s + d.orders, 0);
      const avgDaily = totalRevenue / days;
      const bestDay = chartData.reduce((max, d) => d.revenue > max.revenue ? d : max, chartData[0] || { revenue: 0, date: "" });

      res.json({
        ok: true,
        period,
        days,
        chart: chartData,
        platforms: platformRows.map(p => ({ platform: p.platform || "unknown", total: p.total, orders: p.orders })),
        summary: {
          totalRevenue,
          totalOrders,
          avgDaily: Math.round(avgDaily),
          bestDay: bestDay?.date || "",
          bestDayRevenue: bestDay?.revenue || 0,
        },
      });
    } catch {
      // Fallback: generate demo data if table doesn't exist
      const dates: string[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        dates.push(d.toISOString().split("T")[0]);
      }
      const chartData = dates.map(d => ({
        date: d,
        label: new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short" }),
        revenue: 0,
        orders: 0,
      }));
      res.json({ ok: true, period, days, chart: chartData, platforms: [], summary: { totalRevenue: 0, totalOrders: 0, avgDaily: 0, bestDay: "", bestDayRevenue: 0 } });
    }
  });

  console.log("[Revenue Pro] 📊 API ready: /api/revenue/chart");
}
