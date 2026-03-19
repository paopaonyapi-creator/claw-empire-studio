import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../app/AuthProvider";

interface Alert { id: number; type: string; title: string; message: string; icon: string; read: boolean; createdAt: string; }

const TYPE_COLORS: Record<string, string> = { info: "#3b82f6", success: "#16a34a", warning: "#f59e0b", error: "#ef4444" };

export function PushAlertsWidget() {
  const { token } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unread, setUnread] = useState(0);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/push-alerts?limit=10", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.ok) { setAlerts(data.alerts || []); setUnread(data.unreadCount || 0); }
    } catch {}
  }, [token]);

  useEffect(() => { load(); const iv = setInterval(load, 30_000); return () => clearInterval(iv); }, [load]);

  const markRead = async (id: number) => {
    await fetch(`/api/push-alerts/${id}/read`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
    load();
  };

  const markAllRead = async () => {
    await fetch("/api/push-alerts/read-all", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    load();
  };

  const displayed = showAll ? alerts : alerts.slice(0, 5);
  const timeAgo = (iso: string) => {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return "ตอนนี้";
    if (mins < 60) return `${mins}m`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h`;
    return `${Math.floor(mins / 1440)}d`;
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.iconBox}>🔔</div>
        <h3 style={styles.title}>Push Alerts</h3>
        {unread > 0 && <span style={styles.unreadBadge}>{unread}</span>}
        <div style={{ flex: 1 }} />
        {unread > 0 && <button onClick={markAllRead} style={styles.markAllBtn}>✓ อ่านทั้งหมด</button>}
      </div>

      <div style={styles.list}>
        {alerts.length === 0 ? (
          <div style={styles.empty}>🔕 ยังไม่มี alerts</div>
        ) : (
          displayed.map(a => (
            <div key={a.id} onClick={() => !a.read && markRead(a.id)}
              style={{ ...styles.alertRow, opacity: a.read ? 0.5 : 1, cursor: a.read ? "default" : "pointer" }}>
              <div style={{ ...styles.typeDot, background: TYPE_COLORS[a.type] || "#94a3b8" }} />
              <span style={styles.alertIcon}>{a.icon}</span>
              <div style={styles.alertContent}>
                <div style={styles.alertTitle}>{a.title}</div>
                {a.message && <div style={styles.alertMsg}>{a.message}</div>}
              </div>
              <span style={styles.alertTime}>{timeAgo(a.createdAt)}</span>
              {!a.read && <span style={styles.newDot} />}
            </div>
          ))
        )}
      </div>

      {alerts.length > 5 && (
        <button onClick={() => setShowAll(!showAll)} style={styles.toggleBtn}>
          {showAll ? "ย่อ" : `ดูทั้งหมด (${alerts.length})`}
        </button>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 4px 15px rgba(0,0,0,0.03)", border: "1px solid #f1f5f9", marginBottom: 24 },
  header: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12 },
  iconBox: { fontSize: 22, background: "#fef3c7", width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10 },
  title: { margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" },
  unreadBadge: { background: "#ef4444", color: "#fff", fontSize: 11, fontWeight: 800, padding: "2px 7px", borderRadius: 10, minWidth: 20, textAlign: "center" },
  markAllBtn: { fontSize: 11, fontWeight: 600, color: "#6366f1", background: "none", border: "none", cursor: "pointer" },
  list: { display: "flex", flexDirection: "column", gap: 4 },
  empty: { textAlign: "center", padding: 20, color: "#94a3b8", fontSize: 13 },
  alertRow: { display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, background: "#fafbfc", transition: "opacity 0.2s", position: "relative" },
  typeDot: { width: 4, height: 24, borderRadius: 2, flexShrink: 0 },
  alertIcon: { fontSize: 16, flexShrink: 0 },
  alertContent: { flex: 1, minWidth: 0 },
  alertTitle: { fontSize: 12, fontWeight: 600, color: "#1e293b" },
  alertMsg: { fontSize: 10, color: "#64748b", marginTop: 1 },
  alertTime: { fontSize: 10, color: "#94a3b8", flexShrink: 0 },
  newDot: { width: 6, height: 6, borderRadius: "50%", background: "#ef4444", position: "absolute", top: 8, right: 8 },
  toggleBtn: { width: "100%", marginTop: 8, padding: "6px 0", borderRadius: 6, border: "1px solid #e2e8f0", background: "#f8fafc", fontSize: 11, fontWeight: 600, cursor: "pointer", color: "#475569" },
};
