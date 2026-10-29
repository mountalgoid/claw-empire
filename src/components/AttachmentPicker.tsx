import { useRef, useState } from "react";
import { deleteAttachment, uploadAttachment, type UploadedAttachment } from "../api";
import { useI18n } from "../i18n";

interface AttachmentPickerProps {
  attachments: UploadedAttachment[];
  onChange: (attachments: UploadedAttachment[]) => void;
  disabled?: boolean;
  compact?: boolean;
}

const ACCEPT = ".png,.jpg,.jpeg,.gif,.webp,.mp4,.mov,.webm,.pdf,.txt,.md,.csv,.json";
const MAX_FILES = 8;

function sizeLabel(size: number): string {
  return size >= 1024 * 1024 ? `${(size / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(size / 1024)} KB`;
}

export default function AttachmentPicker({
  attachments,
  onChange,
  disabled = false,
  compact = false,
}: AttachmentPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const { t } = useI18n();

  const addFiles = async (files: FileList | null) => {
    if (!files?.length || uploading) return;
    setError("");
    const selected = Array.from(files);
    if (attachments.length + selected.length > MAX_FILES) {
      setError(
        t({
          ko: "파일은 최대 8개까지 첨부할 수 있습니다.",
          en: "You can attach up to 8 files.",
          id: "Maksimal 8 file dapat dilampirkan.",
        }),
      );
      return;
    }
    setUploading(true);
    const uploaded: UploadedAttachment[] = [];
    try {
      for (const file of selected) uploaded.push(await uploadAttachment(file));
      onChange([...attachments, ...uploaded]);
    } catch (cause) {
      uploaded.forEach((item) => {
        if (item.preview_url) URL.revokeObjectURL(item.preview_url);
        void deleteAttachment(item.id).catch(() => undefined);
      });
      setError(
        t({
          ko: "일부 파일을 올리지 못했습니다. PNG/JPG/WebP/GIF, MP4/MOV/WebM, PDF 또는 텍스트 파일을 확인하세요(각 최대 50MB).",
          en: "Some files could not be uploaded. Use images, MP4/MOV/WebM, PDF, or text files (up to 50 MB each).",
          id: "Sebagian file gagal diunggah. Gunakan gambar, MP4/MOV/WebM, PDF, atau file teks (maksimal 50 MB per file).",
        }),
      );
      console.warn("Attachment upload failed", cause);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async (item: UploadedAttachment) => {
    if (disabled || uploading) return;
    onChange(attachments.filter((attachment) => attachment.id !== item.id));
    if (item.preview_url) URL.revokeObjectURL(item.preview_url);
    try {
      await deleteAttachment(item.id);
    } catch {
      // The server retains an attachment already referenced by a sent task/message.
    }
  };

  return (
    <div className="min-w-0 space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        disabled={disabled || uploading}
        onChange={(event) => void addFiles(event.target.files)}
      />
      <button
        type="button"
        disabled={disabled || uploading || attachments.length >= MAX_FILES}
        onClick={() => inputRef.current?.click()}
        className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {uploading
          ? t({ ko: "파일 업로드 중…", en: "Uploading files…", id: "Mengunggah file…" })
          : t({
              ko: "파일·이미지·영상 첨부",
              en: "Attach files, images, or video",
              id: "Lampirkan file, gambar, atau video",
            })}
      </button>
      {!compact && (
        <p className="text-[11px] leading-relaxed text-slate-500">
          {t({
            ko: "이미지, 동영상, PDF, TXT, Markdown, CSV, JSON · 파일당 최대 50MB",
            en: "Images, video, PDF, TXT, Markdown, CSV, JSON · up to 50 MB per file",
            id: "Gambar, video, PDF, TXT, Markdown, CSV, JSON · maksimal 50 MB per file",
          })}
        </p>
      )}
      <p className="text-[11px] leading-relaxed text-amber-300/75">
        {t({
          ko: "첨부 파일은 배정된 에이전트가 분석합니다. API 에이전트 사용 시 파일 내용과 이미지/영상 프레임이 설정된 외부 제공자에게 전송될 수 있습니다.",
          en: "Assigned agents analyze attachments. With API agents, file contents and image/video frames may be sent to the configured external provider.",
          id: "Lampiran dianalisis agent yang ditugaskan. Jika memakai agent API, isi file dan frame gambar/video dapat dikirim ke penyedia eksternal yang dikonfigurasi.",
        })}
      </p>
      <p className="text-[11px] leading-relaxed text-slate-500">
        {t({
          ko: "공지에서 분석이 필요하면 담당 에이전트를 지정하거나 ‘전송 후 작업으로 실행’을 선택하세요. 일반 공지는 방송만 됩니다.",
          en: "For announcement analysis, mention an agent or choose ‘Send and execute as a task’. A regular announcement is broadcast only.",
          id: "Agar pengumuman dianalisis, sebut agent yang dituju atau pilih ‘Kirim dan jalankan sebagai tugas’. Pengumuman biasa hanya disiarkan.",
        })}
      </p>
      {error && (
        <p role="alert" className="text-xs text-rose-300">
          {error}
        </p>
      )}
      {attachments.length > 0 && (
        <ul className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
          {attachments.map((item) => (
            <li
              key={item.id}
              className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/70 p-2"
            >
              {item.category === "image" && item.preview_url ? (
                <img src={item.preview_url} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-slate-800 text-[10px] font-semibold uppercase text-slate-300"
                >
                  {item.category === "video" ? "VID" : item.name.split(".").pop()?.slice(0, 4) || "FILE"}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs text-slate-200">{item.name}</span>
                <span className="text-[10px] text-slate-500">{sizeLabel(item.size)}</span>
              </span>
              <button
                type="button"
                disabled={disabled || uploading}
                onClick={() => void remove(item)}
                className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-700 hover:text-white disabled:opacity-40"
                aria-label={t({ ko: "첨부 삭제", en: "Remove attachment", id: "Hapus lampiran" })}
              >
                {t({ ko: "삭제", en: "Remove", id: "Hapus" })}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
