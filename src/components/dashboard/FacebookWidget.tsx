/**
 * FacebookWidget — Post composer + connection status + recent posts
 */
import { useState, useEffect, useCallback } from "react";

interface FbStatus {
  connected: boolean;
  name?: string;
  id?: string;
  pages?: Array<{ id: string; name: string; fan_count?: number }>;
  error?: string;
}

interface PostRecord {
  id: string;
  message: string;
  status: string;
  timestamp: string;
}

export function FacebookWidget() {
  const [status, setStatus] = useState<FbStatus | null>(null);
  const [message, setMessage] = useState("");
  const [posting, setPosting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [history, setHistory] = useState<PostRecord[]>([]);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/fb/status");
      if (res.ok) setStatus(await res.json());
    } catch {}
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/fb/history");
      if (res.ok) {
        const j = await res.json();
        setHistory(j.history || []);
      }
    } catch {}
  }, []);

  useEffect(() => { fetchStatus(); fetchHistory(); }, [fetchStatus, fetchHistory]);

  const postToFb = async () => {
    if (!message.trim()) return;
    setPosting(true);
    setFeedback("");
    try {
      const res = await fetch("/api/fb/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback("✅ โพสต์สำเร็จ!");
        setMessage("");
        fetchHistory();
      } else {
        setFeedback(`❌ ${data.error}`);
      }
    } catch { setFeedback("❌ Network error"); }
    setPosting(false);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>📘 Facebook Publisher</h2>
        <span style={{
          ...styles.badge,
          background: status?.connected ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)",
          color: status?.connected ? "#10b981" : "#ef4444",
        }}>
          {status?.connected ? `✅ ${status.name || "Connected"}` : "❌ ยังไม่เชื่อมต่อ"}
        </span>
      </div>

      {/* Post Composer */}
      <div style={styles.composer}>
        <textarea
          style={styles.textarea}
          placeholder="พิมพ์ข้อความที่จะโพสต์ลง Facebook..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
        />
        <div style={styles.actions}>
          <span style={styles.charCount}>{message.length} chars</span>
          <button
            style={{ ...styles.postBtn, opacity: (!message.trim() || posting) ? 0.5 : 1 }}
            onClick={postToFb}
            disabled={!message.trim() || posting}
          >
            {posting ? "⏳ Posting..." : "📤 Post to Facebook"}
          </button>
        </div>
        {feedback && <div style={styles.feedback}>{feedback}</div>}
      </div>

      {/* Recent Posts */}
      {history.length > 0 && (
        <div style={styles.historySection}>
          <div style={styles.historyLabel}>📋 Recent Posts</div>
          {history.slice(0, 5).map((h) => (
            <div key={h.id} style={styles.historyRow}>
              <span style={styles.historyIcon}>{h.status === "posted" ? "✅" : "❌"}</span>
              <span style={styles.historyMsg}>{h.message.substring(0, 60)}{h.message.length > 60 ? "..." : ""}</span>
              <span style={styles.historyTime}>
                {new Date(h.timestamp).toLocaleDateString("th-TH", { month: "short", day: "numeric" })}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Pages info */}
      {status?.pages && status.pages.length > 0 && (
        <div style={styles.pageInfo}>
          {status.pages.map((p) => (
            <div key={p.id} style={styles.pageCard}>
              <span style={styles.pageName}>📄 {p.name}</span>
              {p.fan_count !== undefined && <span style={styles.pageFans}>{p.fan_count.toLocaleString()} fans</span>}
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
    background: "linear-gradient(135deg, rgba(24,119,242,0.12) 0%, rgba(66,103,178,0.08) 100%)",
    border: "1px solid rgba(24,119,242,0.25)",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  title: { fontSize: 16, fontWeight: 700, margin: 0, color: "var(--th-text-heading, #f1f5f9)" },
  badge: {
    fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 12,
  },
  composer: { marginBottom: 12 },
  textarea: {
    width: "100%", padding: "10px 14px", borderRadius: 10, fontSize: 13, resize: "vertical" as const,
    border: "1px solid var(--th-border, rgba(50,50,95,0.45))",
    background: "var(--th-input-bg, rgba(16,16,42,0.85))",
    color: "var(--th-text-primary, #e2e8f0)",
    fontFamily: "inherit",
  },
  actions: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  charCount: { fontSize: 11, color: "var(--th-text-muted, #64748b)" },
  postBtn: {
    padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700,
    border: "none", background: "#1877f2", color: "#fff", cursor: "pointer",
  },
  feedback: { marginTop: 8, fontSize: 12, fontWeight: 600, color: "var(--th-text-primary, #e2e8f0)" },
  historySection: { marginTop: 12 },
  historyLabel: { fontSize: 12, fontWeight: 700, color: "var(--th-text-secondary, #94a3b8)", marginBottom: 6 },
  historyRow: {
    display: "flex", alignItems: "center", gap: 8, padding: "5px 0",
    borderBottom: "1px solid var(--th-border, rgba(50,50,95,0.2))", fontSize: 12,
  },
  historyIcon: { fontSize: 12 },
  historyMsg: { flex: 1, color: "var(--th-text-primary, #e2e8f0)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
  historyTime: { fontSize: 10, color: "var(--th-text-muted, #64748b)" },
  pageInfo: { marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" as const },
  pageCard: {
    display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
    borderRadius: 8, fontSize: 12,
    background: "var(--th-bg-surface, rgba(22,22,48,0.75))",
    border: "1px solid var(--th-border, rgba(50,50,95,0.45))",
  },
  pageName: { fontWeight: 600, color: "var(--th-text-primary, #e2e8f0)" },
  pageFans: { color: "#1877f2", fontWeight: 600 },
};
