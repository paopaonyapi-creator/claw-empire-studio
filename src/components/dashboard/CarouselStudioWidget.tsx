import { useState } from "react";

export function CarouselStudioWidget() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [productName, setProductName] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [hooks, setHooks] = useState<string[]>([]);
  const [downloading, setDownloading] = useState(false);

  const handleGenerate = async () => {
    if (!url) return;
    setLoading(true);
    setImages([]);
    setHooks([]);
    try {
      // 1. Scrape
      const scrapeRes = await fetch("/api/scrape-product", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      const scrapeData = await scrapeRes.json();
      if (!scrapeData.ok) throw new Error("Scrape failed");
      
      let scrapedImages = scrapeData.images || [];
      // Ensure we have 4 images to match 4 hooks safely
      if (scrapedImages.length === 0) throw new Error("No images found");
      while (scrapedImages.length < 4) {
        scrapedImages.push(scrapedImages[0]); // fallback duplicate
      }
      scrapedImages = scrapedImages.slice(0, 4);
      
      setProductName(scrapeData.productName);
      setImages(scrapedImages);
      
      // 2. Generate hooks
      const hookRes = await fetch("/api/ai/carousel-hooks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: scrapeData.productName })
      });
      const hookData = await hookRes.json();
      if (hookData.ok) {
        setHooks(hookData.hooks);
      }
    } catch(err) {
      alert("Error: " + String(err));
    }
    setLoading(false);
  };
  
  const handleDownload = async () => {
    const el = document.getElementById("carousel-slides-container");
    if (!el || !(window as any).html2canvas) return;
    setDownloading(true);
    try {
      const canvas = await (window as any).html2canvas(el, { useCORS: true, allowTaint: true, scale: 2 });
      const link = document.createElement("a");
      link.download = `carousel-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch(err) {
      alert("ดาวน์โหลดล้มเหลว: " + String(err));
    }
    setDownloading(false);
  };

  const handleDownloadPack = async () => {
    const container = document.getElementById("carousel-slides-container");
    if (!container || !(window as any).html2canvas || !(window as any).JSZip) return;
    
    setDownloading(true);
    try {
      const zip = new (window as any).JSZip();
      const slides = Array.from(container.children) as HTMLElement[];
      
      for (let i = 0; i < slides.length; i++) {
        const canvas = await (window as any).html2canvas(slides[i], { useCORS: true, allowTaint: true, scale: 2 });
        const dataUrl = canvas.toDataURL("image/png");
        const base64Data = dataUrl.replace(/^data:image\/(png|jpg);base64,/, "");
        zip.file(`slide-${i + 1}.png`, base64Data, { base64: true });
      }

      const textContent = `Product: ${productName}\nURL: ${url}\n\nHooks / Captions:\n` + hooks.map((h, i) => `${i + 1}. ${h}`).join("\n");
      zip.file("caption.txt", textContent);

      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.download = `carousel-pack-${Date.now()}.zip`;
      link.href = URL.createObjectURL(content);
      link.click();
    } catch(err) {
      alert("ดาวน์โหลดล้มเหลว: " + String(err));
    }
    setDownloading(false);
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>🖼️ สตูดิโอเสกภาพสไลด์ (Auto-Carousel)</h2>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>วางลิงก์ Shopee/Lazada เพื่อดึงรูปมาทำสไลด์ TikTok 9:16 พร้อมให้ AI เขียน Hook ทับรูปให้ทันที</p>
      
      <div style={styles.inputRow}>
        <input 
          placeholder="วางลิงก์สินค้าที่นี่..." 
          style={styles.input} 
          value={url} onChange={e => setUrl(e.target.value)} 
          disabled={loading}
        />
        <button style={styles.btnPrimary} onClick={handleGenerate} disabled={loading || !url}>
          {loading ? "⏳ กำลังดึงรูป+คิดคำ..." : "✨ สร้างสไลด์"}
        </button>
      </div>

      {images.length > 0 && hooks.length > 0 && (
        <div style={styles.resultArea}>
          <div style={styles.actionRow}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>ผลลัพธ์: {productName}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{...styles.btnSecondary, background: "rgba(255,255,255,0.05)"}} onClick={handleDownload} disabled={downloading}>
                {downloading ? "..." : "🖼️ โหลดรูปรวม"}
              </button>
              <button style={{...styles.btnSecondary, background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", border: 'none'}} onClick={handleDownloadPack} disabled={downloading}>
                {downloading ? "กำลังแพ็ค..." : "📦 โหลด Zip (รูป+คำ)"}
              </button>
            </div>
          </div>
          
          <div id="carousel-slides-container" style={styles.slidesContainer}>
            {images.map((img, idx) => (
              <div key={idx} style={styles.slide}>
                {/* Proxy image via our backend to bypass CORS */}
                <img src={`/api/proxy-image?url=${encodeURIComponent(img)}`} style={styles.slideBg} crossOrigin="anonymous" />
                <div style={styles.overlay}></div>
                <div style={styles.textOverlay}>
                  {hooks[idx] || hooks[0]}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: "rgba(30,30,40,0.4)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12, padding: 20, marginBottom: 20,
  },
  title: { fontSize: 16, fontWeight: 700, margin: "0 0 6px 0", color: "#e2e8f0" },
  inputRow: { display: "flex", gap: 8, marginBottom: 20 },
  input: {
    flex: 1, padding: "10px 14px", borderRadius: 8,
    background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff"
  },
  btnPrimary: {
    background: "linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)",
    color: "#fff", border: "none", padding: "0 20px", borderRadius: 8, fontWeight: 600, cursor: "pointer"
  },
  btnSecondary: {
    background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)",
    padding: "6px 14px", borderRadius: 6, fontSize: 13, cursor: "pointer", fontWeight: 500
  },
  resultArea: { background: "rgba(0,0,0,0.2)", padding: 16, borderRadius: 12 },
  actionRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  slidesContainer: {
    display: "flex", gap: 12, overflowX: "auto" as const, paddingBottom: 10
  },
  slide: {
    position: "relative" as const, width: 140, height: 250, flexShrink: 0,
    borderRadius: 8, overflow: "hidden", background: "#000",
    display: "flex", alignItems: "center", justifyContent: "center"
  },
  slideBg: {
    position: "absolute" as const, width: "100%", height: "100%", objectFit: "cover" as const
  },
  overlay: {
    position: "absolute" as const, bottom: 0, left: 0, right: 0, height: "60%",
    background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)"
  },
  textOverlay: {
    position: "absolute" as const, bottom: 16, left: 10, right: 10,
    color: "#fff", fontSize: 16, fontWeight: 800, textAlign: "center" as const,
    textShadow: "1px 1px 4px rgba(0,0,0,0.8), 0px 0px 8px rgba(0,0,0,0.5)",
    lineHeight: 1.2
  }
};
