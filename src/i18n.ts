import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type UiLanguage = "ko" | "en" | "ja" | "zh" | "id";
export const LANGUAGE_STORAGE_KEY = "climpire.language";
export const LANGUAGE_USER_SET_STORAGE_KEY = "climpire.language.user_set";

export type LangText = {
  ko: string;
  en: string;
  ja?: string;
  zh?: string;
  id?: string;
};
export type LanguageText = LangText;

type TranslationInput = LangText | string;

const INDONESIAN_FALLBACKS: Record<string, string> = {
  Office: "Kantor",
  Agents: "Agen",
  Library: "Perpustakaan",
  Dashboard: "Dasbor",
  Tasks: "Tugas",
  Settings: "Pengaturan",
  Decisions: "Keputusan",
  "Department Status": "Status Departemen",
  working: "sedang bekerja",
  "Auto Assign": "Penugasan Otomatis",
  "YOLO Mode": "Mode YOLO",
  "Auto Update (Global)": "Pembaruan Otomatis (Global)",
  "OAuth Auto Swap": "Penggantian OAuth Otomatis",
  "Default CLI Provider": "Penyedia CLI Bawaan",
  Language: "Bahasa",
  Save: "Simpan",
  Saved: "Tersimpan",
  General: "Umum",
  "CLI Tools": "Alat CLI",
  Channel: "Saluran",
  "CEO OFFICE": "KANTOR CEO",
  "6P COLLAB TABLE": "MEJA KOLABORASI 6 ORANG",
  Staff: "Staf",
  Working: "Sedang bekerja",
  "In Progress": "Sedang berjalan",
  Done: "Selesai",
  "Break Room": "☕ Ruang Istirahat",
  "No assigned staff": "Tidak ada staf yang ditugaskan",
  "Meeting live: click table for minutes": "Rapat berlangsung: klik meja untuk melihat notulen",
  Interact: "Berinteraksi",
  "Pending Decisions": "Keputusan Menunggu",
  Refresh: "Segarkan",
  "Loading pending decisions...": "Memuat keputusan yang menunggu...",
  "No pending decisions right now.": "Tidak ada keputusan yang menunggu saat ini.",
  "Project Decision": "Keputusan Proyek",
  "Timeout Resume": "Lanjutkan Tugas Terhenti",
  "Review Round Decision": "Keputusan Putaran Tinjauan",
  "Agent Request": "Permintaan Agen",
  "Open Chat": "Buka Percakapan",
  "Start Team-Lead Meeting": "Mulai Rapat Ketua Tim",
  "Keep Waiting": "Tetap Menunggu",
  "Add Follow-up Request": "Tambahkan Permintaan Lanjutan",
  "Resume Task": "Lanjutkan Tugas",
  "Keep in Inbox": "Tetap di Kotak Masuk",
  "Skip to Next Round": "Lewati ke Putaran Berikutnya",
  "Sending...": "Mengirim...",
  "Run Selected": "Jalankan Pilihan",
  "Additional Follow-up Request": "Permintaan Lanjutan Tambahan",
  "Enter your request details.": "Masukkan detail permintaan.",
  "Submit Request": "Kirim Permintaan",
  "Pick at least one option or enter an extra note.": "Pilih setidaknya satu opsi atau masukkan catatan tambahan.",
  "Planning consolidation complete": "Konsolidasi perencanaan selesai",
  "Planning lead is consolidating opinions...": "Ketua perencanaan sedang menggabungkan pendapat...",
  "Available options now:": "Opsi yang tersedia saat ini:",
  "Choose how to proceed from the options below.": "Pilih cara melanjutkan dari opsi di bawah.",
  "CLI execution failed (spawn claude ENOENT).": "Eksekusi CLI gagal karena penyedia AI tidak tersedia.",
  "CEO, the planning lead consolidated final report has been generated and archived. You can review it from the report popup.":
    "CEO, laporan akhir telah dibuat dan disimpan. Anda dapat meninjaunya melalui jendela laporan.",
  "Task paused after execution failure; checkpoint preserved. Review the report to retry or revise.":
    "Tugas dijeda setelah eksekusi gagal; checkpoint dipertahankan. Buka laporan untuk menjalankan ulang atau merevisi.",
};

function parseLanguage(value?: string | null): UiLanguage | null {
  const code = (value ?? "").toLowerCase().replace("_", "-");
  if (code === "ko" || code.startsWith("ko-")) return "ko";
  if (code === "en" || code.startsWith("en-")) return "en";
  if (code === "ja" || code.startsWith("ja-")) return "ja";
  if (code === "zh" || code.startsWith("zh-")) return "zh";
  if (code === "id" || code.startsWith("id-")) return "id";
  return null;
}

export function normalizeLanguage(value?: string | null): UiLanguage {
  return parseLanguage(value) ?? "en";
}

/** Return the name for the active locale, falling back to English when unavailable. */
export function localeName(
  locale: UiLanguage | string,
  obj: {
    name: string;
    name_ko?: string | null;
    name_ja?: string | null;
    name_zh?: string | null;
    name_id?: string | null;
  },
): string {
  const lang = (typeof locale === "string" ? locale : "en").slice(0, 2);
  if (lang === "ko") return obj.name_ko || obj.name;
  if (lang === "ja") return obj.name_ja || obj.name;
  if (lang === "zh") return obj.name_zh || obj.name;
  if (lang === "id") {
    if (obj.name_id) return obj.name_id;
    const standardNames: Record<string, string> = {
      planning: "Perencanaan",
      development: "Pengembangan",
      design: "Desain",
      "qa/qc": "QA/QC",
      devsecops: "DevSecOps",
      operations: "Operasional",
      research: "Riset",
      marketing: "Pemasaran",
    };
    return standardNames[obj.name.trim().toLowerCase()] || obj.name;
  }
  return obj.name;
}

export function detectBrowserLanguage(): UiLanguage {
  if (typeof window === "undefined") return "en";
  const candidates = [...(window.navigator.languages ?? []), window.navigator.language];
  for (const lang of candidates) {
    const parsed = parseLanguage(lang);
    if (parsed) return parsed;
  }
  return "en";
}

function detectRuntimeLanguage(): UiLanguage {
  if (typeof window === "undefined") return "en";
  let storedLanguage: string | null = null;
  try {
    const storage = window.localStorage as { getItem?: (key: string) => string | null } | undefined;
    if (storage && typeof storage.getItem === "function") {
      storedLanguage = storage.getItem(LANGUAGE_STORAGE_KEY);
    }
  } catch {
    storedLanguage = null;
  }
  return parseLanguage(storedLanguage) ?? detectBrowserLanguage();
}

export function localeFromLanguage(lang: UiLanguage): string {
  switch (lang) {
    case "ko":
      return "ko-KR";
    case "en":
      return "en-US";
    case "ja":
      return "ja-JP";
    case "zh":
      return "zh-CN";
    case "id":
      return "id-ID";
    default:
      return "en-US";
  }
}

export function pickLang(lang: UiLanguage, text: LangText): string {
  switch (lang) {
    case "ko":
      return text.ko;
    case "en":
      return text.en;
    case "ja":
      return text.ja ?? text.en;
    case "zh":
      return text.zh ?? text.en;
    case "id":
      return text.id ?? INDONESIAN_FALLBACKS[text.en] ?? text.en;
    default:
      return text.en;
  }
}

/** Localize common server-generated decision/status phrases kept in message history. */
export function localizeMessageContent(lang: UiLanguage, content: string): string {
  if (lang !== "id" || !content) return content;
  let output = content;
  const replacements: Array<[RegExp, string]> = [
    [/Planning consolidation complete/g, "Konsolidasi perencanaan selesai"],
    [/Planning lead is consolidating opinions\.\.\./g, "Ketua perencanaan sedang menggabungkan pendapat..."],
    [/Available options now:/g, "Opsi yang tersedia saat ini:"],
    [/Choose how to proceed from the options below\./g, "Pilih cara melanjutkan dari opsi di bawah."],
    [/Start Team-Lead Meeting/g, "Mulai Rapat Ketua Tim"],
    [/Add Follow-up Request/g, "Tambahkan Permintaan Lanjutan"],
    [/Open Chat/g, "Buka Percakapan"],
    [/CLI execution failed \(spawn claude ENOENT\)\.?/g, "Eksekusi CLI gagal karena penyedia AI tidak tersedia."],
    [/CLI 실행 중 오류가 발생했습니다 \(spawn claude ENOENT\)\.?/g, "Eksekusi CLI gagal karena penyedia AI tidak tersedia."],
    [/spawn claude ENOENT/g, "penyedia AI tidak tersedia"],
    [/Please reassign the agent or revise the task, then try again\.?/g, "Silakan tetapkan ulang agen atau revisi tugas, lalu coba lagi."],
    [/CEO, the planning lead consolidated final report has been generated and archived\. You can review it from the report popup\./g, "CEO, laporan akhir telah dibuat dan disimpan. Anda dapat meninjaunya melalui jendela laporan."],
    [/Task paused after execution failure; checkpoint preserved\. Review the report to retry or revise\./g, "Tugas dijeda setelah eksekusi gagal; checkpoint dipertahankan. Buka laporan untuk menjalankan ulang atau merevisi."],
    [/failed with an issue \(exit code: -2\)/g, "mengalami masalah (kode keluar: -2)"],
    [/Task '([^']+)' failed \(exit code: -2\)\./g, "Tugas '$1' gagal (kode keluar: -2)."],
  ];
  for (const [pattern, replacement] of replacements) output = output.replace(pattern, replacement);
  return output;
}

export interface I18nContextValue {
  language: UiLanguage;
  locale: string;
  t: (text: TranslationInput) => string;
  __fromProvider?: boolean;
}

const I18nContext = createContext<I18nContextValue>({
  language: "en",
  locale: "en-US",
  t: (text) => (typeof text === "string" ? text : text.en),
  __fromProvider: false,
});

interface I18nProviderProps {
  language?: string | null;
  children: ReactNode;
}

export function I18nProvider({ language, children }: I18nProviderProps) {
  const normalizedLanguage = normalizeLanguage(language);
  const locale = useMemo(() => localeFromLanguage(normalizedLanguage), [normalizedLanguage]);
  const t = useCallback(
    (text: TranslationInput) => (typeof text === "string" ? text : pickLang(normalizedLanguage, text)),
    [normalizedLanguage],
  );

  const value = useMemo(
    () => ({
      language: normalizedLanguage,
      locale,
      t,
      __fromProvider: true,
    }),
    [normalizedLanguage, locale, t],
  );

  return createElement(I18nContext.Provider, { value }, children);
}

export function useI18n(languageOverride?: string | null): I18nContextValue {
  const context = useContext(I18nContext);
  const [runtimeLanguage, setRuntimeLanguage] = useState<UiLanguage>(() => detectRuntimeLanguage());

  useEffect(() => {
    if (context.__fromProvider || typeof window === "undefined") return;
    const sync = () => {
      setRuntimeLanguage(detectRuntimeLanguage());
    };
    window.addEventListener("storage", sync);
    window.addEventListener("climpire-language-change", sync as EventListener);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("climpire-language-change", sync as EventListener);
    };
  }, [context.__fromProvider]);

  const override = useMemo(() => {
    if (typeof languageOverride !== "string" || !languageOverride.trim()) return null;
    return normalizeLanguage(languageOverride);
  }, [languageOverride]);
  const baseLanguage = context.__fromProvider ? context.language : runtimeLanguage;
  const language = override ?? baseLanguage;

  const t = useCallback(
    (text: TranslationInput) => (typeof text === "string" ? text : pickLang(language, text)),
    [language],
  );

  return useMemo(
    () => ({
      language,
      locale: localeFromLanguage(language),
      t,
      __fromProvider: context.__fromProvider,
    }),
    [context.__fromProvider, language, t],
  );
}
