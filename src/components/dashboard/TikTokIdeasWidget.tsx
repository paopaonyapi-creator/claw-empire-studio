import React, { useState } from "react";

interface TikTokIdeas {
  hooks: string[];
  caption: string;
  hashtags: string[];
  script: { sec0_5: string; sec5_15: string; sec15_25: string; sec25_30: string };
  postingTips: string[];
}

export function TikTokIdeasWidget() {
  const [productName, setProductName] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [commission, setCommission] = useState("");
  const [loading, setLoading] = useState(false);
  const [ideas, setIdeas] = useState<TikTokIdeas | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const generate = async () => {
    if (!productName.trim()) return;
    setLoading(true);
    setError("");
    setIdeas(null);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/tiktok/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productName: productName.trim(), targetAudience, commission }),
      });
      const data = await res.json();
      if (data.ok) setIdeas(data.ideas);
      else setError(data.error || "เกิดข้อผิดพลาด");
    } catch {
      setError("เชื่อมต่อ API ไม่ได้");
    }
    setLoading(false);
  };

  return (
    <div className="widget-card" style={{ background: "var(--card-bg, #1a1a2e)", borderRadius: 16, padding: 20, border: "1px solid rgba(99,102,241,0.2)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 22 }}>🎵</span>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text-primary, #fff)" }}>
          TikTok Content Idea Generator
        </h3>
        <span style={{ marginLeft: "auto", fontSize: 11, background: "rgba(99,102,241,0.15)", color: "#818cf8", padding: "3px 8px", borderRadius: 6 }}>AI ✨</span>
      </div>

      {/* Input */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
        <input
          placeholder="🛍️ ชื่อสินค้า เช่น หมวกโครเชต์ถัก"
          value={productName}
          onChange={e => setProductName(e.target.value)}
          style={inputStyle}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <input
            placeholder="👥 กลุ่มเป้าหมาย (ไม่บังคับ)"
            value={targetAudience}
            onChange={e => setTargetAudience(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="💰 ค่าคอม เช่น 12%"
            value={commission}
            onChange={e => setCommission(e.target.value)}
            style={inputStyle}
          />
        </div>
        <button
          onClick={generate}
          disabled={loading || !productName.trim()}
          style={{
            padding: "11px 16px", borderRadius: 10, border: "none", cursor: loading ? "not-allowed" : "pointer",
            background: loading ? "rgba(99,102,241,0.4)" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: "#fff", fontWeight: 700, fontSize: 14, transition: "all 0.2s",
          }}
        >
          {loading ? "🤖 AI กำลังคิด..." : "✨ สร้าง Content Ideas"}
        </button>
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", color: "#fca5a5", padding: "10px 14px", borderRadius: 10, fontSize: 13 }}>
          ❌ {error}
        </div>
      )}

      {/* Results */}
      {ideas && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Hooks */}
          <div style={sectionStyle}>
            <div style={sectionHeader}>🪝 Hook (เลือก 1 แบบ)</div>
            {ideas.hooks.map((h, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "rgba(99,102,241,0.08)", borderRadius: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: "var(--text-primary, #e5e7eb)", flex: 1 }}>{h}</span>
                <button onClick={() => copy(h, `hook-${i}`)} style={copyBtnStyle}>
                  {copied === `hook-${i}` ? "✅" : "📋"}
                </button>
              </div>
            ))}
          </div>

          {/* Caption */}
          <div style={sectionStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={sectionHeader}>📝 Caption</div>
              <button onClick={() => copy(ideas.caption, "caption")} style={copyBtnStyle}>
                {copied === "caption" ? "✅ Copied!" : "📋 Copy"}
              </button>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary, #9ca3af)", lineHeight: 1.6, padding: "8px 0" }}>{ideas.caption}</p>
          </div>

          {/* Hashtags */}
          <div style={sectionStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={sectionHeader}># Hashtags</div>
              <button onClick={() => copy(ideas.hashtags.join(" "), "hashtags")} style={copyBtnStyle}>
                {copied === "hashtags" ? "✅ Copied!" : "📋 Copy All"}
              </button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingTop: 8 }}>
              {ideas.hashtags.map((h, i) => (
                <span key={i} style={{ fontSize: 12, background: "rgba(139,92,246,0.15)", color: "#a78bfa", padding: "3px 8px", borderRadius: 20 }}>{h}</span>
              ))}
            </div>
          </div>

          {/* Script */}
          <div style={sectionStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={sectionHeader}>🎬 Script 30 วิ</div>
              <button onClick={() => copy(Object.values(ideas.script).join("\n\n"), "script")} style={copyBtnStyle}>
                {copied === "script" ? "✅ Copied!" : "📋 Copy"}
              </button>
            </div>
            {Object.entries(ideas.script).map(([key, val]) => (
              <div key={key} style={{ padding: "8px 10px", borderLeft: "3px solid #6366f1", margin: "6px 0", fontSize: 12, color: "var(--text-secondary, #9ca3af)" }}>
                <strong style={{ color: "#818cf8", fontSize: 11 }}>{key.replace("sec", "").replace("_", "-")}s</strong>
                <p style={{ margin: "4px 0 0" }}>{val}</p>
              </div>
            ))}
          </div>

          {/* Tips */}
          {ideas.postingTips?.length > 0 && (
            <div style={sectionStyle}>
              <div style={sectionHeader}>💡 Tips เพิ่ม Reach</div>
              {ideas.postingTips.map((t, i) => (
                <p key={i} style={{ margin: "4px 0", fontSize: 12, color: "var(--text-secondary, #9ca3af)" }}>• {t}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.05)", color: "var(--text-primary, #fff)", fontSize: 13, outline: "none",
};
const sectionStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "12px 14px",
  border: "1px solid rgba(255,255,255,0.06)",
};
const sectionHeader: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: "#818cf8", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px",
};
const copyBtnStyle: React.CSSProperties = {
  padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(99,102,241,0.3)",
  background: "rgba(99,102,241,0.1)", color: "#818cf8", cursor: "pointer", fontSize: 12,
};
