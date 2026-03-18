/**
 * DataExportWidget — Export buttons + analytics mini-dashboard
 */
import { useState, useEffect, useCallback } from "react";

interface Analytics {
  overview: { totalRevenue: number; totalOrders: number; totalTasks: number; tasksDone: number; totalLinks: number; totalClicks: number };
  revenueByPlatform: Record<string, number>;
  topProducts: Array<{ name: string; revenue: number; orders: number }>;
  platformPerformance: Array<{ platform: string; revenue: number; clicks: number; roi: string }>;
}

const EXPORT_TYPES = [
  { key: "revenue", label: "💰 Revenue", icon: "💰" },
  { key: "tasks", label: "📋 Tasks", icon: "📋" },
  { key: "calendar", label: "📅 Calendar", icon: "📅" },
  { key: "links", label: "🔗 Links", icon: "🔗" },
];

export function DataExportWidget() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch("/api/analytics");
      if (res.ok) setAnalytics(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  const downloadCsv = (type: string) => {
    window.open(`/api/export/${type}`, "_blank");
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>📤 Data Export & Analytics</h2>
      </div>

      {/* Export Buttons */}
      <div style={styles.exportRow}>
        {EXPORT_TYPES.map((t) => (
          <button key={t.key} style={styles.exportBtn} onClick={() => downloadCsv(t.key)}>
            {t.icon} {t.label} CSV
          </button>
        ))}
        <button style={{ ...styles.exportBtn, ...styles.reportBtn }} onClick={() => window.open("/api/report/pdf", "_blank")}>
          📄 PDF Report
        </button>
      </div>

      {/* Analytics Summary */}
      {!loading && analytics && (
        <div style={styles.analyticsGrid}>
          <div style={styles.statCard}>
            <div style={{ ...styles.statVal, color: "#f59e0b" }}>฿{analytics.overview.totalRevenue.toLocaleString()}</div>
            <div style={styles.statLabel}>Total Revenue</div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statVal, color: "#10b981" }}>{analytics.overview.totalOrders}</div>
            <div style={styles.statLabel}>Orders</div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statVal, color: "#6366f1" }}>{analytics.overview.tasksDone}/{analytics.overview.totalTasks}</div>
            <div style={styles.statLabel}>Tasks Done</div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statVal, color: "#3b82f6" }}>{analytics.overview.totalClicks}</div>
            <div style={styles.statLabel}>Clicks</div>
          </div>
        </div>
      )}

      {/* Platform Performance */}
      {analytics && analytics.platformPerformance.length > 0 && (
        <div style={styles.platformTable}>
          <div style={styles.tableHeader}>
            <span style={styles.thPlat}>Platform</span>
            <span style={styles.th}>Revenue</span>
            <span style={styles.th}>Clicks</span>
            <span style={styles.th}>ROI</span>
          </div>
          {analytics.platformPerformance.map((p) => (
            <div key={p.platform} style={styles.tableRow}>
              <span style={styles.tdPlat}>{p.platform}</span>
              <span style={styles.td}>฿{p.revenue.toLocaleString()}</span>
              <span style={styles.td}>{p.clicks}</span>
              <span style={{ ...styles.td, color: "#10b981" }}>{p.roi}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    borderRadius: 14, padding: 20, marginBottom: 20,
    background: "var(--th-card-bg, rgba(16,16,42,0.65))",
    border: "1px solid var(--th-card-border, rgba(50,50,95,0.35))",
  },
  header: { marginBottom: 14 },
  title: { fontSize: 16, fontWeight: 700, margin: 0, color: "var(--th-text-heading, #f1f5f9)" },
  exportRow: { display: "flex", gap: 8, flexWrap: "wrap" as const, marginBottom: 16 },
  exportBtn: {
    padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600,
    border: "1px solid var(--th-border, rgba(50,50,95,0.45))",
    background: "var(--th-bg-surface, rgba(22,22,48,0.75))",
    color: "var(--th-text-primary, #e2e8f0)", cursor: "pointer",
  },
  reportBtn: {
    background: "rgba(99,102,241,0.15)", borderColor: "rgba(99,102,241,0.4)", color: "#a5b4fc",
  },
  analyticsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 14 },
  statCard: {
    padding: 12, borderRadius: 10, textAlign: "center" as const,
    background: "var(--th-bg-surface, rgba(22,22,48,0.75))",
  },
  statVal: { fontSize: 18, fontWeight: 800 },
  statLabel: { fontSize: 9, color: "var(--th-text-muted, #64748b)", textTransform: "uppercase" as const, marginTop: 2 },
  platformTable: { marginTop: 8 },
  tableHeader: {
    display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 4,
    padding: "6px 8px", fontSize: 10, fontWeight: 700,
    color: "var(--th-text-muted, #64748b)", borderBottom: "1px solid var(--th-border, rgba(50,50,95,0.45))",
  },
  thPlat: { textAlign: "left" as const },
  th: { textAlign: "right" as const },
  tableRow: {
    display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 4,
    padding: "5px 8px", fontSize: 12,
    borderBottom: "1px solid var(--th-border, rgba(50,50,95,0.2))",
  },
  tdPlat: { fontWeight: 600, color: "var(--th-text-primary, #e2e8f0)" },
  td: { textAlign: "right" as const, color: "var(--th-text-secondary, #94a3b8)" },
};
