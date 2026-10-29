import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../i18n";
import { getTaskPreviewArtifacts } from "../api";
import TaskReportPopup from "./TaskReportPopup";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return { ...actual, getTaskPreviewArtifacts: vi.fn().mockResolvedValue([]) };
});

const baseReport = {
  task: {
    id: "task-1",
    title: "Ship feature",
    description: null,
    department_id: "planning",
    assigned_agent_id: "agent-1",
    status: "done",
    project_path: "/tmp/project",
    created_at: 1000,
    completed_at: 2000,
    agent_name: "Ari",
    agent_name_ko: "아리",
    agent_role: "team_leader",
    dept_name: "Planning",
    dept_name_ko: "기획팀",
  },
  logs: [
    { kind: "system", message: "Final branch verification: passed (ref=main, commits=1, files=1)", created_at: 1500 },
  ],
  subtasks: [],
  meeting_minutes: [],
  planning_summary: {
    title: "Planning Lead Consolidated Summary",
    content: "Summary body",
    source_task_id: "task-1",
    source_agent_name: "Ari",
    source_department_name: "Planning",
    generated_at: 1600,
    documents: [],
  },
  team_reports: [],
  project: {
    root_task_id: "task-1",
    project_name: "Project",
    project_path: "/tmp/project",
    core_goal: "Goal",
  },
};

describe("TaskReportPopup", () => {
  beforeEach(() => vi.mocked(getTaskPreviewArtifacts).mockResolvedValue([]));
  afterEach(() => vi.restoreAllMocks());

  it("shows final branch verification logs in the report popup", () => {
    render(
      <I18nProvider language="en">
        <TaskReportPopup
          report={baseReport as any}
          agents={[{ id: "agent-1", name: "Ari", name_ko: "아리", avatar_emoji: "A" } as any]}
          departments={[{ id: "planning", name: "Planning", name_ko: "기획팀", color: "#00aa88", icon: "P" } as any]}
          uiLanguage="en"
          onClose={() => {}}
        />
      </I18nProvider>,
    );

    expect(screen.getByText("Final Branch Verification")).toBeInTheDocument();
    expect(screen.getByText(/Final branch verification: passed/)).toBeInTheDocument();
  });

  it("keeps a sprite avatar when the assigned agent is missing from the active agent list", () => {
    render(
      <I18nProvider language="en">
        <TaskReportPopup report={baseReport as any} agents={[]} departments={[]} uiLanguage="en" onClose={() => {}} />
      </I18nProvider>,
    );

    expect(screen.getByAltText("Ari")).toBeInTheDocument();
  });

  it("opens generated image and video assets instead of only the text report", async () => {
    vi.mocked(getTaskPreviewArtifacts).mockResolvedValue([
      {
        name: "poster.png",
        path: "content/poster.png",
        source: "project",
        kind: "image",
        mime: "image/png",
        size_bytes: 1200,
        url: "/api/tasks/task-1/preview/content/poster.png?source=project",
      },
      {
        name: "reel.mp4",
        path: "content/reel.mp4",
        source: "project",
        kind: "video",
        mime: "video/mp4",
        size_bytes: 2400,
        url: "/api/tasks/task-1/preview/content/reel.mp4?source=project",
      },
    ]);
    const popup = {
      opener: window,
      location: { href: "" },
      document: { open: vi.fn(), write: vi.fn(), close: vi.fn() },
    } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(popup);

    render(
      <I18nProvider language="en">
        <TaskReportPopup
          report={baseReport as any}
          agents={[]}
          departments={[]}
          uiLanguage="en"
          onClose={() => {}}
          onRunTask={async () => {}}
        />
      </I18nProvider>,
    );

    await waitFor(() => expect(getTaskPreviewArtifacts).toHaveBeenCalledWith("task-1"));
    fireEvent.click(screen.getByRole("button", { name: "Open result" }));
    await waitFor(() => expect(popup.document.write).toHaveBeenCalled());
    const gallery = vi.mocked(popup.document.write).mock.calls[0][0] as string;
    expect(gallery).toContain("<img");
    expect(gallery).toContain("<video");
    expect(gallery).toContain("poster.png");
    expect(gallery).toContain("reel.mp4");
  });

  it("does not start a revision when saving the CEO instruction fails", async () => {
    const onUpdateTask = vi.fn().mockRejectedValue(new Error("save rejected"));
    const onRunTask = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <I18nProvider language="en">
        <TaskReportPopup
          report={baseReport as any}
          agents={[]}
          departments={[]}
          uiLanguage="en"
          onClose={onClose}
          onUpdateTask={onUpdateTask}
          onRunTask={onRunTask}
        />
      </I18nProvider>,
    );

    fireEvent.change(screen.getByPlaceholderText("Optional: describe what should be revised..."), {
      target: { value: "Replace the placeholder image with the real product asset." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revise & run" }));

    expect(await screen.findByText("save rejected")).toBeInTheDocument();
    expect(onRunTask).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
