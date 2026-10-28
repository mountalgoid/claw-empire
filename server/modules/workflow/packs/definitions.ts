export const WORKFLOW_PACK_KEYS = [
  "development",
  "novel",
  "report",
  "video_preprod",
  "web_research_report",
  "roleplay",
  "clipper_studio",
  "content_studio",
  "art_drawing_studio",
  "game_dev_studio",
  "app_dev_studio",
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
    key: "clipper_studio",
    name: "Clipper Studio",
    inputSchema: { required: ["source_material", "clip_goal", "platform"], optional: ["duration", "caption_style"] },
    promptPreset: { mode: "short_form_video_editing", preserve_source_context: true, prioritize_hook: true },
    qaRules: { require_source_attribution: true, require_safe_captions: true, require_platform_format: true },
    outputTemplate: { sections: ["clip_candidates", "hook", "edit_plan", "caption", "export_spec"] },
    routingKeywords: ["clipper", "clipping", "clip", "potong video", "highlight", "cuplikan", "klip", "short clip"],
    costProfile: { ...COMMON_COST_PROFILE, maxRounds: 2, defaultReasoning: "medium" },
  },
  {
    key: "content_studio",
    name: "Content Studio",
    inputSchema: { required: ["content_goal", "audience", "channel"], optional: ["calendar", "brand_voice", "seo"] },
    promptPreset: { mode: "content_strategy", maintain_brand_voice: true, create_reusable_assets: true },
    qaRules: { require_audience_fit: true, require_content_checklist: true, enforce_brand_safety: true },
    outputTemplate: { sections: ["strategy", "content_calendar", "drafts", "distribution", "metrics"] },
    routingKeywords: ["content", "konten", "content plan", "content calendar", "copywriting", "marketing content", "social media"],
    costProfile: { ...COMMON_COST_PROFILE, maxRounds: 3, defaultReasoning: "high" },
  },
  {
    key: "art_drawing_studio",
    name: "Art Drawing Studio",
    inputSchema: { required: ["art_brief", "style", "canvas"], optional: ["references", "palette", "layers"] },
    promptPreset: { mode: "visual_art_direction", preserve_character_identity: true, specify_layers: true },
    qaRules: { require_art_brief_check: true, require_asset_specs: true, enforce_reference_rights: true },
    outputTemplate: { sections: ["visual_direction", "sketch_plan", "asset_list", "layer_spec", "review_checklist"] },
    routingKeywords: ["art", "drawing", "illustration", "gambar", "menggambar", "ilustrasi", "concept art", "desain karakter"],
    costProfile: { ...COMMON_COST_PROFILE, maxRounds: 2, defaultReasoning: "medium" },
  },
  {
    key: "game_dev_studio",
    name: "Game Developer Studio",
    inputSchema: { required: ["game_concept", "platform", "core_loop"], optional: ["engine", "art_style", "multiplayer"] },
    promptPreset: { mode: "game_development", enforce_playable_loop: true, track_assets_and_builds: true },
    qaRules: { require_playtest_evidence: true, require_build_check: true, require_performance_notes: true },
    outputTemplate: { sections: ["game_design", "architecture", "implementation", "playtest", "build_artifact"] },
    routingKeywords: ["game", "video game", "gameplay", "unity", "unreal", "godot", "permainan", "game dev", "game development"],
    costProfile: { ...COMMON_COST_PROFILE, maxRounds: 4, defaultReasoning: "high" },
  },
  {
    key: "app_dev_studio",
    name: "Developer Apps Studio",
    inputSchema: { required: ["app_goal", "target_platform", "acceptance_criteria"], optional: ["stack", "integrations", "offline_mode"] },
    promptPreset: { mode: "product_app_development", enforce_user_flows: true, protect_data: true, optimize_runtime: true },
    qaRules: { require_typecheck_or_build: true, require_security_review: true, require_acceptance_test: true },
    outputTemplate: { sections: ["product_spec", "user_flows", "implementation", "verification", "release_notes"] },
    routingKeywords: ["app", "application", "aplikasi", "mobile app", "web app", "desktop app", "aplikasi kasir", "software"],
    costProfile: { ...COMMON_COST_PROFILE, maxRounds: 4, defaultReasoning: "high" },
  },
];
