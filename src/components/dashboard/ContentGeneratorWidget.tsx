/**
 * ContentGeneratorWidget — AI content creation + history
 */
import { useState } from "react";

export function ContentGeneratorWidget() {
  const [product, setProduct] = useState("");
  const [platform, setPlatform] = useState("tiktok");
  const [result, setResult] = useState<{ hook: string; caption: string; hashtags: string[]; cta: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!product.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: product.trim(), platform }),
      });
      if (res.ok) setResult(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  };

  const copyAll = () => {
    if (!result) return;
    const text = `${result.hook}\n\n${result.caption}\n\n${result.hashtags.join(" ")}\n\n${result.cta}`;
    navigator.clipboard.writeText(text);
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>✨ AI Content Generator</h2>

      <div style={styles.inputRow}>
        <input
          style={styles.input}
          placeholder="ชื่อสินค้า เช่น หมวกกันน็อค"
          value={product}
          onChange={(e) => setProduct(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && generate()}
        />
        <select style={styles.select} value={platform} onChange={(e) => setPlatform(e.target.value)}>
          <option value="tiktok">TikTok</option>
          <option value="facebook">Facebook</option>
          <option value="instagram">Instagram</option>
        </select>
        <button style={styles.genBtn} onClick={generate} disabled={loading || !product.trim()}>
          {loading ? "⏳" : "🚀"} Generate
        </button>
      </div>

      {result && (
        <div style={styles.resultBox}>
          <div style={styles.section}>
            <div style={styles.label}>🎣 HOOK</div>
            <div style={styles.text}>{result.hook}</div>
          </div>
          <div style={styles.section}>
            <div style={styles.label}>📝 CAPTION</div>
            <div style={styles.text}>{result.caption}</div>
          </div>
          <div style={styles.section}>
            <div style={styles.label}>#️⃣ HASHTAGS</div>
            <div style={styles.tags}>
              {result.hashtags.map((h, i) => <span key={i} style={styles.tag}>{h}</span>)}
            </div>
          </div>
          <div style={styles.section}>
            <div style={styles.label}>📢 CTA</div>
            <div style={styles.text}>{result.cta}</div>
          </div>
          <button style={styles.copyBtn} onClick={copyAll}>📋 Copy All</button>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    borderRadius: 14, padding: 20, marginBottom: 20,
    background: "linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(59,130,246,0.1) 100%)",
    border: "1px solid rgba(139,92,246,0.25)",
  },
  title: { fontSize: 16, fontWeight: 700, margin: "0 0 14px 0", color: "var(--th-text-heading, #f1f5f9)" },
  inputRow: { display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" as const },
  input: {
    flex: 1, minWidth: 200, padding: "8px 12px", borderRadius: 8, fontSize: 13,
    border: "1px solid var(--th-border, rgba(50,50,95,0.45))",
    background: "var(--th-input-bg, rgba(16,16,42,0.85))",
    color: "var(--th-text-primary, #e2e8f0)",
  },
  select: {
    padding: "8px 12px", borderRadius: 8, fontSize: 13,
    border: "1px solid var(--th-border, rgba(50,50,95,0.45))",
    background: "var(--th-input-bg, rgba(16,16,42,0.85))",
    color: "var(--th-text-primary, #e2e8f0)",
  },
  genBtn: {
    padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700,
    border: "none", background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
    color: "#fff", cursor: "pointer", whiteSpace: "nowrap" as const,
  },
  resultBox: {
    background: "var(--th-card-bg, rgba(16,16,42,0.65))",
    borderRadius: 10, padding: 16,
    border: "1px solid var(--th-card-border, rgba(50,50,95,0.35))",
  },
  section: { marginBottom: 12 },
  label: { fontSize: 10, fontWeight: 700, color: "#a5b4fc", textTransform: "uppercase" as const, marginBottom: 4 },
  text: { fontSize: 13, color: "var(--th-text-primary, #e2e8f0)", lineHeight: 1.6, whiteSpace: "pre-wrap" as const },
  tags: { display: "flex", gap: 4, flexWrap: "wrap" as const },
  tag: {
    fontSize: 11, padding: "2px 8px", borderRadius: 12,
    background: "rgba(99,102,241,0.2)", color: "#a5b4fc",
  },
  copyBtn: {
    marginTop: 8, padding: "6px 14px", borderRadius: 8, fontSize: 12,
    border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.15)",
    color: "#a5b4fc", cursor: "pointer", fontWeight: 600,
  },
};
