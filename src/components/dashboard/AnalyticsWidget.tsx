import React, { useState, useEffect, useRef } from "react";

interface DayData {
  date: string;
  revenue: number;
  clicks: number;
}

export function AnalyticsWidget() {
  const [data, setData] = useState<DayData[]>([]);
  const [summary, setSummary] = useState<{ todayRevenue: number; weekRevenue: number; monthRevenue: number; todayClicks: number; weekClicks: number }>({ todayRevenue: 0, weekRevenue: 0, monthRevenue: 0, todayClicks: 0, weekClicks: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/revenue").then(r => r.json()).catch(() => null),
      fetch("/api/analytics").then(r => r.json()).catch(() => null),
    ]).then(([revData, analyticsData]) => {
      const days: DayData[] = [];
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        days.push({ date: dateStr, revenue: 0, clicks: 0 });
      }

      if (revData?.entries) {
        for (const e of revData.entries) {
          const eDate = (e.timestamp || e.date || "").split("T")[0];
          const day = days.find(d => d.date === eDate);
          if (day) day.revenue += e.amount || 0;
        }
      }
      if (analyticsData?.dailyViews) {
        for (const [date, views] of Object.entries(analyticsData.dailyViews)) {
          const day = days.find(d => d.date === date);
          if (day) day.clicks = views as number;
        }
      }

      setData(days);
      setSummary({
        todayRevenue: revData?.summary?.today?.total || 0,
        weekRevenue: revData?.summary?.week?.total || 0,
        monthRevenue: revData?.summary?.month?.total || 0,
        todayClicks: analyticsData?.totalViews || 0,
        weekClicks: days.reduce((s, d) => s + d.clicks, 0),
      });
    });
  }, []);

  // Draw chart on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width = canvas.offsetWidth * 2;
    const h = canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);
    const cw = canvas.offsetWidth;
    const ch = canvas.offsetHeight;

    ctx.clearRect(0, 0, cw, ch);

    const maxRev = Math.max(...data.map(d => d.revenue), 1);
    const padding = { top: 20, right: 16, bottom: 30, left: 50 };
    const chartW = cw - padding.left - padding.right;
    const chartH = ch - padding.top - padding.bottom;

    // Grid lines
    ctx.strokeStyle = "#f1f5f9";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartH / 4) * i;
      ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(cw - padding.right, y); ctx.stroke();
    }

    // Y-axis labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px Inter, sans-serif";
    ctx.textAlign = "right";
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartH / 4) * i;
      const val = Math.round(maxRev * (1 - i / 4));
      ctx.fillText(`฿${val.toLocaleString()}`, padding.left - 6, y + 4);
    }

    // X-axis labels
    ctx.textAlign = "center";
    data.forEach((d, i) => {
      const x = padding.left + (chartW / (data.length - 1)) * i;
      ctx.fillText(d.date.slice(5), x, ch - 8);
    });

    // Revenue line (gradient fill below)
    const gradient = ctx.createLinearGradient(0, padding.top, 0, ch - padding.bottom);
    gradient.addColorStop(0, "rgba(99, 102, 241, 0.3)");
    gradient.addColorStop(1, "rgba(99, 102, 241, 0)");

    ctx.beginPath();
    data.forEach((d, i) => {
      const x = padding.left + (chartW / (data.length - 1)) * i;
      const y = padding.top + chartH * (1 - d.revenue / maxRev);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    // Fill area
    const lastX = padding.left + chartW;
    ctx.lineTo(lastX, ch - padding.bottom);
    ctx.lineTo(padding.left, ch - padding.bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Revenue line on top
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = padding.left + (chartW / (data.length - 1)) * i;
      const y = padding.top + chartH * (1 - d.revenue / maxRev);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "#6366f1";
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.stroke();

    // Dots
    data.forEach((d, i) => {
      const x = padding.left + (chartW / (data.length - 1)) * i;
      const y = padding.top + chartH * (1 - d.revenue / maxRev);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#6366f1";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }, [data]);

  const weekGrowth = data.length >= 7 ? (
    data.slice(4).reduce((s, d) => s + d.revenue, 0) - data.slice(0, 3).reduce((s, d) => s + d.revenue, 0)
  ) : 0;
  const growthPct = summary.weekRevenue > 0 ? ((weekGrowth / Math.max(summary.weekRevenue, 1)) * 100).toFixed(0) : "0";
  const conversionRate = summary.todayClicks > 0 ? ((summary.todayRevenue / summary.todayClicks) * 100).toFixed(1) : "0";

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.icon}>📊</div>
        <h3 style={styles.title}>Dashboard Analytics</h3>
      </div>

      {/* KPI Cards */}
      <div style={styles.kpiRow}>
        <div style={{ ...styles.kpiCard, borderLeft: "4px solid #6366f1" }}>
          <div style={styles.kpiValue}>฿{summary.todayRevenue.toLocaleString()}</div>
          <div style={styles.kpiLabel}>วันนี้</div>
        </div>
        <div style={{ ...styles.kpiCard, borderLeft: "4px solid #8b5cf6" }}>
          <div style={styles.kpiValue}>฿{summary.weekRevenue.toLocaleString()}</div>
          <div style={styles.kpiLabel}>7 วัน</div>
        </div>
        <div style={{ ...styles.kpiCard, borderLeft: "4px solid #a855f7" }}>
          <div style={styles.kpiValue}>฿{summary.monthRevenue.toLocaleString()}</div>
          <div style={styles.kpiLabel}>เดือนนี้</div>
        </div>
      </div>

      {/* Revenue Chart */}
      <div style={styles.chartContainer}>
        <div style={styles.chartLabel}>💰 Revenue (7 วัน)</div>
        <canvas ref={canvasRef} style={{ width: "100%", height: 180 }} />
      </div>

      {/* Funnel & Growth */}
      <div style={styles.metricsRow}>
        <div style={styles.metricCard}>
          <div style={styles.metricIcon}>🎯</div>
          <div style={styles.metricValue}>{conversionRate}%</div>
          <div style={styles.metricLabel}>Conversion Rate</div>
          <div style={styles.metricSub}>{summary.todayClicks} clicks → ฿{summary.todayRevenue.toLocaleString()}</div>
        </div>
        <div style={styles.metricCard}>
          <div style={styles.metricIcon}>{Number(growthPct) >= 0 ? "📈" : "📉"}</div>
          <div style={{ ...styles.metricValue, color: Number(growthPct) >= 0 ? "#16a34a" : "#dc2626" }}>
            {Number(growthPct) >= 0 ? "+" : ""}{growthPct}%
          </div>
          <div style={styles.metricLabel}>Weekly Growth</div>
          <div style={styles.metricSub}>{weekGrowth >= 0 ? "+" : ""}฿{weekGrowth.toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 4px 15px rgba(0,0,0,0.03)", border: "1px solid #f1f5f9", marginBottom: 24 },
  header: { display: "flex", alignItems: "center", gap: 12, marginBottom: 16 },
  icon: { fontSize: 24, background: "#eef2ff", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12 },
  title: { margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" },
  kpiRow: { display: "flex", gap: 10, marginBottom: 16 },
  kpiCard: { flex: 1, background: "#fafbfc", padding: "14px 16px", borderRadius: 10 },
  kpiValue: { fontSize: 20, fontWeight: 800, color: "#1e293b" },
  kpiLabel: { fontSize: 12, color: "#64748b", marginTop: 2 },
  chartContainer: { marginBottom: 16, background: "#fafbfc", borderRadius: 12, padding: 16 },
  chartLabel: { fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 10 },
  metricsRow: { display: "flex", gap: 10 },
  metricCard: { flex: 1, background: "#fafbfc", padding: 16, borderRadius: 12, textAlign: "center" },
  metricIcon: { fontSize: 28, marginBottom: 6 },
  metricValue: { fontSize: 24, fontWeight: 800, color: "#1e293b" },
  metricLabel: { fontSize: 12, fontWeight: 600, color: "#64748b", marginTop: 2 },
  metricSub: { fontSize: 11, color: "#94a3b8", marginTop: 4 },
};
