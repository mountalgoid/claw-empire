import { DEFAULT_WORKFLOW_PACK_KEY, isWorkflowPackKey, type WorkflowPackKey } from "./definitions.ts";

type SupportedLang = "ko" | "en" | "ja" | "zh" | "id";

function normalizeLang(raw: string | null | undefined): SupportedLang {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (value.startsWith("ko")) return "ko";
  if (value.startsWith("ja")) return "ja";
  if (value.startsWith("zh")) return "zh";
  if (value.startsWith("id")) return "id";
  return "en";
}

function normalizePackKey(raw: string | null | undefined): WorkflowPackKey {
  if (isWorkflowPackKey(raw)) return raw;
  return DEFAULT_WORKFLOW_PACK_KEY;
}

const QUALITY_CHECKS: Record<WorkflowPackKey, { en: string[]; id: string[] }> = {
  development: {
    en: [
      "Inspect the existing architecture and preserve established conventions and compatibility.",
      "Turn acceptance criteria into positive, negative, and edge-case checks; run focused tests plus the available build/type/lint checks.",
      "Review the final diff for unrelated files, unsafe data handling, accidental secrets, and untracked deliverables; report exact commands and results.",
    ],
    id: [
      "Periksa arsitektur yang sudah ada dan jaga konvensi serta kompatibilitasnya.",
      "Ubah kriteria penerimaan menjadi pemeriksaan alur normal, gagal, dan kasus tepi; jalankan tes terfokus serta build/type-check/lint yang tersedia.",
      "Tinjau diff akhir untuk file tak terkait, pengelolaan data berbahaya, rahasia yang tidak sengaja ikut, dan artefak belum terlacak; laporkan perintah serta hasil yang tepat.",
    ],
  },
  novel: {
    en: [
      "Build a concise story outline from the brief; preserve requested genre, point of view, tone, and audience.",
      "Check character motivation/voice, names, world rules, chronology, and continuity across every scene.",
      "Edit for clarity, pacing, originality, and avoidable repetition; label unresolved creative choices rather than inventing user preferences.",
    ],
    id: [
      "Susun kerangka cerita ringkas dari brief; pertahankan genre, sudut pandang, nada, dan audiens yang diminta.",
      "Periksa motivasi/suara karakter, nama, aturan dunia, kronologi, dan kesinambungan antarscene.",
      "Sunting kejelasan, tempo, orisinalitas, serta repetisi; tandai pilihan kreatif yang belum dipastikan alih-alih mengarang preferensi pengguna.",
    ],
  },
  report: {
    en: [
      "State audience, decision/use case, scope, and date range; separate executive summary, findings, and actionable recommendations.",
      "Support material claims with traceable evidence, calculations, and source dates; label assumptions and uncertainty.",
      "Check units, totals, terminology, and internal consistency; make tables/charts readable and provide an editable source when requested.",
    ],
    id: [
      "Nyatakan audiens, keputusan/tujuan, cakupan, dan rentang waktu; pisahkan ringkasan eksekutif, temuan, serta rekomendasi yang dapat dijalankan.",
      "Dukung klaim penting dengan bukti yang dapat ditelusuri, perhitungan, dan tanggal sumber; tandai asumsi serta ketidakpastian.",
      "Periksa satuan, total, istilah, dan konsistensi; pastikan tabel/grafik terbaca dan sertakan sumber yang dapat diedit bila diminta.",
    ],
  },
  video_preprod: {
    en: [
      "Match aspect ratio, resolution, duration, frame rate, codec, captions, and audio to the requested platform and brief; do not force landscape on vertical work.",
      "Verify script, shot sequence, readable safe areas, sound/rights, and pacing against the actual duration.",
      "When a rendered asset is requested, verify the file exists, inspect metadata and representative frames/playback, and report any runtime or audio limitation.",
    ],
    id: [
      "Sesuaikan rasio, resolusi, durasi, frame rate, codec, caption, dan audio dengan platform serta brief; jangan memaksakan format lanskap untuk konten vertikal.",
      "Periksa naskah, urutan shot, area aman yang terbaca, hak suara/musik, dan tempo terhadap durasi nyata.",
      "Jika diminta video hasil render, pastikan file ada, periksa metadata dan frame/playback perwakilan, serta laporkan batas runtime atau audio.",
    ],
  },
  web_research_report: {
    en: [
      "Translate the brief into research questions and an explicit time window; prioritize primary/authoritative sources and record publication/access dates.",
      "Cite each material factual claim inline, compare independent sources for high-impact claims, and disclose contradictions or missing evidence.",
      "Separate sourced fact, calculation, interpretation, and recommendation; never imply a search or source check that was not performed.",
    ],
    id: [
      "Ubah brief menjadi pertanyaan riset dan rentang waktu yang jelas; utamakan sumber primer/otoritatif serta catat tanggal publikasi/akses.",
      "Cantumkan sitasi pada setiap klaim faktual penting, bandingkan sumber independen untuk klaim berdampak tinggi, dan ungkapkan pertentangan atau bukti yang kurang.",
      "Pisahkan fakta bersumber, perhitungan, interpretasi, dan rekomendasi; jangan mengaku telah mencari atau memeriksa sumber yang belum dilakukan.",
    ],
  },
  roleplay: {
    en: [
      "Maintain the defined character voice, setting, relationship, and continuity without overriding the user's boundaries.",
      "Keep fictional claims clearly in-world; distinguish real-world facts from roleplay when asked and avoid unsafe instructions.",
      "Adapt to the user's cues, avoid repetitive filler, and end at a natural hand-off rather than taking control of the user's character.",
    ],
    id: [
      "Pertahankan suara karakter, latar, relasi, dan kesinambungan tanpa melanggar batas yang ditetapkan pengguna.",
      "Jaga klaim fiksi tetap berada dalam dunia cerita; bedakan fakta dunia nyata saat diminta dan hindari instruksi berbahaya.",
      "Ikuti isyarat pengguna, hindari pengisi berulang, dan akhiri pada titik respons yang wajar tanpa mengambil alih karakter pengguna.",
    ],
  },
  clipper_studio: {
    en: [
      "Record source URL/owner and verify reuse permission; never remove attribution, watermarks, or rights notices.",
      "Select clips that preserve context and requested hook; verify start/end cuts, portrait crop, caption timing, safe margins, and audio levels.",
      "Export to the requested platform specs, inspect the final clip and captions, and provide source attribution plus any rights limitation.",
    ],
    id: [
      "Catat URL/pemilik sumber dan periksa izin penggunaan ulang; jangan menghapus atribusi, watermark, atau pemberitahuan hak.",
      "Pilih potongan yang menjaga konteks dan hook yang diminta; periksa titik potong, crop vertikal, waktu caption, margin aman, dan level audio.",
      "Ekspor sesuai spesifikasi platform, tinjau klip serta caption final, dan sertakan atribusi sumber beserta batas hak penggunaan.",
    ],
  },
  content_studio: {
    en: [
      "Define audience, channel, objective, brand voice, and CTA; map each deliverable to a platform-ready format and specification.",
      "Check factual claims, spelling, accessibility/contrast, brand consistency, rights, and safety across the complete content set.",
      "Verify requested copy and image/video files actually exist, open, and match dimensions/duration; report missing assets rather than substituting text silently.",
    ],
    id: [
      "Tetapkan audiens, kanal, tujuan, suara merek, dan CTA; cocokkan setiap hasil dengan format serta spesifikasi platform.",
      "Periksa klaim faktual, ejaan, aksesibilitas/kontras, konsistensi merek, hak penggunaan, dan keamanan seluruh paket konten.",
      "Pastikan file teks serta gambar/video yang diminta benar-benar ada, dapat dibuka, dan sesuai dimensi/durasi; laporkan aset yang tidak tersedia, jangan diam-diam menggantinya dengan teks.",
    ],
  },
  art_drawing_studio: {
    en: [
      "Confirm subject, composition, style, audience, canvas size, color profile, transparency, and delivery formats before drawing.",
      "Inspect silhouette, anatomy/perspective, hierarchy, edge quality, text legibility, and consistency at both fit-to-screen and 100% zoom.",
      "Deliver requested editable/source layers when possible, export every required format, and record provenance/licenses for external references.",
    ],
    id: [
      "Pastikan subjek, komposisi, gaya, audiens, ukuran kanvas, profil warna, transparansi, dan format kirim sebelum menggambar.",
      "Periksa siluet, anatomi/perspektif, hierarki, kualitas tepi, keterbacaan teks, dan konsistensi pada tampilan layar serta zoom 100%.",
      "Sertakan layer/sumber yang dapat diedit bila memungkinkan, ekspor semua format wajib, dan catat asal/lisensi referensi eksternal.",
    ],
  },
  game_dev_studio: {
    en: [
      "Define the core loop, controls, win/fail states, target device, and frame/performance budget; keep a fresh clone/build runnable.",
      "Test a complete play loop plus input, pause/restart, boundaries, save/load when requested, and common failure states.",
      "Review collision/camera/UI behavior at target resolutions, log reproducible bugs, and distinguish automated checks from human playtesting.",
    ],
    id: [
      "Tetapkan loop inti, kontrol, kondisi menang/gagal, perangkat target, serta anggaran frame/performa; pastikan build bersih dapat dijalankan.",
      "Uji satu siklus permainan lengkap termasuk input, pause/restart, batas area, save/load bila diminta, dan kondisi gagal umum.",
      "Periksa collision/kamera/UI pada resolusi target, catat bug yang dapat direproduksi, dan bedakan tes otomatis dari playtest manusia.",
    ],
  },
  app_dev_studio: {
    en: [
      "Map user roles and acceptance flows; validate empty/loading/error/success states, navigation, persistence, and recovery from interrupted actions.",
      "Test responsive layouts and keyboard/touch access; run available unit/integration/build checks and report untested paths.",
      "Review input validation, authorization, secrets, data minimization/retention, dependency risk, and migration/backward compatibility.",
    ],
    id: [
      "Petakan peran pengguna dan alur penerimaan; validasi state kosong/loading/error/berhasil, navigasi, persistensi, serta pemulihan aksi terputus.",
      "Uji layout responsif dan akses keyboard/sentuh; jalankan tes unit/integrasi/build yang tersedia serta laporkan jalur yang belum diuji.",
      "Tinjau validasi input, otorisasi, rahasia, minimisasi/retensi data, risiko dependency, dan kompatibilitas migrasi.",
    ],
  },
};

function buildQualityGuidance(packKey: WorkflowPackKey, lang: SupportedLang): string {
  const checks = QUALITY_CHECKS[packKey][lang === "id" ? "id" : "en"];
  const general =
    lang === "id"
      ? [
          "Ubah tujuan pengguna dan tujuan inti proyek menjadi kriteria penerimaan yang dapat diamati.",
          "Periksa hasil nyata terhadap setiap kriteria; pisahkan fakta terverifikasi, asumsi, dan keterbatasan.",
          "Jangan mengklaim pekerjaan, sumber, pengujian, atau artefak selesai tanpa bukti yang dapat diperiksa.",
          "Gunakan sumber daya eksternal hanya jika relevan, diizinkan, dan asal-usulnya dapat dijelaskan; jangan membuka rahasia atau menjalankan unduhan yang belum diperiksa.",
          "Jika data pribadi/akses eksternal benar-benar diperlukan, minta CEO dengan menyebutkan tujuan, cakupan minimum, alasan fallback tidak cukup, opsi aman, dan tindakan konkret. Jangan minta rahasia di chat; arahkan ke penyimpanan rahasia yang aman.",
        ]
      : [
          "Translate the user request and project goal into observable acceptance criteria.",
          "Inspect the actual result against every criterion; separate verified facts, assumptions, and limitations.",
          "Never claim work, sources, tests, or artifacts are complete without inspectable evidence.",
          "Use external resources only when relevant, authorized, and attributable; do not expose secrets or execute uninspected downloads.",
          "If private data or external access is truly necessary, ask the CEO with the purpose, minimum scope, why a fallback is insufficient, safe options, and one concrete action. Never request secrets in chat; direct secret setup to a secure store.",
        ];
  return [
    "[Task Quality and Safety Gate]",
    ...general.map((line) => `- ${line}`),
    ...checks.map((line) => `- ${line}`),
  ].join("\n");
}

export function buildWorkflowPackExecutionGuidance(
  packKeyRaw: string | null | undefined,
  langRaw: string | null | undefined,
  options?: {
    videoArtifactRelativePath?: string | null;
  },
): string {
  const packKey = normalizePackKey(packKeyRaw);
  const lang = normalizeLang(langRaw);
  const qualityGuidance = buildQualityGuidance(packKey, lang);
  if (packKey !== "video_preprod") return qualityGuidance;

  const artifactPath = String(options?.videoArtifactRelativePath ?? "").trim() || "video_output/final.mp4";
  const ruleLines: Record<SupportedLang, string[]> = {
    ko: [
      "[Video Output Requirement]",
      "- 이 작업은 문서만 생성하면 완료가 아닙니다. 실제 영상 파일을 생성해야 합니다.",
      "- 순서 고정: 문서화/기획/회의 반영 작업을 모두 끝낸 뒤 마지막 단계에서 렌더링하세요.",
      "- 리뷰 보완 라운드에서 다시 실행할 때는 보완 내용을 반영한 뒤 같은 출력 파일로 재렌더링하세요.",
      `- 최종 산출물은 반드시 \`${artifactPath}\` 경로에 저장하세요. (프로젝트명_부서명_final.mp4 규칙)`,
      "- 다른 태스크의 결과를 덮어쓰지 않도록 `final.mp4` 단일 파일만 고집하지 마세요.",
      "- 프로젝트에 이미 준비된 렌더러를 우선 사용하세요. Remotion은 모션 그래픽에 적합하며, 요구에 맞는 다른 로컬 렌더러도 허용됩니다. 허가 없이 의존성을 설치하거나 바이너리를 내려받지 마세요.",
      `- 실제 영상이 요청되면 \`${artifactPath}\`에 저장하고 다른 task의 결과물을 덮어쓰지 마세요.`,
      `- 렌더 후 파일 존재, ffprobe 또는 동등한 메타데이터, 대표 프레임/오디오를 확인하고 실제로 검증한 결과만 보고하세요.`,
      "",
      "[Video Quality Requirements]",
      "- 해상도와 프레임률은 플랫폼 요구를 따르세요(세로형은 보통 9:16, 가로형은 16:9). 사양이 없을 때만 1080급/30fps를 기본으로 삼으세요.",
      "- 장면 수와 컷 길이를 요청된 러닝타임에 맞추고, 각 장면에 후킹/정보/증거/CTA 중 분명한 역할을 부여하세요.",
      "- 자막의 안전 여백과 대비, 폰트 대체, 음량, 전환을 실제 출력에서 검사하세요.",
      "",
      "[High Quality Direction]",
      "- 길이와 shot 수는 brief 및 게시 플랫폼에 맞추세요. 짧은 Reels/Shorts를 임의로 55~65초 또는 8~12 shot으로 늘리지 마세요.",
      "- 정적인 슬라이드 나열은 피하되 컷 길이는 내레이션, 음악, 정보량에 맞추세요.",
      "- 컷마다 카메라/레이아웃/텍스트 모션을 분리 설계해 템플릿 느낌을 피하고 리듬을 만드세요.",
      "- 시작 2~4초 구간에 마스코트/브랜드 캐릭터 이미지가 있으면 인트로 키비주얼로 활용하세요.",
      "- 자막/텍스트는 safe area(좌우 8%, 상하 10%) 안에 배치하고, 대비비율과 가독성(최소 2단 계층)을 보장하세요.",
      "- 화면 텍스트 정제: `\\n`, `\\t`, 백틱, 마크다운 기호(`#`, `*`, `-`) 같은 원문 태그를 그대로 노출하지 마세요.",
      "- 줄바꿈이 필요하면 이스케이프 문자열이 아닌 실제 줄바꿈/레이아웃 분리로 처리하세요.",
      "- 최종 리포트에 씬 타임라인(초 단위) + 품질 체크리스트 결과를 함께 남기세요.",
    ],
    en: [
      "[Video Output Requirement]",
      "- This task is NOT complete with planning docs only. You must produce a real video file.",
      "- Fixed order: finish documentation/planning/meeting updates first, then render in the final step.",
      "- On review-remediation reruns, apply fixes first and re-render to the same output path.",
      `- Save the final artifact at \`${artifactPath}\`. (project_department_final.mp4 pattern)`,
      "- Do not force a single `final.mp4` filename when it can overwrite other tasks.",
      "- Prefer a renderer already available in the project. Remotion suits motion graphics; use another local renderer when it better fits the brief. Do not install dependencies or download binaries without authorization.",
      `- When a finished video is requested, save it to \`${artifactPath}\` without overwriting another task's output.`,
      `- After rendering, verify the file, metadata with ffprobe or an equivalent check, and representative frames/audio; report only what was inspected.`,
      "",
      "[Video Quality Requirements]",
      "- Match resolution and frame rate to the platform (vertical is commonly 9:16, landscape 16:9); use 1080-class/30fps only when no spec is given.",
      "- Scale shot count and cut length to the requested runtime, giving each scene a clear hook, information, proof, or CTA purpose.",
      "- Inspect subtitle safe areas/contrast, font fallback, audio levels, and transitions in the rendered output.",
      "",
      "[High Quality Direction]",
      "- Follow the brief and platform for runtime and shot count; do not force 55-65 seconds or 8-12 shots on short-form Reels/Shorts.",
      "- Avoid static slides, but pace cuts to narration, music, and information density.",
      "- Design motion per shot (camera/layout/text) to avoid template-like pacing.",
      "- If a mascot/brand character image exists, use it as the opening key visual for the first 2-4 seconds.",
      "- Keep subtitles/text within safe area (8% horizontal, 10% vertical) with clear hierarchy and contrast.",
      "- On-screen text must be sanitized: never render raw escape sequences like `\\n`/`\\t`, backticks, or markdown tokens (`#`, `*`, `-`).",
      "- If a line break is needed, use real layout line breaks, not escaped string literals.",
      "- In the final report, include a second-by-second scene timeline and a quality checklist result.",
    ],
    ja: [
      "[Video Output Requirement]",
      "- このタスクは企画ドキュメントだけでは完了ではありません。実際の動画ファイルを生成してください。",
      "- 順序固定: 文書化/企画/会議反映をすべて完了した後、最後にレンダリングしてください。",
      "- レビュー補完ラウンドで再実行する場合は、補完反映後に同じ出力先へ再レンダリングしてください。",
      `- 最終成果物は必ず \`${artifactPath}\` に保存してください。（project_department_final.mp4 ルール）`,
      "- 他タスク成果物の上書きを避けるため、単一の `final.mp4` 固定運用は避けてください。",
      "- プロジェクトで利用可能なレンダラーを優先してください。Remotion はモーショングラフィックス向きですが、要件に適したローカル renderer も使えます。許可なく依存関係やバイナリを導入しないでください。",
      `- 完成動画が必要な場合は \`${artifactPath}\` に保存し、他タスクの成果物を上書きしないでください。`,
      `- 出力後にファイル、ffprobe 相当のメタデータ、代表フレーム/音声を確認し、実際に検証した内容を報告してください。`,
      "",
      "[Video Quality Requirements]",
      "- 解像度とフレームレートは配信先に合わせてください（縦型は通常9:16、横型は16:9）。指定がなければ1080級/30fpsを目安にします。",
      "- ショット数と尺は要求された動画時間に合わせ、各シーンにフック/情報/根拠/CTAの役割を持たせます。",
      "- 字幕の安全領域とコントラスト、フォント代替、音量、転換を実際の出力で確認してください。",
      "",
      "[High Quality Direction]",
      "- 尺とショット数は brief と配信先に従い、短尺 Reels/Shorts に55〜65秒/8〜12ショットを強制しないでください。",
      "- 静止画の羅列を避けつつ、カットのテンポはナレーション/音楽/情報量に合わせてください。",
      "- カメラ/レイアウト/テキストのモーションをショット単位で設計し、テンプレ感を避けてください。",
      "- マスコット/ブランド画像がある場合、冒頭2〜4秒のキービジュアルとして活用してください。",
      "- 字幕/テキストは safe area（左右8%、上下10%）内に配置し、可読性と階層を担保してください。",
      "- 画面テキストは正規化し、`\\n`/`\\t` やバッククォート、Markdown記号（`#`, `*`, `-`）をそのまま表示しないでください。",
      "- 改行が必要な場合はエスケープ文字列ではなく、実レイアウト上の改行で処理してください。",
      "- 最終レポートには秒単位のシーンタイムラインと品質チェック結果を含めてください。",
    ],
    zh: [
      "[Video Output Requirement]",
      "- 本任务仅产出策划文档不算完成，必须生成真实视频文件。",
      "- 固定顺序：先完成文档/策划/会议结论落实，再在最后一步渲染视频。",
      "- 评审整改轮次重新执行时，先完成整改，再渲染到同一路径。",
      `- 最终产物必须保存到 \`${artifactPath}\`。（project_department_final.mp4 规则）`,
      "- 不要固定只写 `final.mp4`，避免覆盖其他任务产物。",
      "- 优先使用项目中已经可用的渲染器。Remotion 适合动态图形；若其他本地 renderer 更符合需求也可使用。未经授权不要安装依赖或下载二进制文件。",
      `- 用户要求成片时，将视频保存到 \`${artifactPath}\`，不要覆盖其他任务成果。`,
      `- 渲染后检查文件、ffprobe 等效元数据和代表性画面/音频；只报告实际验证过的内容。`,
      "",
      "[Video Quality Requirements]",
      "- 分辨率与帧率应符合发布平台（竖屏通常9:16，横屏16:9）；未指定时才以1080级/30fps为参考。",
      "- 镜头数量和长度应适配目标片长，每个场景明确承担钩子/信息/证据/CTA中的作用。",
      "- 在成片中检查字幕安全区域、对比度、字体回退、音量和转场。",
      "",
      "[High Quality Direction]",
      "- 时长和镜头数应由 brief 与平台决定，不要强制短视频达到55-65秒或8-12个镜头。",
      "- 避免静态幻灯片堆叠，同时让剪辑节奏匹配旁白、音乐和信息密度。",
      "- 按镜头拆分设计相机/版式/文字动效，避免模板感。",
      "- 若存在吉祥物/品牌角色图片，前 2-4 秒必须作为开场关键视觉使用。",
      "- 字幕与文字需放在 safe area（横向8%、纵向10%）内，并保证层级与对比度。",
      "- 屏幕文字必须做净化：禁止直接显示 `\\n`/`\\t`、反引号或 Markdown 符号（`#`, `*`, `-`）。",
      "- 需要换行时请使用真实布局换行，不要输出转义字符串字面量。",
      "- 最终报告需附带按秒场景时间线与质量检查结果。",
    ],
    id: [
      "[Persyaratan Hasil Video]",
      "- Dokumen rencana saja bukan hasil selesai jika CEO meminta video. Simpan video yang benar-benar dirender pada path berikut tanpa menimpa hasil task lain:",
      `  \`${artifactPath}\``,
      "- Gunakan renderer yang sudah tersedia dan sesuai kebutuhan. Remotion cocok untuk motion graphics; renderer lokal lain boleh dipilih bila lebih tepat. Jangan memasang dependency atau mengunduh binary tanpa izin.",
      "- Ikuti kebutuhan platform: vertikal umumnya 9:16, horizontal 16:9. Tentukan resolusi, fps, durasi, codec, caption, dan audio dari brief/platform; 1080-class/30fps hanya default jika spesifikasi tidak ada.",
      "- Rancang hook, isi, bukti, dan CTA sesuai durasi. Jangan memaksakan 55-65 detik atau 8-12 shot untuk Reels/Shorts pendek.",
      "- Setelah render, pastikan file ada; periksa metadata dengan ffprobe atau cara setara, lalu tinjau frame representatif, safe area, keterbacaan caption, audio, dan transisi.",
      "- Bila runtime, izin, atau resource menghalangi render, buat hasil parsial yang aman bila berguna, jelaskan blocker, dan jangan menyatakan video selesai.",
    ],
  };

  return [...ruleLines[lang], "", qualityGuidance].join("\n");
}
