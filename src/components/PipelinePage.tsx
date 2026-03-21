import { useState, useEffect, useCallback } from "react";

interface PipelineProduct {
  name: string;
  url: string;
  priceMin: number;
  priceMax: number;
  shortLink?: string;
}

interface PipelineStage {
  order: number;
  agentName: string;
  department: string;
  icon: string;
  status: "pending" | "running" | "done" | "failed";
  output?: string;
}

interface Pipeline {
  id: string;
  product: PipelineProduct;
  status: string;
  startedAt: string;
  completedAt?: string;
  stages: PipelineStage[];
  finalContent?: {
    message: string;
    hooks: string[];
    hashtags: string;
  } | null;
}

const DEPT_COLORS: Record<string, string> = {
  Strategy: "#8b5cf6",
  Production: "#3b82f6",
  Creative: "#f59e0b",
  Distribution: "#10b981",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  running: { label: "🔄 กำลังทำงาน", color: "#60a5fa", bg: "rgba(96,165,250,0.1)" },
  awaiting_approval: { label: "⏳ รออนุมัติ TG", color: "#fbbf24", bg: "rgba(251,191,36,0.1)" },
  scheduled: { label: "⏰ ตั้งเวลาโพสต์", color: "#a78bfa", bg: "rgba(167,139,250,0.1)" },
  approved: { label: "✅ อนุมัติแล้ว", color: "#34d399", bg: "rgba(52,211,153,0.1)" },
  posted: { label: "📘 โพสต์แล้ว", color: "#34d399", bg: "rgba(52,211,153,0.15)" },
  rejected: { label: "❌ ยกเลิก", color: "#f87171", bg: "rgba(248,113,113,0.1)" },
  failed: { label: "💥 ล้มเหลว", color: "#f87171", bg: "rgba(248,113,113,0.1)" },
};

export default function PipelinePage() {
  const [url, setUrl] = useState("");
  const [productName, setProductName] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [expandedPipeline, setExpandedPipeline] = useState<string | null>(null);
  const [expandedStage, setExpandedStage] = useState<number | null>(null);

  // Auto-fill from URL
  const handleUrlBlur = useCallback(async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl || !trimmedUrl.includes("shopee")) return;
    if (productName) return; // don't overwrite existing data
    setScraping(true);
    try {
      const res = await fetch("/api/affiliate-pipeline/scrape-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmedUrl }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.product) {
          if (data.product.name && data.product.name !== "สินค้า Shopee") setProductName(data.product.name);
          if (data.product.priceMin) setPriceMin(String(data.product.priceMin));
          if (data.product.priceMax) setPriceMax(String(data.product.priceMax));
          if (data.product.imageUrl) setImageUrl(data.product.imageUrl);
        }
      }
    } catch {}
    setScraping(false);
  }, [url, productName]);

  const fetchPipelines = useCallback(async () => {
    try {
      const res = await fetch("/api/affiliate-pipelines");
      if (res.ok) {
        const data = await res.json();
        setPipelines(data.pipelines || []);
      }
    } catch {}
  }, []);

  // Initial load
  useEffect(() => {
    setLoading(true);
    fetchPipelines().finally(() => setLoading(false));
  }, [fetchPipelines]);

  // Auto-refresh when any pipeline is running
  useEffect(() => {
    const hasRunning = pipelines.some((p) => p.status === "running" || p.status === "awaiting_approval");
    if (!hasRunning) return;
    const interval = setInterval(fetchPipelines, 3000);
    return () => clearInterval(interval);
  }, [pipelines, fetchPipelines]);

  const handleStart = async () => {
    if (!productName || !url) return;
    setStarting(true);
    try {
      const res = await fetch("/api/affiliate-pipeline/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName,
          productUrl: url,
          priceMin: Number(priceMin) || 0,
          priceMax: Number(priceMax) || 0,
          imageUrl: imageUrl || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setExpandedPipeline(data.pipelineId);
        setUrl("");
        setProductName("");
        setPriceMin("");
        setPriceMax("");
        setImageUrl("");
        await fetchPipelines();
      }
    } catch (e) {
      console.error(e);
    }
    setStarting(false);
  };

  const handleApprove = async (id: string) => {
    try {
      await fetch(`/api/affiliate-pipeline/${id}/approve`, { method: "POST" });
      await fetchPipelines();
    } catch {}
  };

  const handleSchedule = async (id: string, datetime: string) => {
    try {
      await fetch(`/api/affiliate-pipeline/${id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: new Date(datetime).toISOString() }),
      });
      await fetchPipelines();
    } catch {}
  };

  const doneCount = (stages: PipelineStage[]) => stages.filter((s) => s.status === "done").length;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--th-text-heading)", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
          🚀 Affiliate Content Pipeline
        </h1>
        <p style={{ fontSize: 13, color: "var(--th-text-muted)", marginTop: 4 }}>
          ส่งลิงก์สินค้า → 10 AI Agents ทำงานอัตโนมัติ → ส่ง Telegram ให้อนุมัติ → โพสต์ Facebook
        </p>
      </div>

      {/* Start Pipeline Form */}
      <div
        style={{
          background: "var(--th-bg-surface)",
          border: "1px solid var(--th-border)",
          borderRadius: 12,
          padding: 20,
          marginBottom: 24,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--th-text-heading)", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
          🛍️ เปิด Pipeline ใหม่
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--th-text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
              ชื่อสินค้า *
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="เช่น กางเกงผ้าไหมอิตาลีใส่สบาย"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--th-border)",
                background: "var(--th-bg-input, var(--th-bg-surface))",
                color: "var(--th-text-primary)",
                fontSize: 13,
                outline: "none",
                marginTop: 4,
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--th-text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Shopee URL *
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={handleUrlBlur}
                placeholder="https://s.shopee.co.th/xxx → วาง URL แล้วดึงข้อมูลอัตโนมัติ"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: scraping ? "1px solid #8b5cf6" : "1px solid var(--th-border)",
                  background: "var(--th-bg-input, var(--th-bg-surface))",
                  color: "var(--th-text-primary)",
                  fontSize: 13,
                  outline: "none",
                  marginTop: 4,
                  boxSizing: "border-box",
                }}
              />
              {scraping && (
                <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "#8b5cf6" }}>
                  ⏳ กำลังดึงข้อมูล...
                </span>
              )}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--th-text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
              ราคาต่ำสุด (฿)
            </label>
            <input
              type="number"
              value={priceMin}
              onChange={(e) => setPriceMin(e.target.value)}
              placeholder="89"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--th-border)",
                background: "var(--th-bg-input, var(--th-bg-surface))",
                color: "var(--th-text-primary)",
                fontSize: 13,
                outline: "none",
                marginTop: 4,
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--th-text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
              ราคาสูงสุด (฿)
            </label>
            <input
              type="number"
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value)}
              placeholder="129"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--th-border)",
                background: "var(--th-bg-input, var(--th-bg-surface))",
                color: "var(--th-text-primary)",
                fontSize: 13,
                outline: "none",
                marginTop: 4,
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        <button
          onClick={handleStart}
          disabled={!productName || !url || starting}
          style={{
            width: "100%",
            padding: "12px 20px",
            borderRadius: 10,
            border: "none",
            background: !productName || !url ? "#444" : "linear-gradient(135deg, #8b5cf6, #3b82f6)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            cursor: !productName || !url ? "not-allowed" : "pointer",
            opacity: starting ? 0.7 : 1,
            transition: "all 0.2s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {starting ? (
            <>⏳ กำลังเริ่ม Pipeline...</>
          ) : (
            <>🚀 เริ่ม Pipeline (10 Agents)</>
          )}
        </button>
      </div>

      {/* Pipeline List */}
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--th-text-heading)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
        📋 ประวัติ Pipeline
        {loading && <span style={{ fontSize: 11, color: "var(--th-text-muted)" }}>กำลังโหลด...</span>}
      </div>

      {pipelines.length === 0 && !loading && (
        <div
          style={{
            textAlign: "center",
            padding: "40px 20px",
            color: "var(--th-text-muted)",
            fontSize: 13,
            background: "var(--th-bg-surface)",
            borderRadius: 12,
            border: "1px solid var(--th-border)",
          }}
        >
          ยังไม่มี Pipeline • เริ่มต้นด้วยการวางลิงก์ Shopee ด้านบน
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {pipelines.map((p) => {
          const isExpanded = expandedPipeline === p.id;
          const statusInfo = STATUS_CONFIG[p.status] || STATUS_CONFIG.running;
          const done = doneCount(p.stages);
          const total = p.stages.length;
          const progress = total > 0 ? (done / total) * 100 : 0;

          return (
            <div
              key={p.id}
              style={{
                background: "var(--th-bg-surface)",
                border: `1px solid ${isExpanded ? statusInfo.color + "44" : "var(--th-border)"}`,
                borderRadius: 12,
                overflow: "hidden",
                transition: "border-color 0.2s",
              }}
            >
              {/* Pipeline Header */}
              <button
                onClick={() => setExpandedPipeline(isExpanded ? null : p.id)}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  color: "var(--th-text-primary)",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                    🛍️ {p.product.name}
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 100,
                        background: statusInfo.bg,
                        color: statusInfo.color,
                        fontWeight: 600,
                      }}
                    >
                      {statusInfo.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--th-text-muted)", display: "flex", gap: 12 }}>
                    <span>💰 ฿{p.product.priceMin}-{p.product.priceMax}</span>
                    <span>📊 {done}/{total} agents</span>
                    <span>{new Date(p.startedAt).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ width: 80, height: 6, borderRadius: 100, background: "var(--th-border)", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${progress}%`,
                      height: "100%",
                      borderRadius: 100,
                      background: `linear-gradient(90deg, ${statusInfo.color}, ${statusInfo.color}88)`,
                      transition: "width 0.5s ease",
                    }}
                  />
                </div>

                <span style={{ fontSize: 12, transform: isExpanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>▼</span>
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div style={{ padding: "0 16px 16px", borderTop: "1px solid var(--th-border)" }}>
                  {/* Agent Progress */}
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--th-text-heading)", marginBottom: 8 }}>
                      👥 Agent Progress
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {p.stages.map((s) => {
                        const deptColor = DEPT_COLORS[s.department] || "#6b7280";
                        const isStageExpanded = expandedStage === s.order && expandedPipeline === p.id;
                        return (
                          <div key={s.order}>
                            <button
                              onClick={() => setExpandedStage(isStageExpanded ? null : s.order)}
                              style={{
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "8px 10px",
                                borderRadius: 8,
                                background: s.status === "running"
                                  ? "rgba(96,165,250,0.08)"
                                  : s.status === "done"
                                    ? "rgba(52,211,153,0.05)"
                                    : "transparent",
                                border: "none",
                                cursor: s.output ? "pointer" : "default",
                                textAlign: "left",
                                color: "var(--th-text-primary)",
                                transition: "background 0.2s",
                              }}
                            >
                              <span style={{ fontSize: 16, width: 24, textAlign: "center" }}>{s.icon}</span>
                              <span
                                style={{
                                  fontSize: 10,
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  background: deptColor + "22",
                                  color: deptColor,
                                  fontWeight: 600,
                                }}
                              >
                                {s.department}
                              </span>
                              <span style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{s.agentName}</span>
                              <span style={{ fontSize: 12 }}>
                                {s.status === "done" && "✅"}
                                {s.status === "running" && <span className="animate-spin inline-block">⚙️</span>}
                                {s.status === "pending" && "⏳"}
                                {s.status === "failed" && "❌"}
                              </span>
                            </button>

                            {isStageExpanded && s.output && (
                              <div
                                style={{
                                  marginLeft: 34,
                                  marginTop: 4,
                                  marginBottom: 8,
                                  padding: "10px 12px",
                                  borderRadius: 8,
                                  background: "var(--th-bg-surface-hover, rgba(0,0,0,0.15))",
                                  fontSize: 12,
                                  lineHeight: 1.5,
                                  color: "var(--th-text-secondary)",
                                  whiteSpace: "pre-wrap",
                                  maxHeight: 200,
                                  overflowY: "auto",
                                  border: "1px solid var(--th-border)",
                                }}
                              >
                                {s.output}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Final Content Preview */}
                  {p.finalContent && (
                    <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#a78bfa", marginBottom: 8 }}>📝 ข้อความที่จะโพสต์</div>
                      <div style={{ fontSize: 12, color: "var(--th-text-secondary)", whiteSpace: "pre-wrap", maxHeight: 150, overflowY: "auto", lineHeight: 1.6 }}>
                        {p.finalContent.message.slice(0, 500)}
                        {p.finalContent.message.length > 500 && "..."}
                      </div>
                    </div>
                  )}

                  {/* Approve Button (Manual) */}
                  {p.status === "awaiting_approval" && (
                    <>
                    <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
                      <button
                        onClick={() => handleApprove(p.id)}
                        style={{
                          flex: 1,
                          padding: "10px",
                          borderRadius: 8,
                          border: "none",
                          background: "linear-gradient(135deg, #10b981, #34d399)",
                          color: "#fff",
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        ✅ อนุมัติโพสต์ Facebook
                      </button>
                      <div
                        style={{
                          flex: 1,
                          padding: "10px",
                          borderRadius: 8,
                          background: "rgba(251,191,36,0.1)",
                          color: "#fbbf24",
                          fontSize: 12,
                          fontWeight: 500,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 4,
                        }}
                      >
                        📱 หรือกดอนุมัติผ่าน Telegram
                      </div>
                    </div>
                    {/* Schedule Option */}
                    <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: "var(--th-text-muted)" }}>⏰ ตั้งเวลาโพสต์:</span>
                      <input
                        type="datetime-local"
                        id={`schedule-${p.id}`}
                        style={{
                          flex: 1,
                          padding: "6px 10px",
                          borderRadius: 6,
                          border: "1px solid var(--th-border)",
                          background: "var(--th-bg-input, var(--th-bg-surface))",
                          color: "var(--th-text-primary)",
                          fontSize: 12,
                        }}
                      />
                      <button
                        onClick={() => {
                          const input = document.getElementById(`schedule-${p.id}`) as HTMLInputElement;
                          if (input?.value) handleSchedule(p.id, input.value);
                        }}
                        style={{
                          padding: "6px 14px",
                          borderRadius: 6,
                          border: "none",
                          background: "linear-gradient(135deg, #8b5cf6, #a78bfa)",
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        ⏰ ตั้งเวลา
                      </button>
                    </div>
                    </>
                  )}

                  {/* Scheduled Info */}
                  {p.status === "scheduled" && (p as any).scheduledAt && (
                    <div style={{ marginTop: 14, padding: 10, borderRadius: 8, background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 20 }}>⏰</span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#a78bfa" }}>ตั้งเวลาโพสต์</div>
                        <div style={{ fontSize: 13, color: "var(--th-text-primary)" }}>{new Date((p as any).scheduledAt).toLocaleString("th-TH")}</div>
                      </div>
                    </div>
                  )}

                  {/* Performance Metrics */}
                  {p.status === "posted" && (p as any).performance && (
                    <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#34d399", marginBottom: 8 }}>📊 Performance</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, textAlign: "center" }}>
                        {[
                          { icon: "❤️", label: "Likes", val: (p as any).performance?.likes ?? 0 },
                          { icon: "🔁", label: "Shares", val: (p as any).performance?.shares ?? 0 },
                          { icon: "💬", label: "Comments", val: (p as any).performance?.comments ?? 0 },
                          { icon: "🔗", label: "Clicks", val: (p as any).performance?.clicks ?? 0 },
                          { icon: "👁️", label: "Reach", val: (p as any).performance?.reach ?? 0 },
                        ].map((m) => (
                          <div key={m.label}>
                            <div style={{ fontSize: 18 }}>{m.icon}</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--th-text-primary)" }}>{m.val}</div>
                            <div style={{ fontSize: 10, color: "var(--th-text-muted)" }}>{m.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Promo Image Preview */}
                  {(p.status === "awaiting_approval" || p.status === "approved" || p.status === "posted") && (
                    <div style={{ marginTop: 14, textAlign: "center" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--th-text-heading)", marginBottom: 8 }}>
                        🖼️ Promo Banner Preview
                      </div>
                      <img
                        src={`/api/affiliate-pipeline/${p.id}/image`}
                        alt="Promo banner"
                        style={{
                          width: "100%",
                          maxWidth: 400,
                          borderRadius: 12,
                          border: "1px solid var(--th-border)",
                        }}
                      />
                    </div>
                  )}

                  {/* Link */}
                  {p.product.shortLink && (
                    <div style={{ marginTop: 10, fontSize: 11, color: "var(--th-text-muted)" }}>
                      🔗 Short Link: <a href={p.product.shortLink} target="_blank" rel="noreferrer" style={{ color: "#60a5fa" }}>{p.product.shortLink}</a>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
