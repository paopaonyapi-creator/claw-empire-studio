export const WORKFLOW_PACK_KEYS = [
  "development",
  "novel",
  "report",
  "video_preprod",
  "web_research_report",
  "roleplay",
  "affiliate_studio",
] as const;

export type WorkflowPackKey = (typeof WORKFLOW_PACK_KEYS)[number];

export const DEFAULT_WORKFLOW_PACK_KEY: WorkflowPackKey = "development";

export function isWorkflowPackKey(value: unknown): value is WorkflowPackKey {
  return typeof value === "string" && (WORKFLOW_PACK_KEYS as readonly string[]).includes(value);
}

export type WorkflowPackSeed = {
  key: WorkflowPackKey;
  name: string;
  inputSchema: Record<string, unknown>;
  promptPreset: Record<string, unknown>;
  qaRules: Record<string, unknown>;
  outputTemplate: Record<string, unknown>;
  routingKeywords: string[];
  costProfile: Record<string, unknown>;
};

const COMMON_COST_PROFILE = {
  maxInputTokens: 12000,
  maxOutputTokens: 6000,
  maxRounds: 3,
};

export const DEFAULT_WORKFLOW_PACK_SEEDS: WorkflowPackSeed[] = [
  {
    key: "development",
    name: "Development",
    inputSchema: {
      required: ["project", "instruction"],
      optional: ["constraints", "acceptance_criteria", "deadline"],
    },
    promptPreset: {
      mode: "engineering",
      style: "pragmatic",
      enforceTests: true,
    },
    qaRules: {
      requireTestEvidence: true,
      requireRiskNotes: true,
      maxAutoFixPasses: 1,
    },
    outputTemplate: {
      sections: ["summary", "changes", "verification", "next_steps"],
    },
    routingKeywords: ["fix", "bug", "refactor", "build", "api", "test", "개발", "버그", "수정", "코드"],
    costProfile: {
      ...COMMON_COST_PROFILE,
      defaultReasoning: "high",
    },
  },
  {
    key: "novel",
    name: "Novel Writing",
    inputSchema: {
      required: ["genre", "tone", "length"],
      optional: ["characters", "world_setting", "point_of_view"],
    },
    promptPreset: {
      mode: "creative_writing",
      keepCharacterConsistency: true,
    },
    qaRules: {
      checkToneConsistency: true,
      checkCharacterDrift: true,
    },
    outputTemplate: {
      sections: ["synopsis", "chapter_or_scene"],
    },
    routingKeywords: ["novel", "story", "chapter", "scene", "소설", "스토리", "시나리오"],
    costProfile: {
      ...COMMON_COST_PROFILE,
      maxRounds: 2,
      defaultReasoning: "medium",
    },
  },
  {
    key: "report",
    name: "Structured Report",
    inputSchema: {
      required: ["goal", "audience", "format"],
      optional: ["length", "tone", "deadline"],
    },
    promptPreset: {
      mode: "reporting",
      includeExecutiveSummary: true,
    },
    qaRules: {
      requireSections: ["summary", "body", "action_items"],
      failOnMissingSections: true,
    },
    outputTemplate: {
      sections: ["summary", "body", "action_items"],
    },
    routingKeywords: ["report", "analysis", "brief", "보고서", "분석", "정리", "리포트"],
    costProfile: {
      ...COMMON_COST_PROFILE,
      defaultReasoning: "high",
    },
  },
  {
    key: "video_preprod",
    name: "Video Pre-production",
    inputSchema: {
      required: ["platform", "duration", "goal"],
      optional: ["target_audience", "style", "cta"],
    },
    promptPreset: {
      mode: "video_planning",
      includeShotList: true,
    },
    qaRules: {
      requireShotList: true,
      requireScript: true,
      requireRenderedVideo: true,
    },
    outputTemplate: {
      sections: ["concept", "script", "shot_list", "editing_notes", "video_file"],
    },
    routingKeywords: ["video", "shorts", "reel", "콘티", "영상", "대본", "샷리스트"],
    costProfile: {
      ...COMMON_COST_PROFILE,
      maxRounds: 2,
      defaultReasoning: "medium",
    },
  },
  {
    key: "web_research_report",
    name: "Web Research Report",
    inputSchema: {
      required: ["topic", "time_range"],
      optional: ["source_policy", "language", "depth"],
    },
    promptPreset: {
      mode: "web_research",
      requireCitations: true,
    },
    qaRules: {
      failWithoutCitations: true,
      citationStyle: "inline_links",
    },
    outputTemplate: {
      sections: ["summary", "findings", "citations", "recommendations"],
    },
    routingKeywords: ["research", "web search", "investigate", "조사", "웹서치", "자료조사", "리서치"],
    costProfile: {
      ...COMMON_COST_PROFILE,
      maxRounds: 3,
      defaultReasoning: "high",
    },
  },
  {
    key: "roleplay",
    name: "Roleplay",
    inputSchema: {
      required: ["character", "tone"],
      optional: ["setting", "constraints", "safety_rules"],
    },
    promptPreset: {
      mode: "roleplay",
      stayInCharacter: true,
    },
    qaRules: {
      keepCharacterVoice: true,
      enforceSafetyPolicy: true,
    },
    outputTemplate: {
      sections: ["dialogue"],
    },
    routingKeywords: ["roleplay", "rp", "character chat", "역할놀이", "역할극", "대화해줘"],
    costProfile: {
      ...COMMON_COST_PROFILE,
      maxRounds: 1,
      defaultReasoning: "low",
    },
  },
  {
    key: "affiliate_studio",
    name: "Affiliate Content Studio",
    inputSchema: {
      required: ["product_or_brief"],
      optional: [
        "product_url",
        "product_image",
        "campaign_brief",
        "audience_brief",
        "brand_voice_brief",
        "target_platforms",
        "schedule_hint",
      ],
    },
    promptPreset: {
      mode: "affiliate_content",
      includePipeline: true,
      pipelineStages: [
        "product_analysis",
        "audience_insight",
        "angle_selection",
        "content_draft",
        "hook_generation",
        "visual_brief",
        "video_scripts",
        "platform_adaptation",
        "publish_package",
      ],
      primaryPlatform: "tiktok",
      secondaryPlatforms: ["facebook_shopee", "facebook_lazada"],
      optionalPlatforms: ["instagram_reels", "youtube_shorts", "x_twitter"],
    },
    qaRules: {
      requireHooks: true,
      requireCTA: true,
      requirePlatformSpecificOutput: true,
      requireVisualBrief: true,
      minimumHookVariants: 3,
      minimumScriptVariants: 3,
    },
    outputTemplate: {
      sections: [
        "product_analysis",
        "audience_insight",
        "angle_recommendations",
        "hooks",
        "cta_variants",
        "main_post_copy",
        "tiktok_affiliate_script",
        "facebook_affiliate_post",
        "visual_brief",
        "thumbnail_brief",
        "carousel_brief",
        "short_video_scripts",
        "content_calendar_entry",
        "publish_package",
        "community_reply_suggestions",
      ],
    },
    routingKeywords: [
      "affiliate",
      "product",
      "tiktok",
      "shopee",
      "lazada",
      "content studio",
      "hook",
      "cta",
      "basket",
      "ปักตะกร้า",
      "สินค้า",
      "คอนเทนต์",
      "แอฟฟิลิเอท",
      "제휴",
      "상품",
      "콘텐츠",
      "숏폼",
      "アフィリエイト",
      "商品",
    ],
    costProfile: {
      ...COMMON_COST_PROFILE,
      maxRounds: 3,
      defaultReasoning: "high",
    },
  },
];
