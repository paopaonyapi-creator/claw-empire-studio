/**
 * Telegram Real-Time Notifier
 *
 * Sends instant Telegram notifications for:
 * - Task started (in_progress)
 * - Task completed (done)
 * - Task failed (goes back to inbox)
 * - Task in review
 *
 * Also includes auto-retry logic for failed tasks.
 */

const TG_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TG_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

// Debounce to prevent spam
const recentNotifications = new Map<string, number>();
const DEBOUNCE_MS = 10_000;

async function sendTelegramMessage(text: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TG_CHAT_ID,
        text,
        parse_mode: "HTML",
      }),
    });
    const data = (await res.json()) as { ok?: boolean };
    return data.ok ?? false;
  } catch {
    return false;
  }
}

/**
 * Call this from notifyTaskStatus or wherever task status changes
 */
export function notifyTelegramTaskStatus(taskId: string, title: string, status: string): void {
  const key = `${taskId}:${status}`;
  const now = Date.now();
  const last = recentNotifications.get(key);
  if (last && now - last < DEBOUNCE_MS) return;
  recentNotifications.set(key, now);

  // Clean old entries
  if (recentNotifications.size > 100) {
    const cutoff = now - 60_000;
    for (const [k, v] of recentNotifications) {
      if (v < cutoff) recentNotifications.delete(k);
    }
  }

  let emoji = "📋";
  let label = status;

  switch (status) {
    case "in_progress":
      emoji = "🚀";
      label = "กำลังทำ";
      break;
    case "review":
      emoji = "🔍";
      label = "รอ Review";
      break;
    case "done":
      emoji = "✅";
      label = "เสร็จแล้ว";
      break;
    case "inbox":
      emoji = "📥";
      label = "กลับ Inbox";
      break;
    case "failed":
      emoji = "❌";
      label = "ล้มเหลว";
      break;
    case "planned":
      emoji = "📝";
      label = "วางแผน";
      break;
  }

  const text = `${emoji} <b>[${label}]</b> ${title}`;
  sendTelegramMessage(text).catch(() => {});
}

/**
 * Notify on task failure with error details
 */
export function notifyTelegramTaskFailed(taskId: string, title: string, exitCode: number, errorSnippet?: string): void {
  const text =
    `❌ <b>Task ล้มเหลว</b>\n` +
    `📋 ${title}\n` +
    `🔢 Exit code: ${exitCode}\n` +
    (errorSnippet ? `\n💬 ${errorSnippet.slice(0, 300)}` : "");
  sendTelegramMessage(text).catch(() => {});
}

/**
 * Notify auto-retry attempt
 */
export function notifyTelegramAutoRetry(taskId: string, title: string, attempt: number): void {
  const text = `🔄 <b>Auto-retry #${attempt}</b>\n📋 ${title}`;
  sendTelegramMessage(text).catch(() => {});
}
