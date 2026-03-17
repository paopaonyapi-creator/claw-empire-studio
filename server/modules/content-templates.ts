/**
 * Content Templates — Pre-built task templates for quick creation
 *
 * Templates for common affiliate content workflows:
 * - TikTok Script (ปักตะกร้า)
 * - Product Review
 * - Trend Research
 * - Thumbnail Brief
 * - Comparison Post
 * - Unboxing Script
 */

import type { DatabaseSync } from "node:sqlite";

interface ContentTemplate {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  category: "research" | "content" | "creative" | "analytics";
  description: string;
  promptTemplate: string;
  suggestedAgent: string;
  estimatedTime: string;
  platforms: string[];
}

const TEMPLATES: ContentTemplate[] = [
  {
    id: "tiktok-script",
    name: "🎬 TikTok Script (ปักตะกร้า)",
    nameEn: "TikTok Script",
    icon: "🎬",
    category: "content",
    description: "สร้าง script วิดีโอ TikTok สำหรับปักตะกร้า พร้อม hook, content, CTA",
    promptTemplate:
      "เขียน TikTok script สำหรับรีวิวสินค้า {{product}} เน้นปักตะกร้า\n\n" +
      "โครงสร้าง:\n" +
      "1. Hook (3-5 วินาทีแรก) — ดึงดูดให้หยุดเลื่อน\n" +
      "2. Content (15-30 วิ) — รีวิวจุดเด่น ข้อดี การใช้งาน\n" +
      "3. CTA (5 วิ) — ปักตะกร้า / กดลิงก์\n\n" +
      "ใส่ hashtag แนะนำ 5-8 อัน\n" +
      "ระบุ music/sound effect แนะนำ\n" +
      "ความยาวรวม 30-60 วิ",
    suggestedAgent: "Content Writer",
    estimatedTime: "5-10 min",
    platforms: ["TikTok"],
  },
  {
    id: "product-review",
    name: "⭐ Product Review",
    nameEn: "Product Review",
    icon: "⭐",
    category: "content",
    description: "เขียนรีวิวสินค้าละเอียด พร้อม pros/cons สำหรับ Facebook post",
    promptTemplate:
      "เขียนรีวิวสินค้า {{product}} แบบละเอียด\n\n" +
      "หัวข้อ:\n" +
      "1. ภาพรวมสินค้า (ราคา, แบรนด์)\n" +
      "2. Unboxing & First Impression\n" +
      "3. ข้อดี 3-5 จุด\n" +
      "4. ข้อเสีย 1-2 จุด (ให้ดูเป็นธรรมชาติ)\n" +
      "5. เหมาะกับใคร?\n" +
      "6. สรุป + ลิงก์สั่งซื้อ\n\n" +
      "เขียนภาษาไทย กันเอง อ่านง่าย",
    suggestedAgent: "Content Writer",
    estimatedTime: "10-15 min",
    platforms: ["Facebook", "Instagram"],
  },
  {
    id: "trend-research",
    name: "🔍 Trend Research",
    nameEn: "Trend Research",
    icon: "🔍",
    category: "research",
    description: "วิเคราะห์ trending สินค้า affiliate บน TikTok Shop / Shopee / Lazada",
    promptTemplate:
      "วิเคราะห์ trend สินค้า affiliate ในหมวด {{category}} ที่กำลังมาแรง\n\n" +
      "ครอบคลุม:\n" +
      "1. Top 5 สินค้าที่ trend\n" +
      "2. เหตุผลที่ trend (seasonality, viral, influencer)\n" +
      "3. ช่วงราคาที่ขายดี\n" +
      "4. Commission rate โดยเฉลี่ย\n" +
      "5. คู่แข่ง affiliate ที่ทำอยู่\n" +
      "6. โอกาส gap ที่เราจะเข้าได้\n\n" +
      "แพลตฟอร์ม: TikTok Shop, Shopee, Lazada",
    suggestedAgent: "Trend Hunter",
    estimatedTime: "10-15 min",
    platforms: ["TikTok", "Shopee", "Lazada"],
  },
  {
    id: "thumbnail-brief",
    name: "🎨 Thumbnail Brief",
    nameEn: "Thumbnail Brief",
    icon: "🎨",
    category: "creative",
    description: "สร้าง brief สำหรับ thumbnail/cover ที่ดึงดูดคลิก",
    promptTemplate:
      "สร้าง thumbnail brief สำหรับ {{content_type}} เรื่อง {{topic}}\n\n" +
      "รายละเอียด:\n" +
      "1. ข้อความหลัก (2-3 คำ ตัวใหญ่)\n" +
      "2. ข้อความรอง (1 บรรทัด)\n" +
      "3. Color scheme แนะนำ\n" +
      "4. Element ที่ต้องมี (สินค้า, emoji, before/after)\n" +
      "5. Style reference (ถ้ามี)\n" +
      "6. ขนาด: 1080x1920 (9:16 TikTok) หรือ 1080x1080 (IG)\n\n" +
      "เน้น CTR สูง — ดึงดูดให้คลิกเข้าดู",
    suggestedAgent: "Visual Designer",
    estimatedTime: "5-8 min",
    platforms: ["TikTok", "Instagram"],
  },
  {
    id: "comparison-post",
    name: "⚖️ Comparison Post",
    nameEn: "Comparison Post",
    icon: "⚖️",
    category: "content",
    description: "เปรียบเทียบ 2-3 สินค้าในหมวดเดียวกัน — content ที่ engagement สูง",
    promptTemplate:
      "เขียน comparison post เปรียบเทียบ {{product_list}}\n\n" +
      "หัวข้อเปรียบเทียบ:\n" +
      "1. ราคา\n" +
      "2. คุณสมบัติหลัก\n" +
      "3. ข้อดี/ข้อเสียแต่ละตัว\n" +
      "4. เหมาะกับใคร (budget, premium, mid-range)\n" +
      "5. สรุป: ตัวไหนคุ้มค่าที่สุด?\n\n" +
      "ใส่ตารางเปรียบเทียบ\n" +
      "ลิงก์สั่งซื้อแต่ละตัว",
    suggestedAgent: "Hook & Copy Specialist",
    estimatedTime: "10-15 min",
    platforms: ["Facebook", "TikTok"],
  },
  {
    id: "unboxing-script",
    name: "📦 Unboxing Script",
    nameEn: "Unboxing Script",
    icon: "📦",
    category: "content",
    description: "Script สำหรับวิดีโอ unboxing สินค้า — ตื่นเต้นและจริงใจ",
    promptTemplate:
      "เขียน unboxing script สำหรับสินค้า {{product}}\n\n" +
      "โครงสร้าง:\n" +
      "1. Teaser (3 วิ) — กล่องเข้าฉาก ไม่เฉลย\n" +
      "2. First Look (10 วิ) — เปิดกล่อง reaction จริง\n" +
      "3. Detail (20 วิ) — ดูรายละเอียด สัมผัส ขนาด\n" +
      "4. Quick Test (15 วิ) — ลองใช้งานจริง\n" +
      "5. Verdict (10 วิ) — สรุป + ปักตะกร้า\n\n" +
      "tone: ตื่นเต้น จริงใจ ไม่ overhype\n" +
      "ความยาวรวม ~60 วิ",
    suggestedAgent: "Video Script Producer",
    estimatedTime: "5-10 min",
    platforms: ["TikTok"],
  },
];

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

export function registerTemplateRoutes(app: any, db: DatabaseSync): void {
  // GET /api/templates — list all templates
  app.get("/api/templates", (_req: any, res: any) => {
    res.json({
      ok: true,
      templates: TEMPLATES.map((t) => ({
        id: t.id,
        name: t.name,
        nameEn: t.nameEn,
        icon: t.icon,
        category: t.category,
        description: t.description,
        suggestedAgent: t.suggestedAgent,
        estimatedTime: t.estimatedTime,
        platforms: t.platforms,
      })),
      total: TEMPLATES.length,
    });
  });

  // POST /api/templates/:id/create — create task from template
  app.post("/api/templates/:id/create", (req: any, res: any) => {
    const template = TEMPLATES.find((t) => t.id === req.params.id);
    if (!template) return res.status(404).json({ error: "Template not found" });

    const variables = req.body?.variables || {};
    let prompt = template.promptTemplate;
    for (const [key, value] of Object.entries(variables)) {
      prompt = prompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value));
    }

    // Find suggested agent
    let agentId: string | null = null;
    try {
      const agentRow = db
        .prepare("SELECT id FROM agents WHERE name LIKE ? LIMIT 1")
        .get(`%${template.suggestedAgent}%`) as { id: string } | undefined;
      agentId = agentRow?.id || null;
    } catch {
      // skip
    }

    // Create task
    const taskId = `tmpl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      db.prepare(
        `INSERT INTO tasks (id, title, description, status, assigned_agent_id, created_at, task_type)
         VALUES (?, ?, ?, 'inbox', ?, ?, ?)`,
      ).run(taskId, template.name, prompt, agentId, Date.now(), template.category);

      res.json({
        ok: true,
        task: {
          id: taskId,
          title: template.name,
          description: prompt,
          assigned_agent_id: agentId,
          status: "inbox",
          template_id: template.id,
        },
      });
    } catch (err) {
      res.status(500).json({ error: "task_creation_failed", detail: err instanceof Error ? err.message : String(err) });
    }
  });

  console.log(`[Templates] ✅ API ready: /api/templates (${TEMPLATES.length} templates)`);
}
