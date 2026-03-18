/**
 * ApiHealthWidget — Real-time API status panel 🟢🟡🔴
 */
import { useState, useEffect, useCallback } from "react";

interface ApiStatus {
  name: string; icon: string;
  status: "up" | "down" | "degraded" | "unconfigured";
  latency: number; uptime: number; lastCheck: string; lastError?: string;
  checksTotal: number;
}

interface HealthData {
  overall: string; upCount: number; total: number;
  apis: Record<string, ApiStatus>;
}

export function ApiHealthWidget() {
  const [data, setData] = useState<HealthData | null>(null);

  const fetch_ = useCallback(async () => {
    try {
      const r = await fetch("/api/health");
      if (r.ok) setData(await r.json());
    } catch {}
  }, []);

  useEffect(() => { fetch_(); const t = setInterval(fetch_, 60000); return () => clearInterval(t); }, [fetch_]);

  if (!data) return null;

  const apis = Object.values(data.apis);
  const statusDot = (s: string) => s === "up" ? "🟢" : s === "degraded" ? "🟡" : s === "unconfigured" ? "⚪" : "🔴";
  const overallColor = data.overall === "healthy" ? "#10b981" : data.overall === "degraded" ? "#f59e0b" : "#ef4444";

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>🏥 API Health</h2>
        <span style={{ ...styles.badge, background: `${overallColor}22`, color: overallColor }}>
          {data.upCount}/{data.total} Operational
        </span>
      </div>

      <div style={styles.grid}>
        {apis.map((api) => (
          <div key={api.name} style={{
            ...styles.card,
            borderColor: api.status === "up" ? "rgba(16,185,129,0.3)"
              : api.status === "degraded" ? "rgba(245,158,11,0.3)"
              : api.status === "unconfigured" ? "rgba(100,116,139,0.2)"
              : "rgba(239,68,68,0.3)",
          }}>
            <div style={styles.cardTop}>
              <span style={{ fontSize: 14 }}>{statusDot(api.status)}</span>
              <span style={styles.cardIcon}>{api.icon}</span>
              <span style={styles.cardName}>{api.name}</span>
            </div>
            {api.status === "unconfigured" ? (
              <div style={styles.unconfigured}>Not configured</div>
            ) : (
              <div style={styles.cardStats}>
                <span style={styles.latency}>{api.latency}ms</span>
                <span style={styles.uptime}>
                  <span style={{ ...styles.uptimeBar }}>
                    <span style={{ ...styles.uptimeFill, width: `${api.uptime}%`,
                      background: api.uptime >= 95 ? "#10b981" : api.uptime >= 70 ? "#f59e0b" : "#ef4444",
                    }} />
                  </span>
                  {api.uptime}%
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={styles.footer}>
        Last check: {data.apis[apis[0]?.name]?.lastCheck
          ? new Date(apis[0].lastCheck).toLocaleTimeString("th-TH")
          : "—"}
        <button style={styles.refreshBtn} onClick={fetch_}>🔄</button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    borderRadius: 14, padding: 16, marginBottom: 20,
    background: "var(--th-card-bg, rgba(16,16,42,0.65))",
    border: "1px solid var(--th-card-border, rgba(50,50,95,0.35))",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { fontSize: 16, fontWeight: 700, margin: 0, color: "var(--th-text-heading, #f1f5f9)" },
  badge: { fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 12 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 },
  card: {
    padding: "10px 12px", borderRadius: 10,
    background: "var(--th-bg-surface, rgba(22,22,48,0.75))",
    border: "1px solid", transition: "all 0.2s",
  },
  cardTop: { display: "flex", alignItems: "center", gap: 5, marginBottom: 6 },
  cardIcon: { fontSize: 13 },
  cardName: { fontSize: 11, fontWeight: 600, color: "var(--th-text-primary, #e2e8f0)" },
  cardStats: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  latency: { fontSize: 11, fontWeight: 700, color: "var(--th-text-muted, #64748b)", fontFamily: "monospace" },
  uptime: { display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--th-text-muted, #64748b)" },
  uptimeBar: { width: 32, height: 4, borderRadius: 2, background: "rgba(50,50,95,0.5)", overflow: "hidden", display: "inline-block" },
  uptimeFill: { height: "100%", borderRadius: 2, display: "block" },
  unconfigured: { fontSize: 10, color: "var(--th-text-muted, #64748b)", fontStyle: "italic" as const },
  footer: {
    marginTop: 10, fontSize: 10, color: "var(--th-text-muted, #64748b)",
    display: "flex", justifyContent: "space-between", alignItems: "center",
  },
  refreshBtn: {
    background: "none", border: "1px solid var(--th-border, rgba(50,50,95,0.45))",
    borderRadius: 6, padding: "2px 8px", fontSize: 11, cursor: "pointer",
    color: "var(--th-text-muted, #64748b)",
  },
};
