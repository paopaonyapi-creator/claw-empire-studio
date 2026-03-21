/**
 * Affiliate Content Pipeline — Full 10-Agent Orchestration
 *
 * Flow: Shopee Link → Add Product → 10 Agents (4 departments) → Generate Image
 *       → Send TG Preview with approval buttons → Post to Facebook on approve
 *
 * Stages:
 *  1. Strategy (3 agents: Strategist → Trend Hunter → Audience Planner)
 *  2. Production (2 agents: Content Writer → Hook Specialist)
 *  3. Creative (2 agents: Visual Designer → Video Script Producer)
 *  4. Distribution (3 agents: Calendar → Publisher → Performance)
 *  5. Image Generation (Gemini)
 *  6. TG Approval → Facebook Post with image
 */

import type { Express, Request, Response } from "express";
import { existsSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import path from "path";
import { SESSION_AUTH_TOKEN, PORT } from "../config/runtime.ts";
import { geminiGenerate, geminiGenerateImage, isGeminiConfigured } from "./gemini-provider.ts";
import { sendTgNotification, sendTgPhotoNotification, sendTgDocumentNotification } from "./auto-pipeline.ts";

// Escape user text for SVG/XML
function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AffiliatePipelineRun {
  id: string;
  product: {
    name: string;
    url: string;
    priceMin: number;
    priceMax: number;
    shortLink?: string;
    imageUrl?: string;
  };
  status: "running" | "awaiting_approval" | "approved" | "rejected" | "posted" | "failed" | "scheduled";
  startedAt: string;
  completedAt?: string;
  scheduledAt?: string;
  stages: PipelineStageResult[];
  finalContent: {
    message: string;
    hooks: string[];
    hashtags: string;
    imagePath?: string;
  } | null;
  fbPostId?: string;
  performance?: {
    likes?: number;
    shares?: number;
    comments?: number;
    clicks?: number;
    reach?: number;
    lastUpdated?: string;
  };
}

interface PipelineStageResult {
  order: number;
  agentName: string;
  department: string;
  icon: string;
  status: "pending" | "running" | "done" | "failed";
  output?: string;
  startedAt?: string;
  completedAt?: string;
}

// Active pipelines storage
const activePipelines = new Map<string, AffiliatePipelineRun>();

// Pipeline stage definitions
const PIPELINE_STAGES = [
  { order: 1, agentName: "Chief Content Strategist", department: "Strategy", icon: "🧠" },
  { order: 2, agentName: "Trend Hunter", department: "Strategy", icon: "🔍" },
  { order: 3, agentName: "Audience Insight Planner", department: "Strategy", icon: "🎯" },
  { order: 4, agentName: "Content Writer", department: "Production", icon: "✍️" },
  { order: 5, agentName: "Hook & Copy Specialist", department: "Production", icon: "🪝" },
  { order: 6, agentName: "Visual Designer", department: "Creative", icon: "🎨" },
  { order: 7, agentName: "Video Script Producer", department: "Creative", icon: "🎬" },
  { order: 8, agentName: "Content Calendar Manager", department: "Distribution", icon: "📅" },
  { order: 9, agentName: "Publisher & Community Manager", department: "Distribution", icon: "📢" },
  { order: 10, agentName: "Performance Analyst", department: "Distribution", icon: "📈" },
];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function internalHeaders(): Record<string, string> {
  return { "Content-Type": "application/json", Authorization: `Bearer ${SESSION_AUTH_TOKEN}` };
}

function buildPromptForStage(
  order: number,
  product: { name: string; url: string; priceMin: number; priceMax: number; shortLink?: string; imageUrl?: string },
  previousOutputs: Map<number, string>,
): string {
  const ctx = `สินค้า: ${product.name}\nราคา: ฿${product.priceMin}-${product.priceMax}\nลิงก์: ${product.shortLink || product.url}`;

  switch (order) {
    case 1: // Chief Strategist
      return `${ctx}\n\nวิเคราะห์กลยุทธ์การขายสินค้านี้:\n- กำหนดทิศทางคอนเทนต์\n- เลือกมุมขายที่ดีที่สุด\n- จัดลำดับความสำคัญ\n- วัตถุประสงค์แคมเปญ\nตอบเป็นภาษาไทย`;
    case 2: // Trend Hunter
      return `${ctx}\n\nผลวิเคราะห์จาก Strategist:\n${previousOutputs.get(1)?.slice(0, 500) || "(ไม่มี)"}\n\nวิเคราะห์เทรนด์ที่เกี่ยวข้อง:\n- เทรนด์ TikTok/Facebook ที่ใช้ได้\n- hooks ที่กำลังไวรัล\n- โอกาสสร้างคอนเทนต์\nตอบเป็นภาษาไทย`;
    case 3: // Audience Planner
      return `${ctx}\n\nผลวิเคราะห์:\n${previousOutputs.get(1)?.slice(0, 300) || ""}\n${previousOutputs.get(2)?.slice(0, 300) || ""}\n\nวิเคราะห์กลุ่มเป้าหมาย:\n- Pain points สำคัญ 5 ข้อ\n- ความต้องการ/ความกลัว\n- Objections ที่ต้องตอบ\n- มุมขายที่ตรงใจ\nตอบเป็นภาษาไทย`;
    case 4: // Content Writer
      return `${ctx}\n\nข้อมูลจากทีม Strategy:\n${previousOutputs.get(1)?.slice(0, 300) || ""}\n${previousOutputs.get(3)?.slice(0, 300) || ""}\n\nเขียนคอนเทนต์โปรโมทสินค้า:\n1. Facebook Post (300 คำ) พร้อม hook + CTA + ลิงก์\n2. TikTok caption (100 คำ)\n3. ใส่ emoji ให้น่าอ่าน\nใส่ลิงก์: ${product.shortLink || product.url}\nตอบเป็นภาษาไทย`;
    case 5: // Hook Specialist
      return `${ctx}\n\nMain content:\n${previousOutputs.get(4)?.slice(0, 400) || ""}\n\nสร้าง 5 hooks + 3 CTA:\n- Question hook, Bold claim, Story, Curiosity, Pain point\n- Direct CTA, Soft CTA, Urgency CTA\nใส่ลิงก์: ${product.shortLink || product.url}\nตอบเป็นภาษาไทย`;
    case 6: // Visual Designer
      return `${ctx}\n\nContent:\n${previousOutputs.get(4)?.slice(0, 300) || ""}\nHooks:\n${previousOutputs.get(5)?.slice(0, 300) || ""}\n\nออกแบบ Visual Brief:\n- Image brief (composition, text overlay, mood)\n- Thumbnail brief (focal point, click-bait)\n- ขนาด 1:1 (Facebook), 9:16 (TikTok)\nตอบเป็นภาษาไทย`;
    case 7: // Video Script Producer
      return `${ctx}\n\nContent + Hooks:\n${previousOutputs.get(4)?.slice(0, 300) || ""}\n${previousOutputs.get(5)?.slice(0, 300) || ""}\n\nเขียน TikTok Script 30 วินาที:\n[0:00-0:03] HOOK\n[0:03-0:10] PROBLEM/PAIN\n[0:10-0:25] SOLUTION/PRODUCT\n[0:25-0:30] CTA\nใส่ Visual direction + Text overlay\nตอบเป็นภาษาไทย`;
    case 8: // Calendar Manager
      return `${ctx}\n\nContent ready:\n${previousOutputs.get(4)?.slice(0, 200) || ""}\n\nวางแผน Content Calendar 3 วัน:\n- TikTok 2 posts/day (12:00, 21:00)\n- Facebook 1 post/day (14:00)\n- บอกว่าโพสต์วันไหน เวลาไหน แพลตฟอร์มไหน\nตอบเป็นภาษาไทย`;
    case 9: // Publisher
      return `${ctx}\n\nContent:\n${previousOutputs.get(4)?.slice(0, 300) || ""}\nHooks:\n${previousOutputs.get(5)?.slice(0, 200) || ""}\n\nเตรียม Publish Package:\n- Facebook post (copy-paste ready) + 15 hashtags\n- TikTok caption + 10 hashtags\n- Reply templates (3 ชุด)\nใส่ลิงก์: ${product.shortLink || product.url}\nตอบเป็นภาษาไทย`;
    case 10: // Performance Analyst
      return `${ctx}\n\nวิเคราะห์ Performance Plan:\n- KPIs ที่ต้องวัด\n- เป้าหมาย engagement\n- สิ่งที่ต้อง A/B test\n- แนะนำปรับปรุงสำหรับสัปดาห์หน้า\nตอบเป็นภาษาไทย`;
    default:
      return `${ctx}\n\nทำงานตามหน้าที่ ตอบภาษาไทย`;
  }
}

// ---------------------------------------------------------------------------
// Core: Run agent via Gemini directly (faster than task creation)
// ---------------------------------------------------------------------------

async function runAgentDirect(agentName: string, prompt: string, systemPrompt?: string): Promise<string> {
  const result = await geminiGenerate({
    prompt,
    systemInstruction: systemPrompt || `คุณคือ ${agentName} ใน Affiliate Content Studio ตอบเป็นภาษาไทยเสมอ`,
    maxTokens: 1500,
    temperature: 0.7,
  });
  return result.text || result.error || "ไม่มีผลลัพธ์";
}

// ---------------------------------------------------------------------------
// Core: Generate promotional image via Gemini
// ---------------------------------------------------------------------------

async function generatePromoImageUrl(productName: string, priceMin: number, priceMax: number): Promise<string | null> {
  // Generate image description via Gemini, then use a placeholder approach
  // since we don't have a direct image generation API on server side
  // We'll create a simple HTML-based image or use the product URL's OG image
  const dataDir = path.resolve("data/promo-images");
  mkdirSync(dataDir, { recursive: true });

  // Generate a promotional text image description
  const result = await geminiGenerate({
    prompt: `สร้าง prompt สำหรับ AI image generator เพื่อสร้างรูปโปรโมทสินค้า "${productName}" ราคา ฿${priceMin}-${priceMax} สไตล์ e-commerce banner สวยมาก ตอบเป็น 1 ย่อหน้า ภาษาอังกฤษเท่านั้น`,
    maxTokens: 200,
  });

  // Store the prompt for potential future use
  const promptFile = path.join(dataDir, `prompt-${Date.now()}.txt`);
  try { writeFileSync(promptFile, result.text); } catch {}
  return null; // Image generation is handled separately
}

// ---------------------------------------------------------------------------
// Core: Send TG Approval
// ---------------------------------------------------------------------------

async function sendTgApproval(pipeline: AffiliatePipelineRun): Promise<void> {
  const content = pipeline.finalContent;
  if (!content) return;

  // Build preview message
  let preview = `📋 <b>Content Pipeline เสร็จแล้ว!</b>\n\n`;
  preview += `🛍️ <b>${pipeline.product.name}</b>\n`;
  preview += `💰 ฿${pipeline.product.priceMin}-${pipeline.product.priceMax}\n`;
  preview += `🔗 ${pipeline.product.shortLink || pipeline.product.url}\n\n`;
  preview += `━━━━━━━━━━━━━━━\n`;
  preview += `<b>📝 ข้อความที่จะโพสต์:</b>\n`;
  preview += content.message.slice(0, 800);
  if (content.message.length > 800) preview += "...";
  preview += `\n━━━━━━━━━━━━━━━\n\n`;
  preview += `<b>🪝 Hooks:</b>\n`;
  for (const h of content.hooks.slice(0, 3)) {
    preview += `• ${h.slice(0, 80)}\n`;
  }
  preview += `\n<b>📊 สถานะ:</b>\n`;

  // Stage summary
  let doneCount = 0;
  for (const s of pipeline.stages) {
    if (s.status === "done") doneCount++;
  }
  preview += `✅ ${doneCount}/${pipeline.stages.length} agents เสร็จ\n\n`;
  preview += `👆 กดปุ่มด้านล่างเพื่ออนุมัติหรือยกเลิก`;

  const reply_markup = {
    inline_keyboard: [
      [{ text: "✅ อนุมัติโพสต์ Facebook", callback_data: `approve_aff_${pipeline.id}` }],
      [{ text: "❌ ยกเลิก (Save Draft)", callback_data: `reject_aff_${pipeline.id}` }],
    ],
  };

  // Generate promo image with Gemini AI, fallback to SVG
  const dataDir = path.resolve("data/promo-images");
  mkdirSync(dataDir, { recursive: true });
  const pngPath = path.join(dataDir, `${pipeline.id}.png`);
  const { name: pName, priceMin: pMin, priceMax: pMax, shortLink: pLink, url: pUrl } = pipeline.product;
  const displayLink = pLink || pUrl;
  const priceText = pMax && pMax !== pMin ? `฿${pMin} - ฿${pMax}` : `฿${pMin}`;

  let pngBuffer: Buffer | null = null;

  // Strategy 1: Use Gemini with REAL product image from Shopee
  if (isGeminiConfigured()) {
    try {
      // Download real product image if URL available
      let productImageBuffer: Buffer | null = null;
      let productImageMime = "image/jpeg";
      const imgUrl = pipeline.product.imageUrl;
      if (imgUrl) {
        try {
          console.log(`[AffPipeline] 📥 Downloading product image: ${imgUrl.slice(0, 80)}...`);
          const ctrl = new AbortController();
          setTimeout(() => ctrl.abort(), 10000);
          const imgRes = await fetch(imgUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36" },
            signal: ctrl.signal,
          });
          if (imgRes.ok) {
            const arrBuf = await imgRes.arrayBuffer();
            productImageBuffer = Buffer.from(arrBuf);
            productImageMime = imgRes.headers.get("content-type") || "image/jpeg";
            console.log(`[AffPipeline] ✅ Product image downloaded: ${productImageBuffer.length} bytes`);
          }
        } catch (e) {
          console.log(`[AffPipeline] ⚠️ Product image download failed: ${e instanceof Error ? e.message : e}`);
        }
      }

      const imagePrompt = productImageBuffer
        ? `Create a professional e-commerce promotional poster (square 1:1 ratio) for Facebook/Instagram.

This is the REAL product image. Use this product photo as the hero element.

Product: ${pName}
Price: ${priceText}

Design requirements:
- Place the product photo prominently in the center, make it large and eye-catching
- Add a beautiful gradient background (vibrant blue/purple/pink tones)
- Add a "SALE" or "🔥 SALE" badge in the top-left corner
- Display the price "${priceText}" in large golden text below the product
- Add a CTA button "สั่งซื้อเลย!" (Order Now!) at the bottom
- Professional lighting effects, subtle glow, shadows for depth
- Glassmorphism card effect around the product
- Modern, clean e-commerce style
- Do NOT add any extra text or watermarks`
        : `Create a professional e-commerce promotional poster (square 1:1 ratio) for Facebook.

Product: ${pName}
Price: ${priceText}

Design: Modern e-commerce poster with vibrant gradient background, "🔥 SALE" badge, price in gold, CTA button "สั่งซื้อเลย!", glassmorphism effects. Make it eye-catching and professional.`;

      const imgResult = await geminiGenerateImage({
        prompt: imagePrompt,
        inputImage: productImageBuffer ? { data: productImageBuffer, mimeType: productImageMime } : undefined,
      });
      if (imgResult.imageData && imgResult.imageData.length > 1000) {
        pngBuffer = imgResult.imageData;
        console.log(`[AffPipeline] 🎨 Gemini AI promo banner created: ${pngBuffer.length} bytes (with${productImageBuffer ? '' : 'out'} real photo)`);
      } else if (imgResult.error) {
        console.log(`[AffPipeline] ⚠️ Gemini image gen failed: ${imgResult.error}`);
      }
    } catch (e) {
      console.log(`[AffPipeline] ⚠️ Gemini image error: ${e instanceof Error ? e.message : e}`);
    }
  }

  // Strategy 2: Fallback to SVG → PNG conversion
  if (!pngBuffer) {
    try {
      const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#667eea"/><stop offset="50%" style="stop-color:#764ba2"/><stop offset="100%" style="stop-color:#f093fb"/></linearGradient></defs>
  <rect width="1080" height="1080" fill="url(#bg)"/>
  <circle cx="100" cy="100" r="200" fill="rgba(255,255,255,0.05)"/>
  <circle cx="980" cy="900" r="300" fill="rgba(255,255,255,0.05)"/>
  <rect x="60" y="280" width="960" height="520" rx="24" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
  <rect x="60" y="120" width="240" height="80" rx="40" fill="#ff4757"/>
  <text x="180" y="170" font-family="Arial" font-size="36" font-weight="bold" fill="white" text-anchor="middle">🔥 SALE</text>
  <text x="540" y="400" font-family="Arial" font-size="42" font-weight="bold" fill="white" text-anchor="middle">${escapeXml(pName.slice(0, 40))}</text>
  <text x="540" y="520" font-family="Arial" font-size="72" font-weight="bold" fill="#FFD700" text-anchor="middle">${priceText}</text>
  <rect x="290" y="620" width="500" height="70" rx="35" fill="#FFD700"/>
  <text x="540" y="665" font-family="Arial" font-size="28" font-weight="bold" fill="#333" text-anchor="middle">🛒 สั่งซื้อเลย!</text>
  <text x="540" y="760" font-family="Arial" font-size="22" fill="rgba(255,255,255,0.7)" text-anchor="middle">${escapeXml(displayLink.slice(0, 50))}</text>
  <text x="540" y="1020" font-family="Arial" font-size="20" fill="rgba(255,255,255,0.4)" text-anchor="middle">Powered by Content Studio AI</text>
</svg>`;
      const svgPath = path.join(dataDir, `${pipeline.id}.svg`);
      writeFileSync(svgPath, svgContent);
      const { Resvg } = await import("@resvg/resvg-js");
      const resvg = new Resvg(svgContent, { fitTo: { mode: "width" as const, value: 1080 } });
      pngBuffer = resvg.render().asPng();
      console.log(`[AffPipeline] 🖼️ SVG fallback PNG: ${pngBuffer.length} bytes`);
    } catch (e) {
      console.log(`[AffPipeline] ⚠️ SVG fallback failed: ${e}`);
    }
  }

  try {
    if (pngBuffer) {
      writeFileSync(pngPath, pngBuffer);
      pipeline.finalContent!.imagePath = pngPath;

      // Send image as photo via TG
      const token = process.env.TELEGRAM_BOT_TOKEN || "";
      const chatId = process.env.TELEGRAM_CHAT_ID || "";
      if (token && chatId) {
        const boundary = "----TgBound" + Date.now();
        const parts: Buffer[] = [];
        const addField = (n: string, v: string) => {
          parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${n}"\r\n\r\n${v}\r\n`));
        };
        addField("chat_id", chatId);
        addField("caption", `🖼️ ${pName}\n💰 ${priceText}\n🔗 ${displayLink}`);

        // Determine the file extension from buffer magic bytes
        const isPng = pngBuffer[0] === 0x89 && pngBuffer[1] === 0x50;
        const ext = isPng ? "png" : "jpg";
        const mime = isPng ? "image/png" : "image/jpeg";

        parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="promo.${ext}"\r\nContent-Type: ${mime}\r\n\r\n`));
        parts.push(pngBuffer);
        parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

        const body = Buffer.concat(parts);
        const photoRes = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
          method: "POST",
          headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
          body,
        }).catch(() => null);

        if (photoRes?.ok) {
          console.log("[AffPipeline] 📸 Promo image sent to TG!");
        } else {
          console.log("[AffPipeline] ⚠️ Photo send failed");
        }
      }
    }

    // Send text with approve buttons
    await sendTgNotification(preview, reply_markup);
  } catch (e) {
    console.error("[AffPipeline] ❌ Image send error:", e);
    await sendTgNotification(preview, reply_markup);
  }
}

// ---------------------------------------------------------------------------
// Core: Post to Facebook
// ---------------------------------------------------------------------------

async function postToFacebook(pipeline: AffiliatePipelineRun): Promise<{ ok: boolean; postId?: string; error?: string }> {
  if (!pipeline.finalContent) return { ok: false, error: "No content" };

  const { message, imagePath } = pipeline.finalContent;
  const link = pipeline.product.shortLink || pipeline.product.url;

  try {
    // Use the photo posting endpoint if we have an image, otherwise text
    if (imagePath && existsSync(imagePath)) {
      const res = await fetch(`http://127.0.0.1:${PORT}/api/fb/post-photo`, {
        method: "POST",
        headers: internalHeaders(),
        body: JSON.stringify({ message, imagePath, link }),
      });
      const data = (await res.json()) as any;
      return { ok: !!data.ok || !!data.success, postId: data.postId, error: data.error };
    } else {
      const res = await fetch(`http://127.0.0.1:${PORT}/api/fb/post`, {
        method: "POST",
        headers: internalHeaders(),
        body: JSON.stringify({ message, link }),
      });
      const data = (await res.json()) as any;
      return { ok: !!data.ok || !!data.success, postId: data.postId, error: data.error };
    }
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ---------------------------------------------------------------------------
// Main: Start Affiliate Pipeline
// ---------------------------------------------------------------------------

export async function startAffiliatePipeline(opts: {
  productName: string;
  productUrl: string;
  priceMin: number;
  priceMax: number;
  imagePath?: string;
  imageUrl?: string;
}): Promise<AffiliatePipelineRun> {
  const id = `aff_${Date.now()}`;
  const pipeline: AffiliatePipelineRun = {
    id,
    product: {
      name: opts.productName,
      url: opts.productUrl,
      priceMin: opts.priceMin,
      priceMax: opts.priceMax,
      imageUrl: opts.imageUrl,
    },
    status: "running",
    startedAt: new Date().toISOString(),
    stages: PIPELINE_STAGES.map((s) => ({
      order: s.order,
      agentName: s.agentName,
      department: s.department,
      icon: s.icon,
      status: "pending" as const,
    })),
    finalContent: null,
  };

  activePipelines.set(id, pipeline);

  // Run the entire pipeline (link creation + TG notification + agents) in background
  // so that the API responds immediately
  (async () => {
    // Create short link
    try {
      const linkRes = await fetch(`http://127.0.0.1:${PORT}/api/links`, {
        method: "POST",
        headers: internalHeaders(),
        body: JSON.stringify({
          url: opts.productUrl,
          label: opts.productName,
        }),
      });
      if (linkRes.ok) {
        const linkData = (await linkRes.json()) as { shortCode?: string; link?: { shortCode?: string } };
        const code = linkData.shortCode || linkData.link?.shortCode;
        if (code) {
          const domain = process.env.RAILWAY_PUBLIC_DOMAIN || `127.0.0.1:${PORT}`;
          const protocol = domain.includes("127.0.0.1") || domain.includes("localhost") ? "http" : "https";
          pipeline.product.shortLink = `${protocol}://${domain}/go/${code}`;
        }
      }
    } catch {}

    // Notify TG: Pipeline started (fire-and-forget)
    const stageList = PIPELINE_STAGES.map((s) => `  ${s.icon} ${s.agentName}`).join("\n");
    sendTgNotification(
      `🚀 <b>Affiliate Pipeline Started!</b>\n\n` +
        `🛍️ ${opts.productName}\n` +
        `💰 ฿${opts.priceMin}-${opts.priceMax}\n\n` +
        `<b>10 Agents กำลังทำงาน:</b>\n${stageList}\n\n` +
        `⏱ ประมาณ 3-5 นาที`,
    ).catch(() => {});

    // Run the 10-agent pipeline
    await executeAffiliatePipeline(pipeline, opts.imagePath);
  })().catch((err) => {
    console.error(`[AffPipeline] ❌ Pipeline ${id} failed:`, err);
    pipeline.status = "failed";
  });

  return pipeline;
}

// ---------------------------------------------------------------------------
// Execute: Sequential agent processing
// ---------------------------------------------------------------------------

async function executeAffiliatePipeline(pipeline: AffiliatePipelineRun, imagePath?: string): Promise<void> {
  const outputs = new Map<number, string>();

  for (const stage of pipeline.stages) {
    const stageInfo = PIPELINE_STAGES.find((s) => s.order === stage.order);
    if (!stageInfo) continue;

    stage.status = "running";
    stage.startedAt = new Date().toISOString();

    // Build prompt with context from previous stages
    const prompt = buildPromptForStage(stage.order, pipeline.product, outputs);

    try {
      console.log(`[AffPipeline] ${stageInfo.icon} Running: ${stageInfo.agentName}...`);

      const output = await runAgentDirect(stageInfo.agentName, prompt);
      outputs.set(stage.order, output);

      stage.status = "done";
      stage.output = output;
      stage.completedAt = new Date().toISOString();

      console.log(`[AffPipeline] ✅ ${stageInfo.agentName} done (${output.length} chars)`);

      // Notify TG every 3 stages
      if (stage.order % 3 === 0 || stage.order === 10) {
        const doneCount = pipeline.stages.filter((s) => s.status === "done").length;
        await sendTgNotification(
          `${stageInfo.icon} ${stageInfo.department}: <b>${stageInfo.agentName}</b> เสร็จแล้ว\n` +
            `📊 Progress: ${doneCount}/${pipeline.stages.length}`,
        );
      }
    } catch (err) {
      stage.status = "failed";
      console.error(`[AffPipeline] ❌ ${stageInfo.agentName} failed:`, err);
      // Continue to next agent instead of stopping
    }

    // Small delay between agents to avoid rate limits
    await new Promise((r) => setTimeout(r, 2000));
  }

  // Compile final content from outputs
  const contentWriterOutput = outputs.get(4) || "";
  const hookOutput = outputs.get(5) || "";
  const publisherOutput = outputs.get(9) || "";

  // Extract the best Facebook post content
  // Use publisher output first (it's the publish-ready package), fallback to content writer
  let bestMessage = publisherOutput || contentWriterOutput;
  if (!bestMessage || bestMessage.length < 50) {
    bestMessage = `✨ ${pipeline.product.name}\n\n` +
      `💰 ราคาเพียง ฿${pipeline.product.priceMin}-${pipeline.product.priceMax}\n\n` +
      `🔗 สั่งซื้อเลย: ${pipeline.product.shortLink || pipeline.product.url}`;
  }

  // Extract hooks from hook specialist output
  const hookLines = hookOutput
    .split("\n")
    .filter((l) => l.includes("hook") || l.includes("Hook") || l.startsWith("-") || l.startsWith("•"))
    .slice(0, 5);

  pipeline.finalContent = {
    message: bestMessage,
    hooks: hookLines.length > 0 ? hookLines : ["(hooks อยู่ในเนื้อหาคอนเทนต์)"],
    hashtags: "#ShopeeTH #ของดีราคาถูก",
    imagePath: imagePath || undefined,
  };

  // Update status and send TG approval
  pipeline.status = "awaiting_approval";

  await sendTgApproval(pipeline);
  console.log(`[AffPipeline] 📱 Sent TG approval for ${pipeline.id}`);
}

// ---------------------------------------------------------------------------
// Handle TG Callback (approve/reject)
// ---------------------------------------------------------------------------

export async function handleAffiliateCallback(
  queryId: string,
  data: string,
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  if (!token) return;

  if (data.startsWith("approve_aff_")) {
    const pipelineId = data.replace("approve_aff_", "");
    const pipeline = activePipelines.get(pipelineId);

    // Answer callback
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: queryId, text: "✅ อนุมัติ! กำลังโพสต์..." }),
    }).catch(() => {});

    if (!pipeline) {
      await sendTgNotification("❌ ไม่พบ Pipeline นี้แล้ว (หมดอายุ)");
      return;
    }

    pipeline.status = "approved";

    // Post to Facebook
    await sendTgNotification(`🚀 กำลังโพสต์ลง Facebook...\n🛍️ ${pipeline.product.name}`);

    const result = await postToFacebook(pipeline);
    if (result.ok || (result as any).success) {
      pipeline.status = "posted";
      pipeline.fbPostId = result.postId;
      pipeline.completedAt = new Date().toISOString();

      await sendTgNotification(
        `✅ <b>โพสต์สำเร็จ!</b>\n\n` +
          `🛍️ ${pipeline.product.name}\n` +
          `💰 ฿${pipeline.product.priceMin}-${pipeline.product.priceMax}\n` +
          `📘 Post ID: ${result.postId || "N/A"}\n` +
          `🔗 ${pipeline.product.shortLink || pipeline.product.url}`,
      );
    } else {
      await sendTgNotification(`❌ โพสต์ล้มเหลว: ${result.error || "Unknown error"}`);
    }
  } else if (data.startsWith("reject_aff_")) {
    const pipelineId = data.replace("reject_aff_", "");
    const pipeline = activePipelines.get(pipelineId);

    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: queryId, text: "❌ ยกเลิก — เก็บเป็น Draft" }),
    }).catch(() => {});

    if (pipeline) {
      pipeline.status = "rejected";
      await sendTgNotification(
        `📝 <b>เก็บเป็น Draft</b>\n\n🛍️ ${pipeline.product.name}\n\nเนื้อหาถูกบันทึกแล้ว สามารถแก้ไขและโพสต์ภายหลังได้`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

export function registerAffiliatePipelineRoutes(app: Express): void {
  // Start a new affiliate pipeline
  app.post("/api/affiliate-pipeline/start", async (req: Request, res: Response) => {
    const { productName, productUrl, priceMin, priceMax, imagePath, imageUrl } = req.body || {};
    if (!productName || !productUrl) {
      return res.status(400).json({ error: "productName and productUrl required" });
    }

    try {
      const pipeline = await startAffiliatePipeline({
        productName,
        productUrl,
        priceMin: priceMin || 0,
        priceMax: priceMax || 0,
        imagePath,
        imageUrl,
      });

      res.json({
        ok: true,
        pipelineId: pipeline.id,
        product: pipeline.product,
        stages: pipeline.stages.length,
        message: "Pipeline started! 10 agents working. Approval will be sent to Telegram.",
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Get pipeline status
  app.get("/api/affiliate-pipeline/:id", (req: Request, res: Response) => {
    const pipeline = activePipelines.get(String(req.params.id));
    if (!pipeline) return res.status(404).json({ error: "Pipeline not found" });
    res.json({ ok: true, pipeline });
  });

  // List all pipelines
  app.get("/api/affiliate-pipelines", (_req: Request, res: Response) => {
    const list = Array.from(activePipelines.values())
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, 20);
    res.json({ ok: true, pipelines: list });
  });

  // Manual approve (for testing without TG)
  app.post("/api/affiliate-pipeline/:id/approve", async (req: Request, res: Response) => {
    const pipeline = activePipelines.get(String(req.params.id));
    if (!pipeline) return res.status(404).json({ error: "Pipeline not found" });
    if (pipeline.status !== "awaiting_approval") {
      return res.status(400).json({ error: `Pipeline is ${pipeline.status}, not awaiting_approval` });
    }

    pipeline.status = "approved";
    const result = await postToFacebook(pipeline);
    if (result.ok || (result as any).success) {
      pipeline.status = "posted";
      pipeline.fbPostId = result.postId;
      pipeline.completedAt = new Date().toISOString();
    }

    res.json({ ok: true, pipeline, fbResult: result });
  });

  // Scrape product info from URL (multi-strategy for Shopee)
  app.post("/api/affiliate-pipeline/scrape-url", async (req: Request, res: Response) => {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: "url required" });

    let productName = "";
    let priceMin = 0;
    let priceMax = 0;
    let imageUrl = "";
    let description = "";
    let shopId = "";
    let itemId = "";

    // Strategy 1: Resolve short URL → extract shopId/itemId from redirect chain
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 5000);

      // Follow redirects manually to get final URL
      let currentUrl = url;
      for (let i = 0; i < 5; i++) {
        const r = await fetch(currentUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0 Mobile" },
          redirect: "manual",
          signal: ctrl.signal,
        });
        const location = r.headers.get("location");
        if (!location) {
          // No more redirects — check this URL for shopId/itemId
          break;
        }
        currentUrl = location.startsWith("http") ? location : `https://shopee.co.th${location}`;
      }

      // Parse shopId and itemId from URL patterns
      // Pattern 1: /product/{shopId}/{itemId}
      const productMatch = currentUrl.match(/\/product\/(\d+)\/(\d+)/);
      if (productMatch) {
        shopId = productMatch[1];
        itemId = productMatch[2];
      }
      // Pattern 2: /{slug}-i.{shopId}.{itemId}
      const slugMatch = currentUrl.match(/-i\.(\d+)\.(\d+)/);
      if (!shopId && slugMatch) {
        shopId = slugMatch[1];
        itemId = slugMatch[2];
      }

      console.log(`[Scrape] Resolved: ${url} → shopId=${shopId}, itemId=${itemId}`);
    } catch (e) {
      console.log(`[Scrape] Redirect resolve failed: ${e instanceof Error ? e.message : e}`);
    }

    // Strategy 2: Call Shopee Item API if we have shopId/itemId
    if (shopId && itemId) {
      try {
        const ctrl2 = new AbortController();
        setTimeout(() => ctrl2.abort(), 5000);
        const apiRes = await fetch(`https://shopee.co.th/api/v4/item/get?shopid=${shopId}&itemid=${itemId}`, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0 Mobile",
            "Referer": "https://shopee.co.th/",
            "Accept": "application/json",
            "af-ac-enc-dat": "null",
          },
          signal: ctrl2.signal,
        });
        if (apiRes.ok) {
          const apiData = (await apiRes.json()) as any;
          const item = apiData.data || apiData;
          if (item.name) productName = item.name.slice(0, 100);
          if (item.price_min) priceMin = Math.round(item.price_min / 100000);
          if (item.price_max) priceMax = Math.round(item.price_max / 100000);
          if (item.price && !priceMin) { priceMin = Math.round(item.price / 100000); priceMax = priceMin; }
          if (item.image) imageUrl = `https://down-th.img.susercontent.com/file/${item.image}`;
          if (item.description) description = item.description.slice(0, 200);
          console.log(`[Scrape] ✅ Shopee API success: ${productName}, ฿${priceMin}`);
        }
      } catch (e) {
        console.log(`[Scrape] Shopee API failed: ${e instanceof Error ? e.message : e}`);
      }
    }

    // Strategy 3: Fallback to Gemini to identify product from URL
    if (!productName && isGeminiConfigured()) {
      try {
        const gemResult = await geminiGenerate({
          prompt: `ลิงก์สินค้า Shopee: ${url}\nShop ID: ${shopId || "unknown"}, Item ID: ${itemId || "unknown"}\n\nช่วยบอกว่าสินค้านี้น่าจะเป็นอะไร? ตอบแค่ชื่อสินค้าภาษาไทยสั้นๆ (ไม่เกิน 50 ตัวอักษร) และราคาโดยประมาณ\n\nตอบในรูปแบบ:\nชื่อ: <ชื่อสินค้า>\nราคา: <ราคาต่ำ>-<ราคาสูง>`,
          systemInstruction: "คุณเป็นผู้เชี่ยวชาญสินค้า Shopee Thailand ตอบสั้นกระชับ",
          maxTokens: 100,
        });
        if (gemResult.text) {
          const nameMatch = gemResult.text.match(/ชื่อ:\s*(.+)/);
          if (nameMatch) productName = nameMatch[1].trim().slice(0, 80);
          const priceGemMatch = gemResult.text.match(/ราคา:\s*(\d[\d,]*)\s*[-–]\s*(\d[\d,]*)/);
          if (priceGemMatch) {
            priceMin = parseInt(priceGemMatch[1].replace(/,/g, ""));
            priceMax = parseInt(priceGemMatch[2].replace(/,/g, ""));
          }
          const singlePriceMatch = gemResult.text.match(/ราคา:\s*(\d[\d,]*)/);
          if (!priceMin && singlePriceMatch) {
            priceMin = parseInt(singlePriceMatch[1].replace(/,/g, ""));
            priceMax = priceMin;
          }
        }
      } catch {}
    }

    // Strategy 4: Last resort — simple HTML scrape (may give wrong data)
    if (!productName) {
      try {
        const ctrl3 = new AbortController();
        setTimeout(() => ctrl3.abort(), 5000);
        const fetchRes = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
          redirect: "follow",
          signal: ctrl3.signal,
        });
        const html = await fetchRes.text();
        const titleMatch =
          html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) ||
          html.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch?.[1]) {
          const cleanTitle = titleMatch[1].replace(/ \| shopee.*/i, "").replace(/ - shopee.*/i, "").trim();
          if (cleanTitle && cleanTitle.length > 5 && !cleanTitle.includes("Shopee")) {
            productName = cleanTitle.slice(0, 100);
          }
        }
        const imgMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
        if (imgMatch?.[1]) imageUrl = imgMatch[1];
        const descMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
        if (descMatch?.[1]) description = descMatch[1].slice(0, 200);
        const priceMatch = html.match(/<meta\s+property="product:price:amount"\s+content="(\d+)"/i);
        if (priceMatch?.[1]) { priceMin = parseInt(priceMatch[1]); priceMax = priceMin; }
      } catch {}
    }

    res.json({
      ok: true,
      product: {
        name: productName || "สินค้า Shopee",
        priceMin,
        priceMax,
        imageUrl,
        description,
        url,
        shopId: shopId || undefined,
        itemId: itemId || undefined,
      },
    });
  });

  // Generate promo image (SVG-based)
  app.get("/api/affiliate-pipeline/:id/image", (req: Request, res: Response) => {
    const pipeline = activePipelines.get(String(req.params.id));
    if (!pipeline) return res.status(404).json({ error: "Pipeline not found" });

    const { name, priceMin, priceMax, shortLink, url } = pipeline.product;
    const link = shortLink || url;

    // Generate a stylish SVG promo banner
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#764ba2;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#f093fb;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="card" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:rgba(255,255,255,0.2);stop-opacity:1" />
      <stop offset="100%" style="stop-color:rgba(255,255,255,0.05);stop-opacity:1" />
    </linearGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-opacity="0.3"/>
    </filter>
  </defs>
  
  <!-- Background -->
  <rect width="1080" height="1080" fill="url(#bg)"/>
  
  <!-- Decorative circles -->
  <circle cx="100" cy="100" r="200" fill="rgba(255,255,255,0.05)"/>
  <circle cx="980" cy="900" r="300" fill="rgba(255,255,255,0.05)"/>
  <circle cx="800" cy="200" r="150" fill="rgba(255,255,255,0.03)"/>
  
  <!-- Main card -->
  <rect x="60" y="280" width="960" height="520" rx="24" fill="url(#card)" filter="url(#shadow)" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
  
  <!-- Sale badge -->
  <rect x="60" y="120" width="240" height="80" rx="40" fill="#ff4757" filter="url(#shadow)"/>
  <text x="180" y="170" font-family="Arial,sans-serif" font-size="36" font-weight="bold" fill="white" text-anchor="middle">🔥 SALE</text>
  
  <!-- Product name -->
  <text x="540" y="380" font-family="Arial,sans-serif" font-size="42" font-weight="bold" fill="white" text-anchor="middle" opacity="0.95">
    <tspan x="540" dy="0">${escapeXml(name.slice(0, 30))}</tspan>
    ${name.length > 30 ? `<tspan x="540" dy="52">${escapeXml(name.slice(30, 60))}</tspan>` : ""}
  </text>
  
  <!-- Price -->
  <text x="540" y="520" font-family="Arial,sans-serif" font-size="72" font-weight="bold" fill="#FFD700" text-anchor="middle" filter="url(#shadow)">
    ฿${priceMin}${priceMax && priceMax !== priceMin ? ` - ฿${priceMax}` : ""}
  </text>
  
  <!-- Divider -->
  <line x1="240" y1="580" x2="840" y2="580" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
  
  <!-- CTA -->
  <rect x="290" y="620" width="500" height="70" rx="35" fill="#FFD700" filter="url(#shadow)"/>
  <text x="540" y="665" font-family="Arial,sans-serif" font-size="28" font-weight="bold" fill="#333" text-anchor="middle">🛒 สั่งซื้อเลย!</text>
  
  <!-- Link -->
  <text x="540" y="760" font-family="Arial,sans-serif" font-size="22" fill="rgba(255,255,255,0.7)" text-anchor="middle">${escapeXml(link.slice(0, 50))}</text>
  
  <!-- Branding -->
  <text x="540" y="1020" font-family="Arial,sans-serif" font-size="20" fill="rgba(255,255,255,0.4)" text-anchor="middle">Powered by Content Studio AI</text>
</svg>`;

    // Serve PNG first if available on disk, else serve generated SVG
    const dataDir = path.resolve("data/promo-images");
    const pngPath = path.join(dataDir, `${String(req.params.id)}.png`);
    if (existsSync(pngPath)) {
      res.setHeader("Content-Type", "image/png");
      res.send(readFileSync(pngPath));
      return;
    }

    res.setHeader("Content-Type", "image/svg+xml");
    res.send(svg);
  });

  // Generate and save promo image
  app.post("/api/affiliate-pipeline/:id/generate-image", async (req: Request, res: Response) => {
    const pipeline = activePipelines.get(String(req.params.id));
    if (!pipeline) return res.status(404).json({ error: "Pipeline not found" });

    const dataDir = path.resolve("data/promo-images");
    mkdirSync(dataDir, { recursive: true });

    // Save SVG
    const svgPath = path.join(dataDir, `${pipeline.id}.svg`);
    const { name, priceMin, priceMax, shortLink, url } = pipeline.product;
    const link = shortLink || url;

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#764ba2;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#f093fb;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="1080" height="1080" fill="url(#bg)"/>
  <circle cx="100" cy="100" r="200" fill="rgba(255,255,255,0.05)"/>
  <circle cx="980" cy="900" r="300" fill="rgba(255,255,255,0.05)"/>
  <rect x="60" y="280" width="960" height="520" rx="24" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
  <rect x="60" y="120" width="240" height="80" rx="40" fill="#ff4757"/>
  <text x="180" y="170" font-family="Arial,sans-serif" font-size="36" font-weight="bold" fill="white" text-anchor="middle">🔥 SALE</text>
  <text x="540" y="400" font-family="Arial,sans-serif" font-size="42" font-weight="bold" fill="white" text-anchor="middle">${escapeXml(name.slice(0, 40))}</text>
  <text x="540" y="520" font-family="Arial,sans-serif" font-size="72" font-weight="bold" fill="#FFD700" text-anchor="middle">฿${priceMin}${priceMax && priceMax !== priceMin ? ` - ฿${priceMax}` : ""}</text>
  <rect x="290" y="620" width="500" height="70" rx="35" fill="#FFD700"/>
  <text x="540" y="665" font-family="Arial,sans-serif" font-size="28" font-weight="bold" fill="#333" text-anchor="middle">🛒 สั่งซื้อเลย!</text>
  <text x="540" y="760" font-family="Arial,sans-serif" font-size="22" fill="rgba(255,255,255,0.7)" text-anchor="middle">${escapeXml(link.slice(0, 50))}</text>
</svg>`;

    try {
      writeFileSync(svgPath, svg);
      pipeline.finalContent = {
        ...pipeline.finalContent!,
        imagePath: svgPath,
      };
      res.json({ ok: true, imagePath: svgPath, previewUrl: `/api/affiliate-pipeline/${pipeline.id}/image` });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  console.log("[AffPipeline] ✅ Affiliate Content Pipeline ready: /api/affiliate-pipeline/start");

  // ---------------------------------------------------------------------------
  // Auto-Schedule: Schedule a pipeline to post at a specific time
  // ---------------------------------------------------------------------------
  app.post("/api/affiliate-pipeline/:id/schedule", (req: Request, res: Response) => {
    const pipeline = activePipelines.get(String(req.params.id));
    if (!pipeline) return res.status(404).json({ error: "Pipeline not found" });

    const { scheduledAt } = req.body || {};
    if (!scheduledAt) return res.status(400).json({ error: "scheduledAt required (ISO date string)" });

    if (pipeline.status !== "awaiting_approval") {
      return res.status(400).json({ error: `Pipeline is ${pipeline.status}, cannot schedule` });
    }

    pipeline.status = "scheduled";
    pipeline.scheduledAt = scheduledAt;
    console.log(`[AffPipeline] ⏰ Pipeline ${pipeline.id} scheduled for ${scheduledAt}`);

    res.json({ ok: true, pipeline });
  });

  // ---------------------------------------------------------------------------
  // Performance Tracking: Update metrics for a posted pipeline
  // ---------------------------------------------------------------------------
  app.post("/api/affiliate-pipeline/:id/performance", (req: Request, res: Response) => {
    const pipeline = activePipelines.get(String(req.params.id));
    if (!pipeline) return res.status(404).json({ error: "Pipeline not found" });

    const { likes, shares, comments, clicks, reach } = req.body || {};
    pipeline.performance = {
      ...pipeline.performance,
      likes: likes ?? pipeline.performance?.likes ?? 0,
      shares: shares ?? pipeline.performance?.shares ?? 0,
      comments: comments ?? pipeline.performance?.comments ?? 0,
      clicks: clicks ?? pipeline.performance?.clicks ?? 0,
      reach: reach ?? pipeline.performance?.reach ?? 0,
      lastUpdated: new Date().toISOString(),
    };

    res.json({ ok: true, performance: pipeline.performance });
  });

  // Performance Dashboard: Get all performance stats
  app.get("/api/affiliate-pipeline/performance-dashboard", (_req: Request, res: Response) => {
    const posted = Array.from(activePipelines.values())
      .filter(p => p.status === "posted" || p.fbPostId)
      .map(p => ({
        id: p.id,
        product: p.product.name,
        postedAt: p.completedAt,
        fbPostId: p.fbPostId,
        performance: p.performance || { likes: 0, shares: 0, comments: 0, clicks: 0, reach: 0 },
        shortLink: p.product.shortLink,
      }));

    const totals = posted.reduce((acc, p) => {
      acc.likes += p.performance.likes || 0;
      acc.shares += p.performance.shares || 0;
      acc.comments += p.performance.comments || 0;
      acc.clicks += p.performance.clicks || 0;
      acc.reach += p.performance.reach || 0;
      return acc;
    }, { likes: 0, shares: 0, comments: 0, clicks: 0, reach: 0 });

    res.json({
      ok: true,
      totalPipelines: activePipelines.size,
      postedCount: posted.length,
      totals,
      pipelines: posted,
    });
  });

  // ---------------------------------------------------------------------------
  // Auto-Schedule Checker: Runs every 60s to post scheduled pipelines
  // ---------------------------------------------------------------------------
  setInterval(async () => {
    const now = new Date();
    for (const [_id, pipeline] of activePipelines) {
      if (pipeline.status === "scheduled" && pipeline.scheduledAt) {
        const schedTime = new Date(pipeline.scheduledAt);
        if (now >= schedTime) {
          console.log(`[AffPipeline] ⏰ Auto-posting scheduled pipeline: ${pipeline.id}`);
          pipeline.status = "approved";
          try {
            const result = await postToFacebook(pipeline);
            if (result.ok || (result as any).success) {
              pipeline.status = "posted";
              pipeline.fbPostId = result.postId;
              pipeline.completedAt = new Date().toISOString();
              await sendTgNotification(
                `✅ <b>โพสต์ตามเวลาสำเร็จ!</b>\n\n🛍️ ${pipeline.product.name}\n⏰ ${pipeline.scheduledAt}\n📘 FB Post ID: ${pipeline.fbPostId || "N/A"}`
              );
            } else {
              pipeline.status = "failed";
              await sendTgNotification(`❌ โพสต์ตามเวลาล้มเหลว: ${pipeline.product.name}\nError: ${result.error}`);
            }
          } catch (e) {
            pipeline.status = "failed";
            console.error(`[AffPipeline] ❌ Scheduled post failed:`, e);
          }
        }
      }
    }
  }, 60_000); // Check every 60 seconds

  // ---------------------------------------------------------------------------
  // FB Auto-Tracker: Poll FB Insights every 5 min for posted pipelines
  // ---------------------------------------------------------------------------
  setInterval(async () => {
    const fbToken = process.env.FACEBOOK_PAGE_TOKEN || "";
    if (!fbToken) return;

    for (const [_id, pipeline] of activePipelines) {
      if (pipeline.status !== "posted" || !pipeline.fbPostId) continue;

      try {
        // Get post insights from FB Graph API
        const res = await fetch(
          `https://graph.facebook.com/v18.0/${pipeline.fbPostId}?fields=likes.summary(true),shares,comments.summary(true)&access_token=${fbToken}`
        );
        if (!res.ok) continue;
        const data = (await res.json()) as any;

        pipeline.performance = {
          likes: data.likes?.summary?.total_count ?? pipeline.performance?.likes ?? 0,
          shares: data.shares?.count ?? pipeline.performance?.shares ?? 0,
          comments: data.comments?.summary?.total_count ?? pipeline.performance?.comments ?? 0,
          clicks: pipeline.performance?.clicks ?? 0, // clicks need separate insights call
          reach: pipeline.performance?.reach ?? 0,
          lastUpdated: new Date().toISOString(),
        };

        // Try to get reach/clicks from insights endpoint
        try {
          const insRes = await fetch(
            `https://graph.facebook.com/v18.0/${pipeline.fbPostId}/insights?metric=post_impressions,post_clicks&access_token=${fbToken}`
          );
          if (insRes.ok) {
            const insData = (await insRes.json()) as any;
            for (const metric of insData.data || []) {
              if (metric.name === "post_impressions") {
                pipeline.performance!.reach = metric.values?.[0]?.value ?? 0;
              }
              if (metric.name === "post_clicks") {
                pipeline.performance!.clicks = metric.values?.[0]?.value ?? 0;
              }
            }
          }
        } catch {}

        console.log(`[AffPipeline] 📊 Auto-tracked: ${pipeline.product.name} — ❤️${pipeline.performance?.likes} 🔁${pipeline.performance?.shares}`);
      } catch {
        // Ignore tracking errors
      }
    }
  }, 5 * 60_000); // Every 5 minutes

  // ---------------------------------------------------------------------------
  // Multi-Pipeline: Start multiple pipelines from a list of URLs
  // ---------------------------------------------------------------------------
  app.post("/api/affiliate-pipeline/batch-start", async (req: Request, res: Response) => {
    const { urls } = req.body || {};
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: "urls array required" });
    }

    const results: Array<{ url: string; pipelineId?: string; error?: string }> = [];

    for (const urlEntry of urls.slice(0, 10)) { // Max 10 pipelines
      const productUrl = typeof urlEntry === "string" ? urlEntry : urlEntry.url;
      const productName = typeof urlEntry === "string" ? "" : urlEntry.name || "";

      try {
        // Auto-scrape product info
        let name = productName || "สินค้า Shopee";
        let priceMin = 0;
        let priceMax = 0;

        if (!productName) {
          try {
            const fetchRes = await fetch(productUrl, {
              headers: { "User-Agent": "Mozilla/5.0" },
              redirect: "follow",
            });
            const html = await fetchRes.text();
            const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) || html.match(/<title>([^<]+)<\/title>/i);
            if (titleMatch?.[1]) name = titleMatch[1].replace(/ \| shopee.*/i, "").trim().slice(0, 80);
            const priceMatch = html.match(/"price":\s*"?(\d+)"?/i);
            if (priceMatch?.[1]) { priceMin = parseInt(priceMatch[1]); priceMax = priceMin; }
          } catch {}
        }

        const pipeline = await startAffiliatePipeline({ productName: name, productUrl, priceMin, priceMax });
        results.push({ url: productUrl, pipelineId: pipeline.id });
      } catch (e) {
        results.push({ url: productUrl, error: e instanceof Error ? e.message : String(e) });
      }

      // Small delay between starts to avoid overwhelming
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    res.json({
      ok: true,
      started: results.filter(r => r.pipelineId).length,
      failed: results.filter(r => r.error).length,
      results,
    });
  });
}
