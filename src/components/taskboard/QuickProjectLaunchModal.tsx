import { useState } from "react";
import { isApiRequestError } from "../../api";
import { useI18n } from "../../i18n";
import { launchProjectFromGoal } from "../../api";

interface QuickProjectLaunchModalProps {
  onClose: () => void;
  onRefresh: () => void;
}

export default function QuickProjectLaunchModal({ onClose, onRefresh }: QuickProjectLaunchModalProps) {
  const { t } = useI18n();
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const value = goal.trim();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    try {
      await launchProjectFromGoal(value);
      onRefresh();
      onClose();
    } catch (cause) {
      const code = isApiRequestError(cause) ? cause.code : "";
      const message =
        code === "project_path_conflict"
          ? t({
              ko: "이 목표에 연결된 기존 프로젝트를 찾았지만 경로가 충돌했습니다. 기존 프로젝트를 재사용하도록 새로고침해 주세요.",
              en: "An existing project uses this path. Refresh and try again so the project can be resumed.",
              ja: "このパスは既存プロジェクトで使用中です。更新して既存プロジェクトを再開してください。",
              zh: "此路径已被现有项目使用。请刷新后重试以继续现有项目。",
              id: "Path ini sudah digunakan proyek lain. Segarkan halaman lalu coba lagi agar proyek lama dapat dilanjutkan.",
            })
          : cause instanceof Error
            ? cause.message
            : String(cause);
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-xl rounded-2xl border border-blue-500/30 bg-slate-900 p-5 shadow-2xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">
              {t({ ko: "자동으로 프로젝트 시작", en: "Start a project automatically", ja: "プロジェクトを自動開始", zh: "自动启动项目", id: "Mulai Proyek Otomatis" })}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {t({ ko: "목표만 적으면 팀이 계획하고 실행합니다.", en: "Describe the goal and the team will plan and execute it.", ja: "目標を書くとチームが計画して実行します。", zh: "描述目标，团队会自动规划并执行。", id: "Tulis tujuan, lalu tim akan merencanakan dan mengeksekusinya." })}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white" aria-label={t({ ko: "닫기", en: "Close", ja: "閉じる", zh: "关闭", id: "Tutup" })}>✕</button>
        </div>
        <textarea
          autoFocus
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") void submit();
          }}
          rows={5}
          placeholder={t({ ko: "예: 과일 가게를 관리하는 계산대 앱을 만들어줘", en: "Example: Build a cashier app to manage a fruit store", ja: "例: 果物店を管理するレジアプリを作って", zh: "例如：制作一个管理水果店的收银应用", id: "Contoh: buatkan aplikasi kasir untuk mengelola toko buah" })}
          className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
        />
        {error && <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">{t({ ko: "Ctrl+Enter로 시작", en: "Press Ctrl+Enter to start", ja: "Ctrl+Enterで開始", zh: "按 Ctrl+Enter 开始", id: "Tekan Ctrl+Enter untuk mulai" })}</span>
          <button type="button" disabled={!goal.trim() || busy} onClick={() => void submit()} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? t({ ko: "팀 준비 중...", en: "Preparing the team...", ja: "チームを準備中...", zh: "正在准备团队...", id: "Menyiapkan tim..." }) : t({ ko: "프로젝트 실행", en: "Launch project", ja: "プロジェクトを実行", zh: "启动项目", id: "Jalankan Proyek" })}
          </button>
        </div>
      </div>
    </div>
  );
}
