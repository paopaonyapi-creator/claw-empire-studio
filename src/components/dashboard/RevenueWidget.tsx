/**
 * RevenueWidget — Dashboard revenue summary with daily/weekly/monthly tabs
 */

import { useState, useEffect, useCallback } from "react";

interface RevenueSummary {
  total: number;
  commission: number;
  count: number;
  byPlatform: Record<string, { total: number; count: number }>;
  topProducts: Array<{ name: string; total: number; count: number }>;
}

type Period = "today" | "week" | "month";

const PLATFORM_ICONS: Record<string, string> = {
  shopee: "🟠",
  lazada: "🔵",
  tiktok: "🎵",
  other: "📦",
};

export function RevenueWidget() {
  const [data, setData] = useState<{ today: RevenueSummary; week: RevenueSummary; month: RevenueSummary } | null>(null);
  const [period, setPeriod] = useState<Period>("today");
  const [loading, setLoading] = useState(true);

  const fetchRevenue = useCallback(async () => {
    try {
      const res = await fetch("/api/revenue");
      if (res.ok) {
        const json = await res.json();
        setData(json.summary);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRevenue();
    const t = setInterval(fetchRevenue, 60000);
    return () => clearInterval(t);
  }, [fetchRevenue]);

  const summary = data?.[period] || { total: 0, commission: 0, count: 0, byPlatform: {}, topProducts: [] };

  return (
    <div className="revenue-widget" style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>💰 Revenue Tracker</h2>
        <div style={styles.tabs}>
          {(["today", "week", "month"] as Period[]).map((p) => (
            <button
              key={p}
              className={`revenue-tab ${period === p ? 'revenue-tab-active' : ''}`}
              onClick={() => setPeriod(p)}
              style={{ ...styles.tab, ...(period === p ? styles.tabActive : {}) }}
            >
              {p === "today" ? "วันนี้" : p === "week" ? "7 วัน" : "เดือน"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={styles.loading}>⏳ Loading...</div>
      ) : (
        <>
          {/* Big Numbers */}
          <div className="revenue-big-numbers" style={styles.bigNumbers}>
            <div className="revenue-big-card" style={styles.bigCard}>
              <div style={styles.bigValue}>฿{summary.total.toLocaleString()}</div>
              <div style={styles.bigLabel}>Revenue</div>
            </div>
            <div style={styles.bigCard}>
              <div style={{ ...styles.bigValue, color: "#10b981" }}>฿{summary.commission.toLocaleString()}</div>
              <div style={styles.bigLabel}>Commission</div>
            </div>
            <div style={styles.bigCard}>
              <div style={{ ...styles.bigValue, color: "#6366f1" }}>{summary.count}</div>
              <div style={styles.bigLabel}>Orders</div>
            </div>
          </div>

          {/* Platform Breakdown */}
          {Object.keys(summary.byPlatform).length > 0 && (
            <div style={styles.platforms}>
              {Object.entries(summary.byPlatform).map(([plat, data]) => (
                <div key={plat} style={styles.platformRow}>
                  <span>{PLATFORM_ICONS[plat] || "📦"} {plat}</span>
                  <span style={styles.platformAmount}>฿{data.total.toLocaleString()} ({data.count})</span>
                </div>
              ))}
            </div>
          )}

          {/* Top Products */}
          {summary.topProducts.length > 0 && (
            <div style={styles.topProducts}>
              <div style={styles.sectionLabel}>🏆 Top Products</div>
              {summary.topProducts.slice(0, 3).map((p, i) => (
                <div key={p.name} style={styles.productRow}>
                  <span style={styles.rank}>#{i + 1}</span>
                  <span style={styles.productName}>{p.name}</span>
                  <span style={styles.productAmount}>฿{p.total.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          {summary.count === 0 && (
            <div style={styles.empty}>📭 ยังไม่มีรายได้ — ใช้ /revenue add &lt;จำนวน&gt; &lt;สินค้า&gt;</div>
          )}
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: "linear-gradient(135deg, #fef3c7 0%, #fff7ed 100%)",
    borderRadius: 14, padding: 20,
    boxShadow: "0 2px 12px rgba(245,158,11,0.1)", marginBottom: 20,
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 16, fontWeight: 700, margin: 0, color: "#92400e" },
  tabs: { display: "flex", gap: 4 },
  tab: {
    padding: "4px 10px", fontSize: 11, border: "1px solid #fbbf24", borderRadius: 6,
    background: "#fff", cursor: "pointer", color: "#92400e", fontWeight: 500,
  },
  tabActive: { background: "#f59e0b", color: "#fff", borderColor: "#f59e0b" },
  loading: { textAlign: "center" as const, padding: 20, color: "#92400e" },
  bigNumbers: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 },
  bigCard: { background: "#fff", borderRadius: 10, padding: 12, textAlign: "center" as const },
  bigValue: { fontSize: 20, fontWeight: 800, color: "#d97706" },
  bigLabel: { fontSize: 10, color: "#a16207", marginTop: 2, textTransform: "uppercase" as const },
  platforms: { marginBottom: 12 },
  platformRow: {
    display: "flex", justifyContent: "space-between", padding: "4px 8px",
    fontSize: 12, color: "#78350f", borderBottom: "1px solid rgba(245,158,11,0.15)",
  },
  platformAmount: { fontWeight: 600 },
  topProducts: { marginTop: 8 },
  sectionLabel: { fontSize: 12, fontWeight: 600, color: "#92400e", marginBottom: 6 },
  productRow: { display: "flex", gap: 8, alignItems: "center", padding: "3px 0", fontSize: 12 },
  rank: { color: "#f59e0b", fontWeight: 700, width: 24 },
  productName: { flex: 1, color: "#78350f", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
  productAmount: { fontWeight: 700, color: "#d97706" },
  empty: { textAlign: "center" as const, padding: 20, color: "#a16207", fontSize: 12 },
};
