import { describe, expect, it } from "vitest";
import { WORKFLOW_PACK_KEYS } from "./definitions.ts";
import { buildWorkflowPackExecutionGuidance } from "./execution-guidance.ts";

describe("buildWorkflowPackExecutionGuidance", () => {
  it("video_preprod는 실제 영상 산출 및 플랫폼별 검증 규칙을 포함한다", () => {
    const guidance = buildWorkflowPackExecutionGuidance("video_preprod", "ko", {
      videoArtifactRelativePath: "video_output/VID_기획팀_final.mp4",
    });
    expect(guidance).toContain("video_output/VID_기획팀_final.mp4");
    expect(guidance).toContain("9:16");
    expect(guidance).toContain("실제로 검증한");
    expect(guidance).not.toContain("8~12개 이상 샷");
    expect(guidance).toContain("[High Quality Direction]");
  });

  it("semua paket memiliki quality gate yang terlokalisasi dan panduan spesifik", () => {
    const uniqueChecks: Record<(typeof WORKFLOW_PACK_KEYS)[number], string> = {
      development: "arsitektur",
      novel: "kerangka cerita",
      report: "ringkasan eksekutif",
      video_preprod: "[Persyaratan Hasil Video]",
      web_research_report: "pertanyaan riset",
      roleplay: "suara karakter",
      clipper_studio: "izin penggunaan ulang",
      content_studio: "audiens, kanal",
      art_drawing_studio: "ukuran kanvas",
      game_dev_studio: "loop inti",
      app_dev_studio: "peran pengguna",
    };

    for (const packKey of WORKFLOW_PACK_KEYS) {
      const indonesian = buildWorkflowPackExecutionGuidance(packKey, "id");
      const english = buildWorkflowPackExecutionGuidance(packKey, "en");

      expect(indonesian, `${packKey} id`).toContain("[Task Quality and Safety Gate]");
      expect(indonesian, `${packKey} id`).toContain(uniqueChecks[packKey]);
      expect(english, `${packKey} en`).toContain("[Task Quality and Safety Gate]");
      expect(english, `${packKey} en`).not.toBe(indonesian);
    }
  });

  it("언어 정보가 없으면 영어 규칙으로 폴백한다", () => {
    const guidance = buildWorkflowPackExecutionGuidance("video_preprod", null);
    expect(guidance).toContain("This task is NOT complete");
  });
});
