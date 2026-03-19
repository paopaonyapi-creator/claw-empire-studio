import { useState, useEffect, useRef, useCallback } from "react";

/**
 * useLiveUpdates — Real-time WebSocket hook for dashboard updates
 * Auto-reconnects, polls fallback, provides live data
 */

interface LiveEvent {
  type: "task_update" | "agent_update" | "chat_message" | "pipeline_update" | "review_complete" | "tier_up";
  data: any;
  timestamp: number;
}

export function useLiveUpdates(onEvent?: (event: LiveEvent) => void) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<LiveEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const connect = useCallback(() => {
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

      ws.onopen = () => {
        setConnected(true);
        console.log("[LiveUpdates] ✅ Connected");
      };

      ws.onmessage = (evt) => {
        try {
          const event: LiveEvent = JSON.parse(evt.data);
          setLastEvent(event);
          onEvent?.(event);
        } catch {}
      };

      ws.onclose = () => {
        setConnected(false);
        // Reconnect after 5 seconds
        reconnectTimer.current = setTimeout(connect, 5000);
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    } catch {
      // Fallback: poll via HTTP
      reconnectTimer.current = setTimeout(connect, 10000);
    }
  }, [onEvent]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connect]);

  return { connected, lastEvent };
}

/**
 * usePollingData — Polls an API endpoint at interval
 */
export function usePollingData<T>(url: string, intervalMs = 15000, defaultValue: T): { data: T; loading: boolean; refresh: () => void } {
  const [data, setData] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    fetch(url)
      .then(r => r.json())
      .then(d => setData(d as T))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [url]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [refresh, intervalMs]);

  return { data, loading, refresh };
}
