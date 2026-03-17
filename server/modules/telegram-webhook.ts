/**
 * Telegram Webhook — Instant CEO Chat via Webhook
 *
 * Instead of polling, this sets up a webhook endpoint that Telegram
 * calls directly when a message arrives → instant response.
 *
 * Setup: POST /api/telegram/setup-webhook?url=<your-app-url>
 * Receive: POST /api/telegram/webhook
 */

import { processCeoTelegramMessage } from "./ceo-chat.ts";

const TG_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TG_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

// ---------------------------------------------------------------------------
// Register webhook routes
// ---------------------------------------------------------------------------

export function registerTelegramWebhookRoutes(app: any): void {
  // POST /api/telegram/webhook — receives updates from Telegram
  app.post("/api/telegram/webhook", async (req: any, res: any) => {
    try {
      const update = req.body;
      const message = update?.message;

      if (!message?.text) {
        return res.json({ ok: true });
      }

      // Only process messages from the CEO chat
      const chatId = String(message.chat?.id || "");
      if (TG_CHAT_ID && chatId !== TG_CHAT_ID) {
        return res.json({ ok: true }); // ignore non-CEO messages
      }

      const text = message.text.trim();
      console.log(`[TG-Webhook] 📨 CEO: "${text}"`);

      // Process asynchronously so we don't block Telegram
      processCeoTelegramMessage(text).catch((err) => {
        console.error("[TG-Webhook] ❌ Error:", err instanceof Error ? err.message : err);
      });

      res.json({ ok: true });
    } catch (err) {
      console.error("[TG-Webhook] ❌ Error:", err instanceof Error ? err.message : err);
      res.json({ ok: true }); // always return 200 to Telegram
    }
  });

  // POST /api/telegram/setup-webhook — register webhook with Telegram
  app.post("/api/telegram/setup-webhook", async (req: any, res: any) => {
    if (!TG_BOT_TOKEN) {
      return res.status(400).json({ error: "TELEGRAM_BOT_TOKEN not set" });
    }

    const appUrl = req.body?.url || req.query?.url;
    if (!appUrl) {
      return res.status(400).json({ error: "url parameter required", example: "POST /api/telegram/setup-webhook?url=https://your-app.up.railway.app" });
    }

    const webhookUrl = `${appUrl.replace(/\/$/, "")}/api/telegram/webhook`;

    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ["message"],
          drop_pending_updates: true,
        }),
      });

      const tgData = (await tgRes.json()) as { ok?: boolean; description?: string };

      if (tgData.ok) {
        console.log(`[TG-Webhook] ✅ Webhook set: ${webhookUrl}`);
      }

      res.json({
        ok: tgData.ok ?? false,
        webhook_url: webhookUrl,
        telegram_response: tgData,
      });
    } catch (err) {
      res.status(500).json({ error: "webhook_setup_failed", detail: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /api/telegram/webhook-info — check current webhook status
  app.get("/api/telegram/webhook-info", async (_req: any, res: any) => {
    if (!TG_BOT_TOKEN) {
      return res.json({ ok: false, error: "TELEGRAM_BOT_TOKEN not set" });
    }

    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/getWebhookInfo`);
      const info = await tgRes.json();
      res.json({ ok: true, info });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // DELETE /api/telegram/webhook — remove webhook (switch back to polling)
  app.delete("/api/telegram/webhook", async (_req: any, res: any) => {
    if (!TG_BOT_TOKEN) return res.status(400).json({ error: "TELEGRAM_BOT_TOKEN not set" });

    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/deleteWebhook`, { method: "POST" });
      const data = await tgRes.json();
      res.json({ ok: true, telegram_response: data });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  console.log("[TG-Webhook] ✅ API ready: /api/telegram/webhook, /api/telegram/setup-webhook");
}

// ---------------------------------------------------------------------------
// Auto-setup on startup
// ---------------------------------------------------------------------------

export async function autoSetupTelegramWebhook(): Promise<void> {
  if (!TG_BOT_TOKEN) {
    console.log("[TG-Webhook] ⚠️ No TELEGRAM_BOT_TOKEN — webhook not set");
    return;
  }

  // Try to get the current Railway URL from env
  const railwayUrl = process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : process.env.APP_URL || "";

  if (!railwayUrl) {
    console.log("[TG-Webhook] ⚠️ No RAILWAY_PUBLIC_DOMAIN or APP_URL — set webhook manually via /api/telegram/setup-webhook");
    return;
  }

  const webhookUrl = `${railwayUrl}/api/telegram/webhook`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message"],
        drop_pending_updates: true,
      }),
    });

    const data = (await res.json()) as { ok?: boolean };
    if (data.ok) {
      console.log(`[TG-Webhook] ✅ Auto-registered webhook: ${webhookUrl}`);
    } else {
      console.log(`[TG-Webhook] ⚠️ Failed to auto-register webhook`);
    }
  } catch (err) {
    console.error("[TG-Webhook] ❌ Auto-setup error:", err instanceof Error ? err.message : err);
  }
}
