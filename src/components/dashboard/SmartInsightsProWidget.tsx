import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../app/AuthProvider";

interface Insight {
  id: string;
  type: "trend" | "alert" | "recommendation" | "achievement";
  icon: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
}

const TYPE_COLORS: Record<string, { bg: string; border: string; accent: string }> = {
  trend: { bg: "#eef2ff", border: "#c7d2fe", accent: "#6366f1" },
  alert: { bg: "#fef2f2", border: "#fecaca", accent: "#ef4444" },
  recommendation: { bg: "#ecfdf5", border: "#a7f3d0", accent: "#10b981" },
  achievement: { bg: "#fefce8", border: "#fde68a", accent: "#f59e0b" },
};

const TYPE_LABELS: Record<string, string> = {
  trend: "Trend", alert: "Alert", recommendation: "Tip", achievement: "Achievement",
};

export function SmartInsightsProWidget() {
  const { token } = useAuth();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [filter, setFilter] = useState<string>("all");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/smart-insights", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.ok) setInsights(data.insights || []);
    } catch {}
  }, [token]);

  useEffect(() => { load(); const iv = setInterval(load, 120_000); return () => clearInterval(iv); }, [load]);

  const filtered = filter === "all" ? insights : insights.filter(i => i.type === filter);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.iconBox}>🧠</div>
        <h3 style={styles.title}>Smart Insights Pro</h3>
        <span style={styles.badge}>{insights.length} insights</span>
      </div>

      {/* Filter Pills */}
      <div style={styles.filters}>
        {["all", "alert", "trend", "recommendation", "achievement"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ ...styles.filterBtn, ...(filter === f ? styles.filterActive : {}) }}>
            {f === "all" ? "📊 All" : `${f === "alert" ? "🚨" : f === "trend" ? "📈" : f === "recommendation" ? "💡" : "🏆"} ${TYPE_LABELS[f] || f}`}
          </button>
        ))}
      </div>

      {/* Insights List */}
      <div style={styles.list}>
        {filtered.length === 0 ? (
          <div style={styles.empty}>📊 ไม่มี insight ในหมวดนี้</div>
        ) : (
          filtered.map(insight => {
            const colors = TYPE_COLORS[insight.type] || TYPE_COLORS.recommendation;
            return (
              <div key={insight.id} style={{ ...styles.insightCard, background: colors.bg, borderColor: colors.border }}>
                <div style={styles.insightHeader}>
                  <span style={styles.insightIcon}>{insight.icon}</span>
                  <span style={styles.insightTitle}>{insight.title}</span>
                  <span style={{ ...styles.priorityDot, background: insight.priority === "high" ? "#ef4444" : insight.priority === "medium" ? "#f59e0b" : "#94a3b8" }} />
                </div>
                <div style={styles.insightDesc}>{insight.description}</div>
                <span style={{ ...styles.typePill, background: colors.accent }}>
                  {TYPE_LABELS[insight.type] || insight.type}
                </span>
              </div>
            );
          })
        )}
      </div>

      <button onClick={load} style={styles.refreshBtn}>🔄 Refresh Insights</button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 4px 15px rgba(0,0,0,0.03)", border: "1px solid #f1f5f9", marginBottom: 24 },
  header: { display: "flex", alignItems: "center", gap: 10, marginBottom: 14 },
  iconBox: { fontSize: 22, background: "#fef3c7", width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10 },
  title: { margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b", flex: 1 },
  badge: { fontSize: 11, fontWeight: 600, background: "#6366f1", color: "#fff", padding: "3px 8px", borderRadius: 10 },
  filters: { display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" },
  filterBtn: { padding: "4px 10px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#f8fafc", fontSize: 11, fontWeight: 600, cursor: "pointer", color: "#64748b" },
  filterActive: { background: "#6366f1", color: "#fff", borderColor: "#6366f1" },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  empty: { textAlign: "center", padding: 20, color: "#94a3b8", fontSize: 13 },
  insightCard: { padding: "12px 14px", borderRadius: 12, border: "1px solid", position: "relative" },
  insightHeader: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4 },
  insightIcon: { fontSize: 18 },
  insightTitle: { fontSize: 14, fontWeight: 700, color: "#1e293b", flex: 1 },
  priorityDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  insightDesc: { fontSize: 12, color: "#475569", lineHeight: "1.5", marginLeft: 26 },
  typePill: { position: "absolute", top: 10, right: 10, fontSize: 9, padding: "2px 6px", borderRadius: 4, color: "#fff", fontWeight: 700, textTransform: "uppercase" },
  refreshBtn: { width: "100%", marginTop: 10, padding: "8px 0", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#475569" },
};
