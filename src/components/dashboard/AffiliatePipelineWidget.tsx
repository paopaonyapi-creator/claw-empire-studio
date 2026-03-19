import React, { useState } from "react";

export function AffiliatePipelineWidget() {
  const [url, setUrl] = useState("");
  const [productName, setProductName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [pipelineId, setPipelineId] = useState("tiktok-full");
  const [loadingScrape, setLoadingScrape] = useState(false);
  const [loadingStart, setLoadingStart] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const handleScrape = async () => {
    if (!url.trim()) return;
    setLoadingScrape(true);
    setStatusMsg("");
    try {
      const res = await fetch("/api/scrape-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.ok && data.productName) {
        setProductName(data.productName);
        if (data.imageUrl) setImageUrl(data.imageUrl);
        setStatusMsg("✅ ดึงข้อมูลสำเร็จ!");
      } else {
        setStatusMsg("❌ ไม่สามารถดึงข้อมูลเว็บได้ โปรดพิมพ์ชื่อเอง");
      }
    } catch {
      setStatusMsg("❌ เกิดข้อผิดพลาดในการดึงข้อมูล");
    }
    setLoadingScrape(false);
  };

  const handleStartPipeline = async () => {
    if (!productName.trim()) return;
    setLoadingStart(true);
    setStatusMsg("");
    try {
      const res = await fetch(`/api/pipelines/${pipelineId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: productName, url, imageUrl }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatusMsg("🚀 เริ่มรัน Pipeline แล้ว! รอแจ้งเตือนใน Telegram");
        setUrl("");
        setProductName("");
        setImageUrl("");
      } else {
        setStatusMsg(`❌ Error: ${data.error}`);
      }
    } catch {
      setStatusMsg("❌ เกิดข้อผิดพลาดในการเริ่ม Pipeline");
    }
    setLoadingStart(false);
  };

  return (
    <div className="pipeline-widget" style={styles.container}>
      <div style={styles.header}>
        <div style={styles.icon}>🎯</div>
        <h3 style={styles.title}>Auto-Pipeline (1-Click Post)</h3>
      </div>
      
      <div style={styles.content}>
        <p style={styles.subtitle}>วางลิงก์ Shopee/Lazada เพื่อให้ AI คิดคอนเทนต์และโพสต์อัตโนมัติ</p>
        
        <div style={styles.inputGroup}>
          <input 
            type="text" 
            placeholder="วางลิงก์ Affiliate (Shopee, Lazada, TikTok Shop)" 
            value={url} 
            onChange={(e) => setUrl(e.target.value)}
            style={styles.input}
          />
          <button 
            style={styles.btnScrape} 
            onClick={handleScrape} 
            disabled={!url.trim() || loadingScrape}
          >
            {loadingScrape ? "กำลังดึง..." : "🔍 ดึงข้อมูลสินค้า"}
          </button>
        </div>

        {imageUrl && (
          <div style={styles.thumbnailContainer}>
            <img src={imageUrl} alt="Product Cover" style={styles.thumbnail} />
            <div style={styles.thumbnailLabel}>ดึงรูปภาพหน้าปกสำเร็จ</div>
          </div>
        )}

        <div style={styles.inputGroupRow}>
          <input 
            type="text" 
            placeholder="ชื่อสินค้า (เช่น หมวกพัดลม)" 
            value={productName} 
            onChange={(e) => setProductName(e.target.value)}
            style={{...styles.input, flex: 2}}
          />
          <select 
            value={pipelineId} 
            onChange={(e) => setPipelineId(e.target.value)}
            style={{...styles.input, flex: 1}}
          >
            <option value="tiktok-full">TikTok (สคริปต์+ปก)</option>
            <option value="review-full">Facebook (รีวิว)</option>
            <option value="unbox-full">Unboxing (แกะกล่อง)</option>
          </select>
        </div>

        {statusMsg && (
          <div style={{...styles.status, color: statusMsg.includes("❌") ? "#ef4444" : "#10b981"}}>
            {statusMsg}
          </div>
        )}

        <button 
          style={{...styles.btnStart, opacity: (!productName.trim() || loadingStart) ? 0.6 : 1}}
          onClick={handleStartPipeline}
          disabled={!productName.trim() || loadingStart}
        >
          {loadingStart ? "🚀 กำลังเริ่ม Pipeline..." : "✨ เริ่ม AI Pipeline ทันที"}
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    background: "#fff",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 4px 15px rgba(0,0,0,0.03)",
    marginBottom: 24,
    border: "1px solid #f1f5f9",
  },
  header: { display: "flex", alignItems: "center", gap: 12, marginBottom: 16 },
  icon: { fontSize: 24, background: "#f8fafc", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12 },
  title: { margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" },
  content: { display: "flex", flexDirection: "column" as const, gap: 12 },
  subtitle: { margin: "0 0 4px 0", fontSize: 13, color: "#64748b" },
  inputGroup: { display: "flex", gap: 8 },
  inputGroupRow: { display: "flex", gap: 8 },
  input: {
    flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", backgroundColor: "#f8fafc",
    fontSize: 14, outline: "none", color: "#334155"
  },
  thumbnailContainer: { display: "flex", alignItems: "center", gap: 12, marginTop: 4, marginBottom: 4, background: "#f8fafc", padding: 8, borderRadius: 8, border: "1px solid #e2e8f0" },
  thumbnail: { width: 48, height: 48, objectFit: "cover" as const, borderRadius: 6 },
  thumbnailLabel: { fontSize: 13, color: "#10b981", fontWeight: 600 },
  btnScrape: {
    padding: "0 16px", borderRadius: 8, border: "none", background: "#f1f5f9", color: "#475569",
    fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" as const, transition: "0.2s"
  },
  btnStart: {
    padding: "12px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
    color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", marginTop: 8, transition: "0.2s"
  },
  status: { fontSize: 13, fontWeight: 500 },
};
