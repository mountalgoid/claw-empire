import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

type DbLike = { prepare: (sql: string) => { get: (...args: any[]) => unknown; run: (...args: any[]) => unknown } };

const PROVIDER_TO_AGENT: Record<string, string> = {
  claude: "claude-code",
  codex: "codex",
  gemini: "gemini-cli",
  opencode: "opencode",
  kimi: "kimi-code",
  copilot: "github-copilot",
  antigravity: "antigravity",
};

const SKILLS = [
  {
    id: "video-editing-pro",
    label: "Claw-Empire Video Editing Pro",
    match: /video|reel|film|transisi|edit video|mp4|ffmpeg|motion|montage/i,
    content: `# Video Editing Pro\n\n- Inspect source media before editing.\n- Preserve aspect ratio, duration, fps, captions, safe areas, and visual identity.\n- Prefer installed FFmpeg, Pillow, and Remotion tools.\n- Produce a real playable video, not only a storyboard or README.\n- Verify output with ffprobe and representative frames before reporting completion.\n- Report unavailable audio or external assets precisely; never claim them as complete.\n`,
  },
  {
    id: "voice-production-pro",
    label: "Claw-Empire Voice Production Pro",
    match: /voice|suara|audio|narasi|narator|logat|aksen|tone|musik|background sound|dubbing|tts/i,
    content: `# Voice Production Pro\n\n- Resolve language, accent, tone, pace, character, and audience before rendering.\n- Keep the selected voice profile consistent and document it.\n- Use only local or explicitly configured providers; never invent credentials.\n- Verify format, sample rate, duration, loudness, sync, and the final video audio stream.\n- If a voice provider is unavailable, continue independent work and report the exact requirement.\n`,
  },
];

export function ensureMediaProductionSkills(args: {
  db: DbLike;
  logsDir: string;
  provider: string | null | undefined;
  taskText: string;
  taskId?: string | null;
  appendTaskLog?: (taskId: string, kind: string, message: string) => void;
}): string[] {
  const provider = String(args.provider ?? "")
    .trim()
    .toLowerCase();
  const agent = PROVIDER_TO_AGENT[provider];
  if (!agent) return [];
  const selected = SKILLS.filter((skill) => skill.match.test(args.taskText));
  if (!selected.length) return [];

  const installed: string[] = [];
  for (const skill of selected) {
    const skillDir = path.join(args.logsDir, "..", "custom-skills", skill.id);
    try {
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, "skills.md"), skill.content, "utf8");
      const learned = args.db
        .prepare(
          "SELECT 1 FROM skill_learning_history WHERE provider = ? AND repo = ? AND skill_id = ? AND status = 'succeeded' LIMIT 1",
        )
        .get(provider, "claw-empire/builtin-media", skill.id);
      if (!learned) {
        const now = Date.now();
        args.db
          .prepare(
            `INSERT INTO skill_learning_history
          (id, job_id, provider, repo, skill_id, skill_label, status, command, run_started_at, run_completed_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 'succeeded', ?, ?, ?, ?, ?)`,
          )
          .run(
            randomUUID(),
            `builtin-media-${skill.id}-${provider}`,
            provider,
            "claw-empire/builtin-media",
            skill.id,
            skill.label,
            `builtin install for ${agent}`,
            now,
            now,
            now,
            now,
          );
      }
      installed.push(skill.id);
    } catch (error) {
      args.taskId &&
        args.appendTaskLog?.(args.taskId, "error", `Media skill install failed (${skill.id}): ${String(error)}`);
    }
  }
  if (installed.length && args.taskId) {
    args.appendTaskLog?.(args.taskId, "system", `Media library routed to ${agent}: ${installed.join(", ")}`);
  }
  return installed;
}
