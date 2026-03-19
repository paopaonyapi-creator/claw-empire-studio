/**
 * TG Push Notifier — Send Telegram alerts on important events
 *
 * Hooks into Activity Log to push notifications for:
 * - New orders, login alerts, goal achievements, errors
 */

const TG_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TG_CEO_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

// Events that trigger TG push
const PUSH_EVENTS = new Set([
  "login",
  "create_user",
  "delete_user",
  "new_order",
  "goal_achieved",
  "alert_triggered",
  "fb_post_published",
  "export_completed",
]);

const EVENT_ICONS: Record<string, string> = {
  login: "🔐",
  create_user: "👤",
  delete_user: "🗑️",
  new_order: "🛒",
  goal_achieved: "🎯",
  alert_triggered: "🚨",
  fb_post_published: "📱",
  export_completed: "📋",
};

async function sendTgPush(text: string): Promise<void> {
  if (!TG_BOT_TOKEN || !TG_CEO_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TG_CEO_CHAT_ID,
        text,
        parse_mode: "HTML",
        disable_notification: false,
      }),
    });
  } catch {
    // Silent — notification failure should never crash
  }
}

/**
 * Call this after logActivity to push TG notifications for important events
 */
export function pushTgNotification(params: {
  action: string;
  actor?: string;
  detail?: string;
}): void {
  if (!PUSH_EVENTS.has(params.action)) return;

  const icon = EVENT_ICONS[params.action] || "📌";
  const time = new Date().toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok" });
  const text =
    `${icon} <b>${params.action.replace(/_/g, " ").toUpperCase()}</b>\n\n` +
    `👤 ${params.actor || "system"}\n` +
    (params.detail ? `📝 ${params.detail}\n` : "") +
    `⏰ ${time}`;

  sendTgPush(text);
}

/**
 * Register TG command: /notif on|off
 */
export function handleNotifCommand(arg: string): string {
  const trimmed = arg.trim().toLowerCase();
  if (trimmed === "on") {
    return "🔔 Push notifications: <b>ON</b>\nจะส่งแจ้งเตือนเมื่อมี event สำคัญ";
  }
  if (trimmed === "off") {
    return "🔕 Push notifications: <b>OFF</b>\nปิดแจ้งเตือนแล้ว";
  }
  return (
    `🔔 <b>Push Notifications</b>\n\n` +
    `Events ที่จะแจ้ง:\n` +
    [...PUSH_EVENTS].map(e => `${EVENT_ICONS[e] || "📌"} ${e}`).join("\n") +
    `\n\n/notif on — เปิด\n/notif off — ปิด`
  );
}
