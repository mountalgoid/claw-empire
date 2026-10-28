import { useEffect, useState } from "react";
import { addExternalResource, deleteExternalResource, getExternalResources, syncExternalResource, type ExternalResource } from "../../api";
import type { ProjectI18nTranslate } from "./types";

export default function ExternalResourcePanel({ projectId, t }: { projectId: string; t: ProjectI18nTranslate }) {
  const [resources, setResources] = useState<ExternalResource[]>([]);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState("url");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = () => getExternalResources(projectId).then(setResources).catch(() => setError(t({ ko: "리소스를 불러오지 못했습니다", en: "Could not load resources", ja: "リソースを読み込めません", zh: "无法加载资源" })));
  useEffect(() => { void load(); }, [projectId]);

  async function handleAdd() {
    if (!url.trim()) return;
    setBusy(true); setError("");
    try {
      const resource = await addExternalResource({ project_id: projectId, name: name.trim() || url.trim(), kind, url: url.trim() });
      setResources((current) => [resource, ...current]); setUrl(""); setName("");
    } catch (err) { setError(err instanceof Error ? err.message : "resource_error"); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-w-0 rounded-xl border border-slate-700 bg-slate-800/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-white">{t({ ko: "Sumber Daya Eksternal", en: "External Resources", ja: "外部リソース", zh: "外部资源" })}</h4>
        <span className="text-[10px] text-slate-500">{resources.length}</span>
      </div>
      <p className="mt-1 text-[11px] text-slate-400">{t({ ko: "URL publik, repository, skill, plugin, app, dataset, atau dokumen untuk proyek ini.", en: "Verified public URLs, repositories, skills, plugins, apps, datasets, or documents for this project.", ja: "プロジェクト用の公開URL、リポジトリ、スキル、プラグイン、アプリ、データセット、ドキュメント。", zh: "为项目管理已验证的公开 URL、仓库、技能、插件、应用、数据集或文档。" })}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_110px]">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://github.com/..." className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-white outline-none focus:border-blue-500" />
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-white">
          {[["url", "URL"], ["repository", "Repository"], ["skill", "Skill"], ["plugin", "Plugin"], ["app", "App"], ["dataset", "Dataset"], ["document", "Document"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t({ ko: "Nama sumber (opsional)", en: "Resource name (optional)", ja: "リソース名（任意）", zh: "资源名称（可选）" })} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-white outline-none focus:border-blue-500" />
      <button type="button" disabled={busy || !url.trim()} onClick={() => void handleAdd()} className="mt-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? "..." : t({ ko: "Tambahkan & verifikasi", en: "Add & verify", ja: "追加して検証", zh: "添加并验证" })}</button>
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
      <div className="mt-3 space-y-2">
        {resources.map((resource) => <div key={resource.id} className="rounded-lg border border-slate-700/70 bg-slate-900/60 p-2 text-xs">
          <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-semibold text-slate-100">{resource.name}</p><p className="truncate text-[10px] text-slate-500">{resource.url}</p></div><span className={resource.status === "available" ? "text-emerald-300" : resource.status === "error" ? "text-rose-300" : "text-amber-300"}>{resource.status}</span></div>
          {resource.error_message && <p className="mt-1 text-[10px] text-rose-300">{resource.error_message}</p>}
          <div className="mt-1 flex gap-2"><button type="button" onClick={() => void syncExternalResource(resource.id).then((next) => setResources((current) => current.map((item) => item.id === next.id ? next : item)))} className="text-[10px] text-blue-300 hover:text-white">{t({ ko: "Sinkronkan", en: "Sync", ja: "同期", zh: "同步" })}</button><button type="button" onClick={() => void deleteExternalResource(resource.id).then(() => setResources((current) => current.filter((item) => item.id !== resource.id)))} className="text-[10px] text-rose-300 hover:text-white">{t({ ko: "Hapus", en: "Remove", ja: "削除", zh: "删除" })}</button></div>
        </div>)}
      </div>
    </div>
  );
}
