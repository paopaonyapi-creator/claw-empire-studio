/**
 * Webhook Integration — Receive events from external platforms
 * Shopee, Lazada, TikTok Shop → auto-generate review content
 */

import type { Express } from "express";
import crypto from "crypto";

const PORT = process.env.PORT || 8790;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "claw-empire-webhook-2024";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WebhookEvent {
  id: string;
  source: string;
  type: string;
  payload: any;
  receivedAt: string;
  processed: boolean;
  result: string | null;
}

// Store events
const webhookEvents: WebhookEvent[] = [];

// ---------------------------------------------------------------------------
// Webhook Handlers
// ---------------------------------------------------------------------------

async function handleShopeeOrder(payload: any): Promise<string> {
  const productName = payload.product_name || payload.item_name || "สินค้า Shopee";
  const orderId = payload.order_id || "unknown";

  // Auto-generate review content
  try {
    const { routedGenerate } = await import("./agent-router.ts");
    const result = await routedGenerate({
      agentRole: "content_writer",
      taskType: "product-review",
      prompt: `เขียนรีวิวสินค้าจาก Shopee: "${productName}" (Order #${orderId})\nให้เน้น:\n1. จุดเด่นของสินค้า\n2. ประสบการณ์ใช้งาน\n3. คุ้มค่าหรือไม่\n4. ใส่ CTA ให้ซื้อผ่านลิงก์`,
      maxTokens: 512,
    });

    // Notify via TG
    try {
      const { sendTgNotification } = await import("./auto-pipeline.ts");
      await sendTgNotification(
        `🛒 <b>Shopee Order → Auto Review</b>\n\n📦 ${productName}\n📝 Order: #${orderId}\n\n${result.text.slice(0, 200)}...`
      );
    } catch {}

    return result.text;
  } catch (err) {
    return `Error: ${err}`;
  }
}

async function handleLazadaOrder(payload: any): Promise<string> {
  const productName = payload.product_name || payload.item || "สินค้า Lazada";

  try {
    const { routedGenerate } = await import("./agent-router.ts");
    const result = await routedGenerate({
      agentRole: "content_writer",
      taskType: "product-review",
      prompt: `เขียนรีวิวสินค้าจาก Lazada: "${productName}"\nรวมข้อดีข้อเสีย + CTA ให้ซื้อผ่านลิงก์`,
      maxTokens: 512,
    });
    return result.text;
  } catch (err) {
    return `Error: ${err}`;
  }
}

async function handleTikTokShop(payload: any): Promise<string> {
  const productName = payload.product_name || payload.item || "สินค้า TikTok Shop";

  try {
    const { routedGenerate } = await import("./agent-router.ts");
    const result = await routedGenerate({
      agentRole: "hook_specialist",
      taskType: "tiktok-script",
      prompt: `เขียน TikTok script 30 วินาที สำหรับรีวิว: "${productName}"\nต้องมี hook แรงภายใน 3 วินาทีแรก + ปักตะกร้า CTA`,
      maxTokens: 512,
    });
    return result.text;
  } catch (err) {
    return `Error: ${err}`;
  }
}

async function handleGenericWebhook(source: string, payload: any): Promise<string> {
  const summary = JSON.stringify(payload).slice(0, 500);
  try {
    const { sendTgNotification } = await import("./auto-pipeline.ts");
    await sendTgNotification(`🔔 <b>Webhook: ${source}</b>\n\n${summary}`);
  } catch {}
  return `Received from ${source}`;
}

// Verify webhook signature
function verifySignature(body: string, signature: string): boolean {
  const expected = crypto.createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

export function registerWebhookRoutes(app: Express): void {
  // Generic webhook endpoint
  app.post("/api/webhooks/:source", async (req, res) => {
    const source = req.params.source;
    const payload = req.body || {};

    const event: WebhookEvent = {
      id: `wh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      source,
      type: payload.type || payload.event || "unknown",
      payload,
      receivedAt: new Date().toISOString(),
      processed: false,
      result: null,
    };

    // Process based on source
    let result = "";
    switch (source) {
      case "shopee":
        result = await handleShopeeOrder(payload);
        break;
      case "lazada":
        result = await handleLazadaOrder(payload);
        break;
      case "tiktok":
      case "tiktok-shop":
        result = await handleTikTokShop(payload);
        break;
      default:
        result = await handleGenericWebhook(source, payload);
    }

    event.processed = true;
    event.result = result;
    webhookEvents.unshift(event);
    // Keep last 200
    if (webhookEvents.length > 200) webhookEvents.length = 200;

    res.json({ ok: true, event: { id: event.id, source, processed: true }, content: result.slice(0, 500) });
  });

  // Shopee direct endpoint
  app.post("/api/webhooks/shopee/order", async (req, res) => {
    const result = await handleShopeeOrder(req.body || {});
    const event: WebhookEvent = {
      id: `wh_shopee_${Date.now()}`,
      source: "shopee",
      type: "order",
      payload: req.body,
      receivedAt: new Date().toISOString(),
      processed: true,
      result,
    };
    webhookEvents.unshift(event);
    res.json({ ok: true, content: result });
  });

  // Get webhook history
  app.get("/api/webhooks/history", (_req, res) => {
    res.json({ ok: true, events: webhookEvents.slice(0, 50), total: webhookEvents.length });
  });

  // Get webhook stats
  app.get("/api/webhooks/stats", (_req, res) => {
    const sourceCount: Record<string, number> = {};
    webhookEvents.forEach(e => { sourceCount[e.source] = (sourceCount[e.source] || 0) + 1; });
    res.json({
      ok: true,
      total: webhookEvents.length,
      sources: sourceCount,
      processed: webhookEvents.filter(e => e.processed).length,
    });
  });

  // Test webhook
  app.post("/api/webhooks/test", async (req, res) => {
    const { source, product_name } = req.body || {};
    const testPayload = {
      product_name: product_name || "ทดสอบสินค้า",
      order_id: `TEST_${Date.now()}`,
      type: "test",
    };

    const result = source === "tiktok"
      ? await handleTikTokShop(testPayload)
      : await handleShopeeOrder(testPayload);

    res.json({ ok: true, content: result, source: source || "shopee" });
  });

  console.log("[Webhooks] ✅ Shopee/Lazada/TikTok Shop integration ready");
}
