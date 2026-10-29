import { attachmentUrl } from "../api";
import MessageContent from "./MessageContent";

interface AttachmentReferencesProps {
  content: string;
}

const ATTACHMENT_LINE = /^\s*-\s*(.*?)\s+\[\[attachment:([0-9a-f-]{36})\]\]\s*$/i;
const ATTACHMENT_SECTION = /^\[(?:Attachments|Supporting attachments|첨부 파일|添付ファイル|附件|Lampiran)\]$/i;

export default function AttachmentReferences({ content }: AttachmentReferencesProps) {
  const lines = content.split("\n");
  const files: Array<{ name: string; id: string }> = [];
  const retained: string[] = [];
  for (const line of lines) {
    const match = line.match(ATTACHMENT_LINE);
    if (match) files.push({ name: match[1], id: match[2] });
    else retained.push(line);
  }
  const body = retained
    .filter((line, index, all) => {
      if (!ATTACHMENT_SECTION.test(line.trim())) return true;
      const nextLines = all.slice(index + 1);
      return nextLines.some((next) => !ATTACHMENT_LINE.test(next));
    })
    .join("\n")
    .trim();

  return (
    <>
      {body && <MessageContent content={body} />}
      {files.length > 0 && (
        <span className={`flex flex-wrap gap-1.5 ${body ? "mt-2" : ""}`}>
          {files.map((file) => (
            <a
              key={file.id}
              href={attachmentUrl(file.id)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex max-w-full items-center gap-1 rounded-md border border-white/15 bg-black/10 px-2 py-1 text-xs underline decoration-white/30 underline-offset-2 hover:bg-black/20"
              title={file.name}
            >
              <span aria-hidden="true" className="shrink-0 text-[10px] font-semibold uppercase">
                FILE
              </span>
              <span className="truncate">{file.name}</span>
            </a>
          ))}
        </span>
      )}
    </>
  );
}
