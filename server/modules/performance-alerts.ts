/**
 * Performance Alerts — Auto-detect drops & anomalies
 * NOW BACKED BY SQLite (via studio-db.ts).
 */

import type { Express, Request, Response } from "express";
import {
  dbGetAlertRules, dbAddAlertRule, dbGetAlerts, dbAddAlert, dbClearAlerts,
  dbHasRecentAlert, dbGetTodayClickCount, dbGetTodayRevenue,
  getStudioDb, type StudioAlertRule, type StudioAlert,
} from "./studio-db.ts";

const TG_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TG_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

// ---------------------------------------------------------------------------
// Metric Value Lookup (from SQLite)
// ---------------------------------------------------------------------------
function getMetricValue(metric: string): number {
  switch (metric) {
    case "clicks": return dbGetTodayClickCount();
    case "revenue": return dbGetTodayRevenue();
    default: return 0;
  }
}

// Built-in default rules
function getDefaultRules(): StudioAlertRule[] {
  return [
    { id: "default-1", metric: "clicks", operator: "<", value: 5, enabled: true, createdAt: new Date().toISOString() },
    { id: "default-2", metric: "revenue", operator: "<", value: 1, enabled: true, createdAt: new Date().toISOString() },
  ];
}

function checkRule(rule: StudioAlertRule, value: number): boolean {
  switch (rule.operator) {
    case "<": return value < rule.value;
    case ">": return value > rule.value;
    case "=": return value === rule.value;
    default: return false;
  }
}

// ---------------------------------------------------------------------------
// Auto-check (runs every 30 min)
// ---------------------------------------------------------------------------
async function sendTg(text: string): Promise<void> {
  if (!TG_BOT_TOKEN || !TG_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT_ID, text }),
    });
  } catch {}
}

function runAlertCheck(): void {
  const rules = [...getDefaultRules(), ...dbGetAlertRules()].filter((r) => r.enabled);
  const newAlerts: StudioAlert[] = [];

  for (const rule of rules) {
    const value = getMetricValue(rule.metric);
    if (checkRule(rule, value)) {
      // Don't duplicate alerts for same rule within 6 hours
      if (dbHasRecentAlert(rule.id, 6 * 3600000)) continue;

      const alert: StudioAlert = {
        id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ruleId: rule.id,
        type: rule.operator === "<" && value === 0 ? "critical" : "warning",
        icon: rule.metric === "revenue" ? "💰" : rule.metric === "clicks" ? "🔗" : "📋",
        title: `${rule.metric} ${rule.operator} ${rule.value}`,
        message: `${rule.metric} = ${value} (threshold: ${rule.operator} ${rule.value})`,
        metric: rule.metric,
        currentValue: value,
        threshold: rule.value,
        timestamp: new Date().toISOString(),
        acknowledged: false,
      };
      newAlerts.push(alert);
    }
  }

  if (newAlerts.length > 0) {
    for (const a of newAlerts) dbAddAlert(a);

    let msg = "🚨 PERFORMANCE ALERT\n\n";
    for (const a of newAlerts) msg += `${a.icon} ${a.title}\n   ${a.message}\n\n`;
    msg += "💡 /alerts ดูรายละเอียด";
    sendTg(msg);
    console.log(`[alerts] 🚨 ${newAlerts.length} new alerts triggered`);
  }
}

export function startAlertScheduler(): void {
  setTimeout(() => runAlertCheck(), 120000);
  setInterval(() => runAlertCheck(), 30 * 60000);
  console.log("[alerts] ⏰ Alert checker active — every 30 min");
}

// ---------------------------------------------------------------------------
// TG Command
// ---------------------------------------------------------------------------
export function handleAlertsCommand(arg: string): string {
  const sub = arg.trim().toLowerCase();

  if (sub.startsWith("set ")) {
    const match = sub.match(/^set\s+(\w+)\s*([<>=])\s*(\d+)/);
    if (!match) return "❌ ใช้: /alerts set <metric> <op> <value>\n\nMetrics: clicks, revenue";
    const [, metric, op, val] = match;
    const rule: StudioAlertRule = {
      id: `rule-${Date.now()}`, metric, operator: op as "<" | ">" | "=",
      value: parseInt(val), enabled: true, createdAt: new Date().toISOString(),
    };
    dbAddAlertRule(rule);
    return `✅ Alert rule added!\n${metric} ${op} ${val}`;
  }

  if (sub === "clear") {
    dbClearAlerts();
    return "✅ Alerts cleared!";
  }

  const alerts = dbGetAlerts(true);
  const rules = dbGetAlertRules();

  let msg = "🚨 Performance Alerts\n";
  msg += `${"═".repeat(24)}\n\n`;

  if (alerts.length === 0) {
    msg += "✅ ไม่มี alerts — ระบบปกติ!\n\n";
  } else {
    for (const a of alerts.slice(0, 5)) {
      const typeIcon = a.type === "critical" ? "🔴" : "🟡";
      msg += `${typeIcon} ${a.icon} ${a.title}\n   ${a.message}\n\n`;
    }
  }

  msg += `📋 Custom Rules: ${rules.length}\n`;
  msg += `\n💡 /alerts set clicks < 10\n💡 /alerts clear`;
  return msg;
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------
export function registerAlertRoutes(app: Express): void {
  getStudioDb();

  app.get("/api/alerts", (_req: Request, res: Response) => {
    res.json({
      alerts: dbGetAlerts(true).slice(0, 10),
      rules: [...getDefaultRules(), ...dbGetAlertRules()],
    });
  });
}
