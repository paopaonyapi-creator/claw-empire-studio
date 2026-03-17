/**
 * Content Auto-Scheduler
 *
 * Automatically dispatches content tasks at specific Bangkok times (UTC+7).
 * Enabled via CONTENT_SCHEDULE_ENABLED=1 environment variable.
 *
 * Each scheduled entry fires once per day. A simple in-memory Set tracks
 * which schedules already ran today to avoid duplicate tasks on restarts.
 */

import { PORT } from "../config/runtime.ts";

// ---------------------------------------------------------------------------
// Schedule definition
// ---------------------------------------------------------------------------

interface ScheduleEntry {
  /** Unique id for dedup tracking */
  id: string;
  /** Hour in Bangkok time (UTC+7) */
  hour: number;
  /** Minute */
  minute: number;
  /** Directive content sent to /api/directives */
  content: string;
}

const SCHEDULE: ScheduleEntry[] = [
  {
    id: "daily-trend-report",
    hour: 7,
    minute: 0,
    content:
      "$สร้าง Trend Report ประจำวัน — วิเคราะห์เทรนด์ TikTok/Facebook ที่กำลังมาแรงวันนี้ แนะนำ 3 หัวข้อ content ที่น่าทำ พร้อมเหตุผล",
  },
  {
    id: "daily-script-writing",
    hour: 9,
    minute: 0,
    content:
      "$เขียน Script สำหรับ content วันนี้ — ใช้เทรนด์จาก Trend Report เขียน TikTok script 30-60 วินาที พร้อม hook ที่ดึงดูด และ CTA ปักตะกร้า",
  },
  {
    id: "daily-thumbnail-brief",
    hour: 14,
    minute: 0,
    content:
      "$สร้าง Thumbnail Brief — ออกแบบ 3 thumbnail concepts สำหรับ content วันนี้ ระบุ text overlay, สี, mood, และ layout ที่เหมาะกับแต่ละ platform",
  },
];

// ---------------------------------------------------------------------------
// State: tracks today's dispatched schedules
// ---------------------------------------------------------------------------

let dispatchedToday = new Set<string>();
let lastDateKey = "";

function bangkokNow(): Date {
  // UTC+7
  const utc = new Date();
  return new Date(utc.getTime() + 7 * 60 * 60 * 1000);
}

function dateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

async function dispatchDirective(content: string, scheduleId: string): Promise<void> {
  const url = `http://127.0.0.1:${PORT}/api/directives`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, source: "content-scheduler" }),
    });
    const status = res.status;
    if (status >= 200 && status < 300) {
      console.log(`[ContentScheduler] ✅ Dispatched "${scheduleId}" (HTTP ${status})`);
    } else {
      const text = await res.text().catch(() => "");
      console.warn(`[ContentScheduler] ⚠️ "${scheduleId}" responded ${status}: ${text.slice(0, 200)}`);
    }
  } catch (err) {
    console.error(`[ContentScheduler] ❌ Failed to dispatch "${scheduleId}":`, err instanceof Error ? err.message : err);
  }
}

// ---------------------------------------------------------------------------
// Tick — runs every 60 seconds
// ---------------------------------------------------------------------------

function tick(): void {
  const now = bangkokNow();
  const today = dateKey(now);

  // Reset at midnight
  if (today !== lastDateKey) {
    dispatchedToday = new Set<string>();
    lastDateKey = today;
    console.log(`[ContentScheduler] 📅 New day: ${today} — schedule reset`);
  }

  const currentHour = now.getUTCHours();
  const currentMinute = now.getUTCMinutes();

  for (const entry of SCHEDULE) {
    if (dispatchedToday.has(entry.id)) continue;

    // Fire if we're past the scheduled time (within the same day)
    if (currentHour > entry.hour || (currentHour === entry.hour && currentMinute >= entry.minute)) {
      dispatchedToday.add(entry.id);
      console.log(
        `[ContentScheduler] 🚀 Triggering "${entry.id}" (scheduled ${String(entry.hour).padStart(2, "0")}:${String(entry.minute).padStart(2, "0")} BKK, now ${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")})`,
      );
      dispatchDirective(entry.content, entry.id).catch(() => {});
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function startContentScheduler(): void {
  const enabled = String(process.env.CONTENT_SCHEDULE_ENABLED ?? "").trim();
  if (enabled !== "1" && enabled !== "true") {
    console.log("[ContentScheduler] Disabled (set CONTENT_SCHEDULE_ENABLED=1 to enable)");
    return;
  }

  console.log(`[ContentScheduler] ✅ Started with ${SCHEDULE.length} daily tasks (Bangkok UTC+7)`);
  for (const entry of SCHEDULE) {
    console.log(
      `  → ${entry.id} at ${String(entry.hour).padStart(2, "0")}:${String(entry.minute).padStart(2, "0")}`,
    );
  }

  // Initialize date tracking
  lastDateKey = dateKey(bangkokNow());

  // Run initial check after 15 seconds (give server time to fully start)
  setTimeout(tick, 15_000);

  // Check every 60 seconds
  setInterval(tick, 60_000);
}
