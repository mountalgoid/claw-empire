import { useMemo, useState, useEffect } from "react";
import type { Agent, Department, Task } from "../types";
import type { TaskPreviewArtifact, TaskReportDetail, TaskReportDocument, TaskReportTeamSection } from "../api";
import { archiveTaskReport, getTaskPreviewArtifacts, getTaskReportDetail } from "../api";
import type { UiLanguage } from "../i18n";
import { localeName, pickLang } from "../i18n";
import AgentAvatar from "./AgentAvatar";
import { resolveReportAgent } from "./task-report-agent";

interface TaskReportPopupProps {
  report: TaskReportDetail;
  agents: Agent[];
  departments: Department[];
  uiLanguage: UiLanguage;
  onClose: () => void;
  onUpdateTask?: (id: string, data: Partial<Task>) => Promise<void>;
  onRunTask?: (id: string) => Promise<void>;
  onOpenTasks?: () => void;
  onOpenReports?: () => void;
}

const DOCUMENTS_PER_PAGE = 3;

function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size < 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtTime(ts: number | null | undefined): string {
  if (!ts) return "-";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "-";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function elapsed(start: number | null | undefined, end: number | null | undefined): string {
  if (!start || !end) return "-";
  const ms = end - start;
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

function projectNameFromPath(projectPath: string | null | undefined): string {
  if (!projectPath) return "General";
  const trimmed = projectPath.replace(/[\\/]+$/, "");
  const seg = trimmed.split(/[\\/]/).pop();
  return seg || "General";
}

function statusClass(status: string): string {
  if (status === "done") return "bg-emerald-500/15 text-emerald-300";
  if (status === "review") return "bg-blue-500/15 text-blue-300";
  if (status === "in_progress") return "bg-amber-500/15 text-amber-300";
  return "bg-slate-700/70 text-slate-300";
}

export default function TaskReportPopup({
  report,
  agents,
  departments,
  uiLanguage,
  onClose,
  onUpdateTask,
  onRunTask,
  onOpenTasks,
  onOpenReports,
}: TaskReportPopupProps) {
  const t = (text: { ko: string; en: string; ja?: string; zh?: string; id?: string }) => pickLang(uiLanguage, text);

  const [currentReport, setCurrentReport] = useState<TaskReportDetail>(report);
  const [refreshingArchive, setRefreshingArchive] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("planning");
  const [expandedDocs, setExpandedDocs] = useState<Record<string, boolean>>({});
  const [documentPages, setDocumentPages] = useState<Record<string, number>>({});
  const [revisionText, setRevisionText] = useState("");
  const [actionBusy, setActionBusy] = useState<"run" | "revision" | null>(null);
  const [actionError, setActionError] = useState("");
  const [artifacts, setArtifacts] = useState<TaskPreviewArtifact[]>([]);
  const [artifactsLoading, setArtifactsLoading] = useState(true);
  const [artifactsFailed, setArtifactsFailed] = useState(false);
  const [copiedDocumentId, setCopiedDocumentId] = useState<string | null>(null);

  useEffect(() => {
    setCurrentReport(report);
  }, [report]);

  useEffect(() => {
    let active = true;
    setArtifactsLoading(true);
    setArtifactsFailed(false);
    getTaskPreviewArtifacts(currentReport.task.id)
      .then((items) => {
        if (active) setArtifacts(items);
      })
      .catch(() => {
        if (active) {
          setArtifacts([]);
          setArtifactsFailed(true);
        }
      })
      .finally(() => {
        if (active) setArtifactsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentReport.task.id]);

  const rootTaskId = currentReport.project?.root_task_id || currentReport.task.id;
  const teamReports = useMemo(() => currentReport.team_reports ?? [], [currentReport.team_reports]);
  const projectName = currentReport.project?.project_name || projectNameFromPath(currentReport.task.project_path);
  const projectPath = currentReport.project?.project_path || currentReport.task.project_path;
  const planningSummary = currentReport.planning_summary;
  const branchVerificationLogs = useMemo(
    () =>
      (currentReport.logs ?? []).filter(
        (log) => log.kind === "system" && /^Final branch verification:/i.test(log.message.trim()),
      ),
    [currentReport.logs],
  );

  const refreshArchive = async () => {
    if (!rootTaskId || refreshingArchive) return;
    setRefreshingArchive(true);
    try {
      await archiveTaskReport(rootTaskId);
      const refreshed = await getTaskReportDetail(rootTaskId);
      setCurrentReport(refreshed);
    } catch (err) {
      console.error("Failed to refresh planning archive:", err);
    } finally {
      setRefreshingArchive(false);
    }
  };

  const escapeHtml = (value: string): string =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");

  const buildReportFallbackHtml = (): string => {
    const documents = [
      ...(currentReport.planning_summary?.documents ?? []),
      ...teamReports.flatMap((team) => team.documents ?? []),
    ].filter((document, index, all) => all.findIndex((candidate) => candidate.id === document.id) === index);
    const sections = documents
      .filter((document) => document.content || document.text_preview)
      .map(
        (document) =>
          `<section><h2>${escapeHtml(document.title)}</h2><p class="meta">${escapeHtml(document.path || document.source)}</p><pre>${escapeHtml(document.content || document.text_preview)}</pre></section>`,
      )
      .join("");
    const result = currentReport.task.result?.trim();
    return `<!doctype html><html lang="${uiLanguage}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(currentReport.task.title)}</title><style>body{margin:0;padding:24px;background:#0f172a;color:#e2e8f0;font:14px system-ui,sans-serif}main{max-width:1000px;margin:auto}h1{font-size:22px}h2{font-size:15px;color:#93c5fd}section{margin:18px 0;padding:16px;border:1px solid #334155;border-radius:12px;background:#111c2d}.meta{color:#94a3b8;font-size:12px}pre{white-space:pre-wrap;overflow:auto;line-height:1.55;color:#cbd5e1}</style></head><body><main><h1>${escapeHtml(currentReport.task.title)}</h1>${result ? `<section><h2>Execution Result</h2><pre>${escapeHtml(result)}</pre></section>` : ""}${sections || `<p>${escapeHtml(t({ ko: "Belum ada dokumen hasil.", en: "No result documents are available.", id: "Belum ada dokumen hasil." }))}</p>`}</main></body></html>`;
  };

  const openResult = async () => {
    const projectId = currentReport.project?.project_id || currentReport.task.project_id;
    const previewUrl = projectId
      ? `/api/projects/${encodeURIComponent(projectId)}/preview/index.html`
      : `/api/tasks/${encodeURIComponent(currentReport.task.id)}/preview/index.html`;
    const popup = window.open("about:blank", "_blank");
    if (!popup) {
      setActionError(t({ ko: "Browser memblokir tab hasil. Izinkan pop-up lalu coba lagi.", en: "The browser blocked the result tab. Allow pop-ups and try again.", id: "Browser memblokir tab hasil. Izinkan pop-up lalu coba lagi." }));
      return;
    }
    popup.opener = null;

    try {
      const previewResponse = await fetch(previewUrl, { credentials: "include" });
      const previewType = previewResponse.headers.get("content-type") || "";
      if (previewResponse.ok && !previewType.includes("application/json")) {
        popup.location.href = previewUrl;
        return;
      }

      const resultProjectPath = projectPath;
      const fileDocument = [
        ...(currentReport.planning_summary?.documents ?? []),
        ...teamReports.flatMap((team) => team.documents ?? []),
      ].find((document) => document.path && resultProjectPath && document.path.startsWith(resultProjectPath));
      if (fileDocument?.path && resultProjectPath) {
        const rawRelativePath = fileDocument.path.slice(resultProjectPath.length).replace(/^[/\\]+/, "");
        // Completed worktrees can be removed after merge. Preserve the useful
        // project-relative artifact path from stale worktree links.
        const artifactMatch = fileDocument.path.match(
          /(?:^|[/\\])(content|public|dist|output)([/\\].*)$/i,
        );
        const relativePath = (artifactMatch ? `${artifactMatch[1]}${artifactMatch[2]}` : rawRelativePath).replace(
          /\\/g,
          "/",
        );
        if (relativePath && !relativePath.includes("..")) {
          const fileUrl = projectId
            ? `/api/projects/${encodeURIComponent(projectId)}/preview/${relativePath}`
            : `/api/tasks/${encodeURIComponent(currentReport.task.id)}/preview/${relativePath}`;
          const fileResponse = await fetch(fileUrl, { credentials: "include" });
          if (fileResponse.ok) {
            popup.location.href = fileUrl;
            return;
          }
        }
      }

      popup.document.open();
      popup.document.write(buildReportFallbackHtml());
      popup.document.close();
    } catch (error) {
      console.error("Failed to open task result:", error);
      popup.document.open();
      popup.document.write(buildReportFallbackHtml());
      popup.document.close();
    }
  };

  const runAgain = async (withRevision: boolean) => {
    if (!onUpdateTask || !onRunTask || actionBusy) return;
    const instruction = revisionText.trim();
    if (withRevision && !instruction) {
      setActionError(t({ ko: "작성할 수정 내용을 입력하세요.", en: "Enter the revision instructions first.", id: "Masukkan instruksi revisi terlebih dahulu." }));
      return;
    }
    setActionBusy(withRevision ? "revision" : "run");
    setActionError("");
    try {
      if (withRevision) {
        const existing = currentReport.task.description?.trim() ?? "";
        const revisionBlock = `[REVISION REQUEST]\n${instruction}\n[/REVISION REQUEST]`;
        await onUpdateTask(currentReport.task.id, {
          description: existing ? `${existing}\n\n${revisionBlock}` : revisionBlock,
          status: "planned",
        });
      } else {
        await onUpdateTask(currentReport.task.id, { status: "planned" });
      }
      await onRunTask(currentReport.task.id);
      setRevisionText("");
      onClose();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t({ ko: "Tindakan gagal dijalankan.", en: "Action failed.", id: "Tindakan gagal dijalankan." }));
    } finally {
      setActionBusy(null);
    }
  };

  const completeTask = async () => {
    if (!onUpdateTask || actionBusy) return;
    setActionBusy("run");
    setActionError("");
    try {
      await onUpdateTask(currentReport.task.id, { status: "done" });
      onClose();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t({ ko: "Penyelesaian tugas gagal.", en: "Could not complete the task.", id: "Penyelesaian tugas gagal." }));
    } finally {
      setActionBusy(null);
    }
  };

  useEffect(() => {
    setActiveTab("planning");
    setExpandedDocs({});
    setDocumentPages({});
  }, [currentReport.task.id, currentReport.requested_task_id, teamReports.length]);

  const taskAgent = resolveReportAgent(agents, currentReport.task);
  const departmentById = useMemo(() => {
    const map = new Map<string, Department>();
    for (const department of departments) {
      map.set(department.id, department);
    }
    return map;
  }, [departments]);
  const taskDeptFromMap = currentReport.task.department_id
    ? departmentById.get(currentReport.task.department_id)
    : undefined;
  const taskAgentName = localeName(uiLanguage, {
    name: currentReport.task.agent_name,
    name_ko: currentReport.task.agent_name_ko,
  });
  const taskDeptName = taskDeptFromMap
    ? localeName(uiLanguage, taskDeptFromMap)
    : localeName(uiLanguage, {
        name: currentReport.task.dept_name || currentReport.task.dept_name_ko || "-",
        name_ko: currentReport.task.dept_name_ko,
      });

  const selectedTeam = useMemo(() => {
    if (activeTab === "planning") return null;
    return teamReports.find((team) => team.id === activeTab || team.task_id === activeTab) ?? null;
  }, [activeTab, teamReports]);

  const planningDocs = planningSummary?.documents ?? [];
  const copyText = async (text: string, documentId?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedDocumentId(documentId ?? "planning-summary");
      window.setTimeout(() => setCopiedDocumentId(null), 1800);
    } catch {
      setActionError(t({ ko: "클립보드에 복사할 수 없습니다. 텍스트를 직접 선택해 복사하세요.", en: "Could not copy to clipboard. Select and copy the text manually.", id: "Teks tidak dapat disalin. Silakan pilih dan salin teks secara manual." }));
    }
  };
  const downloadText = (filename: string, content: string) => {
    const blobUrl = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename.replace(/[\\/:*?"<>|]/g, "-").slice(0, 120) || "task-result.txt";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  };
  const renderMediaGallery = () => {
    const images = artifacts.filter((asset) => asset.kind === "image");
    const videos = artifacts.filter((asset) => asset.kind === "video");
    const files = artifacts.filter((asset) => asset.kind === "file");
    return (
      <section className="mb-5 border-b border-slate-700/50 pb-5" aria-label={t({ ko: "미디어 결과", en: "Media results", id: "Hasil media" })}>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              {t({ ko: "Hasil media", en: "Media results", id: "Hasil media" })}
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              {t({ ko: "File, gambar, dan video yang tersedia pada hasil tugas.", en: "Files, images, and videos available in this task output.", id: "File, gambar, dan video yang tersedia pada hasil tugas." })}
            </p>
          </div>
          {!artifactsLoading && artifacts.length > 0 && (
            <span className="text-xs text-slate-400">
              {images.length} {t({ ko: "gambar", en: "images", id: "gambar" })} · {videos.length} {t({ ko: "video", en: "videos", id: "video" })} · {files.length} {t({ ko: "file", en: "files", id: "file" })}
            </span>
          )}
        </div>
        {artifactsLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-live="polite">
            <div className="h-40 animate-pulse rounded-xl bg-slate-800/70" />
            <div className="h-40 animate-pulse rounded-xl bg-slate-800/70" />
          </div>
        ) : artifactsFailed ? (
          <p className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
            {t({ ko: "파일 미디어를 불러오지 못했습니다. 결과 파일 경로와 연결을 확인하세요.", en: "Media files could not be loaded. Check the task output path and connection.", id: "File media tidak dapat dimuat. Periksa lokasi hasil tugas dan koneksi." })}
          </p>
        ) : artifacts.length === 0 ? (
          <p className="rounded-lg border border-slate-700/60 bg-slate-950/40 px-3 py-3 text-xs leading-relaxed text-slate-400">
            {t({ ko: "아직 이 작업 결과 폴더에서 출력 파일을 찾지 못했습니다. 텍스트 보고서는 요청한 파일이 완성되었다는 뜻이 아닙니다.", en: "No output files were found in this task folder yet. A text report does not mean requested files are finished.", id: "Belum ada file hasil di folder tugas ini. Laporan teks bukan berarti file yang diminta sudah selesai." })}
          </p>
        ) : (
          <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
            {images.map((asset) => (
              <figure key={asset.path} className="min-w-0 overflow-hidden rounded-xl border border-slate-700/60 bg-slate-950/50">
                <a href={asset.url} target="_blank" rel="noreferrer" className="block bg-black/20">
                  <img src={asset.url} alt={asset.name} loading="lazy" decoding="async" className="mx-auto max-h-[360px] w-full object-contain" />
                </a>
                <figcaption className="flex min-w-0 items-center justify-between gap-2 px-3 py-2 text-xs text-slate-300">
                  <span className="truncate" title={asset.path}>{asset.path}</span>
                  <a href={asset.url} download={asset.name} className="shrink-0 rounded border border-slate-600 px-2 py-1 hover:bg-slate-700">
                    {t({ ko: "다운로드", en: "Download", id: "Unduh" })}
                  </a>
                </figcaption>
              </figure>
            ))}
            {videos.map((asset) => (
              <figure key={asset.path} className="min-w-0 overflow-hidden rounded-xl border border-slate-700/60 bg-slate-950/50 sm:col-span-2">
                <video src={asset.url} controls preload="metadata" playsInline className="mx-auto max-h-[65vh] w-full bg-black object-contain" aria-label={asset.name} />
                <figcaption className="flex min-w-0 items-center justify-between gap-2 px-3 py-2 text-xs text-slate-300">
                  <span className="truncate" title={asset.path}>{asset.path}</span>
                  <a href={asset.url} download={asset.name} className="shrink-0 rounded border border-slate-600 px-2 py-1 hover:bg-slate-700">
                    {t({ ko: "다운로드", en: "Download", id: "Unduh" })}
                  </a>
                </figcaption>
              </figure>
            ))}
            {files.length > 0 && (
              <div className="space-y-2 sm:col-span-2" aria-label={t({ ko: "파일 결과", en: "Output files", id: "File hasil" })}>
                {files.map((asset) => (
                  <div key={asset.path} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-slate-700/60 bg-slate-950/50 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-slate-200" title={asset.path}>{asset.name}</p>
                      <p className="truncate text-[11px] text-slate-500">{asset.path} · {formatFileSize(asset.size_bytes)}</p>
                    </div>
                    <a href={asset.url} download={asset.name} className="shrink-0 rounded border border-slate-600 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-700">
                      {t({ ko: "다운로드", en: "Download", id: "Unduh" })}
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    );
  };

  const toggleDoc = (docId: string) => {
    setExpandedDocs((prev) => {
      const current = prev[docId] !== false;
      return { ...prev, [docId]: !current };
    });
  };

  const renderDocuments = (documents: TaskReportDocument[], scopeKey: string) => {
    if (!documents.length) {
      return (
        <p className="text-xs text-slate-500">
          {t({ ko: "문서가 없습니다", en: "No documents", ja: "ドキュメントなし", zh: "暂无文档" })}
        </p>
      );
    }

    const totalPages = Math.max(1, Math.ceil(documents.length / DOCUMENTS_PER_PAGE));
    const rawPage = documentPages[scopeKey] ?? 1;
    const currentPage = Math.min(Math.max(rawPage, 1), totalPages);
    const start = (currentPage - 1) * DOCUMENTS_PER_PAGE;
    const visibleDocs = documents.slice(start, start + DOCUMENTS_PER_PAGE);

    return (
      <div className="space-y-2">
        {visibleDocs.map((doc) => {
          const isExpanded = expandedDocs[doc.id] !== false;
          return (
            <div key={doc.id} className="rounded-lg border border-slate-700/60 bg-slate-800/50 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-100">{doc.title}</p>
                  <p className="truncate text-[11px] text-slate-500">
                    {doc.source}
                    {doc.path ? ` · ${doc.path}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => void copyText(doc.content, doc.id)}
                    className="rounded-md border border-slate-600 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700"
                  >
                    {copiedDocumentId === doc.id
                      ? t({ ko: "복사됨", en: "Copied", id: "Tersalin" })
                      : t({ ko: "텍스트 복사", en: "Copy text", id: "Salin teks" })}
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadText(`${doc.title || "task-result"}.txt`, doc.content)}
                    className="rounded-md border border-slate-600 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700"
                  >
                    {t({ ko: "다운로드", en: "Download", id: "Unduh" })}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleDoc(doc.id)}
                    className="rounded-md border border-slate-600 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700"
                  >
                    {isExpanded
                      ? t({ ko: "접기", en: "Collapse", ja: "折りたたむ", zh: "收起", id: "Ciutkan" })
                      : t({ ko: "확장", en: "Expand", ja: "展開", zh: "展开", id: "Perluas" })}
                  </button>
                </div>
              </div>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded bg-black/30 p-2 text-[11px] leading-relaxed text-slate-300">
                {isExpanded ? doc.content : doc.text_preview}
              </pre>
            </div>
          );
        })}
        {totalPages > 1 && (
          <div className="mt-1 flex items-center justify-between rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2">
            <button
              type="button"
              onClick={() => setDocumentPages((prev) => ({ ...prev, [scopeKey]: Math.max(1, currentPage - 1) }))}
              disabled={currentPage <= 1}
              className={`rounded-md px-2 py-1 text-[11px] ${
                currentPage <= 1
                  ? "cursor-not-allowed bg-slate-800 text-slate-600"
                  : "bg-slate-700 text-slate-200 hover:bg-slate-600"
              }`}
            >
              {t({ ko: "이전", en: "Prev", ja: "前へ", zh: "上一页" })}
            </button>
            <span className="text-[11px] text-slate-400">
              {t({
                ko: `페이지 ${currentPage}/${totalPages}`,
                en: `Page ${currentPage}/${totalPages}`,
                ja: `ページ ${currentPage}/${totalPages}`,
                zh: `第 ${currentPage}/${totalPages} 页`,
              })}
            </span>
            <button
              type="button"
              onClick={() =>
                setDocumentPages((prev) => ({ ...prev, [scopeKey]: Math.min(totalPages, currentPage + 1) }))
              }
              disabled={currentPage >= totalPages}
              className={`rounded-md px-2 py-1 text-[11px] ${
                currentPage >= totalPages
                  ? "cursor-not-allowed bg-slate-800 text-slate-600"
                  : "bg-slate-700 text-slate-200 hover:bg-slate-600"
              }`}
            >
              {t({ ko: "다음", en: "Next", ja: "次へ", zh: "下一页" })}
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderPlanningSummary = () => (
    <div className="space-y-3">
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-emerald-300">
            {t({
              ko: "기획팀장 최종 취합본",
              en: "Planning Lead Consolidated Summary",
              ja: "企画リード統合サマリー",
              zh: "规划负责人汇总摘要",
            })}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void copyText(planningSummary?.content || "", "planning-summary")}
              disabled={!planningSummary?.content}
              className="rounded-md border border-emerald-400/40 bg-emerald-500/15 px-2 py-1 text-[11px] text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50"
            >
              {copiedDocumentId === "planning-summary"
                ? t({ ko: "복사됨", en: "Copied", id: "Tersalin" })
                : t({ ko: "요약 복사", en: "Copy summary", id: "Salin ringkasan" })}
            </button>
            <button
              type="button"
              onClick={() => downloadText("planning-summary.txt", planningSummary?.content || "")}
              disabled={!planningSummary?.content}
              className="rounded-md border border-emerald-400/40 bg-emerald-500/15 px-2 py-1 text-[11px] text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50"
            >
              {t({ ko: "다운로드", en: "Download", id: "Unduh" })}
            </button>
            <button
              onClick={refreshArchive}
              disabled={refreshingArchive}
              className={`rounded-md border px-2 py-1 text-[11px] ${
                refreshingArchive
                  ? "cursor-not-allowed border-emerald-500/20 bg-emerald-500/10 text-emerald-300/70"
                  : "border-emerald-400/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25"
              }`}
            >
              {refreshingArchive
                ? t({ ko: "갱신 중...", en: "Refreshing...", ja: "更新中...", zh: "刷新中..." })
                : t({ ko: "취합 갱신", en: "Refresh Consolidation", ja: "統合更新", zh: "刷新汇总" })}
            </button>
            <span className="text-[11px] text-emerald-400">{fmtTime(planningSummary?.generated_at)}</span>
          </div>
        </div>
        <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-emerald-100">
          {planningSummary?.content ||
            t({ ko: "요약 내용이 없습니다", en: "No summary text", ja: "サマリーなし", zh: "暂无摘要内容" })}
        </pre>
      </div>
      {branchVerificationLogs.length > 0 && (
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
          <p className="mb-2 text-xs font-semibold text-blue-200">
            {t({
              ko: "최종 브랜치 검증",
              en: "Final Branch Verification",
              ja: "最終ブランチ検証",
              zh: "最终分支校验",
            })}
          </p>
          <div className="space-y-1.5">
            {branchVerificationLogs.map((log, index) => (
              <div
                key={`${log.created_at}-${index}`}
                className="rounded bg-slate-950/40 px-2 py-1.5 text-[11px] text-slate-200"
              >
                <span className="mr-2 text-slate-500">{fmtTime(log.created_at)}</span>
                {log.message}
              </div>
            ))}
          </div>
        </div>
      )}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
          {t({ ko: "문서 원문", en: "Source Documents", ja: "原本文書", zh: "原始文档" })}
        </p>
        {renderDocuments(planningDocs, "planning")}
      </div>
    </div>
  );

  const renderTeamReport = (team: TaskReportTeamSection) => {
    const teamDeptFromMap = team.department_id ? departmentById.get(team.department_id) : undefined;
    const teamName = teamDeptFromMap
      ? localeName(uiLanguage, teamDeptFromMap)
      : localeName(uiLanguage, {
          name: team.department_name || team.department_name_ko || "-",
          name_ko: team.department_name_ko,
        });
    const teamAgent = localeName(uiLanguage, {
      name: team.agent_name,
      name_ko: team.agent_name_ko,
    });
    const logs = team.logs ?? [];
    const keyLogs = logs.filter((lg) => lg.kind === "system" || lg.message.includes("Status")).slice(-20);

    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-slate-700/60 bg-slate-800/50 p-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-white">{team.title}</p>
            <span className={`rounded px-2 py-0.5 text-[11px] ${statusClass(team.status)}`}>{team.status}</span>
          </div>
          <p className="text-xs text-slate-400">
            {teamName} · {teamAgent || "-"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {t({ ko: "완료", en: "Completed", ja: "完了", zh: "完成" })}: {fmtTime(team.completed_at)}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-300">{team.summary || "-"}</p>
        </div>

        {team.linked_subtasks.length > 0 && (
          <div className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
              {t({ ko: "연결된 서브태스크", en: "Linked Subtasks", ja: "関連サブタスク", zh: "关联子任务" })}
            </p>
            <div className="space-y-1.5">
              {team.linked_subtasks.map((st) => (
                <div
                  key={st.id}
                  className="flex items-center justify-between gap-2 rounded bg-slate-800/70 px-2 py-1.5 text-[11px]"
                >
                  <span className="min-w-0 flex-1 truncate text-slate-300">{st.title}</span>
                  <span className={`rounded px-1.5 py-0.5 ${statusClass(st.status)}`}>{st.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
            {t({ ko: "팀 문서", en: "Team Documents", ja: "チーム文書", zh: "团队文档" })}
          </p>
          {renderDocuments(team.documents ?? [], `team:${team.id}`)}
        </div>

        {keyLogs.length > 0 && (
          <div className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
              {t({ ko: "진행 로그", en: "Progress Logs", ja: "進行ログ", zh: "进度日志" })}
            </p>
            <div className="space-y-1">
              {keyLogs.map((lg, idx) => (
                <div key={`${lg.created_at}-${idx}`} className="text-[11px] text-slate-400">
                  <span className="mr-2 text-slate-500">{fmtTime(lg.created_at)}</span>
                  {lg.message}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="app-overlay-panel fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div
        className="report-popup-content app-overlay-panel-content relative mx-auto flex max-h-[calc(100dvh-1rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-emerald-500/30 bg-slate-900 shadow-2xl shadow-emerald-500/10 sm:max-h-[calc(100dvh-2rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-700/50 px-6 py-4">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-xl">&#x1F4CB;</span>
              <h2 className="truncate text-lg font-bold text-white">
                {t({
                  ko: "작업 완료 보고서",
                  en: "Task Completion Report",
                  ja: "タスク完了レポート",
                  zh: "任务完成报告",
                })}
              </h2>
              <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">{projectName}</span>
            </div>
            <p className="truncate text-xs text-slate-400">{projectPath || "-"}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            &#x2715;
          </button>
        </div>

        <div className="border-b border-slate-700/40 px-6 py-3">
          <div className="flex items-start gap-3">
            <AgentAvatar agent={taskAgent} agents={agents} size={40} rounded="xl" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{currentReport.task.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="rounded bg-slate-700/70 px-1.5 py-0.5">{taskDeptName}</span>
                <span>
                  {taskAgentName} ({currentReport.task.agent_role})
                </span>
                <span className={`rounded px-1.5 py-0.5 ${statusClass(currentReport.task.status)}`}>
                  {currentReport.task.status === "done"
                    ? t({ ko: "Selesai", en: "Completed", ja: "完了", zh: "完成", id: "Selesai" })
                    : currentReport.task.status === "review"
                      ? t({ ko: "Dalam peninjauan", en: "In review", id: "Dalam peninjauan" })
                      : currentReport.task.status === "in_progress"
                        ? t({ ko: "Sedang berjalan", en: "In progress", id: "Sedang berjalan" })
                        : t({ ko: "Belum selesai", en: "Not complete", id: "Belum selesai" })}
                </span>
                {currentReport.task.status === "done" && <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-400">
                  {elapsed(currentReport.task.created_at, currentReport.task.completed_at)}
                </span>}
              </div>
            </div>
          </div>
        </div>

        <div className="border-b border-slate-700/40 px-6 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab("planning")}
              className={`rounded-lg px-3 py-1.5 text-xs ${
                activeTab === "planning"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {t({ ko: "기획팀장 취합본", en: "Planning Summary", ja: "企画サマリー", zh: "规划汇总" })}
            </button>
            {teamReports.map((team) => {
              const label = localeName(uiLanguage, {
                name: team.department_name || team.department_id || "Team",
                name_ko: team.department_name_ko,
              });
              return (
                <button
                  key={team.id}
                  onClick={() => setActiveTab(team.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs ${
                    activeTab === team.id ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {renderMediaGallery()}
          {activeTab === "planning" ? (
            renderPlanningSummary()
          ) : selectedTeam ? (
            renderTeamReport(selectedTeam)
          ) : (
            <p className="text-sm text-slate-500">
              {t({
                ko: "표시할 보고서가 없습니다",
                en: "No report to display",
                ja: "表示するレポートがありません",
                zh: "没有可显示的报告",
              })}
            </p>
          )}
        </div>

        <div className="report-popup-footer sticky bottom-0 z-10 shrink-0 border-t border-slate-700/50 bg-slate-900 px-4 py-3 sm:px-6">
          {actionError && <p className="mb-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{actionError}</p>}
          {(onUpdateTask || onRunTask) && (
            <div className="mb-3 rounded-lg border border-blue-500/25 bg-blue-500/5 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-blue-200">
                  {t({ ko: "Tindak lanjuti hasil", en: "Act on this result", id: "Tindak lanjuti hasil" })}
                </p>
                <button
                  type="button"
                  onClick={openResult}
                  className="rounded-md border border-blue-400/40 bg-blue-500/15 px-2.5 py-1 text-xs text-blue-100 hover:bg-blue-500/25"
                >
                  {t({ ko: "Buka hasil", en: "Open result", id: "Buka hasil" })}
                </button>
              </div>
              <textarea
                value={revisionText}
                onChange={(event) => setRevisionText(event.target.value)}
                placeholder={t({
                  ko: "Opsional: tulis apa yang perlu diperbaiki...",
                  en: "Optional: describe what should be revised...",
                  id: "Opsional: tulis apa yang perlu diperbaiki...",
                })}
                className="min-h-16 w-full resize-y rounded-md border border-slate-700 bg-slate-950/50 px-3 py-2 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-blue-400"
                disabled={Boolean(actionBusy)}
              />
              <div className="mt-2 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => void completeTask()}
                  disabled={Boolean(actionBusy) || !onUpdateTask}
                  className="rounded-md border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t({ ko: "Tandai selesai", en: "Mark complete", id: "Tandai selesai" })}
                </button>
                <button
                  type="button"
                  onClick={() => void runAgain(false)}
                  disabled={Boolean(actionBusy) || !onRunTask || !onUpdateTask}
                  className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {actionBusy === "run"
                    ? t({ ko: "Menjalankan...", en: "Running...", id: "Menjalankan..." })
                    : t({ ko: "Jalankan lagi", en: "Run again", id: "Jalankan lagi" })}
                </button>
                <button
                  type="button"
                  onClick={() => void runAgain(true)}
                  disabled={Boolean(actionBusy) || !onRunTask || !onUpdateTask}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {actionBusy === "revision"
                    ? t({ ko: "Mengirim revisi...", en: "Submitting revision...", id: "Mengirim revisi..." })
                    : t({ ko: "Revisi & jalankan", en: "Revise & run", id: "Revisi & jalankan" })}
                </button>
              </div>
            </div>
          )}
          {(onOpenTasks || onOpenReports) && (
            <div className="mb-3 flex flex-wrap gap-2">
              {onOpenTasks && (
                <button
                  type="button"
                  onClick={onOpenTasks}
                  className="min-h-10 flex-1 rounded-lg border border-blue-400/40 bg-blue-500/15 px-3 py-2 text-xs font-medium text-blue-100 hover:bg-blue-500/25"
                >
                  {t({ ko: "Buka menu Tugas", en: "Open Tasks menu", id: "Buka menu Tugas" })}
                </button>
              )}
              {onOpenReports && (
                <button
                  type="button"
                  onClick={onOpenReports}
                  className="min-h-10 flex-1 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-100 hover:bg-emerald-500/25"
                >
                  {t({ ko: "Buka menu Laporan", en: "Open Reports menu", id: "Buka menu Laporan" })}
                </button>
              )}
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {t({
                ko: `팀 보고서 ${teamReports.length}개`,
                en: `${teamReports.length} team reports`,
                ja: `チームレポート ${teamReports.length}件`,
                zh: `${teamReports.length} 个团队报告`,
              })}
            </span>
            <button
              onClick={onClose}
              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-500"
            >
              {t({ ko: "확인", en: "OK", ja: "OK", zh: "确认" })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
