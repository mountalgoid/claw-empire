import type { Agent, AgentRole, CliProvider, Department, RoomTheme, WorkflowPackKey } from "../types";

export type UiLanguageLike = "ko" | "en" | "ja" | "zh" | "id";

type Localized = { ko: string; en: string; ja: string; zh: string; id?: string };
type DeptPreset = {
  name: Localized;
  icon: string;
  agentPrefix: Localized;
  avatarPool: string[];
};

type StaffPreset = {
  nonLeaderDeptCycle: string[];
  roleTitles?: Partial<Record<AgentRole, Localized>>;
  planningLeadDeptIds?: string[];
};

type SeedProfile = {
  nameOffset: number;
  tone: Localized;
};

type PackPreset = {
  key: WorkflowPackKey;
  slug: string;
  label: Localized;
  summary: Localized;
  roomThemes: Record<string, RoomTheme>;
  departments: Partial<Record<string, DeptPreset>>;
  staff?: StaffPreset;
};

type OfficePackPresentation = {
  departments: Department[];
  agents: Agent[];
  roomThemes: Record<string, RoomTheme>;
};

export type OfficePackStarterAgentDraft = {
  name: string;
  name_ko: string;
  name_ja: string;
  name_zh: string;
  department_id: string | null;
  seed_order_in_department: number;
  role: AgentRole;
  acts_as_planning_leader: number;
  avatar_emoji: string;
  sprite_number: number;
  personality: string | null;
};

type OfficePackSeedProvider = Extract<CliProvider, "claude" | "codex">;
const OFFICE_SEED_SPRITE_POOL = Array.from({ length: 13 }, (_, idx) => idx + 1);

const DEV_THEMES: Record<string, RoomTheme> = {
  ceoOffice: { floor1: 0xe5d9b9, floor2: 0xdfd0a8, wall: 0x998243, accent: 0xa77d0c },
  planning: { floor1: 0xf0e1c5, floor2: 0xeddaba, wall: 0xae9871, accent: 0xd4a85a },
  dev: { floor1: 0xd8e8f5, floor2: 0xcce1f2, wall: 0x6c96b7, accent: 0x5a9fd4 },
  design: { floor1: 0xe8def2, floor2: 0xe1d4ee, wall: 0x9378ad, accent: 0x9a6fc4 },
  qa: { floor1: 0xf0cbcb, floor2: 0xedc0c0, wall: 0xae7979, accent: 0xd46a6a },
  devsecops: { floor1: 0xf0d5c5, floor2: 0xedcdba, wall: 0xae8871, accent: 0xd4885a },
  operations: { floor1: 0xd0eede, floor2: 0xc4ead5, wall: 0x6eaa89, accent: 0x5ac48a },
  breakRoom: { floor1: 0xf7e2b7, floor2: 0xf6dead, wall: 0xa99c83, accent: 0xf0c878 },
};

const DEPARTMENT_PERSON_NAME_POOL: Partial<Record<string, Localized[]>> = {
  planning: [
    { ko: "세이지", en: "Sage", ja: "セージ", zh: "赛吉" },
    { ko: "미나", en: "Mina", ja: "ミナ", zh: "米娜" },
    { ko: "주노", en: "Juno", ja: "ジュノ", zh: "朱诺" },
    { ko: "리안", en: "Rian", ja: "リアン", zh: "里安" },
    { ko: "하루", en: "Haru", ja: "ハル", zh: "晴" },
    { ko: "노아", en: "Noa", ja: "ノア", zh: "诺亚" },
  ],
  dev: [
    { ko: "아리아", en: "Aria", ja: "アリア", zh: "阿莉娅" },
    { ko: "테오", en: "Theo", ja: "テオ", zh: "西奥" },
    { ko: "카이", en: "Kai", ja: "カイ", zh: "凯" },
    { ko: "리암", en: "Liam", ja: "リアム", zh: "利亚姆" },
    { ko: "세나", en: "Sena", ja: "セナ", zh: "塞娜" },
    { ko: "로완", en: "Rowan", ja: "ローワン", zh: "罗恩" },
  ],
  design: [
    { ko: "도로", en: "Doro", ja: "ドロ", zh: "多罗" },
    { ko: "루나", en: "Luna", ja: "ルナ", zh: "露娜" },
    { ko: "픽셀", en: "Pixel", ja: "ピクセル", zh: "像素" },
    { ko: "유나", en: "Yuna", ja: "ユナ", zh: "优娜" },
    { ko: "미로", en: "Miro", ja: "ミロ", zh: "米洛" },
    { ko: "아이리스", en: "Iris", ja: "アイリス", zh: "爱丽丝" },
  ],
  qa: [
    { ko: "스피키", en: "Speaky", ja: "スピーキー", zh: "斯皮奇" },
    { ko: "호크", en: "Hawk", ja: "ホーク", zh: "霍克" },
    { ko: "베라", en: "Vera", ja: "ヴェラ", zh: "薇拉" },
    { ko: "퀸", en: "Quinn", ja: "クイン", zh: "奎因" },
    { ko: "토리", en: "Tori", ja: "トリ", zh: "托莉" },
    { ko: "하윤", en: "Hayoon", ja: "ハユン", zh: "夏允" },
  ],
  operations: [
    { ko: "아틀라스", en: "Atlas", ja: "アトラス", zh: "阿特拉斯" },
    { ko: "나리", en: "Nari", ja: "ナリ", zh: "娜莉" },
    { ko: "오웬", en: "Owen", ja: "オーウェン", zh: "欧文" },
    { ko: "다미", en: "Dami", ja: "ダミ", zh: "达米" },
    { ko: "키라", en: "Kira", ja: "キラ", zh: "琪拉" },
    { ko: "솔", en: "Sol", ja: "ソル", zh: "索尔" },
  ],
  devsecops: [
    { ko: "볼트S", en: "VoltS", ja: "ボルトS", zh: "伏特S" },
    { ko: "시온", en: "Sion", ja: "シオン", zh: "锡安" },
    { ko: "녹스", en: "Knox", ja: "ノックス", zh: "诺克斯" },
    { ko: "레이븐", en: "Raven", ja: "レイヴン", zh: "渡鸦" },
    { ko: "미라", en: "Mira", ja: "ミラ", zh: "米拉" },
    { ko: "알렉스", en: "Alex", ja: "アレックス", zh: "亚历克斯" },
  ],
};

const PACK_SEED_PROFILE: Partial<Record<WorkflowPackKey, SeedProfile>> = {
  report: {
    nameOffset: 0,
    tone: {
      ko: "근거와 문서 완성도를 최우선으로 판단합니다.",
      en: "Prioritizes evidence quality and document completeness.",
      ja: "根拠の確かさと文書の完成度を最優先します。",
      zh: "以证据质量与文档完整度为最高优先级。",
    },
  },
  web_research_report: {
    nameOffset: 1,
    tone: {
      ko: "출처 신뢰도와 사실 검증을 중심으로 움직입니다.",
      en: "Focused on source credibility and fact verification.",
      ja: "情報源の信頼性と事実検証を中心に進めます。",
      zh: "聚焦来源可信度与事实核验。",
    },
  },
  novel: {
    nameOffset: 2,
    tone: {
      ko: "서사 몰입도와 캐릭터 일관성을 가장 중시합니다.",
      en: "Values narrative immersion and character consistency the most.",
      ja: "物語への没入感とキャラクターの一貫性を最重視します。",
      zh: "最重视叙事沉浸感与角色一致性。",
    },
  },
  video_preprod: {
    nameOffset: 3,
    tone: {
      ko: "콘티, 샷 구성, 제작 효율을 우선합니다.",
      en: "Prioritizes storyboard quality, shot composition, and production efficiency.",
      ja: "コンテ品質、ショット構成、制作効率を優先します。",
      zh: "优先保证分镜质量、镜头构成与制作效率。",
    },
  },
  roleplay: {
    nameOffset: 4,
    tone: {
      ko: "캐릭터 몰입감과 대화 리듬을 우선합니다.",
      en: "Prioritizes character immersion and dialogue rhythm.",
      ja: "キャラクター没入感と会話のテンポを優先します。",
      zh: "优先保障角色沉浸感与对话节奏。",
    },
  },
};

type StudioPackKey = Extract<
  WorkflowPackKey,
  "clipper_studio" | "content_studio" | "art_drawing_studio" | "game_dev_studio" | "app_dev_studio"
>;

function buildStudioRoomThemes(accent: number, wall: number): Record<string, RoomTheme> {
  return {
    ceoOffice: { floor1: 0x15243a, floor2: 0x101a2d, wall, accent },
    planning: { floor1: 0x1b3150, floor2: 0x162840, wall, accent },
    dev: { floor1: 0x152c43, floor2: 0x102238, wall, accent },
    design: { floor1: 0x2a2340, floor2: 0x211c34, wall, accent },
    qa: { floor1: 0x242e3b, floor2: 0x1c2530, wall, accent },
    devsecops: { floor1: 0x172b32, floor2: 0x112329, wall, accent },
    operations: { floor1: 0x1d3440, floor2: 0x162832, wall, accent },
    breakRoom: { floor1: 0x202a3e, floor2: 0x182133, wall, accent },
  };
}

function buildStudioDepartment(
  name: Localized,
  icon: string,
  agentPrefix: Localized,
  avatarPool: string[],
): DeptPreset {
  return { name, icon, agentPrefix, avatarPool };
}

function buildStudioPreset(params: {
  key: StudioPackKey;
  slug: string;
  label: Localized;
  summary: Localized;
  accent: number;
  wall: number;
  departments: Partial<Record<string, DeptPreset>>;
  staffCycle: string[];
}): PackPreset {
  return {
    key: params.key,
    slug: params.slug,
    label: params.label,
    summary: params.summary,
    roomThemes: buildStudioRoomThemes(params.accent, params.wall),
    departments: params.departments,
    staff: { nonLeaderDeptCycle: params.staffCycle },
  };
}

const STUDIO_PACK_PRESETS = {
  clipper_studio: buildStudioPreset({
    key: "clipper_studio",
    slug: "CLIP",
    label: { ko: "클리퍼 스튜디오", en: "Clipper Studio", ja: "クリッパースタジオ", zh: "剪辑工作室", id: "Studio Kliper" },
    summary: { ko: "긴 콘텐츠를 짧고 강한 클립으로 전환", en: "Turns long-form material into sharp short clips", ja: "長尺素材を強い短尺クリップへ変換", zh: "将长内容转化为高质量短片", id: "Mengubah materi panjang menjadi klip pendek yang kuat" },
    accent: 0x27d3c2,
    wall: 0x2e7180,
    departments: {
      planning: buildStudioDepartment({ ko: "클립전략실", en: "Clip Strategy", ja: "クリップ戦略", zh: "剪辑策略组", id: "Strategi Klip" }, "✂️", { ko: "클립 기획자", en: "Clip Strategist", ja: "クリップ企画", zh: "剪辑策划", id: "Strategi Klip" }, ["✂️", "🎯", "🧭"]),
      dev: buildStudioDepartment({ ko: "편집엔진팀", en: "Edit Engine", ja: "編集エンジン", zh: "剪辑引擎组", id: "Mesin Edit" }, "🎞️", { ko: "편집 엔지니어", en: "Edit Engineer", ja: "編集エンジニア", zh: "剪辑工程师", id: "Insinyur Edit" }, ["🎞️", "⚙️", "🖥️"]),
      design: buildStudioDepartment({ ko: "썸네일모션팀", en: "Thumbnail & Motion", ja: "サムネ・モーション", zh: "缩略图与动效组", id: "Thumbnail dan Motion" }, "🖼️", { ko: "모션 디자이너", en: "Motion Designer", ja: "モーションデザイナー", zh: "动效设计师", id: "Desainer Motion" }, ["🖼️", "✨", "🎨"]),
      qa: buildStudioDepartment({ ko: "권리검수팀", en: "Rights & QC", ja: "権利・検証", zh: "版权与质检组", id: "Hak dan QC" }, "🔎", { ko: "권리 검수관", en: "Rights Reviewer", ja: "権利レビュア", zh: "版权审查员", id: "Peninjau Hak" }, ["🔎", "✅", "🔐"]),
      operations: buildStudioDepartment({ ko: "배포운영팀", en: "Clip Publishing", ja: "配信運用", zh: "剪辑发布组", id: "Publikasi Klip" }, "📡", { ko: "배포 매니저", en: "Publishing Manager", ja: "配信マネージャー", zh: "发布经理", id: "Manajer Publikasi" }, ["📡", "📈", "🚀"]),
    },
    staffCycle: ["planning", "dev", "design", "qa", "operations", "dev", "design"],
  }),
  content_studio: buildStudioPreset({
    key: "content_studio",
    slug: "CONTENT",
    label: { ko: "콘텐츠 스튜디오", en: "Content Studio", ja: "コンテンツスタジオ", zh: "内容工作室", id: "Studio Konten" },
    summary: { ko: "전략부터 제작·배포·성과 측정까지 통합", en: "Unifies content strategy, production, distribution, and measurement", ja: "戦略から制作・配信・計測まで統合", zh: "整合内容策略、制作、分发与衡量", id: "Menggabungkan strategi, produksi, distribusi, dan pengukuran konten" },
    accent: 0xffb84d,
    wall: 0x82613c,
    departments: {
      planning: buildStudioDepartment({ ko: "콘텐츠전략실", en: "Content Strategy", ja: "コンテンツ戦略", zh: "内容策略组", id: "Strategi Konten" }, "🧭", { ko: "콘텐츠 전략가", en: "Content Strategist", ja: "コンテンツ戦略家", zh: "内容策略师", id: "Strategi Konten" }, ["🧭", "📅", "🎯"]),
      dev: buildStudioDepartment({ ko: "콘텐츠제작팀", en: "Content Production", ja: "コンテンツ制作", zh: "内容制作组", id: "Produksi Konten" }, "✍️", { ko: "콘텐츠 제작자", en: "Content Producer", ja: "コンテンツ制作者", zh: "内容制作人", id: "Produser Konten" }, ["✍️", "📝", "🎙️"]),
      design: buildStudioDepartment({ ko: "에디토리얼디자인팀", en: "Editorial Design", ja: "エディトリアルデザイン", zh: "编辑设计组", id: "Desain Editorial" }, "🖼️", { ko: "에디토리얼 디자이너", en: "Editorial Designer", ja: "編集デザイナー", zh: "编辑设计师", id: "Desainer Editorial" }, ["🖼️", "🎨", "📐"]),
      qa: buildStudioDepartment({ ko: "브랜드검수팀", en: "Brand QA", ja: "ブランド検証", zh: "品牌质检组", id: "QC Merek" }, "✅", { ko: "브랜드 검수관", en: "Brand Reviewer", ja: "ブランドレビュア", zh: "品牌审校员", id: "Peninjau Merek" }, ["✅", "🔎", "🛡️"]),
      operations: buildStudioDepartment({ ko: "배포분석팀", en: "Distribution & Analytics", ja: "配信・分析", zh: "分发与分析组", id: "Distribusi dan Analitik" }, "📊", { ko: "성장 분석가", en: "Growth Analyst", ja: "成長アナリスト", zh: "增长分析师", id: "Analis Pertumbuhan" }, ["📊", "📣", "🚀"]),
    },
    staffCycle: ["planning", "dev", "design", "operations", "qa", "dev", "operations"],
  }),
  art_drawing_studio: buildStudioPreset({
    key: "art_drawing_studio",
    slug: "ART",
    label: { ko: "아트 드로잉 스튜디오", en: "Art Drawing Studio", ja: "アートドローイングスタジオ", zh: "绘画艺术工作室", id: "Studio Gambar Seni" },
    summary: { ko: "아트 브리프·스케치·레이어·에셋 품질 관리", en: "Manages art briefs, sketches, layers, assets, and visual quality", ja: "アート概要・スケッチ・レイヤー・素材品質を管理", zh: "管理艺术简报、草图、图层、素材与视觉质量", id: "Mengelola brief, sketsa, layer, aset, dan kualitas visual" },
    accent: 0xe875ff,
    wall: 0x724b87,
    departments: {
      planning: buildStudioDepartment({ ko: "아트디렉션실", en: "Art Direction", ja: "アートディレクション", zh: "艺术指导组", id: "Direksi Seni" }, "🎯", { ko: "아트 디렉터", en: "Art Director", ja: "アートディレクター", zh: "艺术指导", id: "Direktur Seni" }, ["🎯", "🧭", "📋"]),
      dev: buildStudioDepartment({ ko: "일러스트팀", en: "Illustration", ja: "イラスト", zh: "插画组", id: "Ilustrasi" }, "✏️", { ko: "일러스트레이터", en: "Illustrator", ja: "イラストレーター", zh: "插画师", id: "Ilustrator" }, ["✏️", "🖌️", "🧑‍🎨"]),
      design: buildStudioDepartment({ ko: "비주얼디자인팀", en: "Visual Design", ja: "ビジュアルデザイン", zh: "视觉设计组", id: "Desain Visual" }, "🎨", { ko: "비주얼 디자이너", en: "Visual Designer", ja: "ビジュアルデザイナー", zh: "视觉设计师", id: "Desainer Visual" }, ["🎨", "🖼️", "🌈"]),
      qa: buildStudioDepartment({ ko: "에셋검수팀", en: "Asset QA", ja: "素材検証", zh: "素材质检组", id: "QC Aset" }, "🔍", { ko: "에셋 검수관", en: "Asset Reviewer", ja: "素材レビュア", zh: "素材审校员", id: "Peninjau Aset" }, ["🔍", "✅", "📐"]),
      operations: buildStudioDepartment({ ko: "아트생산팀", en: "Art Production", ja: "アート制作", zh: "艺术制作组", id: "Produksi Seni" }, "🗂️", { ko: "아트 프로듀서", en: "Art Producer", ja: "アートプロデューサー", zh: "艺术制片", id: "Produser Seni" }, ["🗂️", "📦", "🚀"]),
    },
    staffCycle: ["planning", "design", "dev", "design", "qa", "operations", "dev"],
  }),
  game_dev_studio: buildStudioPreset({
    key: "game_dev_studio",
    slug: "GAME",
    label: { ko: "게임 개발 스튜디오", en: "Game Developer Studio", ja: "ゲーム開発スタジオ", zh: "游戏开发工作室", id: "Studio Pengembang Game" },
    summary: { ko: "게임 루프·엔진·아트·플레이테스트·빌드 중심", en: "Coordinates game loops, engine work, art, playtests, and builds", ja: "ゲームループ・エンジン・アート・テスト・ビルドを連携", zh: "协同游戏循环、引擎、美术、试玩与构建", id: "Mengelola game loop, engine, seni, playtest, dan build" },
    accent: 0x45a6ff,
    wall: 0x3d6394,
    departments: {
      planning: buildStudioDepartment({ ko: "게임디자인실", en: "Game Design", ja: "ゲームデザイン", zh: "游戏设计组", id: "Desain Game" }, "🎮", { ko: "게임 디자이너", en: "Game Designer", ja: "ゲームデザイナー", zh: "游戏设计师", id: "Desainer Game" }, ["🎮", "🧭", "📜"]),
      dev: buildStudioDepartment({ ko: "게임플레이엔진팀", en: "Gameplay Engineering", ja: "ゲームプレイエンジン", zh: "玩法引擎组", id: "Engineering Gameplay" }, "🕹️", { ko: "게임플레이 엔지니어", en: "Gameplay Engineer", ja: "ゲームプレイエンジニア", zh: "玩法工程师", id: "Insinyur Gameplay" }, ["🕹️", "⚙️", "💻"]),
      design: buildStudioDepartment({ ko: "게임아트팀", en: "Game Art", ja: "ゲームアート", zh: "游戏美术组", id: "Seni Game" }, "🧩", { ko: "게임 아티스트", en: "Game Artist", ja: "ゲームアーティスト", zh: "游戏美术师", id: "Artis Game" }, ["🧩", "🎨", "🖌️"]),
      qa: buildStudioDepartment({ ko: "플레이테스트팀", en: "Playtest QA", ja: "プレイテスト", zh: "试玩质检组", id: "QC Playtest" }, "🧪", { ko: "플레이테스트 리드", en: "Playtest Lead", ja: "プレイテストリード", zh: "试玩负责人", id: "Lead Playtest" }, ["🧪", "🎯", "✅"]),
      devsecops: buildStudioDepartment({ ko: "빌드보안팀", en: "Build & Security", ja: "ビルド・セキュリティ", zh: "构建与安全组", id: "Build dan Keamanan" }, "🛡️", { ko: "빌드 엔지니어", en: "Build Engineer", ja: "ビルドエンジニア", zh: "构建工程师", id: "Insinyur Build" }, ["🛡️", "🔧", "🚀"]),
      operations: buildStudioDepartment({ ko: "릴리스운영팀", en: "Release Operations", ja: "リリース運用", zh: "发布运营组", id: "Operasi Rilis" }, "📦", { ko: "릴리스 매니저", en: "Release Manager", ja: "リリースマネージャー", zh: "发布经理", id: "Manajer Rilis" }, ["📦", "📈", "🚀"]),
    },
    staffCycle: ["planning", "dev", "design", "qa", "devsecops", "operations", "dev", "qa"],
  }),
  app_dev_studio: buildStudioPreset({
    key: "app_dev_studio",
    slug: "APPS",
    label: { ko: "앱 개발 스튜디오", en: "Developer Apps Studio", ja: "アプリ開発スタジオ", zh: "应用开发工作室", id: "Studio Pengembang Aplikasi" },
    summary: { ko: "제품 흐름·구현·보안·검증·출시를 통합", en: "Unifies product flows, implementation, security, testing, and release", ja: "製品フロー・実装・セキュリティ・検証・リリースを統合", zh: "整合产品流程、实现、安全、测试与发布", id: "Menggabungkan alur produk, implementasi, keamanan, pengujian, dan rilis" },
    accent: 0x6c8cff,
    wall: 0x4c5f9d,
    departments: {
      planning: buildStudioDepartment({ ko: "제품기획실", en: "Product Planning", ja: "プロダクト企画", zh: "产品规划组", id: "Perencanaan Produk" }, "📱", { ko: "프로덕트 매니저", en: "Product Manager", ja: "プロダクトマネージャー", zh: "产品经理", id: "Manajer Produk" }, ["📱", "🧭", "📋"]),
      dev: buildStudioDepartment({ ko: "앱엔지니어링팀", en: "App Engineering", ja: "アプリエンジニアリング", zh: "应用工程组", id: "Engineering Aplikasi" }, "💻", { ko: "앱 엔지니어", en: "App Engineer", ja: "アプリエンジニア", zh: "应用工程师", id: "Insinyur Aplikasi" }, ["💻", "⚙️", "🧱"]),
      design: buildStudioDepartment({ ko: "UX/UI팀", en: "UX/UI Design", ja: "UX/UIデザイン", zh: "UX/UI设计组", id: "Desain UX/UI" }, "🧑‍💻", { ko: "UX/UI 디자이너", en: "UX/UI Designer", ja: "UX/UIデザイナー", zh: "UX/UI设计师", id: "Desainer UX/UI" }, ["🧑‍💻", "🎨", "📐"]),
      qa: buildStudioDepartment({ ko: "품질엔지니어링팀", en: "Quality Engineering", ja: "品質エンジニアリング", zh: "质量工程组", id: "Engineering Kualitas" }, "🧪", { ko: "품질 엔지니어", en: "Quality Engineer", ja: "品質エンジニア", zh: "质量工程师", id: "Insinyur Kualitas" }, ["🧪", "✅", "🔎"]),
      devsecops: buildStudioDepartment({ ko: "앱보안인프라팀", en: "AppSec & Infrastructure", ja: "アプリセキュリティ・インフラ", zh: "应用安全与基础设施组", id: "Keamanan dan Infrastruktur" }, "🛡️", { ko: "앱 보안 엔지니어", en: "App Security Engineer", ja: "アプリセキュリティエンジニア", zh: "应用安全工程师", id: "Insinyur Keamanan Aplikasi" }, ["🛡️", "🔐", "☁️"]),
      operations: buildStudioDepartment({ ko: "릴리스운영팀", en: "Release Operations", ja: "リリース運用", zh: "发布运营组", id: "Operasi Rilis" }, "🚀", { ko: "출시 매니저", en: "Release Manager", ja: "リリースマネージャー", zh: "发布经理", id: "Manajer Rilis" }, ["🚀", "📈", "📦"]),
    },
    staffCycle: ["planning", "dev", "design", "qa", "devsecops", "operations", "dev", "qa"],
  }),
} satisfies Record<StudioPackKey, PackPreset>;

const PACK_PRESETS: Record<WorkflowPackKey, PackPreset> = {
  development: {
    key: "development",
    slug: "DEV",
    label: {
      ko: "개발 오피스",
      en: "Development Office",
      ja: "開発オフィス",
      zh: "开发办公室",
    },
    summary: {
      ko: "기본 개발 조직 구조",
      en: "Default engineering organization",
      ja: "標準の開発組織",
      zh: "默认开发组织",
    },
    roomThemes: DEV_THEMES,
    departments: {},
  },
  report: {
    key: "report",
    slug: "RPT",
    label: {
      ko: "보고서 오피스",
      en: "Report Office",
      ja: "レポートオフィス",
      zh: "报告办公室",
    },
    summary: {
      ko: "리서치/문서화 중심 팀 구성",
      en: "Research and documentation focused crew",
      ja: "調査・文書化中心の構成",
      zh: "以调研与文档为核心的团队",
    },
    roomThemes: {
      ceoOffice: { floor1: 0xf0e8dc, floor2: 0xebdfce, wall: 0x8f7a63, accent: 0xbd8b57 },
      planning: { floor1: 0xe6ecf6, floor2: 0xdde5f1, wall: 0x5f7394, accent: 0x7090bd },
      dev: { floor1: 0xe7f0ed, floor2: 0xddeae5, wall: 0x5c7d73, accent: 0x6ea495 },
      design: { floor1: 0xf4ecf4, floor2: 0xece2ed, wall: 0x82658a, accent: 0xa076ab },
      qa: { floor1: 0xf8efe9, floor2: 0xf0e3d8, wall: 0x8c6c5f, accent: 0xb67b63 },
      devsecops: { floor1: 0xe8edf0, floor2: 0xdee5ea, wall: 0x596778, accent: 0x6f85a0 },
      operations: { floor1: 0xe9f1e7, floor2: 0xe0ebdc, wall: 0x5f7d5b, accent: 0x76a06b },
      breakRoom: { floor1: 0xf5efe4, floor2: 0xede4d3, wall: 0x8f866d, accent: 0xc2a26b },
    },
    departments: {
      planning: {
        name: { ko: "편집기획실", en: "Editorial Planning", ja: "編集企画室", zh: "编辑企划室" },
        icon: "📚",
        agentPrefix: { ko: "편집 PM", en: "Editorial PM", ja: "編集PM", zh: "编辑PM" },
        avatarPool: ["📚", "🗂️", "🧭"],
      },
      dev: {
        name: { ko: "리서치엔진팀", en: "Research Engine", ja: "リサーチエンジン", zh: "调研引擎组" },
        icon: "🧠",
        agentPrefix: { ko: "리서처", en: "Researcher", ja: "リサーチャー", zh: "研究员" },
        avatarPool: ["🧠", "📊", "📝"],
      },
      design: {
        name: { ko: "문서디자인팀", en: "Doc Design", ja: "ドキュメントデザイン", zh: "文档设计组" },
        icon: "🧾",
        agentPrefix: { ko: "문서 디자이너", en: "Doc Designer", ja: "資料デザイナー", zh: "文档设计师" },
        avatarPool: ["🧾", "🎨", "📐"],
      },
      qa: {
        name: { ko: "검수팀", en: "Review Desk", ja: "レビュー班", zh: "审校组" },
        icon: "🔎",
        agentPrefix: { ko: "검수관", en: "Reviewer", ja: "レビュア", zh: "审校员" },
        avatarPool: ["🔎", "✅", "🧪"],
      },
    },
    staff: {
      nonLeaderDeptCycle: ["planning", "planning", "dev", "qa", "design", "planning", "dev", "qa", "operations"],
    },
  },
  web_research_report: {
    key: "web_research_report",
    slug: "WEB",
    label: {
      ko: "웹 리서치 오피스",
      en: "Web Research Office",
      ja: "Web調査オフィス",
      zh: "网页调研办公室",
    },
    summary: {
      ko: "소스 수집과 근거 검증 중심",
      en: "Source collection and citation verification",
      ja: "情報源収集と根拠検証中心",
      zh: "以来源收集与证据校验为核心",
    },
    roomThemes: {
      ceoOffice: { floor1: 0xddebf1, floor2: 0xd2e3eb, wall: 0x4e6f7f, accent: 0x3d90b5 },
      planning: { floor1: 0xe2eef6, floor2: 0xd8e7f1, wall: 0x55728d, accent: 0x5f95c6 },
      dev: { floor1: 0xe2f1ef, floor2: 0xd8ebe8, wall: 0x4d7a72, accent: 0x4fa69a },
      design: { floor1: 0xeceff7, floor2: 0xe2e8f2, wall: 0x606c88, accent: 0x748ec5 },
      qa: { floor1: 0xf0f3f7, floor2: 0xe6ecf2, wall: 0x5d6f80, accent: 0x7a93b0 },
      devsecops: { floor1: 0xe4edf5, floor2: 0xd9e4ef, wall: 0x4e617a, accent: 0x5f7fa5 },
      operations: { floor1: 0xe5f3ec, floor2: 0xdbeadf, wall: 0x52755d, accent: 0x5fa777 },
      breakRoom: { floor1: 0xe8f0f4, floor2: 0xdce8ef, wall: 0x5f7380, accent: 0x7ca0b9 },
    },
    departments: {
      planning: {
        name: { ko: "조사전략실", en: "Research Strategy", ja: "調査戦略室", zh: "调研战略室" },
        icon: "🧭",
        agentPrefix: { ko: "전략 분석가", en: "Strategy Analyst", ja: "戦略アナリスト", zh: "策略分析师" },
        avatarPool: ["🧭", "🗺️", "📌"],
      },
      dev: {
        name: { ko: "크롤링팀", en: "Crawler Team", ja: "クロール班", zh: "爬取组" },
        icon: "🕸️",
        agentPrefix: { ko: "수집 엔지니어", en: "Collection Engineer", ja: "収集エンジニア", zh: "采集工程师" },
        avatarPool: ["🕸️", "🔗", "🧠"],
      },
      qa: {
        name: { ko: "팩트체크팀", en: "Fact Check", ja: "ファクトチェック", zh: "事实核验组" },
        icon: "✅",
        agentPrefix: { ko: "검증관", en: "Verifier", ja: "検証官", zh: "核验员" },
        avatarPool: ["✅", "🔍", "📎"],
      },
    },
    staff: {
      nonLeaderDeptCycle: ["planning", "dev", "qa", "dev", "planning", "qa", "operations", "devsecops"],
    },
  },
  novel: {
    key: "novel",
    slug: "NOV",
    label: {
      ko: "소설 스튜디오",
      en: "Novel Studio",
      ja: "小説スタジオ",
      zh: "小说工作室",
    },
    summary: {
      ko: "세계관/캐릭터/서사 중심 구성",
      en: "Worldbuilding, character and narrative setup",
      ja: "世界観・キャラ・物語中心",
      zh: "世界观/角色/叙事导向",
    },
    roomThemes: {
      ceoOffice: { floor1: 0xefe3d8, floor2: 0xe7d6c9, wall: 0x7c5d4b, accent: 0xb86b45 },
      planning: { floor1: 0xf2e7dc, floor2: 0xebddcf, wall: 0x7f624e, accent: 0xb97c4f },
      dev: { floor1: 0xe8e0f2, floor2: 0xdfd6eb, wall: 0x6e5a90, accent: 0x8d76bb },
      design: { floor1: 0xf6e3ea, floor2: 0xf0d8e1, wall: 0x885a6d, accent: 0xbc708f },
      qa: { floor1: 0xf3ece4, floor2: 0xece1d7, wall: 0x7f6b5a, accent: 0xa88468 },
      devsecops: { floor1: 0xe8e6ef, floor2: 0xddd9e8, wall: 0x5f5f7f, accent: 0x7b7ca8 },
      operations: { floor1: 0xe6efe8, floor2: 0xdce8e0, wall: 0x58735f, accent: 0x6b9a79 },
      breakRoom: { floor1: 0xf0e3cf, floor2: 0xe8d6bd, wall: 0x8a6f55, accent: 0xbc8b58 },
    },
    departments: {
      planning: {
        name: { ko: "세계관실", en: "Worldbuilding", ja: "世界観室", zh: "世界观组" },
        icon: "🌌",
        agentPrefix: { ko: "세계관 작가", en: "Lore Writer", ja: "設定作家", zh: "设定作者" },
        avatarPool: ["🌌", "📜", "🧭"],
      },
      dev: {
        name: { ko: "서사엔진팀", en: "Narrative Engine", ja: "物語エンジン", zh: "叙事引擎组" },
        icon: "✍️",
        agentPrefix: { ko: "서사 설계자", en: "Narrative Architect", ja: "物語設計者", zh: "叙事架构师" },
        avatarPool: ["✍️", "🖋️", "📘"],
      },
      design: {
        name: { ko: "캐릭터 아트팀", en: "Character Art", ja: "キャラアート", zh: "角色美术组" },
        icon: "🎭",
        agentPrefix: { ko: "캐릭터 디자이너", en: "Character Designer", ja: "キャラデザ", zh: "角色设计师" },
        avatarPool: ["🎭", "🧵", "🎨"],
      },
      qa: {
        name: { ko: "톤 검수팀", en: "Tone QA", ja: "トーン検証", zh: "语气审校组" },
        icon: "🪶",
        agentPrefix: { ko: "문체 검수관", en: "Style Reviewer", ja: "文体レビュア", zh: "文风审校员" },
        avatarPool: ["🪶", "📖", "✅"],
      },
    },
    staff: {
      nonLeaderDeptCycle: ["planning", "design", "dev", "design", "planning", "qa", "design", "operations"],
    },
  },
  video_preprod: {
    key: "video_preprod",
    slug: "VID",
    label: {
      ko: "영상 프리프로덕션",
      en: "Video Pre-production",
      ja: "映像プリプロ",
      zh: "视频前期策划",
    },
    summary: {
      ko: "콘티/샷리스트/편집 노트 중심",
      en: "Storyboard and shot-list focused setup",
      ja: "コンテ・ショットリスト中心",
      zh: "分镜与镜头清单导向",
    },
    roomThemes: {
      ceoOffice: { floor1: 0x1f1f25, floor2: 0x17171c, wall: 0x343748, accent: 0xd18d35 },
      planning: { floor1: 0x25212b, floor2: 0x1c1923, wall: 0x44405b, accent: 0xbc7d47 },
      dev: { floor1: 0x1d2631, floor2: 0x17202a, wall: 0x334961, accent: 0x4c8fca },
      design: { floor1: 0x2a2230, floor2: 0x211a27, wall: 0x544063, accent: 0xc274b7 },
      qa: { floor1: 0x2a2425, floor2: 0x211d1f, wall: 0x5a494b, accent: 0xb98862 },
      devsecops: { floor1: 0x1f242c, floor2: 0x182028, wall: 0x3b4d62, accent: 0x6f8fb0 },
      operations: { floor1: 0x1f2a25, floor2: 0x18211d, wall: 0x3e5d50, accent: 0x62a789 },
      breakRoom: { floor1: 0x2a2622, floor2: 0x211d1a, wall: 0x564c43, accent: 0xbd8a49 },
    },
    departments: {
      planning: {
        name: { ko: "프리프로덕션팀", en: "Pre-production", ja: "プリプロ班", zh: "前期策划组" },
        icon: "🎬",
        agentPrefix: { ko: "프로듀서", en: "Producer", ja: "プロデューサ", zh: "制片" },
        avatarPool: ["🎬", "📽️", "🧭"],
      },
      dev: {
        name: { ko: "씬 엔진팀", en: "Scene Engine", ja: "シーン設計", zh: "场景引擎组" },
        icon: "🎞️",
        agentPrefix: { ko: "씬 디렉터", en: "Scene Director", ja: "シーン監督", zh: "场景导演" },
        avatarPool: ["🎞️", "🧱", "🔧"],
      },
      design: {
        name: { ko: "아트/촬영팀", en: "Art & Camera", ja: "アート撮影", zh: "美术摄影组" },
        icon: "📷",
        agentPrefix: { ko: "촬영 디자이너", en: "Camera Designer", ja: "撮影デザイナ", zh: "摄影设计师" },
        avatarPool: ["📷", "🎨", "💡"],
      },
      qa: {
        name: { ko: "컷 검수팀", en: "Cut QA", ja: "カット検証", zh: "镜头审校组" },
        icon: "🧪",
        agentPrefix: { ko: "컷 검수관", en: "Cut Reviewer", ja: "カットレビュア", zh: "镜头审校员" },
        avatarPool: ["🧪", "✅", "📌"],
      },
    },
    staff: {
      nonLeaderDeptCycle: ["planning", "design", "operations", "dev", "design", "planning", "qa", "operations"],
    },
  },
  roleplay: {
    key: "roleplay",
    slug: "RPG",
    label: {
      ko: "롤플레이 스튜디오",
      en: "Roleplay Studio",
      ja: "ロールプレイスタジオ",
      zh: "角色扮演工作室",
    },
    summary: {
      ko: "캐릭터 연기와 대사 몰입 중심",
      en: "Character role and dialogue immersion",
      ja: "キャラ演技と会話没入",
      zh: "角色演绎与对话沉浸",
    },
    roomThemes: {
      ceoOffice: { floor1: 0xf3e7dc, floor2: 0xebdbc9, wall: 0x7d5c4d, accent: 0xbe6f53 },
      planning: { floor1: 0xefe6f6, floor2: 0xe5dbef, wall: 0x6a5d91, accent: 0x8a74c0 },
      dev: { floor1: 0xe6edf8, floor2: 0xdce6f4, wall: 0x576d91, accent: 0x6f8fd1 },
      design: { floor1: 0xf6e3f2, floor2: 0xefd8e9, wall: 0x835b80, accent: 0xc36eb4 },
      qa: { floor1: 0xf5efe6, floor2: 0xeee3d8, wall: 0x7f6d5c, accent: 0xb7956d },
      devsecops: { floor1: 0xe8ecf5, floor2: 0xdde4ef, wall: 0x566479, accent: 0x6d86ab },
      operations: { floor1: 0xe9f2ea, floor2: 0xdfeadf, wall: 0x5b7660, accent: 0x6fae7e },
      breakRoom: { floor1: 0xf4e8d5, floor2: 0xecdcc3, wall: 0x8a7458, accent: 0xc59a5e },
    },
    departments: {
      planning: {
        name: { ko: "캐릭터기획실", en: "Character Planning", ja: "キャラ企画室", zh: "角色企划室" },
        icon: "🎭",
        agentPrefix: { ko: "캐릭터 플래너", en: "Character Planner", ja: "キャラ企画", zh: "角色策划" },
        avatarPool: ["🎭", "🧠", "📜"],
      },
      dev: {
        name: { ko: "대사엔진팀", en: "Dialogue Engine", ja: "会話エンジン", zh: "对话引擎组" },
        icon: "🗣️",
        agentPrefix: { ko: "대사 연출가", en: "Dialogue Director", ja: "台詞演出", zh: "台词导演" },
        avatarPool: ["🗣️", "💬", "🎙️"],
      },
      design: {
        name: { ko: "연출아트팀", en: "Stage Art", ja: "演出アート", zh: "演出美术组" },
        icon: "🎨",
        agentPrefix: { ko: "연출 디자이너", en: "Stage Designer", ja: "演出デザイナ", zh: "演出设计师" },
        avatarPool: ["🎨", "✨", "🎬"],
      },
      qa: {
        name: { ko: "캐릭터검수팀", en: "Character QA", ja: "キャラ検証", zh: "角色审校组" },
        icon: "🔐",
        agentPrefix: { ko: "설정 검수관", en: "Lore Reviewer", ja: "設定レビュア", zh: "设定审校员" },
        avatarPool: ["🔐", "✅", "🧪"],
      },
    },
    staff: {
      nonLeaderDeptCycle: ["planning", "design", "dev", "design", "qa", "planning", "operations", "design"],
    },
  },
  ...STUDIO_PACK_PRESETS,
};

export function normalizeOfficeWorkflowPack(value: unknown): WorkflowPackKey {
  if (typeof value !== "string") return "development";
  return value in PACK_PRESETS ? (value as WorkflowPackKey) : "development";
}

function pickText(locale: UiLanguageLike, text: Localized): string {
  switch (locale) {
    case "ko":
      return text.ko;
    case "ja":
      return text.ja || text.en;
    case "zh":
      return text.zh || text.en;
    case "id":
      return text.id || text.en;
    case "en":
    default:
      return text.en;
  }
}

function localizedNumberedName(
  locale: UiLanguageLike,
  prefix: Localized,
  order: number,
): { name: string; name_ko: string; name_ja: string; name_zh: string } {
  return {
    name: `${prefix.en} ${order}`,
    name_ko: `${prefix.ko} ${order}`,
    name_ja: `${prefix.ja} ${order}`,
    name_zh: `${prefix.zh} ${order}`,
  };
}

function localizedStaffDisplayName(params: {
  packKey: WorkflowPackKey;
  deptId: string;
  order: number;
  fallbackPrefix: Localized;
}): { name: string; name_ko: string; name_ja: string; name_zh: string } {
  const { packKey, deptId, order, fallbackPrefix } = params;
  const pool = DEPARTMENT_PERSON_NAME_POOL[deptId];
  if (!pool || pool.length === 0) {
    return localizedNumberedName("en", fallbackPrefix, order);
  }
  const seedOffset = PACK_SEED_PROFILE[packKey]?.nameOffset ?? 0;
  const base = pool[(order - 1 + seedOffset) % pool.length] ?? pool[0];
  const cycle = Math.floor((order - 1) / pool.length) + 1;
  const suffix = cycle > 1 ? ` ${cycle}` : "";
  return {
    name: `${base.en}${suffix}`,
    name_ko: `${base.ko}${suffix}`,
    name_ja: `${base.ja}${suffix}`,
    name_zh: `${base.zh}${suffix}`,
  };
}

function resolveSeedSpriteNumber(
  params: {
    packKey: WorkflowPackKey;
    deptId: string;
    role: AgentRole;
    order: number;
  },
  usedSpriteNumbers: Set<number>,
): number {
  const seed = `${params.packKey}:${params.deptId}:${params.role}:${params.order}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const poolSize = OFFICE_SEED_SPRITE_POOL.length;
  const start = hash % poolSize;
  for (let offset = 0; offset < poolSize; offset += 1) {
    const candidate = OFFICE_SEED_SPRITE_POOL[(start + offset) % poolSize];
    if (candidate != null && !usedSpriteNumbers.has(candidate)) {
      return candidate;
    }
  }
  return OFFICE_SEED_SPRITE_POOL[start] ?? 1;
}

function buildSeedPersonality(params: {
  packKey: WorkflowPackKey;
  deptId: string;
  role: AgentRole;
  locale: UiLanguageLike;
  defaultPrefix: Localized;
  departmentName: { ko: string; en: string; ja: string; zh: string };
}): string | null {
  if (params.packKey === "development") return null;
  const tone = PACK_SEED_PROFILE[params.packKey]?.tone;
  if (!tone) return null;
  const locale = params.locale;
  const roleLabelMap: Record<UiLanguageLike, Record<AgentRole, string>> = {
    ko: {
      team_leader: "팀 리드",
      senior: "시니어",
      junior: "주니어",
      intern: "인턴",
    },
    en: {
      team_leader: "team lead",
      senior: "senior member",
      junior: "junior member",
      intern: "intern",
    },
    ja: {
      team_leader: "チームリーダー",
      senior: "シニア",
      junior: "ジュニア",
      intern: "インターン",
    },
    zh: {
      team_leader: "团队负责人",
      senior: "高级成员",
      junior: "初级成员",
      intern: "实习成员",
    },
    id: {
      team_leader: "ketua tim",
      senior: "anggota senior",
      junior: "anggota junior",
      intern: "magang",
    },
  };
  const focusByLocale: Record<UiLanguageLike, string> = {
    ko: params.defaultPrefix.ko?.trim() || `${params.departmentName.ko} 담당`,
    en: params.defaultPrefix.en?.trim() || `${params.departmentName.en} coverage`,
    ja: params.defaultPrefix.ja?.trim() || `${params.departmentName.ja}担当`,
    zh: params.defaultPrefix.zh?.trim() || `${params.departmentName.zh}职责`,
    id: params.defaultPrefix.id?.trim() || `${params.departmentName.en} coverage`,
  };
  const roleLabel = roleLabelMap[locale][params.role];
  const focus = focusByLocale[locale];
  const toneText = pickText(locale, tone);
  if (locale === "ko") return `${toneText} ${focus} 역할의 ${roleLabel}입니다.`;
  if (locale === "id") return `${toneText} Berperan sebagai ${roleLabel} yang berfokus pada ${focus}.`;
  if (locale === "ja") return `${toneText} ${focus}を担当する${roleLabel}として動きます。`;
  if (locale === "zh") return `${toneText} 作为负责${focus}的${roleLabel}推进工作。`;
  return `${toneText} Serves as a ${roleLabel} focused on ${focus}.`;
}

function buildPackDepartmentDescription(params: {
  locale: UiLanguageLike;
  packSummary: Localized;
  departmentName: Localized;
}): string {
  const { locale, packSummary, departmentName } = params;
  const summary = pickText(locale, packSummary);
  const deptName = pickText(locale, departmentName);
  if (locale === "ko") return `${deptName}입니다. ${summary} 목표를 중심으로 협업합니다.`;
  if (locale === "id") return `Tim ${deptName}. Berkolaborasi untuk mencapai sasaran ${summary.toLowerCase()}.`;
  if (locale === "ja") return `${deptName}です。${summary}の目標達成に向けて連携します。`;
  if (locale === "zh") return `${deptName}团队。围绕${summary}目标协作推进。`;
  return `${deptName} team. Collaborates to deliver the ${summary.toLowerCase()} goal.`;
}

function buildPackDepartmentPrompt(params: {
  locale: UiLanguageLike;
  packSummary: Localized;
  departmentName: Localized;
}): string {
  const { locale, packSummary, departmentName } = params;
  const summary = pickText(locale, packSummary);
  const deptName = pickText(locale, departmentName);
  if (locale === "ko") {
    return `[부서 역할] ${deptName}\n[업무 기준] ${summary}\n요청을 실행 가능한 단계로 나누고, 근거와 산출물을 명확히 제시하세요.`;
  }
  if (locale === "id") {
    return `[Peran Departemen] ${deptName}\n[Standar Pelaksanaan] ${summary}\nBagi permintaan menjadi langkah yang dapat dijalankan dan jelaskan dasar serta hasilnya dengan jelas.`;
  }
  if (locale === "ja") {
    return `[部署の役割] ${deptName}\n[業務基準] ${summary}\n依頼を実行可能なステップに分解し、根拠と成果物を明確に提示してください。`;
  }
  if (locale === "zh") {
    return `[部门职责] ${deptName}\n[执行基准] ${summary}\n请将请求拆分为可执行步骤，并清晰提供依据与产出物。`;
  }
  return `[Department Role] ${deptName}\n[Execution Standard] ${summary}\nBreak requests into actionable steps and clearly provide rationale and deliverables.`;
}

export function getOfficePackMeta(packKey: WorkflowPackKey): { label: Localized; summary: Localized } {
  const preset = PACK_PRESETS[packKey] ?? PACK_PRESETS.development;
  return { label: preset.label, summary: preset.summary };
}

export function getOfficePackRoomThemes(packKey: WorkflowPackKey): Record<string, RoomTheme> {
  const preset = PACK_PRESETS[packKey] ?? PACK_PRESETS.development;
  return preset.roomThemes;
}

export function listOfficePackOptions(locale: UiLanguageLike): Array<{
  key: WorkflowPackKey;
  label: string;
  summary: string;
  slug: string;
  accent: number;
}> {
  return (Object.keys(PACK_PRESETS) as WorkflowPackKey[]).map((key) => ({
    key,
    label: pickText(locale, PACK_PRESETS[key].label),
    summary: pickText(locale, PACK_PRESETS[key].summary),
    slug: PACK_PRESETS[key].slug,
    accent: PACK_PRESETS[key].roomThemes.ceoOffice?.accent ?? 0x5a9fd4,
  }));
}

export function buildOfficePackPresentation(params: {
  packKey: WorkflowPackKey;
  locale: UiLanguageLike;
  departments: Department[];
  agents: Agent[];
  customRoomThemes: Record<string, RoomTheme>;
}): OfficePackPresentation {
  const { packKey, locale, departments, agents, customRoomThemes } = params;
  if (packKey === "development") {
    return {
      departments,
      agents,
      roomThemes: customRoomThemes,
    };
  }

  const preset = PACK_PRESETS[packKey] ?? PACK_PRESETS.development;
  const transformedDepartments = departments.map((dept) => {
    const deptPreset = preset.departments[dept.id];
    if (!deptPreset) return dept;
    const localizedName: Localized = {
      ko: deptPreset.name.ko || dept.name_ko || dept.name,
      en: deptPreset.name.en || dept.name,
      ja: deptPreset.name.ja || dept.name_ja || dept.name,
      zh: deptPreset.name.zh || dept.name_zh || dept.name,
    };
    return {
      ...dept,
      icon: deptPreset.icon,
      name: deptPreset.name.en,
      name_ko: deptPreset.name.ko,
      name_ja: deptPreset.name.ja,
      name_zh: deptPreset.name.zh,
      description: buildPackDepartmentDescription({
        locale,
        packSummary: preset.summary,
        departmentName: localizedName,
      }),
      prompt: buildPackDepartmentPrompt({
        locale,
        packSummary: preset.summary,
        departmentName: localizedName,
      }),
    };
  });

  return {
    departments: transformedDepartments,
    agents,
    roomThemes: {
      ...customRoomThemes,
      ...preset.roomThemes,
    },
  };
}

export function resolveOfficePackSeedProvider(params: {
  packKey: WorkflowPackKey;
  departmentId?: string | null;
  role: AgentRole;
  seedIndex: number;
  seedOrderInDepartment?: number;
}): OfficePackSeedProvider {
  if (params.packKey === "development") return "claude";
  const dept = String(params.departmentId ?? "")
    .trim()
    .toLowerCase();
  if (dept === "planning") {
    const order = params.seedOrderInDepartment ?? params.seedIndex;
    return order % 2 === 0 ? "codex" : "claude";
  }
  if (dept === "dev" || dept === "design") return "claude";
  if (dept === "devsecops" || dept === "operations" || dept === "qa") return "codex";
  return params.seedIndex % 2 === 0 ? "codex" : "claude";
}

export function buildOfficePackStarterAgents(params: {
  packKey: WorkflowPackKey;
  departments: Department[];
  targetCount?: number;
  locale?: UiLanguageLike;
}): OfficePackStarterAgentDraft[] {
  const { packKey, departments } = params;
  const locale = params.locale ?? "en";
  if (packKey === "development") return [];
  const preset = PACK_PRESETS[packKey] ?? PACK_PRESETS.development;
  const departmentById = new Map(departments.map((department) => [department.id, department]));
  const baseDeptOrder = ["planning", "dev", "design", "qa", "operations", "devsecops"].filter((deptId) =>
    departmentById.has(deptId),
  );
  if (baseDeptOrder.length === 0) return [];

  const nonLeaderCycle = (preset.staff?.nonLeaderDeptCycle ?? []).filter((deptId) => departmentById.has(deptId)) || [];
  const planningLeadDeptIds =
    (preset.staff?.planningLeadDeptIds ?? ["planning"]).filter((deptId) => departmentById.has(deptId)) || [];
  const workerCycle = nonLeaderCycle.length > 0 ? nonLeaderCycle : baseDeptOrder;
  const rolePool: AgentRole[] = ["senior", "junior", "intern"];
  const desiredCount = Math.max(baseDeptOrder.length + 2, params.targetCount ?? Math.min(10, baseDeptOrder.length * 2));

  const perDeptCounter = new Map<string, number>();
  const usedSpriteNumbers = new Set<number>();
  const result: OfficePackStarterAgentDraft[] = [];

  const resolveDeptPrefix = (deptId: string): Localized => {
    const presetInfo = preset.departments[deptId];
    if (presetInfo) return presetInfo.agentPrefix;
    const department = departmentById.get(deptId);
    const baseName = department?.name ?? deptId;
    const baseNameKo = department?.name_ko ?? baseName;
    const baseNameJa = department?.name_ja ?? baseName;
    const baseNameZh = department?.name_zh ?? baseName;
    return {
      ko: `${baseNameKo} 팀원`,
      en: `${baseName} Member`,
      ja: `${baseNameJa} メンバー`,
      zh: `${baseNameZh} 成员`,
    };
  };

  const resolveAvatar = (deptId: string, order: number): string => {
    const presetInfo = preset.departments[deptId];
    if (presetInfo && presetInfo.avatarPool.length > 0) {
      return presetInfo.avatarPool[(order - 1) % presetInfo.avatarPool.length] ?? presetInfo.icon;
    }
    return departmentById.get(deptId)?.icon ?? "🤖";
  };

  const pushAgent = (deptId: string, role: AgentRole) => {
    const nextOrder = (perDeptCounter.get(deptId) ?? 0) + 1;
    perDeptCounter.set(deptId, nextOrder);
    const prefix = resolveDeptPrefix(deptId);
    const department = departmentById.get(deptId);
    const localizedNames = localizedStaffDisplayName({
      packKey,
      deptId,
      order: nextOrder,
      fallbackPrefix: prefix,
    });
    const spriteNumber = resolveSeedSpriteNumber(
      {
        packKey,
        deptId,
        role,
        order: nextOrder,
      },
      usedSpriteNumbers,
    );
    usedSpriteNumbers.add(spriteNumber);
    result.push({
      ...localizedNames,
      department_id: deptId,
      seed_order_in_department: nextOrder,
      role,
      acts_as_planning_leader: role === "team_leader" && planningLeadDeptIds.includes(deptId) ? 1 : 0,
      avatar_emoji: resolveAvatar(deptId, nextOrder),
      sprite_number: spriteNumber,
      personality: buildSeedPersonality({
        packKey,
        deptId,
        role,
        locale,
        defaultPrefix: prefix,
        departmentName: {
          ko: department?.name_ko || department?.name || deptId,
          en: department?.name || department?.name_ko || deptId,
          ja: department?.name_ja || department?.name || deptId,
          zh: department?.name_zh || department?.name || deptId,
        },
      }),
    });
  };

  for (const deptId of baseDeptOrder) {
    pushAgent(deptId, "team_leader");
  }

  let cursor = 0;
  while (result.length < desiredCount) {
    const deptId = workerCycle[cursor % workerCycle.length];
    const role = rolePool[cursor % rolePool.length] ?? "junior";
    if (!deptId) break;
    pushAgent(deptId, role);
    cursor += 1;
  }

  return result;
}
