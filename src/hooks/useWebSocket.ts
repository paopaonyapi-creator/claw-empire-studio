import { useEffect, useRef, useCallback, useState } from "react";
import { bootstrapSession } from "../api";
import type { WSEvent, WSEventType } from "../types";

type Listener = (payload: unknown) => void;

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Map<WSEventType, Set<Listener>>>(new Map());
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${location.host}/ws`;
    let alive = true;
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let forceSessionBootstrap = false;
    let wsConnected = false;

    async function connect() {
      if (!alive) return;
      const forceBootstrap = forceSessionBootstrap;
      try {
        const bootstrapped = await bootstrapSession({
          promptOnUnauthorized: false,
          force: forceBootstrap,
        });
        if (!bootstrapped) {
          reconnectTimer = setTimeout(() => {
            void connect();
          }, 2000);
          return;
        }
        forceSessionBootstrap = false;
      } catch {
        // Avoid force bootstrap busy-loop when unauthorized recovery itself fails.
        if (forceBootstrap) forceSessionBootstrap = false;
        // ignore bootstrap errors; ws connect result will drive retry
        reconnectTimer = setTimeout(() => {
          void connect();
        }, 2000);
        return;
      }
      ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (alive) { setConnected(true); wsConnected = true; }
      };
      ws.onclose = (event) => {
        if (!alive) return;
        wsConnected = false;
        // Don't set disconnected immediately — REST fallback will handle
        if (event.code === 1008) {
          forceSessionBootstrap = true;
        }
        reconnectTimer = setTimeout(() => {
          void connect();
        }, 2000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (e) => {
        if (!alive) return;
        try {
          const evt: WSEvent = JSON.parse(e.data);
          const listeners = listenersRef.current.get(evt.type);
          if (listeners) {
            for (const fn of listeners) fn(evt.payload);
          }
        } catch {}
      };
    }

    void connect();

    // ─── REST API health polling fallback ───
    // If WS doesn't connect, poll /api/health to show "Connected" status
    let healthPollTimer: ReturnType<typeof setInterval>;

    async function pollHealth() {
      if (!alive) return;
      // If WS is connected, skip polling
      if (wsConnected) { setConnected(true); return; }
      try {
        const res = await fetch("/api/health", { signal: AbortSignal.timeout(5000) });
        if (alive) setConnected(res.ok);
      } catch {
        if (alive) setConnected(false);
      }
    }

    // Start polling after 5s delay (give WS time to connect first)
    const startPollTimer = setTimeout(() => {
      if (!alive) return;
      void pollHealth();
      healthPollTimer = setInterval(pollHealth, 15000);
    }, 5000);

    return () => {
      alive = false;
      clearTimeout(reconnectTimer);
      clearTimeout(startPollTimer);
      clearInterval(healthPollTimer);
      ws?.close();
    };
  }, []);

  const on = useCallback((type: WSEventType, fn: Listener) => {
    if (!listenersRef.current.has(type)) {
      listenersRef.current.set(type, new Set());
    }
    listenersRef.current.get(type)!.add(fn);
    return () => {
      listenersRef.current.get(type)?.delete(fn);
    };
  }, []);

  return { connected, on };
}
