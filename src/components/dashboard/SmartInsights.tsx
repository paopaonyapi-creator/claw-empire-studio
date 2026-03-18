/**
 * SmartInsights — AI-powered insight cards with priority ranking
 */

import { useState, useEffect, useCallback } from "react";

interface InsightCard {
  id: string;
  type: "tip" | "warning" | "trend" | "achievement";
  icon: string;
  title: string;
  message: string;
  metric?: string;
  priority: number;
}

const TYPE_STYLES: Record<string, { bg: string; border: string; accent: string }> = {
  achievement: { bg: "#f0fdf4", border: "#86efac", accent: "#166534" },
  trend: { bg: "#eff6ff", border: "#93c5fd", accent: "#1e40af" },
  tip: { bg: "#fefce8", border: "#fde047", accent: "#854d0e" },
  warning: { bg: "#fef2f2", border: "#fca5a5", accent: "#991b1b" },
};

export function SmartInsights() {
  const [insights, setInsights] = useState<InsightCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetchInsights = useCallback(async () => {
    try {
      const res = await fetch("/api/insights");
      if (res.ok) {
        const json = await res.json();
        setInsights(json.insights || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchInsights();
    const t = setInterval(fetchInsights, 120000); // refresh every 2 min
    return () => clearInterval(t);
  }, [fetchInsights]);

  const displayed = expanded ? insights : insights.slice(0, 4);

  return (
    <div className="insights-widget" style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>🧠 Smart Insights</h2>
        <span style={styles.count}>{insights.length} insights</span>
      </div>

      {loading ? (
        <div style={styles.loading}>⏳ Analyzing...</div>
      ) : insights.length === 0 ? (
        <div style={styles.empty}>📭 ยังไม่มีข้อมูลเพียงพอ — เริ่มสร้าง content แล้ว insights จะมาเอง!</div>
      ) : (
        <>
          <div style={styles.cardGrid}>
            {displayed.map((insight) => {
              const style = TYPE_STYLES[insight.type] || TYPE_STYLES.tip;
              return (
                <div
                  key={insight.id}
                  className={`insight-card-${insight.type}`}
                  style={{
                    ...styles.card,
                    background: style.bg,
                    borderLeft: `3px solid ${style.border}`,
                  }}
                >
                  <div style={styles.cardHeader}>
                    <span style={styles.cardIcon}>{insight.icon}</span>
                    <span style={{ ...styles.cardTitle, color: style.accent }}>{insight.title}</span>
                    {insight.metric && (
                      <span style={{ ...styles.metric, color: style.accent }}>{insight.metric}</span>
                    )}
                  </div>
                  <div style={{ ...styles.cardMessage, color: style.accent }}>
                    {insight.message}
                  </div>
                </div>
              );
            })}
          </div>

          {insights.length > 4 && (
            <button
              onClick={() => setExpanded(!expanded)}
              style={styles.toggleBtn}
            >
              {expanded ? "▲ Show Less" : `▼ Show All (${insights.length})`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: "linear-gradient(135deg, #eef2ff 0%, #f0f9ff 100%)",
    borderRadius: 14, padding: 20,
    boxShadow: "0 2px 12px rgba(99,102,241,0.08)", marginBottom: 20,
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  title: { fontSize: 16, fontWeight: 700, margin: 0, color: "#312e81" },
  count: { fontSize: 11, color: "#6366f1", fontWeight: 500, background: "#e0e7ff", padding: "2px 8px", borderRadius: 10 },
  loading: { textAlign: "center" as const, padding: 30, color: "#6366f1" },
  empty: { textAlign: "center" as const, padding: 30, color: "#6366f1", fontSize: 13 },
  cardGrid: { display: "flex", flexDirection: "column" as const, gap: 8 },
  card: {
    padding: "10px 14px", borderRadius: 10,
    transition: "transform 0.15s, box-shadow 0.15s",
  },
  cardHeader: { display: "flex", alignItems: "center", gap: 6, marginBottom: 4 },
  cardIcon: { fontSize: 16 },
  cardTitle: { fontSize: 13, fontWeight: 700, flex: 1 },
  metric: { fontSize: 11, fontWeight: 700, background: "rgba(255,255,255,0.5)", padding: "1px 6px", borderRadius: 4 },
  cardMessage: { fontSize: 12, lineHeight: 1.5, opacity: 0.85 },
  toggleBtn: {
    display: "block", width: "100%", marginTop: 10, padding: "6px 0",
    background: "none", border: "none", color: "#6366f1", fontSize: 12,
    fontWeight: 600, cursor: "pointer", textAlign: "center" as const,
  },
};
