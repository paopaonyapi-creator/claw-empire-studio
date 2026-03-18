/**
 * AlertsWidget — Active performance alerts
 */
import { useState, useEffect, useCallback } from "react";

interface Alert {
  id: string;
  type: "warning" | "critical" | "info";
  icon: string;
  title: string;
  message: string;
  timestamp: string;
}

export function AlertsWidget() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch("/api/alerts");
      if (res.ok) { const j = await res.json(); setAlerts(j.alerts || []); }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetch_(); const t = setInterval(fetch_, 60000); return () => clearInterval(t); }, [fetch_]);

  if (loading) return null;
  if (alerts.length === 0) return null; // Don't show if no alerts

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>🚨 Alerts</h2>
        <span style={styles.badge}>{alerts.length}</span>
      </div>
      {alerts.slice(0, 5).map((a) => (
        <div key={a.id} style={{ ...styles.alertCard, borderLeftColor: a.type === "critical" ? "#ef4444" : "#f59e0b" }}>
          <span style={styles.alertIcon}>{a.icon}</span>
          <div style={styles.alertBody}>
            <div style={styles.alertTitle}>{a.title}</div>
            <div style={styles.alertMsg}>{a.message}</div>
          </div>
          <span style={styles.alertType}>
            {a.type === "critical" ? "🔴" : "🟡"}
          </span>
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    borderRadius: 14, padding: 16, marginBottom: 20,
    background: "rgba(239,68,68,0.08)",
    border: "1px solid rgba(239,68,68,0.25)",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  title: { fontSize: 15, fontWeight: 700, margin: 0, color: "#fca5a5" },
  badge: {
    fontSize: 11, fontWeight: 700, background: "#ef4444", color: "#fff",
    padding: "2px 8px", borderRadius: 10,
  },
  alertCard: {
    display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
    borderRadius: 8, marginBottom: 6,
    background: "var(--th-card-bg, rgba(16,16,42,0.65))",
    borderLeft: "3px solid #f59e0b",
  },
  alertIcon: { fontSize: 18 },
  alertBody: { flex: 1 },
  alertTitle: { fontSize: 12, fontWeight: 700, color: "var(--th-text-heading, #f1f5f9)" },
  alertMsg: { fontSize: 11, color: "var(--th-text-muted, #64748b)" },
  alertType: { fontSize: 12 },
};
