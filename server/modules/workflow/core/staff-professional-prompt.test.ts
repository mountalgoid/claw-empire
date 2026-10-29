import { describe, expect, it } from "vitest";
import { buildStaffProfessionalPrompt } from "./staff-professional-prompt.ts";

describe("buildStaffProfessionalPrompt", () => {
  it("builds an Indonesian role and pack-specific operating profile", () => {
    const prompt = buildStaffProfessionalPrompt({
      name: "Bolt",
      role: "senior",
      departmentId: "dev",
      departmentName: "Pengembangan",
      provider: "codex",
      workflowPackKey: "clipper_studio",
      taskText: "Buat clip dari link YouTube",
      lang: "id",
    });

    expect(prompt).toContain("Bolt — Staf Senior");
    expect(prompt).toContain("produksi klip video dari sumber lokal atau URL yang sah");
    expect(prompt).toContain("implementasi, integrasi, dan pemeliharaan kode");
    expect(prompt).toContain("Fokus perintah saat ini:");
    expect(prompt).toContain("file/link sumber");
    expect(prompt).toContain("Clipper Editing Pro");
    expect(prompt).toContain("ffprobe");
    expect(prompt).toContain("jangan mengarang tool");
  });

  it("keeps a global fallback for unknown staff profiles", () => {
    const prompt = buildStaffProfessionalPrompt({ name: "Agen", role: "unknown", lang: "en" });
    expect(prompt).toContain("Permanent Professional Staff Profile");
    expect(prompt).toContain("testable software development");
    expect(prompt).toContain("never fake access");
  });
});
