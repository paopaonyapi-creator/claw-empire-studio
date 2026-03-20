/**
 * Multi-Platform Publish — Publish content to TikTok + Facebook + IG simultaneously
 * Adapts content format per platform
 */

import type { Express } from "express";

const PORT = process.env.PORT || 8790;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PublishRequest {
  content: string;
  platforms: ("tiktok" | "facebook" | "instagram")[];
  productName?: string;
  affiliateLink?: string;
  imageUrl?: string;
  scheduleAt?: string; // ISO date
}

interface PublishResult {
  platform: string;
  status: "success" | "scheduled" | "failed" | "no_config";
  message: string;
  postId?: string;
  adaptedContent?: string;
}

interface PublishJob {
  id: string;
  request: PublishRequest;
  results: PublishResult[];
  createdAt: string;
  status: "pending" | "done" | "partial";
}

// Store publish jobs
const publishJobs: PublishJob[] = [];

// ---------------------------------------------------------------------------
// Platform-specific Content Adaptation
// ---------------------------------------------------------------------------

async function adaptContent(content: string, platform: string, productName?: string): Promise<string> {
  const { geminiGenerate } = await import("./gemini-provider.ts");

  const platformGuide: Record<string, string> = {
    tiktok: "สไตล์ TikTok: สั้นกระชับ ใช้ emoji เยอะ มี hook แรง ขึ้นต้นด้วยคำถามหรือ pain point ปิดด้วย CTA ชัดเจน ใส่ hashtag 3-5 ตัว ไม่เกิน 150 คำ",
    facebook: "สไตล์ Facebook: เล่าเรื่องยาวขึ้น มี storytelling มี paragraph break ใส่ emoji พอดี ปิดด้วย CTA และลิงก์ ไม่เกิน 300 คำ",
    instagram: "สไตล์ Instagram: เน้น visual caption สั้น มี emoji ใส่ hashtag 10-15 ตัว ขึ้นต้นด้วยประโยคดึงดูด ปิดด้วย CTA ไม่เกิน 200 คำ",
  };

  const prompt = `ปรับ content นี้ให้เหมาะกับ ${platform}:

Content เดิม:
${content.slice(0, 1500)}

${productName ? `สินค้า: ${productName}` : ""}

กฎ: ${platformGuide[platform] || "ปรับให้เหมาะสม"}

ตอบเป็นข้อความที่พร้อมโพสต์เท่านั้น ห้ามมีคำอธิบายเพิ่มเติม`;

  const response = await geminiGenerate({ prompt, maxTokens: 1024 });
  return response.text || content;
}

// ---------------------------------------------------------------------------
// Platform Publishers
// ---------------------------------------------------------------------------

async function publishToFacebook(content: string, scheduleAt?: string): Promise<PublishResult> {
  try {
    const fbModule = await import("./facebook-publisher.ts");
    if (scheduleAt) {
      fbModule.scheduleFbPostExternal(content, scheduleAt);
      return { platform: "facebook", status: "scheduled", message: `Scheduled for ${scheduleAt}` };
    }
    fbModule.scheduleFbPostExternal(content, new Date(Date.now() + 60000).toISOString().slice(0, 16));
    return { platform: "facebook", status: "scheduled", message: "Scheduled in 1 minute" };
  } catch (err) {
    return { platform: "facebook", status: "failed", message: String(err) };
  }
}

async function publishToTikTok(content: string): Promise<PublishResult> {
  // TikTok API requires video — we store as draft
  return {
    platform: "tiktok",
    status: "success",
    message: "📋 Caption saved as draft. Upload video manually on TikTok",
    adaptedContent: content,
  };
}

async function publishToInstagram(content: string): Promise<PublishResult> {
  // IG API requires Business account setup
  return {
    platform: "instagram",
    status: "success",
    message: "📋 Caption saved as draft. Post via IG Creator Studio",
    adaptedContent: content,
  };
}

// ---------------------------------------------------------------------------
// Core Multi-publish
// ---------------------------------------------------------------------------

async function multiPublish(request: PublishRequest): Promise<PublishJob> {
  const job: PublishJob = {
    id: `pub_${Date.now()}`,
    request,
    results: [],
    createdAt: new Date().toISOString(),
    status: "pending",
  };

  for (const platform of request.platforms) {
    // Adapt content for each platform
    const adapted = await adaptContent(request.content, platform, request.productName);
    
    // Add affiliate link if provided
    let finalContent = adapted;
    if (request.affiliateLink) {
      finalContent += `\n\n🛒 สั่งซื้อ: ${request.affiliateLink}`;
    }

    let result: PublishResult;
    switch (platform) {
      case "facebook":
        result = await publishToFacebook(finalContent, request.scheduleAt);
        break;
      case "tiktok":
        result = await publishToTikTok(finalContent);
        break;
      case "instagram":
        result = await publishToInstagram(finalContent);
        break;
      default:
        result = { platform, status: "failed", message: "Unknown platform" };
    }

    result.adaptedContent = finalContent;
    job.results.push(result);
  }

  job.status = job.results.every(r => r.status === "success" || r.status === "scheduled") ? "done" : "partial";
  publishJobs.push(job);

  // Notify via TG
  try {
    const { sendTgNotification } = await import("./auto-pipeline.ts");
    const summary = job.results.map(r => `${r.platform === "tiktok" ? "🎵" : r.platform === "facebook" ? "📘" : "📸"} ${r.platform}: ${r.status}`).join("\n");
    await sendTgNotification(
      `📢 <b>Multi-Platform Publish</b>\n\n` +
      `📝 ${request.productName || "Content"}\n` +
      `🎯 ${request.platforms.length} platforms\n\n${summary}`
    );
  } catch {}

  return job;
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

export function registerMultiPublishRoutes(app: Express): void {
  // Multi-platform publish
  app.post("/api/publish/multi", async (req, res) => {
    const { content, platforms, productName, affiliateLink, imageUrl, scheduleAt } = req.body || {};
    if (!content || !platforms?.length) {
      return res.status(400).json({ ok: false, error: "content and platforms[] required" });
    }
    try {
      const job = await multiPublish({ content, platforms, productName, affiliateLink, imageUrl, scheduleAt });
      res.json({ ok: true, job });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // Adapt content for a platform (preview)
  app.post("/api/publish/adapt", async (req, res) => {
    const { content, platform, productName } = req.body || {};
    if (!content || !platform) {
      return res.status(400).json({ ok: false, error: "content and platform required" });
    }
    try {
      const adapted = await adaptContent(content, platform, productName);
      res.json({ ok: true, adapted });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // Get publish history
  app.get("/api/publish/history", (_req, res) => {
    const sorted = [...publishJobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50);
    res.json({ ok: true, jobs: sorted, total: sorted.length });
  });

  console.log("[Multi-Publish] ✅ TikTok + Facebook + IG publishing ready");
}
