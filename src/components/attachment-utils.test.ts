import { describe, expect, it, vi } from "vitest";
import type { UploadedAttachment } from "../api";
import { appendAttachmentReferences, clearAttachmentPreviews } from "./attachment-utils";

describe("attachment references", () => {
  it("adds durable attachment IDs without embedding local filesystem paths", () => {
    const files: UploadedAttachment[] = [
      {
        id: "4f19e839-4864-4e74-8c49-183fbcb35fd7",
        name: "Trading chart.png",
        mime_type: "image/png",
        size: 1024,
        category: "image",
        sha256: "a".repeat(64),
      },
    ];
    const content = appendAttachmentReferences("Analyze this chart", files, "Lampiran");
    expect(content).toContain("Analyze this chart");
    expect(content).toContain("Trading chart.png [[attachment:4f19e839-4864-4e74-8c49-183fbcb35fd7]]");
    expect(content).not.toContain("/root/");
    expect(appendAttachmentReferences("  Analyze  ", [], "Lampiran")).toBe("Analyze");
  });

  it("releases local previews when a composer is cleared", () => {
    const revoke = vi.fn();
    vi.stubGlobal("URL", { revokeObjectURL: revoke } as unknown as typeof URL);
    clearAttachmentPreviews([
      {
        id: "file",
        name: "chart.png",
        mime_type: "image/png",
        size: 1,
        category: "image",
        sha256: "x",
        preview_url: "blob:local",
      },
    ]);
    expect(revoke).toHaveBeenCalledWith("blob:local");
    vi.unstubAllGlobals();
  });
});
