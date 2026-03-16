/**
 * Affiliate Content Studio — Pipeline Directive Templates
 *
 * Pre-built CEO directive templates for common content pipeline operations.
 * These can be triggered as `$ directive` commands in the Claw-Empire chat.
 *
 * Usage in chat:
 *   $ [paste any directive below]
 *
 * Or import and use programmatically:
 *   import { PIPELINE_DIRECTIVES } from "./pipeline-directives.ts";
 *   const directive = PIPELINE_DIRECTIVES.analyzeProduct("https://shopee.co.th/...");
 */

export const PIPELINE_DIRECTIVES = {
  // ===== DAILY OPERATIONS =====

  /**
   * Morning trend scan — Trend Hunter agent analyzes current trends
   */
  morningTrendScan: () =>
    `Trend Hunter: ทำ Morning Trend Scan วันนี้
- สแกน TikTok trending sounds, formats, hashtags ที่เกี่ยวกับ affiliate
- ดู Shopee/Lazada flash sale และ campaign ที่กำลังจะมา
- หา seasonal hooks ที่ใช้ได้สัปดาห์นี้
- สรุปเป็น Trend Report พร้อม action items
ส่งเป็น JSON format ตาม TrendReportSchema`,

  /**
   * Analyze a product for affiliate content
   */
  analyzeProduct: (productUrl: string, platform: string = "tiktok") =>
    `วิเคราะห์สินค้านี้สำหรับ ${platform} affiliate content:
URL: ${productUrl}

ต้องการ:
1. Product Analysis — จุดเด่น, ราคา, กลุ่มเป้าหมาย, USP, objections ที่อาจเกิดขึ้น
2. Audience Insight — pain points, desires, emotional triggers ของกลุ่มเป้าหมาย
3. 5+ Content Angles เรียงตาม potential
4. 5+ Hook Variants ที่เหมาะกับแพลตฟอร์ม
5. CTA ที่เหมาะสม (ปักตะกร้า/คลิกลิงก์)
ส่งแต่ละ section เป็น JSON format`,

  /**
   * Full content production for a product
   */
  fullContentProduction: (productName: string, productUrl: string) =>
    `สร้าง Full Content Package สำหรับสินค้า "${productName}"
URL: ${productUrl}

Pipeline เต็มรูปแบบ:
1. Product Analysis → value proposition + objections
2. Audience Insight → pain points + desires + triggers
3. Content Angles → 3 best angles
4. Hooks → 5+ hook variants per angle
5. TikTok Script → 3 script variants (15s, 30s, 60s) พร้อม timing
6. Facebook Post → 2 variants สำหรับ Shopee/Lazada link
7. Visual Brief → thumbnail + image direction
8. Publish Package → copy-paste ready สำหรับทุกแพลตฟอร์ม

ทุก output เป็น JSON format ตาม schema`,

  /**
   * Weekly performance review
   */
  weeklyPerformanceReview: () =>
    `Performance Analyst: ทำ Weekly Performance Review
- สรุป top 5 และ bottom 5 content จากสัปดาห์ที่ผ่านมา
- วิเคราะห์ pattern — hook type ไหนได้ engagement ดี
- เปรียบเทียบ TikTok vs Facebook performance
- ระบุ winning hooks ที่ควรใช้ซ้ำ
- ระบุ pattern ที่ควรหยุดใช้
- แนะนำ action items สำหรับสัปดาห์หน้า
ส่งเป็น WeeklyPerformanceSummarySchema format`,

  // ===== CONTENT CREATION =====

  /**
   * Generate hooks for a product
   */
  generateHooks: (productName: string, targetAudience: string) =>
    `Hook & Copy Specialist: สร้าง hooks สำหรับ "${productName}"
กลุ่มเป้าหมาย: ${targetAudience}

ต้องการ:
- 3 Question hooks
- 3 Bold claim hooks
- 3 Curiosity gap hooks
- 3 Pain point hooks
- 2 Story hooks
- 2 Statistic hooks

แต่ละ hook ต้อง:
- เหมาะกับ TikTok (ดึงคนหยุดดูใน 1.5 วินาที)
- มี emotional trigger
- ไม่ clickbait เกินไป
ส่งเป็น HooksSchema format`,

  /**
   * Create TikTok script variants
   */
  createTikTokScripts: (productName: string, hook: string) =>
    `Video Script Producer: สร้าง TikTok script สำหรับ "${productName}"
ใช้ hook: "${hook}"

ต้องการ 3 variants:
1. 15 วินาที — Quick showcase + CTA
2. 30 วินาที — Problem → Solution → CTA
3. 60 วินาที — Story-driven review + CTA

แต่ละ script ต้องมี:
- Shot-by-shot breakdown พร้อม timing
- Visual direction / camera angle
- Text overlay suggestions
- Sound/music recommendation
- CTA: "ปักตะกร้าเลย" / "คลิกลิงก์ในโปรไฟล์"
ส่งเป็น TiktokAffiliateScriptSchema format`,

  /**
   * Create Facebook post for Shopee/Lazada
   */
  createFacebookPost: (productName: string, platform: "shopee" | "lazada", affiliateLink: string) =>
    `Content Writer: สร้าง Facebook post สำหรับ "${productName}"
แพลตฟอร์ม: ${platform}
Affiliate Link: ${affiliateLink}

ต้องการ 2 variants:
1. Short format — ข้อความสั้น + emoji + link
2. Long format — review เต็มรูปแบบ + pros/cons + link

แต่ละ variant ต้องมี:
- Hook ที่ดึงความสนใจ
- Social proof หรือ personal experience angle
- Clear CTA พร้อม link
- Hashtags ที่เกี่ยวข้อง
ส่งเป็น FacebookAffiliatePostSchema format`,

  // ===== SCHEDULING =====

  /**
   * Plan content calendar for the week
   */
  planWeeklyCalendar: (focus: string = "mixed") =>
    `Content Calendar Manager: วางแผน Content Calendar สัปดาห์หน้า
Focus: ${focus}

ต้องการ:
- จันทร์-อาทิตย์, 1-2 content ต่อวัน
- ระบุ optimal posting times สำหรับแต่ละแพลตฟอร์ม
- สลับ content type (video, carousel, post)
- สลับ platform (TikTok, Facebook)
- note seasonal/trending opportunities
ส่งเป็น ContentCalendarEntrySchema[] format`,

  // ===== COMMUNITY =====

  /**
   * Generate comment reply suggestions
   */
  handleComments: (postUrl: string) =>
    `Publisher & Community Manager: วิเคราะห์ comments จาก post นี้
Post URL: ${postUrl}

ต้องการ:
- จัดกลุ่ม comments ตาม signal type (buying intent, price question, objection, etc.)
- แนะนำ reply สำหรับแต่ละ comment ที่มี buying signal
- reply ต้อง friendly แต่ nudge ไปที่ link
- ระบุ comments ที่ควร pin
ส่งเป็น CommunityReplySuggestionsSchema format`,
} as const;

/**
 * List of all available pipeline directives with descriptions.
 * Useful for displaying in UI or generating help text.
 */
export const DIRECTIVE_CATALOG = [
  {
    id: "morning_trend_scan",
    label: "🔍 Morning Trend Scan",
    description: "Daily trend analysis for affiliate opportunities",
    category: "daily",
  },
  {
    id: "analyze_product",
    label: "📦 Analyze Product",
    description: "Full product analysis with audience insight and angles",
    category: "analysis",
  },
  {
    id: "full_content_production",
    label: "🚀 Full Content Package",
    description: "End-to-end content production for a product",
    category: "production",
  },
  {
    id: "generate_hooks",
    label: "🎣 Generate Hooks",
    description: "Create 15+ hook variants by type",
    category: "creation",
  },
  {
    id: "create_tiktok_scripts",
    label: "🎬 TikTok Scripts",
    description: "3 script variants (15s, 30s, 60s)",
    category: "creation",
  },
  {
    id: "create_facebook_post",
    label: "📱 Facebook Post",
    description: "Shopee/Lazada affiliate post variants",
    category: "creation",
  },
  {
    id: "plan_weekly_calendar",
    label: "📅 Weekly Calendar",
    description: "Plan next week's content schedule",
    category: "scheduling",
  },
  {
    id: "weekly_performance_review",
    label: "📊 Weekly Review",
    description: "Performance analysis and learnings",
    category: "reporting",
  },
  {
    id: "handle_comments",
    label: "💬 Comment Manager",
    description: "Analyze and reply to buying signals",
    category: "community",
  },
] as const;
