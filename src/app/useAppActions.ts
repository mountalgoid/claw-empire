import { useCallback, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import * as api from "../api";
import { buildDecisionInboxItems } from "../components/chat/decision-inbox";
import type { DecisionInboxItem } from "../components/chat/decision-inbox";
import { LANGUAGE_USER_SET_STORAGE_KEY, normalizeLanguage, pickLang } from "../i18n";
import { normalizeOfficeWorkflowPack } from "./office-workflow-pack";
import type {
  Agent,
  CliStatusMap,
  CompanySettings,
  CompanyStats,
  Department,
  Message,
  Task,
  WorkflowPackKey,
} from "../types";
import { mapWorkflowDecisionItemsLocalized } from "./decision-inbox";
import { mergeSettingsWithDefaults, syncClientLanguage } from "./utils";
import type { ProjectMetaPayload } from "./types";

interface UseAppActionsParams {
  agents: Agent[];
  settings: CompanySettings;
  scheduleLiveSync: (delayMs?: number) => void;
  setSettings: Dispatch<SetStateAction<CompanySettings>>;
  setAgents: Dispatch<SetStateAction<Agent[]>>;
  setDepartments: Dispatch<SetStateAction<Department[]>>;
  setTasks: Dispatch<SetStateAction<Task[]>>;
  setStats: Dispatch<SetStateAction<CompanyStats | null>>;
  setMessages: Dispatch<SetStateAction<Message[]>>;
  setChatAgent: Dispatch<SetStateAction<Agent | null>>;
  setShowChat: Dispatch<SetStateAction<boolean>>;
  setUnreadAgentIds: Dispatch<SetStateAction<Set<string>>>;
  setShowDecisionInbox: Dispatch<SetStateAction<boolean>>;
  setDecisionInboxLoading: Dispatch<SetStateAction<boolean>>;
  setDecisionInboxItems: Dispatch<SetStateAction<DecisionInboxItem[]>>;
  setDecisionReplyBusyKey: Dispatch<SetStateAction<string | null>>;
  setCliStatus: Dispatch<SetStateAction<CliStatusMap | null>>;
  setActionNotice: Dispatch<SetStateAction<{ tone: "info" | "error"; message: string } | null>>;
}

export function useAppActions({
  agents,
  settings,
  scheduleLiveSync,
  setSettings,
  setAgents,
  setDepartments,
  setTasks,
  setStats,
  setMessages,
  setChatAgent,
  setShowChat,
  setUnreadAgentIds,
  setShowDecisionInbox,
  setDecisionInboxLoading,
  setDecisionInboxItems,
  setDecisionReplyBusyKey,
  setCliStatus,
  setActionNotice,
}: UseAppActionsParams) {
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const settingsSaveRequestSeqRef = useRef(0);

  const handleSendMessage = useCallback(
    async (
      content: string,
      receiverType: "agent" | "department" | "all",
      receiverId?: string,
      messageType?: string,
      projectMeta?: ProjectMetaPayload,
    ) => {
      try {
        if (messageType === "task_assign" || messageType === "report") {
          const lang = normalizeLanguage(settingsRef.current.language);
          setActionNotice({
            tone: "info",
            message: pickLang(lang, {
              ko: "업무 지시를 팀에 전달하는 중입니다...",
              en: "Sending the task instruction to the team...",
              ja: "チームにタスク指示を送信しています...",
              zh: "正在向团队发送任务指令...",
              id: "Mengirim instruksi tugas ke tim...",
            }),
          });
        }
        await api.sendMessage({
          receiver_type: receiverType,
          receiver_id: receiverId,
          content,
          message_type: (messageType as "chat" | "task_assign" | "report") || "chat",
          project_id: projectMeta?.project_id,
          project_path: projectMeta?.project_path,
          project_context: projectMeta?.project_context,
        });
        const msgs = await api.getMessages({ receiver_type: receiverType, receiver_id: receiverId, limit: 50 });
        setMessages(msgs);
        if (messageType === "task_assign") {
          const lang = normalizeLanguage(settingsRef.current.language);
          setActionNotice({
            tone: "info",
            message: pickLang(lang, {
              ko: "업무 지시가 전달되었습니다. 팀의 실행 응답을 기다리는 중입니다.",
              en: "Task instruction sent. Waiting for the team's execution response.",
              ja: "タスク指示を送信しました。チームの実行応答を待っています。",
              zh: "任务指令已发送，正在等待团队执行响应。",
              id: "Instruksi tugas sudah dikirim. Menunggu respons eksekusi tim.",
            }),
          });
        }
      } catch (error) {
        console.error("Send message failed:", error);
        const lang = normalizeLanguage(settingsRef.current.language);
        setActionNotice({
          tone: "error",
          message: pickLang(lang, {
            ko: "업무 지시 전송에 실패했습니다.",
            en: "Failed to send the task instruction.",
            ja: "タスク指示の送信に失敗しました。",
            zh: "任务指令发送失败。",
            id: "Instruksi tugas gagal dikirim.",
          }),
        });
      }
    },
    [setActionNotice, setMessages],
  );

  const handleSendAnnouncement = useCallback(async (content: string) => {
    try {
      await api.sendAnnouncement(content);
    } catch (error) {
      console.error("Announcement failed:", error);
    }
  }, []);

  const handleSendDirective = useCallback(async (content: string, projectMeta?: ProjectMetaPayload) => {
    try {
      if (projectMeta?.project_id || projectMeta?.project_path || projectMeta?.project_context) {
        await api.sendDirectiveWithProject({
          content,
          project_id: projectMeta.project_id,
          project_path: projectMeta.project_path,
          project_context: projectMeta.project_context,
        });
      } else {
        await api.sendDirective(content);
      }
    } catch (error) {
      console.error("Directive failed:", error);
    }
  }, []);

  const handleCreateTask = useCallback(
    async (input: {
      title: string;
      description?: string;
      department_id?: string;
      task_type?: string;
      priority?: number;
      project_id?: string;
      project_path?: string;
      assigned_agent_id?: string;
      workflow_pack_key?: WorkflowPackKey;
    }) => {
      try {
        const lang = normalizeLanguage(settingsRef.current.language);
        setActionNotice({
          tone: "info",
          message: pickLang(lang, {
            ko: "업무를 접수했습니다. 자동 실행을 준비하는 중입니다...",
            en: "Task received. Preparing automatic execution...",
            ja: "タスクを受け付けました。自動実行を準備しています...",
            zh: "任务已接收，正在准备自动执行...",
            id: "Tugas diterima. Menyiapkan eksekusi otomatis...",
          }),
        });
        await api.createTask(input as Parameters<typeof api.createTask>[0]);
        const tks = await api.getTasks();
        setTasks(tks);
        const sts = await api.getStats();
        setStats(sts);
        setActionNotice({
          tone: "info",
          message: pickLang(lang, {
            ko: "업무가 등록되었고 팀 실행이 시작되었습니다. 진행 상황은 Task Board에서 확인할 수 있습니다.",
            en: "Task registered and team execution started. Track progress on the Task Board.",
            ja: "タスクを登録し、チームの実行を開始しました。Task Boardで進捗を確認できます。",
            zh: "任务已登记并开始团队执行，可在任务看板查看进度。",
            id: "Tugas terdaftar dan eksekusi tim dimulai. Pantau progres di Papan Tugas.",
          }),
        });
      } catch (error) {
        console.error("Create task failed:", error);
        const lang = normalizeLanguage(settingsRef.current.language);
        setActionNotice({
          tone: "error",
          message: pickLang(lang, {
            ko: "업무 등록 또는 실행 시작에 실패했습니다.",
            en: "Task registration or execution startup failed.",
            ja: "タスクの登録または実行開始に失敗しました。",
            zh: "任务登记或执行启动失败。",
            id: "Pendaftaran tugas atau awal eksekusi gagal.",
          }),
        });
        throw error;
      }
    },
    [setActionNotice, setTasks, setStats],
  );

  const handleUpdateTask = useCallback(
    async (id: string, data: Partial<Task>) => {
      try {
        await api.updateTask(id, data);
        const tks = await api.getTasks();
        setTasks(tks);
      } catch (error) {
        console.error("Update task failed:", error);
      }
    },
    [setTasks],
  );

  const handleDeleteTask = useCallback(
    async (id: string) => {
      try {
        await api.deleteTask(id);
        setTasks((prev) => prev.filter((task) => task.id !== id));
      } catch (error) {
        console.error("Delete task failed:", error);
      }
    },
    [setTasks],
  );

  const refreshTasksAndAgents = useCallback(async () => {
    const activePack = normalizeOfficeWorkflowPack(settings.officeWorkflowPack ?? "development");
    const includeSeedAgents = activePack !== "development";
    const [tks, ags] = await Promise.all([api.getTasks(), api.getAgents({ includeSeed: includeSeedAgents })]);
    setTasks(tks);
    setAgents(ags);
  }, [setTasks, setAgents, settings.officeWorkflowPack]);

  const handleAssignTask = useCallback(
    async (taskId: string, agentId: string) => {
      try {
        await api.assignTask(taskId, agentId);
        await refreshTasksAndAgents();
      } catch (error) {
        console.error("Assign task failed:", error);
      }
    },
    [refreshTasksAndAgents],
  );

  const handleRunTask = useCallback(
    async (id: string) => {
      try {
        await api.runTask(id);
        await refreshTasksAndAgents();
      } catch (error) {
        console.error("Run task failed:", error);
      }
    },
    [refreshTasksAndAgents],
  );

  const handleStopTask = useCallback(
    async (id: string) => {
      try {
        await api.stopTask(id);
        await refreshTasksAndAgents();
      } catch (error) {
        console.error("Stop task failed:", error);
      }
    },
    [refreshTasksAndAgents],
  );

  const handlePauseTask = useCallback(
    async (id: string) => {
      try {
        await api.pauseTask(id);
        await refreshTasksAndAgents();
      } catch (error) {
        console.error("Pause task failed:", error);
      }
    },
    [refreshTasksAndAgents],
  );

  const handleResumeTask = useCallback(
    async (id: string) => {
      try {
        await api.resumeTask(id);
        await refreshTasksAndAgents();
      } catch (error) {
        console.error("Resume task failed:", error);
      }
    },
    [refreshTasksAndAgents],
  );

  const handleSaveSettings = useCallback(
    async (nextInput: CompanySettings) => {
      const previousSettings = settings;
      const nextSettings = mergeSettingsWithDefaults(nextInput);
      const autoUpdateChanged = Boolean(nextSettings.autoUpdateEnabled) !== Boolean(settings.autoUpdateEnabled);
      const saveRequestSeq = (settingsSaveRequestSeqRef.current += 1);
      const attemptedSnapshot = JSON.stringify(nextSettings);
      setSettings(nextSettings);
      syncClientLanguage(nextSettings.language);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LANGUAGE_USER_SET_STORAGE_KEY, "1");
      }
      try {
        await api.saveSettings(nextSettings);
        if (autoUpdateChanged) {
          try {
            await api.setAutoUpdateEnabled(Boolean(nextSettings.autoUpdateEnabled));
          } catch (syncErr) {
            console.error("Auto update runtime sync failed:", syncErr);
          }
        }
      } catch (error) {
        const isLatestRequest = settingsSaveRequestSeqRef.current === saveRequestSeq;
        const currentSnapshot = JSON.stringify(settingsRef.current);
        if (isLatestRequest && currentSnapshot === attemptedSnapshot) {
          setSettings(previousSettings);
          syncClientLanguage(previousSettings.language);
        }
        console.error("Save settings failed:", error);
      }
    },
    [settings, setSettings],
  );

  const handleDismissAutoUpdateNotice = useCallback(async () => {
    if (!settings.autoUpdateNoticePending) return;
    setSettings((prev) => ({ ...prev, autoUpdateNoticePending: false }));
    try {
      await api.saveSettingsPatch({ autoUpdateNoticePending: false });
    } catch (error) {
      console.error("Failed to persist auto-update notice dismissal:", error);
    }
  }, [settings.autoUpdateNoticePending, setSettings]);

  const handleOpenChat = useCallback(
    (agent: Agent) => {
      setChatAgent(agent);
      setShowChat(true);
      setUnreadAgentIds((prev) => {
        if (!prev.has(agent.id)) return prev;
        const next = new Set(prev);
        next.delete(agent.id);
        return next;
      });
      api
        .getMessages({ receiver_type: "agent", receiver_id: agent.id, limit: 50 })
        .then(setMessages)
        .catch(console.error);
    },
    [setChatAgent, setShowChat, setUnreadAgentIds, setMessages],
  );

  const loadDecisionInbox = useCallback(async () => {
    setDecisionInboxLoading(true);
    try {
      const [allMessages, workflowDecisionItems] = await Promise.all([
        api.getMessages({ limit: 500 }),
        api.getDecisionInbox(),
      ]);
      const agentDecisionItems = buildDecisionInboxItems(allMessages, agents);
      const workflowItems = mapWorkflowDecisionItemsLocalized(workflowDecisionItems, settings.language);
      const merged = [...workflowItems, ...agentDecisionItems];
      const deduped = new Map<string, DecisionInboxItem>();
      for (const item of merged) deduped.set(item.id, item);
      setDecisionInboxItems(Array.from(deduped.values()).sort((a, b) => b.createdAt - a.createdAt));
    } catch (error) {
      console.error("Load decision inbox failed:", error);
    } finally {
      setDecisionInboxLoading(false);
    }
  }, [agents, settings.language, setDecisionInboxLoading, setDecisionInboxItems]);

  const handleOpenDecisionInbox = useCallback(() => {
    setShowDecisionInbox(true);
    void loadDecisionInbox();
  }, [loadDecisionInbox, setShowDecisionInbox]);

  const handleOpenDecisionChat = useCallback(
    (agentId: string) => {
      const matchedAgent = agents.find((agent) => agent.id === agentId);
      if (!matchedAgent) {
        window.alert(
          pickLang(normalizeLanguage(settings.language), {
            ko: "요청 에이전트 정보를 찾지 못했습니다.",
            en: "Could not find the requested agent.",
            ja: "対象エージェント情報が見つかりません。",
            zh: "未找到对应代理信息。",
          }),
        );
        return;
      }
      setShowDecisionInbox(false);
      handleOpenChat(matchedAgent);
    },
    [agents, settings.language, setShowDecisionInbox, handleOpenChat],
  );

  const handleReplyDecisionOption = useCallback(
    async (
      item: DecisionInboxItem,
      optionNumber: number,
      payloadInput?: { note?: string; selected_option_numbers?: number[] },
    ) => {
      const option = item.options.find((entry) => entry.number === optionNumber);
      if (!option) return;
      const busyKey = `${item.id}:${option.number}`;
      setDecisionReplyBusyKey(busyKey);
      const locale = normalizeLanguage(settings.language);
      try {
        if (item.kind === "agent_request") {
          if (!item.agentId) return;
          const replyContent = pickLang(locale, {
            ko: `[의사결정 회신] ${option.number}번으로 진행해 주세요. (${option.label})`,
            en: `[Decision Reply] Please proceed with option ${option.number}. (${option.label})`,
            ja: `[意思決定返信] ${option.number}番で進めてください。(${option.label})`,
            zh: `[决策回复] 请按选项 ${option.number} 推进。（${option.label}）`,
          });
          await api.sendMessage({
            receiver_type: "agent",
            receiver_id: item.agentId,
            content: replyContent,
            message_type: "chat",
            task_id: item.taskId ?? undefined,
          });
          setDecisionInboxItems((prev) => prev.filter((entry) => entry.id !== item.id));
        } else {
          const selectedAction = option.action ?? "";
          let payload: { note?: string; target_task_id?: string; selected_option_numbers?: number[] } | undefined;
          if (selectedAction === "add_followup_request") {
            const note = payloadInput?.note?.trim() ?? "";
            if (!note) {
              window.alert(
                pickLang(locale, {
                  ko: "추가요청사항이 비어 있습니다.",
                  en: "Additional request is empty.",
                  ja: "追加要請が空です。",
                  zh: "追加请求内容为空。",
                }),
              );
              return;
            }
            payload = { note, ...(item.taskId ? { target_task_id: item.taskId } : {}) };
          } else if (item.kind === "review_round_pick") {
            const selectedOptionNumbers = payloadInput?.selected_option_numbers;
            const note = payloadInput?.note?.trim() ?? "";
            payload = {
              ...(note ? { note } : {}),
              ...(Array.isArray(selectedOptionNumbers) ? { selected_option_numbers: selectedOptionNumbers } : {}),
            };
          }
          const replyResult = await api.replyDecisionInbox(item.id, optionNumber, payload);
          if (replyResult.action === "start_project_review_blocked") {
            const blockedLines = (replyResult.blocked_tasks ?? [])
              .slice(0, 3)
              .map((entry) => `- ${entry.title} (${entry.reason})`);
            const blockedSummary =
              blockedLines.length > 0
                ? `\n\n${blockedLines.join("\n")}`
                : pickLang(locale, {
                    ko: "\n\n세부 사유는 태스크 로그를 확인해 주세요.",
                    en: "\n\nCheck task logs for details.",
                    ja: "\n\n詳細はタスクログを確認してください。",
                    zh: "\n\n请查看任务日志了解详情。",
                  });
            window.alert(
              pickLang(locale, {
                ko: `팀장 회의 시작이 보류되었습니다. 필요한 게이트를 먼저 해소해 주세요.${blockedSummary}`,
                en: `Team-lead meeting start is on hold. Resolve required gates first.${blockedSummary}`,
                ja: `チームリーダー会議の開始は保留です。先に必要なゲートを解消してください。${blockedSummary}`,
                zh: `组长评审会议暂缓启动。请先解决必要门禁。${blockedSummary}`,
              }),
            );
          }
          if (replyResult.resolved) {
            setDecisionInboxItems((prev) => prev.filter((entry) => entry.id !== item.id));
            scheduleLiveSync(40);
          }
          await loadDecisionInbox();
        }
      } catch (error) {
        console.error("Decision reply failed:", error);
        window.alert(
          pickLang(locale, {
            ko: "의사결정 회신 전송에 실패했습니다. 잠시 후 다시 시도해 주세요.",
            en: "Failed to send decision reply. Please try again.",
            ja: "意思決定返信の送信に失敗しました。もう一度お試しください。",
            zh: "发送决策回复失败，请稍后重试。",
          }),
        );
      } finally {
        setDecisionReplyBusyKey((prev) => (prev === busyKey ? null : prev));
      }
    },
    [settings.language, setDecisionReplyBusyKey, setDecisionInboxItems, scheduleLiveSync, loadDecisionInbox],
  );

  const handleAgentsChange = useCallback(() => {
    const activePack = normalizeOfficeWorkflowPack(settings.officeWorkflowPack ?? "development");
    const includeSeedAgents = activePack !== "development";
    api.getAgents({ includeSeed: includeSeedAgents }).then(setAgents).catch(console.error);
    api.getDepartments({ workflowPackKey: activePack }).then(setDepartments).catch(console.error);
    api.getTasks().then(setTasks).catch(console.error);
  }, [setAgents, setDepartments, setTasks, settings.officeWorkflowPack]);

  const handleRefreshCli = useCallback(async () => {
    const status = await api.getCliStatus(true);
    setCliStatus(status);
  }, [setCliStatus]);

  const handleOpenAnnouncement = useCallback(() => {
    setChatAgent(null);
    setShowChat(true);
    api.getMessages({ receiver_type: "all", limit: 50 }).then(setMessages).catch(console.error);
  }, [setChatAgent, setShowChat, setMessages]);

  const handleClearMessages = useCallback(
    async (agentId?: string) => {
      try {
        await api.clearMessages(agentId);
        setMessages([]);
      } catch (error) {
        console.error("Clear messages failed:", error);
      }
    },
    [setMessages],
  );

  return {
    handleSendMessage,
    handleSendAnnouncement,
    handleSendDirective,
    handleCreateTask,
    handleUpdateTask,
    handleDeleteTask,
    handleAssignTask,
    handleRunTask,
    handleStopTask,
    handlePauseTask,
    handleResumeTask,
    handleSaveSettings,
    handleDismissAutoUpdateNotice,
    handleOpenChat,
    loadDecisionInbox,
    handleOpenDecisionInbox,
    handleOpenDecisionChat,
    handleReplyDecisionOption,
    handleAgentsChange,
    handleRefreshCli,
    handleOpenAnnouncement,
    handleClearMessages,
  };
}
