/**
 * Revenue Tracker — Track affiliate commissions and ROI
 * NOW BACKED BY SQLite (via studio-db.ts).
 */

import type { Express, Request, Response } from "express";
import {
  dbAddRevenue, dbGetRevenueEntries, dbGetRevenueSummary, getStudioDb,
} from "./studio-db.ts";

// ---------------------------------------------------------------------------
// TG Command Handler
// ---------------------------------------------------------------------------
export function handleRevenueCommand(arg: string): string {
  const parts = arg.trim().split(/\s+/);
  const sub = parts[0]?.toLowerCase() || "";

  if (!sub || sub === "day" || sub === "today") {
    return formatSummary("📊 รายได้วันนี้", dbGetRevenueSummary("day"));
  }
  if (sub === "week") {
    return formatSummary("📊 รายได้ 7 วัน", dbGetRevenueSummary("week"));
  }
  if (sub === "month") {
    return formatSummary("📊 รายได้เดือนนี้", dbGetRevenueSummary("month"));
  }
  if (sub === "add") {
    const amount = parseFloat(parts[1] || "0");
    const product = parts.slice(2).join(" ") || "Unknown Product";
    if (amount <= 0) return "❌ ใส่จำนวนเงิน: /revenue add 350 ProductName";
    const entry = dbAddRevenue(amount, product);
    return `✅ บันทึกรายได้!\n💰 ${entry.amount} ${entry.currency}\n📦 ${entry.productName}\n🏪 ${entry.platform}\n💵 Commission: ~${entry.commission.toFixed(0)} THB`;
  }
  return `📊 Revenue Tracker\n\n/revenue — สรุปรายได้วันนี้\n/revenue week — สรุป 7 วัน\n/revenue month — สรุปเดือน\n/revenue add <จำนวน> <สินค้า> — บันทึกรายได้`;
}

function formatSummary(title: string, s: ReturnType<typeof dbGetRevenueSummary>): string {
  let msg = `${title}\n${"─".repeat(20)}\n`;
  msg += `💰 ยอดรวม: ${s.total.toLocaleString()} THB\n`;
  msg += `💵 Commission: ~${s.commission.toLocaleString()} THB\n`;
  msg += `📦 ${s.count} รายการ\n\n`;

  if (Object.keys(s.byPlatform).length > 0) {
    msg += `🏪 แยกตาม Platform:\n`;
    for (const [plat, data] of Object.entries(s.byPlatform)) {
      msg += `  ${plat}: ${data.total.toLocaleString()} THB (${data.count} ชิ้น)\n`;
    }
    msg += "\n";
  }

  if (s.topProducts.length > 0) {
    msg += `🏆 Top Products:\n`;
    s.topProducts.forEach((p, i) => {
      msg += `  ${i + 1}. ${p.name} — ${p.total.toLocaleString()} THB\n`;
    });
  }

  if (s.count === 0) {
    msg += "\n📭 ยังไม่มีรายการ ใช้ /revenue add <จำนวน> <สินค้า>";
  }
  return msg;
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------
export function registerRevenueTrackerRoutes(app: Express): void {
  getStudioDb();

  app.get("/api/revenue", (_req: Request, res: Response) => {
    res.json({
      entries: dbGetRevenueEntries(100),
      summary: {
        today: dbGetRevenueSummary("day"),
        week: dbGetRevenueSummary("week"),
        month: dbGetRevenueSummary("month"),
      },
    });
  });

  app.post("/api/revenue", (req: Request, res: Response) => {
    const { amount, productName, note } = req.body || {};
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "amount required" });
    }
    const entry = dbAddRevenue(amount, productName || "Unknown", note || "");
    res.json({ ok: true, entry });
  });
}
