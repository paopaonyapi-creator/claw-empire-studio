/**
 * Revenue Tracker — Track affiliate commissions and ROI
 *
 * Records revenue per product/link, daily/weekly/monthly summaries
 * TG command: /revenue [day|week|month|add <amount> <product>]
 */

import type { Express, Request, Response } from "express";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "path";

interface RevenueEntry {
  id: string;
  amount: number;
  currency: string;
  productName: string;
  platform: string;
  source: string;          // "shopee" | "lazada" | "tiktok" | "manual"
  commission: number;      // commission amount
  note: string;
  timestamp: string;
}

const DATA_FILE = path.resolve("data/revenue.json");
let entries: RevenueEntry[] = [];

function loadData(): void {
  try {
    if (existsSync(DATA_FILE)) {
      entries = JSON.parse(readFileSync(DATA_FILE, "utf-8"));
    }
  } catch { entries = []; }
}

function saveData(): void {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!existsSync(dir)) {
      const { mkdirSync } = require("node:fs");
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(DATA_FILE, JSON.stringify(entries, null, 2));
  } catch { /* ignore */ }
}

loadData();

function genId(): string {
  return `rev_${Date.now().toString(36)}`;
}

function detectPlatform(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("shopee")) return "shopee";
  if (n.includes("lazada")) return "lazada";
  if (n.includes("tiktok") || n.includes("tt")) return "tiktok";
  return "other";
}

function addRevenue(amount: number, productName: string, note = ""): RevenueEntry {
  const entry: RevenueEntry = {
    id: genId(),
    amount,
    currency: "THB",
    productName,
    platform: detectPlatform(productName),
    source: detectPlatform(productName),
    commission: amount * 0.1, // Default 10% commission estimate
    note,
    timestamp: new Date().toISOString(),
  };
  entries.push(entry);
  saveData();
  return entry;
}

function getRevenueSummary(period: "day" | "week" | "month"): {
  total: number;
  commission: number;
  count: number;
  byPlatform: Record<string, { total: number; count: number }>;
  topProducts: Array<{ name: string; total: number; count: number }>;
} {
  const now = new Date();
  let cutoff: Date;

  if (period === "day") {
    cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (period === "week") {
    cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else {
    cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const filtered = entries.filter((e) => new Date(e.timestamp) >= cutoff);

  const byPlatform: Record<string, { total: number; count: number }> = {};
  const byProduct: Record<string, { total: number; count: number }> = {};

  let total = 0;
  let commission = 0;

  for (const e of filtered) {
    total += e.amount;
    commission += e.commission;

    if (!byPlatform[e.platform]) byPlatform[e.platform] = { total: 0, count: 0 };
    byPlatform[e.platform].total += e.amount;
    byPlatform[e.platform].count++;

    if (!byProduct[e.productName]) byProduct[e.productName] = { total: 0, count: 0 };
    byProduct[e.productName].total += e.amount;
    byProduct[e.productName].count++;
  }

  const topProducts = Object.entries(byProduct)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return { total, commission, count: filtered.length, byPlatform, topProducts };
}

// ---------------------------------------------------------------------------
// TG Command Handler
// ---------------------------------------------------------------------------

export function handleRevenueCommand(arg: string): string {
  const parts = arg.trim().split(/\s+/);
  const sub = parts[0]?.toLowerCase() || "";

  if (!sub || sub === "day" || sub === "today") {
    const s = getRevenueSummary("day");
    return formatSummary("📊 รายได้วันนี้", s);
  }

  if (sub === "week") {
    const s = getRevenueSummary("week");
    return formatSummary("📊 รายได้ 7 วัน", s);
  }

  if (sub === "month") {
    const s = getRevenueSummary("month");
    return formatSummary("📊 รายได้เดือนนี้", s);
  }

  if (sub === "add") {
    const amount = parseFloat(parts[1] || "0");
    const product = parts.slice(2).join(" ") || "Unknown Product";
    if (amount <= 0) return "❌ ใส่จำนวนเงิน: /revenue add 350 ProductName";
    const entry = addRevenue(amount, product);
    return `✅ บันทึกรายได้!\n💰 ${entry.amount} ${entry.currency}\n📦 ${entry.productName}\n🏪 ${entry.platform}\n💵 Commission: ~${entry.commission.toFixed(0)} THB`;
  }

  return `📊 Revenue Tracker\n\n/revenue — สรุปรายได้วันนี้\n/revenue week — สรุป 7 วัน\n/revenue month — สรุปเดือน\n/revenue add <จำนวน> <สินค้า> — บันทึกรายได้`;
}

function formatSummary(title: string, s: ReturnType<typeof getRevenueSummary>): string {
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
  app.get("/api/revenue", (_req: Request, res: Response) => {
    res.json({
      entries: entries.slice(-100),
      summary: {
        today: getRevenueSummary("day"),
        week: getRevenueSummary("week"),
        month: getRevenueSummary("month"),
      },
    });
  });

  app.post("/api/revenue", (req: Request, res: Response) => {
    const { amount, productName, note } = req.body || {};
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "amount required" });
    }
    const entry = addRevenue(amount, productName || "Unknown", note || "");
    res.json({ ok: true, entry });
  });
}
