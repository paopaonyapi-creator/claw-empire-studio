import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../app/AuthProvider";

interface Notification {
  id: string;
  type: "alert" | "order" | "post" | "system";
  icon: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export function NotificationHub() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const loadNotifications = useCallback(async () => {
    const items: Notification[] = [];

    // Fetch alerts
    try {
      const res = await fetch("/api/alerts", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.alerts) {
        for (const a of data.alerts) {
          items.push({
            id: a.id, type: "alert", icon: a.icon || "🚨",
            title: a.title || "Performance Alert",
            message: a.message || "",
            timestamp: a.timestamp || new Date().toISOString(),
            read: a.acknowledged || false,
          });
        }
      }
    } catch {}

    // Fetch recent orders
    try {
      const res = await fetch("/api/orders", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.ok && data.orders) {
        for (const o of data.orders.slice(0, 5)) {
          items.push({
            id: o.id, type: "order", icon: "🛒",
            title: `ออเดอร์ ${o.productName}`,
            message: `฿${(o.amount || 0).toLocaleString()} — ${o.platform}`,
            timestamp: o.timestamp || new Date().toISOString(),
            read: true,
          });
        }
      }
    } catch {}

    // Fetch FB post status
    try {
      const res = await fetch("/api/fb/history", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.history) {
        for (const h of data.history.slice(0, 3)) {
          items.push({
            id: h.id, type: "post",
            icon: h.status === "posted" ? "✅" : h.status === "scheduled" ? "⏰" : "❌",
            title: `FB Post: ${h.status}`,
            message: h.message?.substring(0, 60) || "",
            timestamp: h.timestamp || new Date().toISOString(),
            read: h.status !== "failed",
          });
        }
      }
    } catch {}

    // Sort by timestamp desc
    items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    setNotifications(items);
  }, [token]);

  useEffect(() => {
    loadNotifications();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadNotifications, 30_000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const unreadCount = notifications.filter(n => !n.read).length;
  const displayed = filter === "unread" ? notifications.filter(n => !n.read) : notifications;

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const timeSince = (ts: string): string => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "เมื่อกี้";
    if (mins < 60) return `${mins} นาทีที่แล้ว`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} ชม.ที่แล้ว`;
    return `${Math.floor(hrs / 24)} วันที่แล้ว`;
  };

  const typeColors: Record<string, string> = {
    alert: "#fef2f2", order: "#eff6ff", post: "#f0fdf4", system: "#faf5ff",
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.iconWrap}>
          🔔
          {unreadCount > 0 && <div style={styles.badge}>{unreadCount}</div>}
        </div>
        <h3 style={styles.title}>Notification Hub</h3>
        <div style={{ flex: 1 }} />
        <button onClick={() => setFilter(filter === "all" ? "unread" : "all")} style={styles.filterBtn}>
          {filter === "all" ? "📋 ทั้งหมด" : "🔴 ยังไม่อ่าน"}
        </button>
        {unreadCount > 0 && (
          <button onClick={markAllRead} style={styles.markReadBtn}>✓ อ่านทั้งหมด</button>
        )}
      </div>

      <div style={styles.list}>
        {displayed.length === 0 ? (
          <div style={styles.empty}>
            {filter === "unread" ? "✅ ไม่มีแจ้งเตือนใหม่" : "📭 ยังไม่มีการแจ้งเตือน"}
          </div>
        ) : (
          displayed.slice(0, 10).map(n => (
            <div key={n.id} style={{ ...styles.notifRow, background: n.read ? "#fff" : typeColors[n.type] || "#fafbfc" }}>
              <div style={styles.notifIcon}>{n.icon}</div>
              <div style={styles.notifContent}>
                <div style={styles.notifTitle}>
                  {n.title}
                  {!n.read && <span style={styles.unreadDot}>●</span>}
                </div>
                <div style={styles.notifMsg}>{n.message}</div>
              </div>
              <div style={styles.notifTime}>{timeSince(n.timestamp)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 4px 15px rgba(0,0,0,0.03)", border: "1px solid #f1f5f9", marginBottom: 24 },
  header: { display: "flex", alignItems: "center", gap: 10, marginBottom: 16 },
  iconWrap: { fontSize: 24, position: "relative", background: "#fef3c7", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12 },
  badge: { position: "absolute", top: -4, right: -4, background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 800, width: 18, height: 18, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" },
  title: { margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" },
  filterBtn: { padding: "5px 10px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  markReadBtn: { padding: "5px 10px", borderRadius: 6, border: "none", background: "#dbeafe", color: "#1d4ed8", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  list: { display: "flex", flexDirection: "column", gap: 6 },
  empty: { textAlign: "center", padding: 24, color: "#94a3b8", fontSize: 14 },
  notifRow: { display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: 10, border: "1px solid #f1f5f9", transition: "background 0.2s" },
  notifIcon: { fontSize: 20, marginTop: 2, flexShrink: 0 },
  notifContent: { flex: 1, minWidth: 0 },
  notifTitle: { fontSize: 13, fontWeight: 600, color: "#1e293b", display: "flex", alignItems: "center", gap: 4 },
  unreadDot: { color: "#ef4444", fontSize: 8 },
  notifMsg: { fontSize: 12, color: "#64748b", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  notifTime: { fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap", flexShrink: 0 },
};
