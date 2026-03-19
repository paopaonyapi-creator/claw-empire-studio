import { useState } from "react";

export function CompetitorSpyWidget() {
  const [competitorUrl, setCompetitorUrl] = useState("");
  const [ourProduct, setOurProduct] = useState("");
  const [loading, setLoading] = useState(false);

  const handleStartSpy = async () => {
    if (!competitorUrl || !ourProduct) return;
    setLoading(true);
    try {
      const combinedPayload = `ข้อมูลคู่แข่ง: ${competitorUrl}\nสินค้าของเราที่ต้องการขาย: ${ourProduct}`;
      
      const res = await fetch("/api/pipelines/competitor-spy-full/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // productName is passed as displayProduct, combinedPayload mapped to variable in template
        body: JSON.stringify({ product: combinedPayload, productName: `(Spy) ${ourProduct}` }), 
      });
      const data = await res.json();
      if (data.ok) {
        alert("🕵️ ส่ง AI สายลับไปแกะสคริปต์คู่แข่งแล้ว! รอรับแจ้งเตือนทาง Telegram ได้เลยบอส!");
        setCompetitorUrl("");
        setOurProduct("");
      } else {
        alert("❌ เกิดข้อผิดพลาด: " + data.error);
      }
    } catch(err) {
      alert("❌ " + String(err));
    }
    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>🕵️ สายลับถอดรหัสคู่แข่ง (Competitor Spy)</h2>
        <span style={styles.badge}>ลับสุดยอด</span>
      </div>
      <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 16 }}>
        ก๊อปปี้สคริปต์ไวรัล หรือลิงก์คลิปคู่แข่งมาวาง แล้วบอกสินค้าของเรา AI จะถอดโครงสร้าง Hook ลับ แล้วเขียนสคริปต์ใหม่ให้เป๊ะ!
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <textarea 
          placeholder="วางสคริปต์คู่แข่ง หรือ อธิบายเนื้อหาคลิปคู่แข่งที่ไวรัล..." 
          style={{ ...styles.input, height: 60, resize: "none" }}
          value={competitorUrl}
          onChange={e => setCompetitorUrl(e.target.value)}
          disabled={loading}
        />
        <input 
          placeholder="ชื่อสินค้าของเรา / จุดเด่นที่เราอยากเน้น..." 
          style={styles.input}
          value={ourProduct}
          onChange={e => setOurProduct(e.target.value)}
          disabled={loading}
        />
        <button 
          style={styles.btnPrimary} 
          onClick={handleStartSpy} 
          disabled={loading || !competitorUrl || !ourProduct}
        >
          {loading ? "กำลังแฮ็กข้อมูล..." : "🕵️ สั่งสายลับทำงาน"}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: "linear-gradient(135deg, rgba(15,23,42,0.8) 0%, rgba(30,41,59,0.8) 100%)", 
    border: "1px solid rgba(56,189,248,0.2)",
    borderRadius: 12, padding: 20, marginBottom: 20,
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  title: { fontSize: 16, fontWeight: 700, margin: 0, color: "#38bdf8" },
  badge: { 
    background: "rgba(220,38,38,0.2)", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)",
    fontSize: 10, padding: "2px 8px", borderRadius: 12, fontWeight: 700
  },
  input: {
    width: "100%", padding: "10px 14px", borderRadius: 8,
    background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff",
    fontSize: 14, outline: "none"
  },
  btnPrimary: {
    width: "100%", background: "linear-gradient(135deg, #0284c7 0%, #2563eb 100%)",
    color: "#fff", border: "none", padding: "10px", borderRadius: 8, fontWeight: 600, cursor: "pointer",
    fontSize: 14, transition: "0.2s"
  }
};
