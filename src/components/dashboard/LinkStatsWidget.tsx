/**
 * LinkStatsWidget — Affiliate link performance card for Dashboard
 */

import { useState, useEffect, useCallback } from "react";

interface LinkItem {
  label: string;
  shortUrl: string;
  clicks: number;
  shortCode: string;
}

interface LinkData {
  total: number;
  totalClicks: number;
  links: LinkItem[];
}

export function LinkStatsWidget() {
  const [data, setData] = useState<LinkData | null>(null);

  const fetchLinks = useCallback(async () => {
    try {
      const res = await fetch("/api/links");
      if (res.ok) setData(await res.json() as LinkData);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchLinks(); const t = setInterval(fetchLinks, 60000); return () => clearInterval(t); }, [fetchLinks]);

  if (!data) return null;

  const top3 = [...(data.links || [])].sort((a, b) => b.clicks - a.clicks).slice(0, 3);
  const maxClicks = Math.max(...top3.map(l => l.clicks), 1);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>📎 Affiliate Links</h3>
        <span style={styles.badge}>{data.total} links</span>
      </div>

      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{data.totalClicks}</div>
          <div style={styles.statLabel}>Total Clicks</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{data.total > 0 ? Math.round(data.totalClicks / data.total) : 0}</div>
          <div style={styles.statLabel}>Avg per Link</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{top3[0]?.clicks || 0}</div>
          <div style={styles.statLabel}>Top Link</div>
        </div>
      </div>

      {top3.length > 0 && (
        <div style={styles.leaderSection}>
          <div style={styles.leaderTitle}>🏆 Top Links</div>
          {top3.map((link, i) => (
            <div key={link.shortCode} style={styles.linkRow}>
              <span style={styles.linkRank}>{["🥇", "🥈", "🥉"][i]}</span>
              <div style={styles.linkInfo}>
                <div style={styles.linkLabel}>{link.label}</div>
                <div style={styles.linkBar}>
                  <div style={{ ...styles.linkBarFill, width: `${(link.clicks / maxClicks) * 100}%` }} />
                </div>
              </div>
              <span style={styles.linkClicks}>{link.clicks}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { background: "#fff", borderRadius: 14, padding: 18, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 16 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  title: { fontSize: 15, fontWeight: 700, margin: 0, color: "#1e293b" },
  badge: { fontSize: 11, color: "#6366f1", background: "#ede9fe", padding: "2px 8px", borderRadius: 10, fontWeight: 600 },
  statsRow: { display: "flex", gap: 10, marginBottom: 14 },
  statCard: { flex: 1, background: "linear-gradient(135deg, #f8fafc 0%, #ede9fe 100%)", borderRadius: 10, padding: "10px 12px", textAlign: "center" as const },
  statValue: { fontSize: 20, fontWeight: 800, color: "#6366f1" },
  statLabel: { fontSize: 10, color: "#94a3b8", fontWeight: 500, marginTop: 2 },
  leaderSection: { borderTop: "1px solid #f1f5f9", paddingTop: 12 },
  leaderTitle: { fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 8 },
  linkRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 8 },
  linkRank: { fontSize: 16 },
  linkInfo: { flex: 1, minWidth: 0 },
  linkLabel: { fontSize: 12, fontWeight: 600, color: "#334155", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" },
  linkBar: { height: 4, background: "#e2e8f0", borderRadius: 2, marginTop: 3 },
  linkBarFill: { height: "100%", background: "linear-gradient(90deg, #6366f1, #a78bfa)", borderRadius: 2, transition: "width 0.5s" },
  linkClicks: { fontSize: 13, fontWeight: 700, color: "#6366f1", minWidth: 30, textAlign: "right" as const },
};
