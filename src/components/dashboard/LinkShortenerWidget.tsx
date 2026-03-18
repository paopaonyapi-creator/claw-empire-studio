/**
 * LinkShortenerWidget — Create short links + view click stats
 */
import { useState, useEffect, useCallback } from "react";

interface ShortLink { code: string; url: string; clicks: number; createdAt: string }

export function LinkShortenerWidget() {
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [url, setUrl] = useState("");
  const [alias, setAlias] = useState("");
  const [loading, setLoading] = useState(false);
  const [newLink, setNewLink] = useState("");

  const fetchLinks = useCallback(async () => {
    try { const r = await fetch("/api/links"); if (r.ok) { const j = await r.json(); setLinks(j.links || []); } } catch {}
  }, []);

  useEffect(() => { fetchLinks(); }, [fetchLinks]);

  const create = async () => {
    if (!url.trim()) return;
    setLoading(true); setNewLink("");
    try {
      const r = await fetch("/api/links", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), alias: alias.trim() || undefined }),
      });
      if (r.ok) {
        const j = await r.json();
        setNewLink(j.shortUrl || `/s/${j.code}`);
        setUrl(""); setAlias(""); fetchLinks();
      }
    } catch {}
    setLoading(false);
  };

  const copyLink = (text: string) => { navigator.clipboard.writeText(text); };

  const totalClicks = links.reduce((s, l) => s + l.clicks, 0);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>🔗 Link Shortener</h2>
        <span style={styles.stats}>{links.length} links · {totalClicks} clicks</span>
      </div>

      <div style={styles.inputRow}>
        <input style={styles.urlInput} placeholder="https://shopee.co.th/product..." value={url}
          onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} />
        <input style={styles.aliasInput} placeholder="alias" value={alias}
          onChange={(e) => setAlias(e.target.value)} />
        <button style={styles.createBtn} onClick={create} disabled={loading || !url.trim()}>
          {loading ? "⏳" : "✂️"} Short
        </button>
      </div>

      {newLink && (
        <div style={styles.newLinkBox}>
          <span style={styles.newLinkUrl}>{newLink}</span>
          <button style={styles.copyBtn} onClick={() => copyLink(newLink)}>📋 Copy</button>
        </div>
      )}

      {links.length > 0 && (
        <div style={styles.linkList}>
          {links.slice(0, 8).map((l) => (
            <div key={l.code} style={styles.linkRow}>
              <span style={styles.linkCode}>/s/{l.code}</span>
              <span style={styles.linkUrl}>{l.url.substring(0, 40)}{l.url.length > 40 ? "..." : ""}</span>
              <span style={styles.linkClicks}>{l.clicks} 👆</span>
            </div>
          ))}
        </div>
      )}
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
  stats: { fontSize: 11, color: "var(--th-text-muted, #64748b)" },
  inputRow: { display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" as const },
  urlInput: {
    flex: 1, minWidth: 180, padding: "7px 10px", borderRadius: 8, fontSize: 12,
    border: "1px solid var(--th-border, rgba(50,50,95,0.45))",
    background: "var(--th-input-bg, rgba(16,16,42,0.85))", color: "var(--th-text-primary, #e2e8f0)",
  },
  aliasInput: {
    width: 80, padding: "7px 10px", borderRadius: 8, fontSize: 12,
    border: "1px solid var(--th-border, rgba(50,50,95,0.45))",
    background: "var(--th-input-bg, rgba(16,16,42,0.85))", color: "var(--th-text-primary, #e2e8f0)",
  },
  createBtn: {
    padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700,
    border: "none", background: "linear-gradient(135deg, #3b82f6, #6366f1)",
    color: "#fff", cursor: "pointer", whiteSpace: "nowrap" as const,
  },
  newLinkBox: {
    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
    padding: "8px 12px", borderRadius: 8, marginBottom: 10,
    background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)",
  },
  newLinkUrl: { fontSize: 13, fontWeight: 700, color: "#10b981" },
  copyBtn: {
    padding: "4px 10px", borderRadius: 6, fontSize: 11, border: "none",
    background: "rgba(16,185,129,0.2)", color: "#10b981", cursor: "pointer", fontWeight: 600,
  },
  linkList: { marginTop: 6 },
  linkRow: {
    display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "center",
    padding: "5px 0", borderBottom: "1px solid var(--th-border, rgba(50,50,95,0.2))", fontSize: 12,
  },
  linkCode: { fontWeight: 700, color: "#3b82f6", fontFamily: "monospace" },
  linkUrl: { color: "var(--th-text-secondary, #94a3b8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
  linkClicks: { fontWeight: 700, color: "#f59e0b", fontSize: 11 },
};
