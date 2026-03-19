/**
 * Global Search API — Unified search across products, tasks, content, agents
 */

import type { Express, Request, Response } from "express";
import { getStudioDb } from "./studio-db.ts";

export function registerSearchRoutes(app: Express): void {
  app.get("/api/search", (req: Request, res: Response) => {
    const q = String(req.query.q || "").trim().toLowerCase();
    if (!q || q.length < 2) return res.json({ ok: true, results: [] });

    const db = getStudioDb();
    const results: Array<{ type: string; icon: string; title: string; subtitle: string; id: string }> = [];

    // Search products
    try {
      const products = db.prepare(
        "SELECT id, name, category, price FROM studio_products WHERE LOWER(name) LIKE ? OR LOWER(category) LIKE ? LIMIT 5"
      ).all(`%${q}%`, `%${q}%`) as any[];
      for (const p of products) {
        results.push({ type: "product", icon: "📦", title: p.name, subtitle: `${p.category} — ฿${p.price}`, id: String(p.id) });
      }
    } catch {}

    // Search activity log
    try {
      const activities = db.prepare(
        "SELECT id, action, actor, detail FROM studio_activity_log WHERE LOWER(action) LIKE ? OR LOWER(detail) LIKE ? ORDER BY created_at DESC LIMIT 5"
      ).all(`%${q}%`, `%${q}%`) as any[];
      for (const a of activities) {
        results.push({ type: "activity", icon: "🗂️", title: a.action, subtitle: `${a.actor} — ${a.detail}`, id: String(a.id) });
      }
    } catch {}

    // Search KPI goals
    try {
      const goals = db.prepare(
        "SELECT id, metric, period, target, current FROM studio_kpi_goals WHERE LOWER(metric) LIKE ? LIMIT 3"
      ).all(`%${q}%`) as any[];
      for (const g of goals) {
        results.push({ type: "goal", icon: "🎯", title: g.metric, subtitle: `${g.current}/${g.target} (${g.period})`, id: String(g.id) });
      }
    } catch {}

    // Search revenue entries  
    try {
      const revenue = db.prepare(
        "SELECT id, platform, product_name, amount FROM studio_revenue WHERE LOWER(product_name) LIKE ? OR LOWER(platform) LIKE ? ORDER BY created_at DESC LIMIT 5"
      ).all(`%${q}%`, `%${q}%`) as any[];
      for (const r of revenue) {
        results.push({ type: "revenue", icon: "💰", title: r.product_name || r.platform, subtitle: `฿${r.amount} — ${r.platform}`, id: String(r.id) });
      }
    } catch {}

    // Search users
    try {
      const users = db.prepare(
        "SELECT id, username, display_name, role FROM studio_users WHERE LOWER(username) LIKE ? OR LOWER(display_name) LIKE ? LIMIT 3"
      ).all(`%${q}%`, `%${q}%`) as any[];
      for (const u of users) {
        results.push({ type: "user", icon: "👤", title: u.display_name || u.username, subtitle: u.role.toUpperCase(), id: String(u.id) });
      }
    } catch {}

    res.json({ ok: true, results, total: results.length });
  });

  console.log("[Search] ✅ API ready: /api/search?q=...");
}
