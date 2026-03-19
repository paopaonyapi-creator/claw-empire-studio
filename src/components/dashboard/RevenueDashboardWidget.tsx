import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../app/AuthProvider";

interface ChartDataPoint { date: string; label: string; revenue: number; orders: number; }
interface PlatformData { platform: string; total: number; orders: number; }
interface RevenueSummary { totalRevenue: number; totalOrders: number; avgDaily: number; bestDay: string; bestDayRevenue: number; }

export function RevenueDashboardWidget() {
  const { token } = useAuth();
  const [period, setPeriod] = useState("7d");
  const [chart, setChart] = useState<ChartDataPoint[]>([]);
  const [platforms, setPlatforms] = useState<PlatformData[]>([]);
  const [summary, setSummary] = useState<RevenueSummary>({ totalRevenue: 0, totalOrders: 0, avgDaily: 0, bestDay: "", bestDayRevenue: 0 });

  const loadChart = useCallback(async () => {
    try {
      const res = await fetch(`/api/revenue/chart?period=${period}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.ok) {
        setChart(data.chart || []);
        setPlatforms(data.platforms || []);
        setSummary(data.summary || {});
      }
    } catch {}
  }, [token, period]);

  useEffect(() => { loadChart(); }, [loadChart]);

  const maxRevenue = Math.max(...chart.map(d => d.revenue), 1);

  const platformColors = ["#6366f1", "#ec4899", "#f59e0b", "#16a34a", "#3b82f6"];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.iconBox}>📊</div>
        <h3 style={styles.title}>Revenue Dashboard</h3>
        <div style={{ flex: 1 }} />
        {["7d", "30d", "90d"].map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            style={{ ...styles.periodBtn, ...(period === p ? styles.periodActive : {}) }}>
            {p}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <div style={styles.summaryValue}>฿{summary.totalRevenue.toLocaleString()}</div>
          <div style={styles.summaryLabel}>Total Revenue</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryValue}>{summary.totalOrders}</div>
          <div style={styles.summaryLabel}>Orders</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryValue}>฿{summary.avgDaily.toLocaleString()}</div>
          <div style={styles.summaryLabel}>Avg/Day</div>
        </div>
      </div>

      {/* Bar Chart */}
      <div style={styles.chartArea}>
        <div style={styles.chartBars}>
          {chart.map((d, i) => (
            <div key={i} style={styles.barCol} title={`${d.label}: ฿${d.revenue.toLocaleString()}`}>
              <div style={{ ...styles.bar, height: `${Math.max(2, (d.revenue / maxRevenue) * 100)}%`, background: d.revenue > 0 ? "linear-gradient(180deg, #818cf8, #6366f1)" : "#e2e8f0" }} />
              {chart.length <= 14 && <div style={styles.barLabel}>{d.label}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Platform Breakdown */}
      {platforms.length > 0 && (
        <div style={styles.platformSection}>
          <div style={styles.platformTitle}>📱 Platform Breakdown</div>
          {platforms.map((p, i) => (
            <div key={p.platform} style={styles.platformRow}>
              <div style={{ ...styles.platformDot, background: platformColors[i % 5] }} />
              <span style={styles.platformName}>{p.platform}</span>
              <span style={styles.platformVal}>฿{p.total.toLocaleString()} ({p.orders} orders)</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 4px 15px rgba(0,0,0,0.03)", border: "1px solid #f1f5f9", marginBottom: 24 },
  header: { display: "flex", alignItems: "center", gap: 10, marginBottom: 14 },
  iconBox: { fontSize: 22, background: "#eef2ff", width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10 },
  title: { margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" },
  periodBtn: { padding: "4px 10px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#f8fafc", fontSize: 11, fontWeight: 600, cursor: "pointer", color: "#64748b" },
  periodActive: { background: "#6366f1", color: "#fff", borderColor: "#6366f1" },
  summaryGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 },
  summaryCard: { background: "#fafbfc", borderRadius: 10, padding: "12px 10px", textAlign: "center", border: "1px solid #f1f5f9" },
  summaryValue: { fontSize: 18, fontWeight: 800, color: "#1e293b" },
  summaryLabel: { fontSize: 10, color: "#94a3b8", marginTop: 2 },
  chartArea: { marginBottom: 14 },
  chartBars: { display: "flex", alignItems: "flex-end", gap: 2, height: 120, padding: "0 4px" },
  barCol: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%" , justifyContent: "flex-end" },
  bar: { width: "100%", borderRadius: "3px 3px 0 0", minHeight: 2, transition: "height 0.5s ease" },
  barLabel: { fontSize: 8, color: "#94a3b8", marginTop: 4, whiteSpace: "nowrap" },
  platformSection: { paddingTop: 10, borderTop: "1px solid #f1f5f9" },
  platformTitle: { fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 8 },
  platformRow: { display: "flex", alignItems: "center", gap: 8, padding: "3px 0" },
  platformDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  platformName: { fontSize: 12, color: "#475569", flex: 1 },
  platformVal: { fontSize: 12, color: "#64748b", fontWeight: 600 },
};
