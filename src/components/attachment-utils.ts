import type { UploadedAttachment } from "../api";

export function appendAttachmentReferences(
  content: string,
  attachments: UploadedAttachment[],
  label = "Attachments",
): string {
  if (!attachments.length) return content.trim();
  const references = attachments.map((file) => `- ${file.name} [[attachment:${file.id}]]`).join("\n");
  return `${content.trim()}\n\n[${label}]\n${references}`.trim();
}

export function clearAttachmentPreviews(attachments: UploadedAttachment[]): void {
  attachments.forEach((file) => {
    if (file.preview_url) URL.revokeObjectURL(file.preview_url);
  });
}
