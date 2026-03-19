/**
 * Notification WebSocket Broadcaster
 * 
 * Broadcasts real-time notification events to connected frontend clients.
 * Events: new_alert, new_order, fb_post_update, user_action
 */

import type { Express } from "express";
import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "node:http";

export type NotifEvent = {
  type: "new_alert" | "new_order" | "fb_post_update" | "user_action" | "revenue_update";
  data: Record<string, unknown>;
  timestamp: string;
};

// Clients connected to the notification WS channel
const notifClients = new Set<WebSocket>();

export function setupNotificationWs(server: Server): void {
  const wss = new WebSocketServer({ server, path: "/ws/notifications" });

  wss.on("connection", (ws) => {
    notifClients.add(ws);
    console.log(`[NotifWS] ✅ client connected (total: ${notifClients.size})`);

    ws.on("close", () => {
      notifClients.delete(ws);
      console.log(`[NotifWS] client disconnected (total: ${notifClients.size})`);
    });

    ws.on("error", () => {
      notifClients.delete(ws);
    });

    // Send welcome message
    ws.send(JSON.stringify({
      type: "connected",
      data: { message: "Notification stream active" },
      timestamp: new Date().toISOString(),
    }));
  });

  console.log("[NotifWS] ✅ WebSocket notification server on /ws/notifications");
}

/**
 * Broadcast a notification event to all connected clients
 */
export function broadcastNotification(event: NotifEvent): void {
  const message = JSON.stringify(event);
  for (const ws of notifClients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
}

/**
 * Register API endpoint that broadcasts test notifications
 */
export function registerNotificationRoutes(app: Express): void {
  // POST /api/notifications/broadcast — internal use: trigger notification
  app.post("/api/notifications/broadcast", (req, res) => {
    const { type, data } = req.body as { type?: string; data?: Record<string, unknown> };
    if (!type) return res.status(400).json({ ok: false, error: "type required" });

    const event: NotifEvent = {
      type: type as NotifEvent["type"],
      data: data || {},
      timestamp: new Date().toISOString(),
    };
    broadcastNotification(event);
    res.json({ ok: true, clients: notifClients.size });
  });

  // GET /api/notifications/status — check ws status
  app.get("/api/notifications/status", (_req, res) => {
    res.json({ ok: true, connectedClients: notifClients.size });
  });
}
