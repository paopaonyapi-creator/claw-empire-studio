/**
 * Auto-Pipeline — Chained content creation workflows
 *
 * One command → multiple tasks chained automatically
 * Research → Script → Thumbnail → Review
 */

import type { Express } from "express";

const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Pipeline Definitions
// ---------------------------------------------------------------------------

interface PipelineStep {
  order: number;
  templateId: string;
  label: string;
  icon: string;
  dependsOn: number | null; // order of previous step, null = first
}

interface PipelineTemplate {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  description: string;
  steps: PipelineStep[];
  estimatedTime: string;
}

const PIPELINES: PipelineTemplate[] = [
  {
    id: "tiktok-full",
    name: "TikTok Full Pipeline",
    nameEn: "TikTok Full Pipeline",
    icon: "🎬",
    description: "Research → Script → Thumbnail — ครบ flow TikTok",
    estimatedTime: "20-30 min",
    steps: [
      { order: 1, templateId: "trend-research", label: "🔍 Trend Research", icon: "🔍", dependsOn: null },
      { order: 2, templateId: "tiktok-script", label: "✍️ TikTok Script", icon: "✍️", dependsOn: 1 },
      { order: 3, templateId: "thumbnail-brief", label: "🎨 Thumbnail Brief", icon: "🎨", dependsOn: 2 },
    ],
  },
  {
    id: "review-full",
    name: "Review Full Pipeline",
    nameEn: "Review Full Pipeline",
    icon: "⭐",
    description: "Research → Review → Comparison — ครบ flow รีวิว",
    estimatedTime: "25-35 min",
    steps: [
      { order: 1, templateId: "trend-research", label: "🔍 Trend Research", icon: "🔍", dependsOn: null },
      { order: 2, templateId: "product-review", label: "⭐ Product Review", icon: "⭐", dependsOn: 1 },
      { order: 3, templateId: "comparison-post", label: "⚖️ Comparison Post", icon: "⚖️", dependsOn: 2 },
    ],
  },
  {
    id: "unbox-full",
    name: "Unboxing Full Pipeline",
    nameEn: "Unboxing Full Pipeline",
    icon: "📦",
    description: "Research → Unboxing → Thumbnail — ครบ flow แกะกล่อง",
    estimatedTime: "20-30 min",
    steps: [
      { order: 1, templateId: "trend-research", label: "🔍 Research", icon: "🔍", dependsOn: null },
      { order: 2, templateId: "unboxing-script", label: "📦 Unboxing Script", icon: "📦", dependsOn: 1 },
      { order: 3, templateId: "thumbnail-brief", label: "🎨 Thumbnail", icon: "🎨", dependsOn: 2 },
    ],
  },
  {
    id: "competitor-spy-full",
    name: "Competitor Spy Pipeline",
    nameEn: "Competitor Spy Pipeline",
    icon: "🕵️",
    description: "ถอดรหัสคลิปไวรัลคู่แข่ง → เขียนสคริปต์สินค้าเรา แบบเป๊ะๆ",
    estimatedTime: "10-15 min",
    steps: [
      { order: 1, templateId: "competitor-spy-rewrite", label: "✍️ Spy & Rewrite", icon: "🕵️", dependsOn: null },
      { order: 2, templateId: "thumbnail-brief", label: "🎨 Thumbnail Brief", icon: "🎨", dependsOn: 1 },
    ],
  },
];

// Active pipeline tracking
interface ActivePipeline {
  id: string;
  pipelineId: string;
  product: string;
  startedAt: string;
  status: "running" | "done" | "failed";
  currentStep: number;
  totalSteps: number;
  steps: Array<{
    order: number;
    label: string;
    taskId: string | null;
    status: "pending" | "running" | "done" | "failed";
    startedAt: string | null;
    completedAt: string | null;
  }>;
}

export const activePipelines: Map<string, ActivePipeline> = new Map();

// ---------------------------------------------------------------------------
// Pipeline Execution
// ---------------------------------------------------------------------------

function getVariableKey(templateId: string): string {
  if (templateId === "trend-research") return "category";
  if (templateId === "thumbnail-brief") return "topic";
  if (templateId === "comparison-post") return "product_list";
  return "product";
}

async function createTaskFromTemplate(templateId: string, product: string): Promise<{ ok: boolean; taskId?: string; title?: string }> {
  try {
    const variableKey = getVariableKey(templateId);
    const res = await fetch(`http://127.0.0.1:${PORT}/api/templates/${templateId}/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variables: { [variableKey]: product } }),
    });

    if (!res.ok) return { ok: false };

    const data = (await res.json()) as { ok?: boolean; task?: { id: string; title: string } };
    if (data.ok && data.task) {
      // Smart Auto-Assign: find best agent for this step
      try {
        const { findBestAgentForStep } = await import("./smart-assignment.ts");
        const bestAgentId = await findBestAgentForStep(templateId, data.task.title);
        if (bestAgentId) {
          await fetch(`http://127.0.0.1:${PORT}/api/tasks/${data.task.id}/assign`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agent_id: bestAgentId }),
          }).catch(() => {});
        }
      } catch {}

      // Auto-run the task
      fetch(`http://127.0.0.1:${PORT}/api/tasks/${data.task.id}/run`, { method: "POST" }).catch(() => {});
      return { ok: true, taskId: data.task.id, title: data.task.title };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}


export async function sendTgNotification(text: string, reply_markup?: any): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  const chatId = process.env.TELEGRAM_CHAT_ID || "";
  if (!token || !chatId) return;

  const payload: any = { chat_id: chatId, text, parse_mode: "HTML" };
  if (reply_markup) {
    payload.reply_markup = reply_markup;
  }

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

async function executePipeline(pipelineId: string, displayProduct: string, promptProduct: string): Promise<ActivePipeline> {
  const template = PIPELINES.find((p) => p.id === pipelineId);
  if (!template) throw new Error(`Pipeline ${pipelineId} not found`);

  const id = `pl_${Date.now()}`;
  const pipeline: ActivePipeline = {
    id,
    pipelineId,
    product: displayProduct,
    startedAt: new Date().toISOString(),
    status: "running",
    currentStep: 1,
    totalSteps: template.steps.length,
    steps: template.steps.map((s) => ({
      order: s.order,
      label: s.label,
      taskId: null,
      status: "pending",
      startedAt: null,
      completedAt: null,
    })),
  };

  activePipelines.set(id, pipeline);

  // Notify start
    const stepsPreview = template.steps.map((s) => `  ${s.icon} ${s.label}`).join("\n");
  await sendTgNotification(
    `🚀 <b>Pipeline Started!</b>\n\n` +
      `📋 ${template.nameEn}\n` +
      `📝 "${displayProduct}"\n` +
      `⏱ ~${template.estimatedTime}\n\n` +
      `<b>Steps:</b>\n${stepsPreview}`,
  );

  // Execute steps sequentially with delays
  for (const step of template.steps) {
    const pipelineStep = pipeline.steps[step.order - 1];
    pipelineStep.status = "running";
    pipelineStep.startedAt = new Date().toISOString();
    pipeline.currentStep = step.order;

    const result = await createTaskFromTemplate(step.templateId, promptProduct);

    if (result.ok) {
      pipelineStep.taskId = result.taskId || null;
      pipelineStep.status = "done";
      pipelineStep.completedAt = new Date().toISOString();

      await sendTgNotification(`✅ Step ${step.order}/${template.steps.length}: ${step.label}\n📝 ${result.title || "Task created"}`);
    } else {
      pipelineStep.status = "failed";
      pipeline.status = "failed";
      await sendTgNotification(`❌ Step ${step.order} failed: ${step.label}`);
      break;
    }

    // Wait between steps (give agent time to process)
    if (step.order < template.steps.length) {
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  if (pipeline.status !== "failed") {
    pipeline.status = "done";
    const reply_markup = {
      inline_keyboard: [
        [{ text: "👍 โพสต์ตอนนี้เลย (Facebook)", callback_data: `post_${id}` }],
        [{ text: "✏️ แก้ไขแคปชัน", callback_data: `edit_${id}` }]
      ]
    };
    await sendTgNotification(
      `🎉 <b>Pipeline Complete!</b>\n\n` +
        `📋 ${template.nameEn}\n` +
        `📝 "${displayProduct}"\n` +
        `✅ ${template.steps.length}/${template.steps.length} steps done\n\n` +
        `บอสจะให้จัดการยังไงต่อดีคะ? 👇`,
      reply_markup
    );
  }

  return pipeline;
}

// ---------------------------------------------------------------------------
// TG Command Handler (exported for ceo-chat)
// ---------------------------------------------------------------------------

export async function handlePipelineCommand(command: string, arg: string): Promise<string> {
  if (command === "/pipeline" && !arg) {
    return (
      `🔄 <b>Auto-Pipelines</b>\n\n` +
      PIPELINES.map((p) => `${p.icon} /pipeline-${p.id.replace("-full", "")} <สินค้า>\n   ${p.description}`).join("\n\n") +
      `\n\n💡 ตัวอย่าง: /pipeline-tiktok เครื่องปั่น Philips`
    );
  }

  // Find matching pipeline
  const pipelineMap: Record<string, string> = {
    "/pipeline-tiktok": "tiktok-full",
    "/pipeline-review": "review-full",
    "/pipeline-unbox": "unbox-full",
  };

  const pipelineId = pipelineMap[command];
  if (!pipelineId) return "";

  if (!arg.trim()) return `⚠️ กรุณาใส่ชื่อสินค้า เช่น: ${command} เครื่องปั่น Philips`;

  // Execute in background
  executePipeline(pipelineId, arg.trim(), arg.trim()).catch(() => {});

  const template = PIPELINES.find((p) => p.id === pipelineId);
  return `🚀 <b>Starting ${template?.nameEn || "Pipeline"}!</b>\n\n📝 "${arg.trim()}"\n⏱ ~${template?.estimatedTime || "20-30 min"}\n\nจะแจ้งทุก step ใน TG 📡`;
}

export async function handleTelegramCallback(queryId: string, data: string, chatId: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  if (!token) return;

  if (data.startsWith("post_")) {
    const pipelineId = data.replace("post_", "");
    const pipeline = activePipelines.get(pipelineId);

    // answer the callback query to stop loading
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: queryId, text: "รับทราบ! กำลังเตรียมโพสต์..." }),
    }).catch(() => {});

    if (pipeline) {
      // Find the last completed task
      const lastStep = [...pipeline.steps].reverse().find((s) => s.taskId && s.status === "done");
      let messageToPost = `(Auto-generated from ${pipeline.product})`;

      if (lastStep && lastStep.taskId) {
        try {
          const res = await fetch(`http://127.0.0.1:${PORT}/api/tasks/${lastStep.taskId}`);
          if (res.ok) {
            const json = (await res.json()) as any;
            if (json.task?.result) {
              messageToPost = json.task.result;
            }
          }
        } catch (e) {}
      }

      const date = new Date();
      date.setMinutes(date.getMinutes() + 5);
      const scheduledTime = date.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm

      try {
        const fbPub = await import("./facebook-publisher.ts");
        fbPub.scheduleFbPostExternal(messageToPost, scheduledTime);

        // Update inline message if possible or just send new notification
        await sendTgNotification(
          `✅ <b>จัดคิวให้แล้วบอส!</b>\n\nระบบจะเริ่มโพสต์รีวิวของ <b>${pipeline.product}</b> ลงหน้าเพจ Facebook อัตโนมัติในอีก 5 นาทีครับ 🚀 (ตั้งเวลาไว้ตอน ${scheduledTime})`
        );
      } catch (err) {
        await sendTgNotification(`❌ เกิดข้อผิดพลาดในการจัดคิวลง Facebook: ${String(err)}`);
      }
    } else {
      await sendTgNotification("❌ ไม่พบข้อมูล Pipeline นี้แล้ว หรือหมดอายุ");
    }
  } else if (data.startsWith("edit_")) {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: queryId, text: "กรุณาแก้ในระบบบอทครับ" }),
    }).catch(() => {});

    await sendTgNotification(
      `✏️ ระบบแก้ไขผ่านแชทยังอยู่ในช่วงพัฒนา กรุณาเปิดหน้า Claw-Empire Dashboard แล้วคลิกโพสต์ค้างไว้ไปแก้ใน Content Calendar แทนก่อนนะครับบอส!`
    );
  } else if (data.startsWith("optimize_")) {
    const shortCode = data.replace("optimize_", "");
    
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: queryId, text: "รับทราบ! เริ่มปั่นแคปชัน A/B Testing..." }),
    }).catch(() => {});

    try {
      const linkTracker = await import("./link-tracker.ts");
      const link = linkTracker.getLinkByShortCode(shortCode);
      if (link) {
        const domain = process.env.RAILWAY_PUBLIC_DOMAIN || `127.0.0.1:${process.env.PORT || 8800}`;
        const protocol = domain.includes("127.0.0.1") || domain.includes("localhost") ? "http" : "https";
        const shortUrl = `${protocol}://${domain}/go/${link.shortCode}`;
        
        const newPrompt = `(A/B Test) สินค้า: ${link.label}\n[ACTION REQUIRED] ยอดคลิกลิงก์นี้ตกต่ำมาก กรุณาคิด Hook ให้ดึงดูด น่าสนใจ หรือเปลี่ยนมุมขยี้ปัญหา (Pain point) ด่วน! และปิดท้ายด้วยการแนบลิงก์ Affiliate นี้เสมอ: ${shortUrl}`;
        executePipeline("tiktok-full", `[A/B Test] ${link.label}`, newPrompt).catch(() => {});
      } else {
        await sendTgNotification("❌ ไม่พบข้อมูลลิงก์นี้ในระบบ (อาจเก่าเกินไป)");
      }
    } catch(err) {
      console.error(err);
    }
  }
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

export function registerAutoPipelineRoutes(app: Express): void {
  // List available pipelines
  app.get("/api/pipelines", (_req, res) => {
    res.json({
      ok: true,
      pipelines: PIPELINES.map((p) => ({
        id: p.id,
        name: p.nameEn,
        icon: p.icon,
        description: p.description,
        estimatedTime: p.estimatedTime,
        steps: p.steps.length,
      })),
    });
  });

  // Simple HTML Scraper for Affiliate Links
  app.post("/api/scrape-product", async (req, res) => {
    const { url } = req.body || {};
    if (!url || !url.startsWith("http")) {
      return res.status(400).json({ ok: false, error: "valid url is required" });
    }
    try {
      // Basic fetch
      const htmlRes = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
      });
      const htmlText = await htmlRes.text();
      // Extract <title>
      const titleMatch = htmlText.match(/<title[^>]*>([^<]+)<\/title>/i);
      let title = titleMatch ? titleMatch[1].trim() : "Unknown Product";
      
      // Clean up common store suffixes
      title = title.replace(/\| Shopee Thailand/i, "").replace(/\| Lazada\.co\.th/i, "").trim();

      // Extract OG Image
      const ogMatch = htmlText.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i) 
          || htmlText.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["'][^>]*>/i);
      const mainImageUrl = ogMatch ? ogMatch[1] : null;

      // Extract more generic images
      const imgTags = Array.from(htmlText.matchAll(/<img[^>]+src=["'](https:\/\/[^"']+)["'][^>]*>/gi));
      let extractedImages = imgTags
        .map((m) => m[1])
        .filter((u) => !u.includes(".svg") && !u.includes("logo") && !u.includes("icon"));

      extractedImages = [...new Set(extractedImages)];
      
      const finalImages: string[] = [];
      if (mainImageUrl) finalImages.push(mainImageUrl);
      for (const img of extractedImages) {
        if (img !== mainImageUrl && finalImages.length < 5) {
          finalImages.push(img);
        }
      }

      res.json({ ok: true, productName: title, imageUrl: finalImages[0] || null, images: finalImages });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e) });
    }
  });

  // Proxy Image for html2canvas to avoid CORS
  app.get("/api/proxy-image", async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) return res.status(400).send("No url");
      const imgRes = await fetch(url);
      const buffer = await imgRes.arrayBuffer();
      res.setHeader("Content-Type", imgRes.headers.get("content-type") || "image/jpeg");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.send(Buffer.from(buffer));
    } catch(e) {
      res.status(500).send("Proxy error");
    }
  });

  // Generate Carousel Hooks
  app.post("/api/ai/carousel-hooks", async (req, res) => {
    try {
      const { product } = req.body as { product: string };
      if (!product) return res.status(400).json({ ok: false, error: "no product" });

      const { geminiGenerate } = await import("./gemini-provider.ts");
      const prompt = `เขียนข้อความดึงดูดใจ (Hook/Pain point/Benefit) สั้นๆ กระชับมากๆ (ไม่เกิน 10-15 คำต่อข้อความ) สำหรับสินค้า: "${product}"
เพื่อเอาไปแปะบนรูปภาพสไลด์โชว์ (Carousel) จำนวน 4 สไลด์
กรุณาส่งกลับมาเป็น Array ของ string ในรูปแบบ JSON เท่านั้น ห้ามมีข้อความอื่น
ตัวอย่าง: ["หน้ามัน สิวบุกหนักมาก?", "ใช้ตัวนี้ ล้างสะอาดหมดจด!", "เนื้อเจล บางเบา ไม่บาดผิว", "คลิกตะกร้าด่วน ก่อนของหมด!"]`;

      const response = await geminiGenerate({ prompt });
      let hooks = ["Slide 1", "Slide 2", "Slide 3", "Slide 4"];
      try {
        const jsonMatch = response.text.match(/\[.*\]/s);
        if (jsonMatch) hooks = JSON.parse(jsonMatch[0]);
      } catch {
        // Fallback
        hooks = response.text.split("\n").filter((l: string) => l.trim().length > 0).slice(0, 4);
      }

      res.json({ ok: true, hooks: hooks.slice(0, 4) });
    } catch(err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // Auto-Reply Generator (Legacy — still works)
  app.post("/api/ai/auto-reply", async (req, res) => {
    try {
      const { comment, product, link } = req.body as { comment: string, product: string, link: string };
      if (!comment || !product || !link) {
        return res.status(400).json({ ok: false, error: "comment, product, link are required" });
      }

      const { geminiGenerate } = await import("./gemini-provider.ts");

      // Pull product catalog context from SQLite for smarter replies
      const { dbGetProducts, dbGetAllLinks } = await import("./studio-db.ts");
      const products = dbGetProducts().slice(0, 20);
      const links = dbGetAllLinks().slice(0, 20);

      let catalogContext = "";
      if (products.length > 0) {
        catalogContext += "\n\n📦 สินค้าอื่นในร้านที่สามารถแนะนำเพิ่มเติม:\n";
        for (const p of products.slice(0, 8)) {
          catalogContext += `- ${p.name} (${p.platform}, ${p.category})\n`;
        }
      }
      if (links.length > 0) {
        catalogContext += "\n🔗 Affiliate Links ที่มีในระบบ:\n";
        for (const l of links.slice(0, 8)) {
          catalogContext += `- ${l.label}: ${l.shortCode}\n`;
        }
      }

      const prompt = `คุณคือแอดมินเพจขายของที่เอาใจใส่ลูกค้าและสื่อสารเก่งมาก
ลูกค้าคอมเมนต์มาว่า: "${comment}"
เกี่ยวกับสินค้า: "${product}"

หน้าที่ของคุณ:
1. เขียนข้อความตอบกลับลูกค้าแบบเป็นธรรมชาติ เป็นกันเอง (มีหางเสียง ค่ะ/ครับ เข้ากับบริบท)
2. เน้นย้ำจุดเด่นของสินค้าสั้นๆ เพื่อปิดการขาย
3. นำเสนอ Affiliate Link นี้ให้ลูกค้ากดสั่งซื้อ: ${link}
4. ถ้าลูกค้าถามหาสินค้าที่ไม่ตรงกับ "${product}" ให้แนะนำสินค้าอื่นจากรายการด้านล่างที่ใกล้เคียงที่สุด
${catalogContext}

ห้ามพิมพ์อย่างอื่นนอกจากข้อความตอบกลับที่พร้อมใช้งานทันที`;

      const response = await geminiGenerate({ prompt });
      res.json({ ok: true, reply: response.text });
    } catch(err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // Smart Auto-Reply (NEW) — ไม่ต้องเลือกสินค้า AI หาเอง
  app.post("/api/ai/smart-reply", async (req, res) => {
    try {
      const { comment } = req.body as { comment: string };
      if (!comment?.trim()) {
        return res.status(400).json({ ok: false, error: "comment is required" });
      }

      const { geminiGenerate } = await import("./gemini-provider.ts");
      const { dbGetProducts, dbGetAllLinks } = await import("./studio-db.ts");

      const products = dbGetProducts().slice(0, 20);
      const links = dbGetAllLinks().slice(0, 20);

      let catalogContext = "📦 สินค้าทั้งหมดในร้าน:\n";
      if (products.length > 0) {
        for (const p of products) {
          catalogContext += `- ID: ${p.id} | ${p.name} | ${p.platform} | ${p.category}`;
          if (p.price) catalogContext += ` | ราคา: ${p.price}`;
          if (p.commission) catalogContext += ` | คอม: ${p.commission}`;
          catalogContext += "\n";
        }
      } else {
        catalogContext += "(ยังไม่มีสินค้าในระบบ)\n";
      }

      catalogContext += "\n🔗 Affiliate Links:\n";
      if (links.length > 0) {
        for (const l of links) {
          catalogContext += `- ${l.label} → ลิงก์: /go/${l.shortCode} (คลิก: ${l.clicks})\n`;
        }
      } else {
        catalogContext += "(ยังไม่มีลิงก์ในระบบ)\n";
      }

      const prompt = `คุณคือแอดมินเพจขายของออนไลน์ที่เก่งมาก มีข้อมูลสินค้าและลิงก์ Affiliate ทั้งหมดในร้านดังนี้:

${catalogContext}

ลูกค้าคอมเมนต์มาว่า: "${comment}"

หน้าที่ของคุณ:
1. วิเคราะห์ว่าลูกค้าสนใจสินค้าอะไร หรือมีคำถามอะไร
2. เลือกสินค้าที่เหมาะสมที่สุดจากรายการด้านบน
3. เขียนข้อความตอบกลับลูกค้าแบบเป็นกันเอง มีหางเสียง ค่ะ/ครับ
4. เน้นย้ำจุดเด่นของสินค้า + แนบ Affiliate Link ให้ลูกค้ากดซื้อ
5. ถ้าลูกค้าถามหาสินค้าที่ไม่มี ให้แนะนำสินค้าใกล้เคียง + อธิบายว่าทำไมน่าลอง

ตอบเป็น JSON ดังนี้:
{
  "reply": "ข้อความตอบกลับพร้อมใช้ทันที",
  "matchedProduct": "ชื่อสินค้าที่แนะนำ (หรือ null ถ้าไม่มีสินค้าตรง)",
  "matchedLink": "ลิงก์ย่อ (หรือ null)",
  "suggestedProducts": ["ชื่อสินค้าอื่นที่น่าสนใจ 1-2 ชิ้น"],
  "confidence": "high | medium | low"
}`;

      const response = await geminiGenerate({ prompt });
      let parsed: any = null;
      try {
        const jsonMatch = response.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      } catch {}

      if (parsed && parsed.reply) {
        res.json({
          ok: true,
          reply: parsed.reply,
          matchedProduct: parsed.matchedProduct || null,
          matchedLink: parsed.matchedLink || null,
          suggestedProducts: parsed.suggestedProducts || [],
          confidence: parsed.confidence || "medium",
          catalogSize: { products: products.length, links: links.length },
        });
      } else {
        // Fallback: return raw text
        res.json({ ok: true, reply: response.text, matchedProduct: null, matchedLink: null, suggestedProducts: [], confidence: "low", catalogSize: { products: products.length, links: links.length } });
      }
    } catch(err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // Start a pipeline
  app.post("/api/pipelines/:id/start", async (req, res) => {
    const { id } = req.params;
    const { product, url, imageUrl } = req.body as { product?: string, url?: string, imageUrl?: string };

    if (!product?.trim()) {
      return res.status(400).json({ ok: false, error: "product is required" });
    }

    const template = PIPELINES.find((p) => p.id === id);
    if (!template) {
      return res.status(404).json({ ok: false, error: "pipeline not found" });
    }

    let promptProduct = product.trim();
    if (url && url.startsWith("http")) {
      try {
        const linkTracker = await import("./link-tracker.ts");
        const trackedLink = linkTracker.createTrackedLink(url, product.trim(), imageUrl);
        const domain = process.env.RAILWAY_PUBLIC_DOMAIN || `127.0.0.1:${PORT}`;
        // Using http if localhost, https if domain
        const protocol = domain.includes("127.0.0.1") || domain.includes("localhost") ? "http" : "https";
        const shortUrl = `${protocol}://${domain}/go/${trackedLink.shortCode}`;
        promptProduct += `\n[ACTION REQUIRED]: อย่าลืมแนบ Affiliate Link ต่อไปนี้เป็น Call-to-action ท้ายคลิป/ท้ายโพสต์ด้วย: ${shortUrl}`;
      } catch (e) {
        console.error("Failed to generate shortlink:", e);
      }
    }

    // Execute in background
    const pipelineRunId = `pl_${Date.now()}`;
    executePipeline(id, product.trim(), promptProduct).catch(() => {});

    res.json({
      ok: true,
      pipeline: {
        id: pipelineRunId,
        template: template.nameEn,
        product: product.trim(),
        steps: template.steps.length,
        estimatedTime: template.estimatedTime,
      },
    });
  });

  // Daily Recommended Trends
  app.get("/api/trends/recommended", (_req, res) => {
    // In a real app, this would scrape Shopee's top-seller or TikTok trending products.
    // For now, we return 3 highly profitable affiliate products mocked for today.
    const trends = [
      {
        id: "trend_1",
        name: "พัดลมพกพา Jisulife Pro",
        url: "https://shopee.co.th/Jisulife-Pro-Portable-Fan-i.1234.5678",
        imageUrl: "https://down-th.img.susercontent.com/file/th-11134207-7r98o-lstn9p", // mock image (use any real or mock)
        commissionRate: "12%",
        reason: "🔥 ยอดค้นหาพุ่ง 300% ช่วงหน้าร้อน"
      },
      {
        id: "trend_2",
        name: "หูฟัง Bluetooth Baseus WM02",
        url: "https://shopee.co.th/Baseus-WM02-TWS-Bluetooth-5.3-i.5678.1234",
        imageUrl: "https://down-th.img.susercontent.com/file/sg-11134201-22100-qwe123asd", // mock image
        commissionRate: "15%",
        reason: "🎶 สินค้าขายดีอันดับ 1 หมวดหมู่ Gadget"
      },
      {
        id: "trend_3",
        name: "กล่องสุ่ม Popmart Labubu",
        url: "https://shopee.co.th/Popmart-Labubu-Blind-Box-i.9999.8888",
        imageUrl: "https://down-th.img.susercontent.com/file/th-11134207-7qul3-lh67hjg", // mock image
        commissionRate: "5%",
        reason: "📈 กระแสมาแรงที่สุดใน TikTok ตอนนี้"
      }
    ];

    res.json({ ok: true, trends });
  });

  // List active/recent pipelines
  app.get("/api/pipelines/active", (_req, res) => {
    const list = Array.from(activePipelines.values())
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, 20);
    res.json({ ok: true, pipelines: list });
  });

  console.log(`[Auto-Pipeline] ✅ ${PIPELINES.length} pipelines registered`);
}
