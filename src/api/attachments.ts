import { request } from "./core";

export interface UploadedAttachment {
  id: string;
  name: string;
  mime_type: string;
  size: number;
  category: "image" | "video" | "document";
  sha256: string;
  preview_url?: string;
}

export async function uploadAttachment(file: File): Promise<UploadedAttachment> {
  if (file.size <= 0 || file.size > 50 * 1024 * 1024) throw new Error("attachment_size_invalid");
  const result = await request<UploadedAttachment>("/api/attachments", {
    method: "POST",
    headers: {
      "content-type": "application/octet-stream",
      "x-file-name": encodeURIComponent(file.name),
    },
    body: file,
  });
  return { ...result, preview_url: URL.createObjectURL(file) };
}

export async function deleteAttachment(id: string): Promise<void> {
  await request(`/api/attachments/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function attachmentUrl(id: string): string {
  return `/api/attachments/${encodeURIComponent(id)}`;
}
