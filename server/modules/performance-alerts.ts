/**
 * Performance Alerts — Auto-detect drops & anomalies
 *
 * Monitors: clicks, revenue, task completion
 * Auto-sends TG alerts when thresholds are hit
 * TG: /alerts, /alerts set <metric> <op> <value>
 * API: GET /api/alerts
 */

import type { Express, Request, Response } from "express";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "path";

const TG_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TG_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

interface AlertRule {
  id: string;
  metric: string;
  operator: "<" | ">" | "=";
  value: number;
  enabled: boolean;
  createdAt: string;
}

interface ActiveAlert {
  id: string;
  ruleId: string;
  type: "warning" | "critical" | "info";
  icon: string;
  title: string;
  message: string;
  metric: string;
  currentValue: number;
  threshold: number;
  timestamp: string;
  acknowledged: boolean;
}

const RULES_FILE = path.resolve("data/alert-rules.json");
const ALERTS_FILE = path.resolve("data/active-alerts.json");

function loadRules(): AlertRule[] {
  try { if (existsSync(RULES_FILE)) return JSON.parse(readFileSync(RULES_FILE, "utf-8")) || []; } catch {} return [];
}
function saveRules(d: AlertRule[]): void { mkdirSync(path.dirname(RULES_FILE), { recursive: true }); writeFileSync(RULES_FILE, JSON.stringify(d, null, 2)); }
function loadAlerts(): ActiveAlert[] {
  try { if (existsSync(ALERTS_FILE)) return JSON.parse(readFileSync(ALERTS_FILE, "utf-8")) || []; } catch {} return [];
}
function saveAlerts(d: ActiveAlert[]): void { mkdirSync(path.dirname(ALERTS_FILE), { recursive: true }); writeFileSync(ALERTS_FILE, JSON.stringify(d, null, 2)); }

function loadJson(f: string): unknown[] {
  try { const p = path.resolve(`data/${f}`); if (existsSync(p)) return JSON.parse(readFileSync(p, "utf-8")) || []; } catch {} return [];
}

function getMetricValue(metric: string): number {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  switch (metric) {
    case "clicks": {
      const links = loadJson("link-clicks.json") as Array<{ timestamp?: string }>;
      return links.filter((l) => (l.timestamp || "").startsWith(todayStr)).length;
    }
    case "revenue": {
      const rev = loadJson("revenue.json") as Array<{ amount?: number; timestamp?: string }>;
      return rev.filter((r) => (r.timestamp || "").startsWith(todayStr)).reduce((s, r) => s + (r.amount || 0), 0);
    }
    case "tasks_done": {
      const tasks = loadJson("tasks.json") as Array<{ status?: string }>;
      return tasks.filter((t) => t.status === "done").length;
    }
    case "tasks_pending": {
      const tasks = loadJson("tasks.json") as Array<{ status?: string }>;
      return tasks.filter((t) => t.status === "pending" || t.status === "queued").length;
    }
    case "agents_working": {
      const agents = loadJson("agents.json") as Array<{ status?: string }>;
      return agents.filter((a) => a.status === "working" || a.status === "busy").length;
    }
    default: return 0;
  }
}

// Built-in default rules
function getDefaultRules(): AlertRule[] {
  return [
    { id: "default-1", metric: "clicks", operator: "<", value: 5, enabled: true, createdAt: new Date().toISOString() },
    { id: "default-2", metric: "revenue", operator: "<", value: 1, enabled: true, createdAt: new Date().toISOString() },
    { id: "default-3", metric: "tasks_pending", operator: ">", value: 20, enabled: true, createdAt: new Date().toISOString() },
  ];
}

function checkRule(rule: AlertRule, value: number): boolean {
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
  const rules = [...getDefaultRules(), ...loadRules()].filter((r) => r.enabled);
  const existing = loadAlerts();
  const newAlerts: ActiveAlert[] = [];

  for (const rule of rules) {
    const value = getMetricValue(rule.metric);
    if (checkRule(rule, value)) {
      // Don't duplicate alerts for same rule within 6 hours
      const recent = existing.find(
        (a) => a.ruleId === rule.id && Date.now() - new Date(a.timestamp).getTime() < 6 * 3600000
      );
      if (recent) continue;

      const alert: ActiveAlert = {
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
    const all = [...newAlerts, ...existing].slice(0, 50);
    saveAlerts(all);

    // Send TG notification
    let msg = "🚨 PERFORMANCE ALERT\n\n";
    for (const a of newAlerts) {
      msg += `${a.icon} ${a.title}\n   ${a.message}\n\n`;
    }
    msg += "💡 /alerts ดูรายละเอียด";
    sendTg(msg);
    console.log(`[alerts] 🚨 ${newAlerts.length} new alerts triggered`);
  }
}

export function startAlertScheduler(): void {
  // Initial check after 2 minutes
  setTimeout(() => runAlertCheck(), 120000);
  // Then every 30 minutes
  setInterval(() => runAlertCheck(), 30 * 60000);
  console.log("[alerts] ⏰ Alert checker active — every 30 min");
}

// ---------------------------------------------------------------------------
// TG Command
// ---------------------------------------------------------------------------

export function handleAlertsCommand(arg: string): string {
  const sub = arg.trim().toLowerCase();

  if (sub.startsWith("set ")) {
    // /alerts set clicks < 10
    const match = sub.match(/^set\s+(\w+)\s*([<>=])\s*(\d+)/);
    if (!match) return "❌ ใช้: /alerts set <metric> <op> <value>\n\nMetrics: clicks, revenue, tasks_done, tasks_pending";
    const [, metric, op, val] = match;
    const rules = loadRules();
    const rule: AlertRule = {
      id: `rule-${Date.now()}`, metric, operator: op as "<" | ">" | "=",
      value: parseInt(val), enabled: true, createdAt: new Date().toISOString(),
    };
    rules.push(rule);
    saveRules(rules);
    return `✅ Alert rule added!\n${metric} ${op} ${val}`;
  }

  if (sub === "clear") {
    saveAlerts([]); return "✅ Alerts cleared!";
  }

  // Show current alerts
  const alerts = loadAlerts().filter((a) => !a.acknowledged);
  const rules = loadRules();

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
  app.get("/api/alerts", (_req: Request, res: Response) => {
    res.json({
      alerts: loadAlerts().filter((a) => !a.acknowledged).slice(0, 10),
      rules: [...getDefaultRules(), ...loadRules()],
    });
  });
}
