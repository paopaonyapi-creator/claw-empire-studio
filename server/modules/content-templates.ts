/**
 * Content Template Library — Ready-made templates per platform
 * TikTok scripts, FB posts, IG captions, product reviews
 */

import type { Express } from "express";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContentTemplate {
  id: string;
  name: string;
  category: string;
  platform: "tiktok" | "facebook" | "instagram" | "all";
  template: string;
  variables: string[];
  example: string;
  tags: string[];
}

// ---------------------------------------------------------------------------
// Built-in Templates
// ---------------------------------------------------------------------------

const TEMPLATES: ContentTemplate[] = [
  {
    id: "tiktok-review-30s",
    name: "TikTok รีวิว 30 วินาที",
    category: "product-review",
    platform: "tiktok",
    template: "HOOK (0-3s): \"{hook_line}\"\n\nBODY (4-25s):\nวันนี้มารีวิว {product_name}\n- ข้อดี: {pro_1}\n- ข้อดี: {pro_2}\n- ข้อเสีย: {con_1}\nราคา: {price}\n\nCTA (26-30s): กดตะกร้าส้มเลย! #รีวิว #{product_hashtag}",
    variables: ["hook_line", "product_name", "pro_1", "pro_2", "con_1", "price", "product_hashtag"],
    example: "รีวิวหูฟัง Bluetooth 299 บาท",
    tags: ["review", "30s"],
  },
  {
    id: "tiktok-compare",
    name: "TikTok เปรียบเทียบสินค้า",
    category: "comparison",
    platform: "tiktok",
    template: "HOOK: \"{product_a} vs {product_b} ตัวไหนคุ้ม?\"\n\nเปรียบเทียบ:\n{product_a}: ราคา {price_a} | คุณภาพ {quality_a}\n{product_b}: ราคา {price_b} | คุณภาพ {quality_b}\n\nสรุป: {winner} ชนะ!\nCTA: กดตะกร้าเลย!",
    variables: ["product_a", "product_b", "price_a", "price_b", "quality_a", "quality_b", "winner"],
    example: "AirPods Pro vs Galaxy Buds",
    tags: ["comparison", "versus"],
  },
  {
    id: "tiktok-unboxing",
    name: "TikTok Unboxing",
    category: "unboxing",
    platform: "tiktok",
    template: "HOOK: \"เพิ่งได้ {product_name} มา แกะเลย!\"\n\n1. กล่อง: {box_desc}\n2. ในกล่อง: {contents}\n3. First impression: {first_impression}\n\nให้ {rating}/10\nราคา: {price} | ซื้อได้ที่ลิงก์ด้านล่าง",
    variables: ["product_name", "box_desc", "contents", "first_impression", "rating", "price"],
    example: "แกะกล่อง iPhone 16 Pro",
    tags: ["unboxing"],
  },
  {
    id: "fb-affiliate",
    name: "Facebook Affiliate Post",
    category: "affiliate",
    platform: "facebook",
    template: "{product_name}\n\n{intro_text}\n\nข้อดี:\n- {pro_1}\n- {pro_2}\n- {pro_3}\n\nข้อควรรู้: {note_1}\n\nราคา: {price} (ปกติ {original_price}) ลด {discount}%!\n\nสั่งซื้อ: {link}\n#รีวิว #{product_hashtag}",
    variables: ["product_name", "intro_text", "pro_1", "pro_2", "pro_3", "note_1", "price", "original_price", "discount", "link", "product_hashtag"],
    example: "รีวิวเครื่องชงกาแฟ ลด 40%",
    tags: ["affiliate", "promotion"],
  },
  {
    id: "fb-storytelling",
    name: "Facebook Storytelling",
    category: "story",
    platform: "facebook",
    template: "{hook_story}\n\nก่อนหน้านี้... {before_story}\nแต่พอได้ลอง {product_name}...\n{after_story}\nตอนนี้ {current_result}\n\nแนะนำ {product_name} เลย!\nราคา: {price}\nลิงก์: {link}",
    variables: ["hook_story", "before_story", "product_name", "after_story", "current_result", "price", "link"],
    example: "เล่าประสบการณ์ใช้ครีมกันแดด",
    tags: ["storytelling", "personal"],
  },
  {
    id: "ig-carousel",
    name: "IG Carousel Review",
    category: "carousel",
    platform: "instagram",
    template: "Slide 1: {product_name} — Worth it? {emoji}\nSlide 2: สเปค + ราคา\nSlide 3: ข้อดี 3 ข้อ\nSlide 4: ข้อเสีย + ทางเลือก\nSlide 5: สรุป + CTA\n\nCaption: {caption_text}\n{hashtags}",
    variables: ["product_name", "emoji", "caption_text", "hashtags"],
    example: "รีวิว MacBook Air M3 carousel",
    tags: ["carousel", "instagram"],
  },
  {
    id: "ig-reel",
    name: "IG Reel Script",
    category: "reel",
    platform: "instagram",
    template: "HOOK (0-2s): {hook_text}\nDEMO (3-12s): {demo_description}\nRESULT (13-18s): {result_text}\nCTA (19-20s): {cta_text}\n\nCaption: {caption}\nMusic: {music_suggestion}",
    variables: ["hook_text", "demo_description", "result_text", "cta_text", "caption", "music_suggestion"],
    example: "Reel สาธิตเครื่องสำอาง 20 วินาที",
    tags: ["reel", "short-form"],
  },
  {
    id: "top-list",
    name: "Top N List (All Platforms)",
    category: "list",
    platform: "all",
    template: "TOP {count} {category} ที่ต้องมี!\n\n1. {item_1} — {reason_1} ({price_1})\n2. {item_2} — {reason_2} ({price_2})\n3. {item_3} — {reason_3} ({price_3})\n\nแนะนำที่สุด: {best_pick}\nเหตุผล: {best_reason}\n\nลิงก์ทั้งหมดอยู่ในคอมเม้นท์!",
    variables: ["count", "category", "item_1", "reason_1", "price_1", "item_2", "reason_2", "price_2", "item_3", "reason_3", "price_3", "best_pick", "best_reason"],
    example: "Top 3 หูฟัง Bluetooth ไม่เกิน 1,000",
    tags: ["top-list", "ranking"],
  },
];

const userTemplates: ContentTemplate[] = [];

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

export function fillTemplate(templateId: string, vars: Record<string, string>): string {
  const tmpl = [...userTemplates, ...TEMPLATES].find(t => t.id === templateId);
  if (!tmpl) return "";
  let result = tmpl.template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return result;
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

export function registerContentTemplateRoutes(app: Express): void {
  app.get("/api/templates", (req, res) => {
    const platform = req.query.platform as string;
    const category = req.query.category as string;
    let all = [...userTemplates, ...TEMPLATES];
    if (platform) all = all.filter(t => t.platform === platform || t.platform === "all");
    if (category) all = all.filter(t => t.category === category);
    res.json({ ok: true, templates: all, total: all.length });
  });

  app.get("/api/templates/:id", (req, res) => {
    const tmpl = [...userTemplates, ...TEMPLATES].find(t => t.id === req.params.id);
    if (!tmpl) return res.status(404).json({ ok: false, error: "Template not found" });
    res.json({ ok: true, template: tmpl });
  });

  app.post("/api/templates/:id/fill", (req, res) => {
    const result = fillTemplate(req.params.id, req.body || {});
    if (!result) return res.status(404).json({ ok: false, error: "Template not found" });
    res.json({ ok: true, content: result });
  });

  app.post("/api/templates/:id/generate", async (req, res) => {
    const { product } = req.body || {};
    const tmpl = [...userTemplates, ...TEMPLATES].find(t => t.id === req.params.id);
    if (!tmpl) return res.status(404).json({ ok: false, error: "Template not found" });
    try {
      const { routedGenerate } = await import("./agent-router.ts");
      const result = await routedGenerate({
        agentRole: "content_writer",
        taskType: tmpl.category,
        prompt: `ใช้ template นี้สร้าง content:\n\n${tmpl.template}\n\nสินค้า: ${product || "สินค้าตัวอย่าง"}\n\nเติมตัวแปรทั้งหมดให้ครบ เขียนให้น่าสนใจ`,
        maxTokens: 768,
      });
      res.json({ ok: true, template: tmpl.name, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  app.post("/api/templates", (req, res) => {
    const data = req.body as Partial<ContentTemplate>;
    if (!data.name || !data.template) return res.status(400).json({ ok: false, error: "name and template required" });
    const tmpl: ContentTemplate = {
      id: `custom_${Date.now()}`,
      name: data.name,
      category: data.category || "custom",
      platform: (data.platform as any) || "all",
      template: data.template,
      variables: data.variables || [],
      example: data.example || "",
      tags: data.tags || ["custom"],
    };
    userTemplates.push(tmpl);
    res.json({ ok: true, template: tmpl });
  });

  console.log(`[Templates] ✅ ${TEMPLATES.length} content templates loaded`);
}
