import { useCallback, useMemo, useState, type JSX } from "react";
import type { TaskPreviewArtifact } from "../api";
import { getTaskPreviewArtifacts, manageTaskArtifact } from "../api";
import type { UiLanguage } from "../i18n";
import { pickLang } from "../i18n";
import type { Task } from "../types";

interface AssetLibraryProps {
  tasks: Task[];
  uiLanguage: UiLanguage;
}

interface TaskNode {
  task: Task;
  children: TaskNode[];
}

interface AssetDirectory {
  path: string;
  assets: TaskPreviewArtifact[];
}

function projectKey(task: Task): string {
  return task.project_id || task.project_path || "__general__";
}

function projectLabel(task: Task, language: UiLanguage): string {
  const named = task.project_name?.trim();
  if (named) return named;
  if (!task.project_path) return pickLang(language, { ko: "일반", en: "General", ja: "一般", zh: "常规", id: "Umum" });
  return task.project_path.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || "General";
}

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function groupAssetsByDirectory(assets: TaskPreviewArtifact[]): AssetDirectory[] {
  const groups = new Map<string, TaskPreviewArtifact[]>();
  for (const asset of assets) {
    const directory = asset.path.includes("/") ? asset.path.slice(0, asset.path.lastIndexOf("/")) : "";
    const items = groups.get(directory) ?? [];
    items.push(asset);
    groups.set(directory, items);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, items]) => ({ path, assets: items.sort((a, b) => a.name.localeCompare(b.name)) }));
}

function flattenTaskNodes(nodes: TaskNode[]): Task[] {
  return nodes.flatMap((node) => [node.task, ...flattenTaskNodes(node.children)]);
}

function taskStatus(task: Task, language: UiLanguage): string {
  const labels: Record<string, { ko: string; en: string; ja: string; zh: string; id: string }> = {
    inbox: { ko: "받은 편지함", en: "Inbox", ja: "受信トレイ", zh: "收件箱", id: "Kotak masuk" },
    planned: { ko: "계획됨", en: "Planned", ja: "計画済み", zh: "已计划", id: "Direncanakan" },
    collaborating: { ko: "협업 중", en: "Collaborating", ja: "協業中", zh: "协作中", id: "Berkolaborasi" },
    in_progress: { ko: "진행 중", en: "In progress", ja: "進行中", zh: "进行中", id: "Sedang berjalan" },
    review: { ko: "검토", en: "Review", ja: "レビュー", zh: "审核中", id: "Ditinjau" },
    done: { ko: "완료", en: "Done", ja: "完了", zh: "已完成", id: "Selesai" },
    cancelled: { ko: "취소됨", en: "Cancelled", ja: "キャンセル", zh: "已取消", id: "Dibatalkan" },
  };
  return pickLang(language, labels[task.status] ?? { ko: task.status, en: task.status, ja: task.status, zh: task.status, id: task.status });
}

export default function AssetLibrary({ tasks, uiLanguage }: AssetLibraryProps) {
  const t = (ko: string, en: string, id: string, ja = en, zh = en) => pickLang(uiLanguage, { ko, en, id, ja, zh });
  const [search, setSearch] = useState("");
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(() => new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(() => new Set());
  const [assetsByTask, setAssetsByTask] = useState<Record<string, TaskPreviewArtifact[]>>({});
  const [loadingTaskIds, setLoadingTaskIds] = useState<Set<string>>(() => new Set());
  const [failedTaskIds, setFailedTaskIds] = useState<Set<string>>(() => new Set());
  const [editingAssetKey, setEditingAssetKey] = useState<string | null>(null);
  const [assetDestination, setAssetDestination] = useState("");
  const [assetOperation, setAssetOperation] = useState<"rename" | "move">("rename");
  const [assetActionKey, setAssetActionKey] = useState<string | null>(null);
  const [assetActionError, setAssetActionError] = useState<string | null>(null);

  const projects = useMemo(() => {
    const grouped = new Map<string, Task[]>();
    for (const task of tasks) {
      const key = projectKey(task);
      const items = grouped.get(key) ?? [];
      items.push(task);
      grouped.set(key, items);
    }
    return [...grouped.entries()]
      .map(([key, projectTasks]) => {
        const sorted = [...projectTasks].sort((a, b) => Number(b.updated_at || b.created_at) - Number(a.updated_at || a.created_at));
        const projectName = projectLabel(sorted[0], uiLanguage);
        const nodesById = new Map(sorted.map((task) => [task.id, { task, children: [] as TaskNode[] }]));
        const roots: TaskNode[] = [];
        for (const node of nodesById.values()) {
          const parentId = node.task.source_task_id;
          const parent = parentId ? nodesById.get(parentId) : undefined;
          if (parent && parent.task.id !== node.task.id) parent.children.push(node);
          else roots.push(node);
        }
        const sortNodes = (nodes: TaskNode[]) => {
          nodes.sort((a, b) => Number(b.task.updated_at || b.task.created_at) - Number(a.task.updated_at || a.task.created_at));
          nodes.forEach((node) => sortNodes(node.children));
        };
        sortNodes(roots);
        return { key, name: projectName, tasks: sorted, roots };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks, uiLanguage]);

  const loadTaskAssets = useCallback(async (taskId: string, force = false) => {
    if ((!force && assetsByTask[taskId]) || loadingTaskIds.has(taskId)) return;
    setLoadingTaskIds((current) => new Set(current).add(taskId));
    setFailedTaskIds((current) => {
      const next = new Set(current);
      next.delete(taskId);
      return next;
    });
    try {
      const assets = await getTaskPreviewArtifacts(taskId);
      setAssetsByTask((current) => ({ ...current, [taskId]: assets }));
    } catch {
      setFailedTaskIds((current) => new Set(current).add(taskId));
    } finally {
      setLoadingTaskIds((current) => {
        const next = new Set(current);
        next.delete(taskId);
        return next;
      });
    }
  }, [assetsByTask, loadingTaskIds]);

  const toggleTask = (taskId: string) => {
    const wasExpanded = expandedTasks.has(taskId);
    setExpandedTasks((current) => {
      const next = new Set(current);
      if (wasExpanded) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
    if (!wasExpanded) void loadTaskAssets(taskId);
  };

  const toggleProject = (projectKeyValue: string) => {
    setExpandedProjects((current) => {
      const next = new Set(current);
      if (next.has(projectKeyValue)) next.delete(projectKeyValue);
      else next.add(projectKeyValue);
      return next;
    });
  };

  const refreshTaskAssets = (taskId: string) => {
    setAssetsByTask((current) => {
      const next = { ...current };
      delete next[taskId];
      return next;
    });
    void loadTaskAssets(taskId, true);
  };

  const saveAssetPath = async (taskId: string, asset: TaskPreviewArtifact) => {
    const actionKey = `${taskId}:${asset.source ?? "task"}:${asset.path}`;
    const nextPath = assetDestination.trim();
    if (!nextPath || nextPath === asset.path || assetActionKey) return;
    setAssetActionError(null);
    setAssetActionKey(actionKey);
    try {
      await manageTaskArtifact({ taskId, operation: assetOperation, source: asset.source ?? "task", path: asset.path, destination: nextPath });
      setEditingAssetKey(null);
      refreshTaskAssets(taskId);
    } catch {
      setAssetActionError(t("Perubahan aset gagal. Periksa nama dan folder tujuan.", "Asset change failed. Check the destination name and folder.", "Perubahan aset gagal. Periksa nama dan folder tujuan.", "アセットを変更できませんでした。保存先を確認してください。", "资产修改失败，请检查目标名称和目录。"));
    } finally {
      setAssetActionKey(null);
    }
  };

  const deleteAsset = async (taskId: string, asset: TaskPreviewArtifact) => {
    const confirmed = window.confirm(t(`Hapus aset “${asset.path}” secara permanen?`, `Permanently delete “${asset.path}”?`, `Hapus aset “${asset.path}” secara permanen?`, `「${asset.path}」を完全に削除しますか？`, `永久删除“${asset.path}”？`));
    if (!confirmed || assetActionKey) return;
    setAssetActionError(null);
    setAssetActionKey(`${taskId}:${asset.source ?? "task"}:${asset.path}`);
    try {
      await manageTaskArtifact({ taskId, operation: "delete", source: asset.source ?? "task", path: asset.path });
      refreshTaskAssets(taskId);
    } catch {
      setAssetActionError(t("Aset tidak dapat dihapus.", "The asset could not be deleted.", "Aset tidak dapat dihapus.", "アセットを削除できませんでした。", "无法删除该资产。"));
    } finally {
      setAssetActionKey(null);
    }
  };

  const searchTree = (node: TaskNode, query: string, projectMatches: boolean): TaskNode | null => {
    const matches = projectMatches || node.task.title.toLocaleLowerCase().includes(query);
    const children = node.children
      .map((child) => searchTree(child, query, projectMatches))
      .filter((child): child is TaskNode => child !== null);
    return matches || children.length > 0 ? { ...node, children: matches ? node.children : children } : null;
  };

  const visibleProjects = useMemo(() => projects.map((project) => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return project;
    const projectMatches = project.name.toLocaleLowerCase().includes(query);
    const roots = project.roots.map((root) => searchTree(root, query, projectMatches)).filter((root): root is TaskNode => root !== null);
    return { ...project, roots, tasks: flattenTaskNodes(roots) };
  }).filter((project) => project.roots.length > 0), [projects, search]);

  const renderTaskNode = (node: TaskNode, depth = 0): JSX.Element => {
    const task = node.task;
    const expanded = expandedTasks.has(task.id);
    const loading = loadingTaskIds.has(task.id);
    const assets = assetsByTask[task.id] ?? [];
    const directories = groupAssetsByDirectory(assets);
    return (
      <div key={task.id} className="min-w-0 border-l border-slate-700/70" style={{ marginLeft: Math.min(depth * 12, 60) }}>
        <div className="flex min-w-0 items-center gap-2 border-b border-slate-800/80 py-2 pl-3">
          <button
            type="button"
            onClick={() => toggleTask(task.id)}
            aria-expanded={expanded}
            className="min-w-0 flex-1 text-left active:scale-[0.99]"
          >
            <span className="block truncate text-sm font-medium text-slate-100">{task.title}</span>
            <span className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-slate-500">
              <span>{taskStatus(task, uiLanguage)}</span>
              <span>{new Date(task.updated_at || task.created_at).toLocaleDateString(uiLanguage)}</span>
              {expanded && !loading && <span>{assets.length} {t("aset", "assets", "aset", "アセット", "项资产")}</span>}
            </span>
          </button>
          <button
            type="button"
            onClick={() => toggleTask(task.id)}
            aria-label={expanded ? t("Ciutkan", "Collapse", "Ciutkan", "折りたたむ", "收起") : t("Buka aset", "Open assets", "Buka aset", "アセットを開く", "打开资产")}
            className="h-8 w-8 shrink-0 rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            {expanded ? "−" : "+"}
          </button>
          {expanded && (
            <button type="button" onClick={() => refreshTaskAssets(task.id)} disabled={loading} className="h-8 shrink-0 rounded-md border border-slate-700 px-2 text-[11px] text-slate-300 hover:bg-slate-800 disabled:opacity-50">
              {t("Muat ulang", "Refresh", "Muat ulang", "更新", "刷新")}
            </button>
          )}
        </div>
        {expanded && (
          <div className="space-y-3 px-3 py-3">
            {assetActionError && <p role="alert" className="text-xs text-rose-300">{assetActionError}</p>}
            {loading ? (
              <div className="space-y-2" aria-live="polite"><div className="h-8 animate-pulse rounded bg-slate-800" /><div className="h-8 animate-pulse rounded bg-slate-800" /></div>
            ) : failedTaskIds.has(task.id) ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-100">
                <span>{t("Aset tidak dapat dimuat.", "Assets could not be loaded.", "Aset tidak dapat dimuat.", "アセットを読み込めませんでした。", "无法加载资产。")}</span>
                <button type="button" onClick={() => void loadTaskAssets(task.id, true)} className="rounded border border-amber-400/40 px-2 py-1">{t("Coba lagi", "Retry", "Coba lagi", "再試行", "重试")}</button>
              </div>
            ) : assets.length === 0 ? (
              <p className="rounded-lg bg-slate-900/70 px-3 py-2 text-xs text-slate-400">{t("Belum ada aset untuk task ini.", "No generated assets for this task yet.", "Belum ada aset untuk tugas ini.", "このタスクにはまだ生成されたアセットがありません。", "此任务尚无生成的资产。")}</p>
            ) : directories.map((directory) => (
              <section key={directory.path || "root"} className="space-y-2">
                <h4 className="border-b border-slate-800 pb-1 font-mono text-[11px] text-slate-400">{directory.path || t("Folder utama", "Root folder", "Folder utama", "ルートフォルダー", "根目录")}</h4>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {directory.assets.map((asset) => (
                    <article key={`${asset.source ?? "task"}:${asset.path}`} className="min-w-0 overflow-hidden rounded-lg border border-slate-800 bg-slate-950/50">
                      {asset.kind === "image" && <a href={asset.url} target="_blank" rel="noreferrer"><img src={asset.url} alt={asset.name} loading="lazy" decoding="async" className="max-h-64 w-full bg-slate-900 object-contain" /></a>}
                      {asset.kind === "video" && <video src={asset.url} controls preload="none" playsInline className="max-h-64 w-full bg-slate-950 object-contain" aria-label={asset.name} />}
                      <div className="flex min-w-0 items-center justify-between gap-2 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-slate-200" title={asset.path}>{asset.name}</p>
                          <p className="text-[10px] text-slate-500">{formatFileSize(asset.size_bytes)} · {asset.kind === "image" ? t("Gambar", "Image", "Gambar", "画像", "图片") : asset.kind === "video" ? t("Video", "Video", "Video", "動画", "视频") : t("Berkas", "File", "Berkas", "ファイル", "文件")} · {asset.source === "project" ? t("Proyek", "Project", "Proyek", "プロジェクト", "项目") : t("Task", "Task", "Tugas", "タスク", "任务")}</p>
                        </div>
                        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                          <a href={asset.url} target="_blank" rel="noreferrer" className="rounded border border-slate-700 px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-800">{t("Buka", "Open", "Buka", "開く", "打开")}</a>
                          <a href={asset.url} download={asset.name} className="rounded border border-slate-700 px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-800">{t("Unduh", "Download", "Unduh", "ダウンロード", "下载")}</a>
                          <button type="button" onClick={() => { setEditingAssetKey(editingAssetKey === `${task.id}:${asset.source ?? "task"}:${asset.path}` ? null : `${task.id}:${asset.source ?? "task"}:${asset.path}`); setAssetDestination(asset.path); setAssetActionError(null); }} className="rounded border border-slate-700 px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-800">{t("Kelola", "Manage", "Kelola", "管理", "管理")}</button>
                          <button type="button" onClick={() => void deleteAsset(task.id, asset)} disabled={Boolean(assetActionKey)} className="rounded border border-rose-800/70 px-2 py-1.5 text-xs text-rose-200 hover:bg-rose-950/60 disabled:opacity-50">{t("Hapus", "Delete", "Hapus", "削除", "删除")}</button>
                        </div>
                      </div>
                      {editingAssetKey === `${task.id}:${asset.source ?? "task"}:${asset.path}` && (
                        <div className="space-y-2 border-t border-slate-800 px-3 py-3">
                          <label className="block text-[11px] text-slate-400">
                            {t("Path aset baru", "New asset path", "Path aset baru", "新しいアセットのパス", "新资产路径")}
                            <input value={assetDestination} onChange={(event) => setAssetDestination(event.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100" />
                          </label>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <select value={assetOperation} onChange={(event) => setAssetOperation(event.target.value as "rename" | "move")} className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200">
                              <option value="rename">{t("Ganti nama", "Rename", "Ganti nama", "名前を変更", "重命名")}</option>
                              <option value="move">{t("Pindahkan", "Move", "Pindahkan", "移動", "移动")}</option>
                            </select>
                            <button type="button" onClick={() => void saveAssetPath(task.id, asset)} disabled={Boolean(assetActionKey) || !assetDestination.trim()} className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">{assetActionKey === `${task.id}:${asset.source ?? "task"}:${asset.path}` ? t("Menyimpan…", "Saving…", "Menyimpan…", "保存中…", "正在保存…") : t("Simpan", "Save", "Simpan", "保存", "保存")}</button>
                          </div>
                          {assetActionError && <p role="alert" className="text-xs text-rose-300">{assetActionError}</p>}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
        {expanded && node.children.map((child) => renderTaskNode(child, depth + 1))}
      </div>
    );
  };

  const totalTaskCount = projects.reduce((sum, project) => sum + project.tasks.length, 0);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <section className="flex flex-col gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-400">{t("Pustaka proyek", "Project library", "Pustaka proyek", "プロジェクトライブラリ", "项目库")}</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-100">{t("Semua aset", "All assets", "Semua aset", "すべてのアセット", "全部资产")}</h2>
          <p className="mt-1 text-sm text-slate-400">{projects.length} {t("proyek", "projects", "proyek", "プロジェクト", "个项目")} · {totalTaskCount} {t("task", "tasks", "tugas", "タスク", "个任务")}</p>
        </div>
        <label className="w-full sm:max-w-sm">
          <span className="mb-1 block text-xs text-slate-400">{t("Cari proyek atau task", "Search projects or tasks", "Cari proyek atau tugas", "プロジェクトまたはタスクを検索", "搜索项目或任务")}</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Nama proyek atau task...", "Project or task name...", "Nama proyek atau tugas...", "プロジェクト名またはタスク名...", "项目或任务名称...")} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-500" />
        </label>
      </section>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-slate-800 px-4 py-10 text-center text-sm text-slate-400">{t("Belum ada task untuk dikelompokkan.", "There are no tasks to organize yet.", "Belum ada tugas untuk dikelompokkan.", "整理するタスクはまだありません。", "暂无可整理的任务。")}</div>
      ) : visibleProjects.length === 0 ? (
        <div className="rounded-xl border border-slate-800 px-4 py-10 text-center text-sm text-slate-400">{t("Tidak ada proyek atau task yang cocok.", "No matching projects or tasks.", "Tidak ada proyek atau tugas yang cocok.", "一致するプロジェクトやタスクはありません。", "没有匹配的项目或任务。")}</div>
      ) : (
        <div className="divide-y divide-slate-800/80">
          {visibleProjects.map((project) => (
            <section key={project.key} className="py-1">
              <button type="button" onClick={() => toggleProject(project.key)} aria-expanded={expandedProjects.has(project.key) || Boolean(search)} className="flex w-full items-center justify-between gap-3 py-3 text-left">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-slate-100">{project.name}</h3>
                  <p className="text-xs text-slate-500">{project.tasks.length} {t("task", "tasks", "tugas", "タスク", "个任务")}</p>
                </div>
                <span aria-hidden="true" className={`text-xs text-slate-500 transition-transform ${expandedProjects.has(project.key) || search ? "rotate-180" : ""}`}>⌄</span>
              </button>
              {(expandedProjects.has(project.key) || Boolean(search)) && (
                <div className="space-y-1 pb-3">
                  {project.roots.map((node) => renderTaskNode(node))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
