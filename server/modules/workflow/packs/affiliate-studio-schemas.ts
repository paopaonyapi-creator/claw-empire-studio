/**
 * Affiliate Content Studio — Structured Output Schemas
 *
 * Zod schemas defining the expected output format for each stage
 * of the affiliate content production pipeline. These schemas serve
 * as both documentation and runtime validation contracts.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// 1. Product Analysis
// ---------------------------------------------------------------------------
export const ProductAnalysisSchema = z.object({
  product_name: z.string().describe("Product name as displayed on the platform"),
  product_url: z.string().url().optional().describe("Source URL if available"),
  price_range: z.string().describe("Price or price range (e.g., '฿299', '฿199-฿399')"),
  category: z.string().describe("Product category (e.g., 'skincare', 'kitchen gadget')"),
  key_features: z.array(z.string()).min(3).describe("Top features/benefits"),
  value_proposition: z.string().describe("Single-sentence value proposition"),
  unique_selling_points: z.array(z.string()).describe("What makes this product different"),
  potential_objections: z.array(z.string()).describe("Likely buyer objections"),
  commission_info: z.string().optional().describe("Commission rate/structure if known"),
  affiliate_platform: z.enum(["tiktok", "shopee", "lazada", "other"]).describe("Primary affiliate platform"),
});

// ---------------------------------------------------------------------------
// 2. Audience Insight
// ---------------------------------------------------------------------------
export const AudienceInsightSchema = z.object({
  target_segment: z.string().describe("Primary audience segment description"),
  pain_points: z.array(z.object({
    pain: z.string(),
    intensity: z.enum(["low", "medium", "high"]),
    content_angle: z.string().describe("How to address this in content"),
  })).min(3),
  desires: z.array(z.string()).min(3).describe("What the audience wants/aspires to"),
  objections: z.array(z.object({
    objection: z.string(),
    counter_argument: z.string(),
  })).min(2),
  emotional_triggers: z.array(z.string()).describe("Emotions that drive purchase"),
  language_patterns: z.array(z.string()).describe("Words/phrases the audience uses"),
  persuasion_angles: z.array(z.string()).min(2).describe("Recommended persuasion approaches"),
});

// ---------------------------------------------------------------------------
// 3. Angle Recommendations
// ---------------------------------------------------------------------------
export const AngleRecommendationsSchema = z.object({
  recommended_angles: z.array(z.object({
    angle: z.string().describe("Content angle description"),
    type: z.enum(["educational", "story", "comparison", "problem_solution", "review", "lifestyle", "urgency"]),
    platform_fit: z.array(z.enum(["tiktok", "facebook", "instagram", "youtube", "x"])),
    strength: z.enum(["strong", "medium", "experimental"]),
    reasoning: z.string().describe("Why this angle works for this product"),
  })).min(3),
  primary_angle: z.string().describe("The single best angle to lead with"),
  angle_sequence: z.array(z.string()).describe("Recommended order for publishing multiple angles"),
});

// ---------------------------------------------------------------------------
// 4. Hooks
// ---------------------------------------------------------------------------
export const HooksSchema = z.object({
  hooks: z.array(z.object({
    text: z.string().describe("The hook text"),
    type: z.enum(["question", "bold_claim", "story", "curiosity_gap", "pain_point", "statistic", "controversy"]),
    platform: z.enum(["tiktok", "facebook", "instagram", "universal"]),
    word_count: z.number().int().positive(),
    strength_rating: z.number().min(1).max(10),
  })).min(5),
  top_pick: z.string().describe("The single strongest hook"),
  pairing_notes: z.string().optional().describe("Notes on which hooks pair best with which angles"),
});

// ---------------------------------------------------------------------------
// 5. CTA Variants
// ---------------------------------------------------------------------------
export const CtaVariantsSchema = z.object({
  cta_variants: z.array(z.object({
    text: z.string(),
    type: z.enum(["direct", "soft", "urgency", "social_proof", "scarcity"]),
    platform: z.enum(["tiktok", "facebook", "instagram", "universal"]),
    placement: z.enum(["end", "middle", "overlay", "caption"]),
  })).min(3),
  tiktok_basket_cta: z.string().describe("ปักตะกร้า-specific CTA for TikTok"),
  link_in_bio_cta: z.string().describe("Link-in-bio CTA variant"),
});

// ---------------------------------------------------------------------------
// 6. Main Post Copy
// ---------------------------------------------------------------------------
export const MainPostCopySchema = z.object({
  headline: z.string(),
  body: z.string().min(100).describe("Main body copy (300-500 words)"),
  short_version: z.string().describe("Condensed version (50-150 words)"),
  story_version: z.string().optional().describe("Story/personal experience angle"),
  educational_version: z.string().optional().describe("Educational/how-to angle"),
  key_talking_points: z.array(z.string()).min(3),
  word_count: z.number().int().positive(),
});

// ---------------------------------------------------------------------------
// 7. TikTok Affiliate Script
// ---------------------------------------------------------------------------
export const TiktokAffiliateScriptSchema = z.object({
  title: z.string(),
  duration_seconds: z.number().int().min(15).max(180),
  hook: z.object({
    timing: z.string().describe("e.g., '0:00-0:03'"),
    visual: z.string(),
    audio: z.string(),
    text_overlay: z.string().optional(),
  }),
  segments: z.array(z.object({
    timing: z.string(),
    purpose: z.enum(["hook", "problem", "solution", "proof", "demo", "cta", "transition"]),
    visual: z.string(),
    audio: z.string(),
    text_overlay: z.string().optional(),
  })).min(3),
  cta: z.object({
    timing: z.string(),
    visual: z.string(),
    audio: z.string(),
    text_overlay: z.string(),
    basket_instruction: z.string().describe("ปักตะกร้า instruction"),
  }),
  hashtags: z.array(z.string()).min(5),
  music_suggestion: z.string().optional(),
  shooting_notes: z.string().optional().describe("Notes for the creator shooting this"),
});

// ---------------------------------------------------------------------------
// 8. Facebook Affiliate Post
// ---------------------------------------------------------------------------
export const FacebookAffiliatePostSchema = z.object({
  post_type: z.enum(["persuasive", "value_focused", "story", "comparison", "review"]),
  platform_target: z.enum(["shopee", "lazada", "both"]),
  headline: z.string(),
  body: z.string().min(50),
  cta_text: z.string(),
  affiliate_link_placement: z.string().describe("Where/how to place the affiliate link"),
  hashtags: z.array(z.string()),
  image_suggestion: z.string().optional().describe("What image to pair with this post"),
  comment_prompt: z.string().optional().describe("Question to encourage comments"),
  emoji_usage: z.string().optional().describe("Suggested emoji pattern"),
});

// ---------------------------------------------------------------------------
// 9. Visual Brief
// ---------------------------------------------------------------------------
export const VisualBriefSchema = z.object({
  concept: z.string().describe("One-sentence concept"),
  composition: z.string().describe("Layout and composition description"),
  text_overlay: z.object({
    headline: z.string(),
    subtext: z.string().optional(),
    placement: z.string(),
  }),
  color_scheme: z.array(z.string()).describe("Hex colors or color names"),
  mood: z.string().describe("Visual mood (e.g., 'clean minimal', 'vibrant lifestyle')"),
  reference_style: z.string().describe("Style reference (e.g., 'product flat lay', 'UGC screenshot')"),
  dimensions: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    aspect_ratio: z.string(),
  }),
  platform: z.enum(["tiktok", "facebook", "instagram", "universal"]),
});

// ---------------------------------------------------------------------------
// 10. Thumbnail Brief
// ---------------------------------------------------------------------------
export const ThumbnailBriefSchema = z.object({
  focal_point: z.string().describe("What the eye should see first"),
  text_content: z.string().describe("Text to overlay on thumbnail"),
  text_placement: z.enum(["top", "center", "bottom", "left", "right"]),
  emotion: z.string().describe("Emotion to convey (surprise, excitement, curiosity)"),
  background_type: z.enum(["solid_color", "gradient", "product_shot", "lifestyle", "blurred"]),
  click_appeal: z.enum(["informational", "emotional", "curiosity", "urgency"]),
  dimensions: z.string().describe("e.g., '1280x720' for YouTube, '1080x1920' for TikTok"),
});

// ---------------------------------------------------------------------------
// 11. Carousel Brief
// ---------------------------------------------------------------------------
export const CarouselBriefSchema = z.object({
  total_slides: z.number().int().min(3).max(10),
  story_flow: z.string().describe("How the carousel tells its story across slides"),
  slides: z.array(z.object({
    slide_number: z.number().int().positive(),
    purpose: z.string().describe("What this slide achieves"),
    headline: z.string(),
    body_text: z.string().optional(),
    visual_direction: z.string(),
    is_cta_slide: z.boolean(),
  })).min(3),
  platform: z.enum(["instagram", "facebook", "tiktok", "linkedin"]),
  dimensions: z.string().describe("e.g., '1080x1080' or '1080x1350'"),
});

// ---------------------------------------------------------------------------
// 12. Short Video Scripts (batch of 3)
// ---------------------------------------------------------------------------
export const ShortVideoScriptsSchema = z.object({
  product_name: z.string(),
  scripts: z.array(TiktokAffiliateScriptSchema).min(3).max(5),
  variation_strategy: z.string().describe("How the scripts differ from each other"),
});

// ---------------------------------------------------------------------------
// 13. Content Calendar Entry
// ---------------------------------------------------------------------------
export const ContentCalendarEntrySchema = z.object({
  content_title: z.string(),
  content_type: z.enum(["tiktok_video", "facebook_post", "instagram_reel", "carousel", "story", "youtube_short"]),
  platform: z.enum(["tiktok", "facebook", "instagram", "youtube", "x"]),
  publish_date: z.string().describe("ISO date string"),
  publish_time: z.string().describe("HH:mm in local timezone"),
  status: z.enum(["idea", "draft", "visual_pending", "ready", "scheduled", "published", "review"]),
  priority: z.enum(["high", "medium", "low"]),
  dependencies: z.array(z.string()).optional().describe("What must be done before publishing"),
  product_name: z.string().optional(),
  campaign_name: z.string().optional(),
  notes: z.string().optional(),
});

// ---------------------------------------------------------------------------
// 14. Publish Package
// ---------------------------------------------------------------------------
export const PublishPackageSchema = z.object({
  platform: z.enum(["tiktok", "facebook", "instagram", "youtube", "x"]),
  content_type: z.string(),
  caption: z.string().describe("Platform-formatted caption, ready to paste"),
  hashtags: z.array(z.string()),
  affiliate_link: z.string().optional(),
  link_placement: z.string().describe("Where to place the link (bio, comment, in-post)"),
  thumbnail_brief: ThumbnailBriefSchema.optional(),
  posting_instructions: z.string().describe("Step-by-step posting guide"),
  cross_posting_notes: z.string().optional(),
  best_posting_time: z.string().describe("Recommended posting time"),
});

// ---------------------------------------------------------------------------
// 15. Community Reply Suggestions
// ---------------------------------------------------------------------------
export const CommunityReplySuggestionsSchema = z.object({
  buying_intent_replies: z.array(z.object({
    trigger_comment: z.string().describe("Example comment that triggers this reply"),
    reply: z.string(),
    conversion_goal: z.string(),
  })).min(3),
  objection_handling_replies: z.array(z.object({
    objection: z.string(),
    reply: z.string(),
    tone: z.enum(["friendly", "authoritative", "empathetic", "playful"]),
  })).min(2),
  engagement_replies: z.array(z.object({
    context: z.string(),
    reply: z.string(),
  })).min(2),
  conversion_signals: z.array(z.object({
    signal_type: z.enum(["buying_intent", "price_question", "availability_question", "comparison_request", "positive_review"]),
    example_comment: z.string(),
    recommended_action: z.string(),
  })),
});

// ---------------------------------------------------------------------------
// 16. Weekly Performance Summary
// ---------------------------------------------------------------------------
export const WeeklyPerformanceSummarySchema = z.object({
  period: z.object({
    start_date: z.string(),
    end_date: z.string(),
  }),
  top_performers: z.array(z.object({
    content_title: z.string(),
    platform: z.string(),
    views: z.number().int(),
    engagement_rate: z.number(),
    conversions: z.number().int().optional(),
    why_it_worked: z.string(),
  })).min(1).max(5),
  bottom_performers: z.array(z.object({
    content_title: z.string(),
    platform: z.string(),
    views: z.number().int(),
    engagement_rate: z.number(),
    why_it_failed: z.string(),
    improvement_suggestion: z.string(),
  })).max(3),
  best_hook_types: z.array(z.string()),
  best_content_formats: z.array(z.string()),
  best_posting_times: z.array(z.string()),
  platform_comparison: z.object({
    tiktok: z.object({ avg_views: z.number(), avg_engagement: z.number(), total_conversions: z.number().optional() }).optional(),
    facebook: z.object({ avg_views: z.number(), avg_engagement: z.number(), total_conversions: z.number().optional() }).optional(),
  }),
  patterns_to_repeat: z.array(z.string()).min(1),
  patterns_to_stop: z.array(z.string()),
  next_week_recommendations: z.array(z.string()).min(2),
});

// ---------------------------------------------------------------------------
// Export all schemas as a map for runtime reference
// ---------------------------------------------------------------------------
export const AFFILIATE_STUDIO_SCHEMAS = {
  product_analysis: ProductAnalysisSchema,
  audience_insight: AudienceInsightSchema,
  angle_recommendations: AngleRecommendationsSchema,
  hooks: HooksSchema,
  cta_variants: CtaVariantsSchema,
  main_post_copy: MainPostCopySchema,
  tiktok_affiliate_script: TiktokAffiliateScriptSchema,
  facebook_affiliate_post: FacebookAffiliatePostSchema,
  visual_brief: VisualBriefSchema,
  thumbnail_brief: ThumbnailBriefSchema,
  carousel_brief: CarouselBriefSchema,
  short_video_scripts: ShortVideoScriptsSchema,
  content_calendar_entry: ContentCalendarEntrySchema,
  publish_package: PublishPackageSchema,
  community_reply_suggestions: CommunityReplySuggestionsSchema,
  weekly_performance_summary: WeeklyPerformanceSummarySchema,
} as const;
