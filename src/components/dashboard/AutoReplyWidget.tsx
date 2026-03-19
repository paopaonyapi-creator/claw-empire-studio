import React, { useState, useEffect } from "react";

export function AutoReplyWidget() {
  const [links, setLinks] = useState<Array<{ label: string; shortUrl: string }>>([]);
  const [selectedLink, setSelectedLink] = useState("");
  const [productName, setProductName] = useState("");
  const [comment, setComment] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [smartMode, setSmartMode] = useState(true);
  const [matchedProduct, setMatchedProduct] = useState<string | null>(null);
  const [suggestedProducts, setSuggestedProducts] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<string | null>(null);
  const [catalogSize, setCatalogSize] = useState<{ products: number; links: number } | null>(null);

  useEffect(() => {
    fetch("/api/links")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.links) {
          setLinks(data.links);
          if (data.links.length > 0) {
            setSelectedLink(data.links[0].shortUrl);
            setProductName(data.links[0].label);
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleLinkChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const url = e.target.value;
    setSelectedLink(url);
    const link = links.find((l) => l.shortUrl === url);
    if (link) setProductName(link.label);
  };

  const handleGenerateReply = async () => {
    if (!comment.trim()) return;
    setLoading(true);
    setReply("");
    setMatchedProduct(null);
    setSuggestedProducts([]);
    setConfidence(null);

    try {
      if (smartMode) {
        // Smart Mode — AI selects product automatically from DB
        const res = await fetch("/api/ai/smart-reply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comment }),
        });
        const data = await res.json();
        if (data.ok) {
          setReply(data.reply);
          setMatchedProduct(data.matchedProduct);
          setSuggestedProducts(data.suggestedProducts || []);
          setConfidence(data.confidence);
          setCatalogSize(data.catalogSize);
        } else {
          setReply("❌ ไม่สามารถสร้างข้อความได้: " + (data.error || "Unknown"));
        }
      } else {
        // Manual Mode — user selects product
        if (!productName.trim() || !selectedLink) return;
        const res = await fetch("/api/ai/auto-reply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comment, product: productName, link: selectedLink }),
        });
        const data = await res.json();
        if (data.ok) {
          setReply(data.reply);
        } else {
          setReply("❌ ไม่สามารถสร้างข้อความได้: " + (data.error || "Unknown"));
        }
      }
    } catch {
      setReply("❌ เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    }
    setLoading(false);
  };

  const confidenceColor = confidence === "high" ? "#22c55e" : confidence === "medium" ? "#f59e0b" : "#ef4444";

  return (
    <div className="auto-reply-widget" style={styles.container}>
      <div style={styles.header}>
        <div style={styles.icon}>💬</div>
        <h3 style={styles.title}>Smart Auto-Reply (บ็อต AI ปิดการขาย)</h3>
      </div>

      <div style={styles.content}>
        <p style={styles.subtitle}>
          {smartMode
            ? "🤖 โหมด Smart — AI ค้นหาสินค้าจาก DB เองอัตโนมัติ ไม่ต้องเลือก"
            : "📝 โหมด Manual — เลือกสินค้า/ลิงก์เอง"}
        </p>

        {/* Smart / Manual Toggle */}
        <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
          <button
            onClick={() => setSmartMode(true)}
            style={{
              ...styles.toggleBtn,
              background: smartMode ? "linear-gradient(135deg, #8b5cf6, #6366f1)" : "#f1f5f9",
              color: smartMode ? "#fff" : "#64748b",
            }}
          >
            🤖 Smart Mode
          </button>
          <button
            onClick={() => setSmartMode(false)}
            style={{
              ...styles.toggleBtn,
              background: !smartMode ? "linear-gradient(135deg, #8b5cf6, #6366f1)" : "#f1f5f9",
              color: !smartMode ? "#fff" : "#64748b",
            }}
          >
            📝 Manual Mode
          </button>
        </div>

        {/* Manual Mode fields */}
        {!smartMode && (
          <div style={styles.inputGroup}>
            <label style={styles.label}>เลือกสินค้า/พิกัดที่จะแจก</label>
            <select value={selectedLink} onChange={handleLinkChange} style={styles.input}>
              {links.length === 0 && <option value="">ไม่มีลิงก์ในระบบ</option>}
              {links.map((l) => (
                <option key={l.shortUrl} value={l.shortUrl}>
                  {l.label} ({l.shortUrl})
                </option>
              ))}
            </select>
          </div>
        )}

        <div style={styles.inputGroup}>
          <label style={styles.label}>คอมเมนต์ของลูกค้า</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder='เช่น "สนใจค่ะ ราคาเท่าไหร่", "มีหูฟังบลูทูธไหมคะ", "พิกัดเสื้อหน่อยค่ะ"'
            style={styles.textarea}
            rows={2}
          />
        </div>

        <button
          onClick={handleGenerateReply}
          disabled={loading || !comment.trim()}
          style={{ ...styles.btnSubmit, opacity: (loading || !comment.trim()) ? 0.6 : 1 }}
        >
          {loading
            ? "✨ AI กำลังวิเคราะห์..."
            : smartMode
              ? "🧠 AI วิเคราะห์ + ตอบอัตโนมัติ"
              : "🤖 ให้ AI ตอบคอมเมนต์นี้"}
        </button>

        {reply && (
          <div style={styles.resultBox}>
            <div style={styles.resultLabel}>👇 ข้อความพร้อมก๊อปปี้ไปตอบลูกค้า</div>
            <div style={styles.resultText}>{reply}</div>

            {/* Smart Mode metadata */}
            {smartMode && (matchedProduct || suggestedProducts.length > 0) && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #bbf7d0" }}>
                {matchedProduct && (
                  <div style={{ fontSize: 12, color: "#166534", marginBottom: 4 }}>
                    📦 สินค้าที่ AI แนะนำ: <strong>{matchedProduct}</strong>
                  </div>
                )}
                {suggestedProducts.length > 0 && (
                  <div style={{ fontSize: 12, color: "#166534", marginBottom: 4 }}>
                    💡 สินค้าใกล้เคียง: {suggestedProducts.join(", ")}
                  </div>
                )}
                {confidence && (
                  <span style={{ fontSize: 11, color: confidenceColor, fontWeight: 700 }}>
                    {confidence === "high" ? "✅" : confidence === "medium" ? "⚡" : "⚠️"} ความมั่นใจ: {confidence}
                  </span>
                )}
                {catalogSize && (
                  <span style={{ fontSize: 11, color: "#64748b", marginLeft: 12 }}>
                    📊 DB: {catalogSize.products} สินค้า, {catalogSize.links} ลิงก์
                  </span>
                )}
              </div>
            )}

            <button
              onClick={() => navigator.clipboard.writeText(reply)}
              style={styles.btnCopy}
            >
              📋 คัดลอกข้อความ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: "#fff",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 4px 15px rgba(0,0,0,0.03)",
    border: "1px solid #f1f5f9",
    marginBottom: 24,
  },
  header: { display: "flex", alignItems: "center", gap: 12, marginBottom: 16 },
  icon: { fontSize: 24, background: "#fdf4ff", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12 },
  title: { margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" },
  content: { display: "flex", flexDirection: "column", gap: 14 },
  subtitle: { margin: "0 0 4px 0", fontSize: 13, color: "#64748b" },
  inputGroup: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 13, fontWeight: 600, color: "#475569" },
  input: {
    padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", backgroundColor: "#f8fafc",
    fontSize: 14, outline: "none", color: "#334155", width: "100%"
  },
  textarea: {
    padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", backgroundColor: "#f8fafc",
    fontSize: 14, outline: "none", color: "#334155", width: "100%", resize: "none"
  },
  toggleBtn: {
    flex: 1, padding: "8px 12px", borderRadius: 8, border: "none",
    fontWeight: 600, fontSize: 13, cursor: "pointer", transition: "0.2s",
  },
  btnSubmit: {
    padding: "12px", borderRadius: 10, border: "none",
    background: "linear-gradient(135deg, #d946ef 0%, #a855f7 100%)",
    color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", transition: "0.2s"
  },
  resultBox: {
    background: "#f0fdf4", border: "1px solid #bbf7d0", padding: 16, borderRadius: 12, marginTop: 4
  },
  resultLabel: { fontSize: 12, fontWeight: 700, color: "#166534", marginBottom: 8 },
  resultText: { fontSize: 14, color: "#14532d", whiteSpace: "pre-wrap", lineHeight: 1.5 },
  btnCopy: {
    marginTop: 12, padding: "8px 12px", borderRadius: 6, border: "none", background: "#dcfce7",
    color: "#166534", fontWeight: 600, fontSize: 12, cursor: "pointer", width: "100%"
  }
};
