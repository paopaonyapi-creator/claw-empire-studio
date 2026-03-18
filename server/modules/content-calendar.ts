/**
 * Content Calendar — Schedule posts across platforms
 *
 * Weekly scheduling Mon-Sun, assign products/templates to time slots
 * TG command: /schedule [list|add <day> <time> <product>|clear]
 */

import type { Express, Request, Response } from "express";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "path";

interface CalendarEntry {
  id: string;
  day: string;           // "mon"|"tue"|"wed"|"thu"|"fri"|"sat"|"sun"
  time: string;          // "09:00" | "12:00" | "18:00" etc.
  platform: string;      // "tiktok" | "facebook" | "instagram"
  productName: string;
  templateType: string;  // "review" | "comparison" | "hook" | "trend"
  status: "scheduled" | "posted" | "skipped";
  note: string;
  weekOf: string;        // ISO date of week start
  createdAt: string;
}

const DATA_FILE = path.resolve("data/calendar.json");
let calendar: CalendarEntry[] = [];

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DAY_NAMES: Record<string, string> = {
  mon: "จันทร์", tue: "อังคาร", wed: "พุธ", thu: "พฤหัส",
  fri: "ศุกร์", sat: "เสาร์", sun: "อาทิตย์",
};

function loadData(): void {
  try {
    if (existsSync(DATA_FILE)) {
      calendar = JSON.parse(readFileSync(DATA_FILE, "utf-8"));
    }
  } catch { calendar = []; }
}

function saveData(): void {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!existsSync(dir)) {
      const { mkdirSync } = require("node:fs");
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(DATA_FILE, JSON.stringify(calendar, null, 2));
  } catch { /* ignore */ }
}

loadData();

function genId(): string {
  return `cal_${Date.now().toString(36)}`;
}

function getCurrentWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(now.setDate(diff)).toISOString().split("T")[0];
}

function addEntry(day: string, time: string, productName: string, platform = "tiktok"): CalendarEntry {
  const entry: CalendarEntry = {
    id: genId(),
    day: day.toLowerCase().slice(0, 3),
    time: time || "18:00",
    platform,
    productName,
    templateType: "review",
    status: "scheduled",
    note: "",
    weekOf: getCurrentWeekStart(),
    createdAt: new Date().toISOString(),
  };
  calendar.push(entry);
  saveData();
  return entry;
}

function getWeekSchedule(weekOf?: string): CalendarEntry[] {
  const week = weekOf || getCurrentWeekStart();
  return calendar
    .filter((e) => e.weekOf === week)
    .sort((a, b) => {
      const dayDiff = DAYS.indexOf(a.day as typeof DAYS[number]) - DAYS.indexOf(b.day as typeof DAYS[number]);
      if (dayDiff !== 0) return dayDiff;
      return a.time.localeCompare(b.time);
    });
}

// ---------------------------------------------------------------------------
// TG Command Handler
// ---------------------------------------------------------------------------

export function handleScheduleCommand(arg: string): string {
  const parts = arg.trim().split(/\s+/);
  const sub = parts[0]?.toLowerCase() || "";

  if (!sub || sub === "list") {
    const schedule = getWeekSchedule();
    if (schedule.length === 0) {
      return `📅 Content Calendar\n${"─".repeat(20)}\n📭 สัปดาห์นี้ว่าง\n\n/schedule add <วัน> <เวลา> <สินค้า>\nตัวอย่าง: /schedule add mon 18:00 หมวกแก๊ป`;
    }

    let msg = `📅 Content Calendar (${getCurrentWeekStart()})\n${"─".repeat(28)}\n`;
    let currentDay = "";

    for (const entry of schedule) {
      if (entry.day !== currentDay) {
        currentDay = entry.day;
        msg += `\n📌 ${DAY_NAMES[currentDay] || currentDay}:\n`;
      }
      const statusIcon = entry.status === "posted" ? "✅" : entry.status === "skipped" ? "⏭️" : "⏰";
      msg += `  ${statusIcon} ${entry.time} — ${entry.productName} (${entry.platform})\n`;
    }

    return msg;
  }

  if (sub === "add") {
    const day = parts[1] || "";
    const time = parts[2] || "18:00";
    const product = parts.slice(3).join(" ") || "Unnamed";

    if (!DAYS.includes(day.toLowerCase().slice(0, 3) as typeof DAYS[number])) {
      return `❌ วันไม่ถูก! ใช้: mon tue wed thu fri sat sun\nตัวอย่าง: /schedule add fri 18:00 หมวก`;
    }

    const entry = addEntry(day, time, product);
    return `✅ เพิ่มลง Calendar!\n📅 ${DAY_NAMES[entry.day]} ${entry.time}\n📦 ${entry.productName}\n📱 ${entry.platform}`;
  }

  if (sub === "clear") {
    const week = getCurrentWeekStart();
    calendar = calendar.filter((e) => e.weekOf !== week);
    saveData();
    return "🗑️ ล้าง Calendar สัปดาห์นี้แล้ว";
  }

  return `📅 Content Calendar\n\n/schedule — ดูตาราง\n/schedule add <วัน> <เวลา> <สินค้า>\n/schedule clear — ล้างสัปดาห์นี้`;
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

export function registerContentCalendarRoutes(app: Express): void {
  app.get("/api/calendar", (_req: Request, res: Response) => {
    const weekOf = String(_req.query.week || "") || undefined;
    res.json({
      weekOf: weekOf || getCurrentWeekStart(),
      entries: getWeekSchedule(weekOf),
      allEntries: calendar.slice(-200),
    });
  });

  app.post("/api/calendar", (req: Request, res: Response) => {
    const { day, time, productName, platform } = req.body || {};
    if (!day || !productName) {
      return res.status(400).json({ error: "day and productName required" });
    }
    const entry = addEntry(day, time || "18:00", productName, platform || "tiktok");
    res.json({ ok: true, entry });
  });

  app.delete("/api/calendar/:id", (req: Request, res: Response) => {
    const id = String(req.params.id);
    calendar = calendar.filter((e) => e.id !== id);
    saveData();
    res.json({ ok: true });
  });
}
