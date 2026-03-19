import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../app/AuthProvider";

interface GamificationStats {
  totalXp: number;
  level: number;
  title: string;
  badge: string;
  nextXp: number;
  progress: number;
  currentStreak: number;
  bestStreak: number;
}

export function GamificationWidget() {
  const { token } = useAuth();
  const [stats, setStats] = useState<GamificationStats | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/gamification", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.ok) setStats(data.stats);
    } catch {}
  }, [token]);

  useEffect(() => { loadStats(); }, [loadStats]);

  if (!stats) return null;

  const levelGradients = [
    "linear-gradient(135deg, #a3e635, #4ade80)", // 1
    "linear-gradient(135deg, #facc15, #f59e0b)", // 2
    "linear-gradient(135deg, #fb923c, #ef4444)", // 3
    "linear-gradient(135deg, #818cf8, #6366f1)", // 4
    "linear-gradient(135deg, #fbbf24, #f59e0b)", // 5
    "linear-gradient(135deg, #f472b6, #ec4899)", // 6
    "linear-gradient(135deg, #38bdf8, #0ea5e9)", // 7
    "linear-gradient(135deg, #34d399, #10b981)", // 8
    "linear-gradient(135deg, #60a5fa, #3b82f6)", // 9
    "linear-gradient(135deg, #c084fc, #a855f7)", // 10
  ];
  const gradient = levelGradients[Math.min(stats.level - 1, 9)];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={{ ...styles.levelCircle, background: gradient }}>
          <span style={styles.levelNum}>{stats.level}</span>
        </div>
        <div>
          <div style={styles.title}>{stats.badge} {stats.title}</div>
          <div style={styles.xpText}>{stats.totalXp.toLocaleString()} XP</div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={styles.streakBox}>
          <span style={styles.streakNum}>🔥 {stats.currentStreak}</span>
          <span style={styles.streakLabel}>streak</span>
        </div>
      </div>

      {/* XP Progress Bar */}
      <div style={styles.progressOuter}>
        <div style={{ ...styles.progressInner, width: `${stats.progress}%`, background: gradient }} />
      </div>
      <div style={styles.progressLabels}>
        <span>Level {stats.level}</span>
        <span>{stats.progress}%</span>
        <span>Level {stats.level + 1} ({stats.nextXp} XP)</span>
      </div>

      {/* Stats Grid */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>⭐</div>
          <div style={styles.statValue}>{stats.totalXp}</div>
          <div style={styles.statLabel}>Total XP</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>🔥</div>
          <div style={styles.statValue}>{stats.currentStreak} วัน</div>
          <div style={styles.statLabel}>Current Streak</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>🏅</div>
          <div style={styles.statValue}>{stats.bestStreak} วัน</div>
          <div style={styles.statLabel}>Best Streak</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>📊</div>
          <div style={styles.statValue}>Lv.{stats.level}</div>
          <div style={styles.statLabel}>Current Level</div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 4px 15px rgba(0,0,0,0.03)", border: "1px solid #f1f5f9", marginBottom: 24 },
  header: { display: "flex", alignItems: "center", gap: 14, marginBottom: 16 },
  levelCircle: { width: 48, height: 48, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(99,102,241,0.3)" },
  levelNum: { fontSize: 20, fontWeight: 800, color: "#fff" },
  title: { fontSize: 16, fontWeight: 700, color: "#1e293b" },
  xpText: { fontSize: 12, color: "#64748b", fontWeight: 500 },
  streakBox: { display: "flex", flexDirection: "column", alignItems: "center", background: "#fff7ed", borderRadius: 10, padding: "6px 12px" },
  streakNum: { fontSize: 18, fontWeight: 700, color: "#ea580c" },
  streakLabel: { fontSize: 10, color: "#9a3412", fontWeight: 500 },
  progressOuter: { height: 8, borderRadius: 4, background: "#e2e8f0", overflow: "hidden", marginBottom: 4 },
  progressInner: { height: "100%", borderRadius: 4, transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)" },
  progressLabels: { display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94a3b8", marginBottom: 14 },
  statsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 },
  statCard: { textAlign: "center", background: "#fafbfc", borderRadius: 10, padding: "10px 6px", border: "1px solid #f1f5f9" },
  statIcon: { fontSize: 18, marginBottom: 2 },
  statValue: { fontSize: 14, fontWeight: 700, color: "#1e293b" },
  statLabel: { fontSize: 9, color: "#94a3b8", marginTop: 2 },
};
