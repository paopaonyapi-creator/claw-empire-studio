import React, { useState, useCallback, useRef, useEffect } from "react";
import { useAuth } from "../../app/AuthProvider";

interface SearchResult {
  type: string;
  icon: string;
  title: string;
  subtitle: string;
  id: string;
}

export function GlobalSearchBar() {
  const { token } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) setResults(data.results || []);
    } catch {}
    setLoading(false);
  }, [token]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(v), 300);
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const typeColors: Record<string, string> = {
    product: "#6366f1", activity: "#8b5cf6", goal: "#f59e0b",
    revenue: "#16a34a", user: "#3b82f6",
  };

  return (
    <div ref={wrapperRef} style={styles.wrapper}>
      <div style={styles.inputBox}>
        <span style={styles.searchIcon}>🔍</span>
        <input
          value={query}
          onChange={handleChange}
          onFocus={() => setOpen(true)}
          placeholder="ค้นหา products, tasks, revenue..."
          style={styles.input}
        />
        {loading && <span style={styles.spinner}>⏳</span>}
      </div>

      {open && results.length > 0 && (
        <div style={styles.dropdown}>
          {results.map((r, i) => (
            <div key={`${r.type}-${r.id}-${i}`} style={styles.resultRow}>
              <span style={styles.resultIcon}>{r.icon}</span>
              <div style={styles.resultContent}>
                <div style={styles.resultTitle}>{r.title}</div>
                <div style={styles.resultSub}>{r.subtitle}</div>
              </div>
              <span style={{ ...styles.typeBadge, background: typeColors[r.type] || "#64748b" }}>
                {r.type}
              </span>
            </div>
          ))}
        </div>
      )}

      {open && query.length >= 2 && results.length === 0 && !loading && (
        <div style={styles.dropdown}>
          <div style={styles.noResults}>🔍 ไม่พบผลลัพธ์สำหรับ "{query}"</div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { position: "relative", width: "100%", maxWidth: 420 },
  inputBox: { display: "flex", alignItems: "center", background: "rgba(255,255,255,0.08)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", padding: "0 12px", gap: 8 },
  searchIcon: { fontSize: 15, opacity: 0.6 },
  input: { flex: 1, padding: "9px 0", border: "none", background: "transparent", outline: "none", fontSize: 13, color: "inherit" },
  spinner: { fontSize: 14 },
  dropdown: { position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "#1e1e3f", borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)", maxHeight: 340, overflowY: "auto", zIndex: 999, padding: 6 },
  resultRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, cursor: "pointer", transition: "background 0.15s" },
  resultIcon: { fontSize: 18, flexShrink: 0 },
  resultContent: { flex: 1, minWidth: 0 },
  resultTitle: { fontSize: 13, fontWeight: 600, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  resultSub: { fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  typeBadge: { fontSize: 9, padding: "2px 6px", borderRadius: 4, color: "#fff", fontWeight: 600, textTransform: "uppercase", flexShrink: 0 },
  noResults: { padding: 16, textAlign: "center", color: "#94a3b8", fontSize: 13 },
};
