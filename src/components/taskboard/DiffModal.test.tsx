import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { I18nProvider } from "../../i18n";
import DiffModal from "./DiffModal";
import type { DirectiveSummary, TaskDirectiveContext } from "./directive-progress";

const apiMocks = vi.hoisted(() => ({
  getTaskDiff: vi.fn(),
  getTaskVerifyCommit: vi.fn(),
  mergeTask: vi.fn(),
  discardTask: vi.fn(),
}));

vi.mock("../../api", () => ({
  getTaskDiff: apiMocks.getTaskDiff,
  getTaskVerifyCommit: apiMocks.getTaskVerifyCommit,
  mergeTask: apiMocks.mergeTask,
  discardTask: apiMocks.discardTask,
}));

describe("DiffModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.getTaskDiff.mockResolvedValue({
      ok: true,
      hasWorktree: true,
      branchName: "climpire/test",
      stat: "1 file changed",
      diff: "diff --git a/a b/a",
    });
    apiMocks.getTaskVerifyCommit.mockResolvedValue({
      ok: true,
      hasWorktree: true,
      verdict: "ok",
      commitCount: 1,
      compareRef: "main",
      files: ["src/verify.ts"],
      uncommittedFiles: [],
      hasUncommittedChanges: false,
      hasRealCode: true,
    });
    apiMocks.mergeTask.mockResolvedValue({ ok: true, message: "merged" });
    apiMocks.discardTask.mockResolvedValue({ ok: true, message: "discarded" });
  });

  it("renders final branch verification status from verify-commit", async () => {
    render(
      <I18nProvider language="en">
        <DiffModal taskId="task-1" onClose={vi.fn()} />
      </I18nProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Final Branch Verification")).toBeInTheDocument();
    });

    expect(screen.getByText("Passed")).toBeInTheDocument();
    expect(screen.getByText("1 commit")).toBeInTheDocument();
    expect(screen.getByText("src/verify.ts")).toBeInTheDocument();
    expect(apiMocks.getTaskVerifyCommit).toHaveBeenCalledWith("task-1");
  });

  function rootDirective(readiness: DirectiveSummary["readiness"]): TaskDirectiveContext {
    const counts = {
      integrated: 1,
      awaiting_approval: readiness === "ready_for_approval" ? 1 : 0,
      working: readiness === "not_ready" ? 1 : 0,
      waiting: 0,
      queued: 0,
      conflict: 0,
      blocked: 0,
    };
    return {
      branch: "climpire/d-task-1",
      isRoot: true,
      part: null,
      summary: {
        rootTaskId: "task-1",
        branch: "climpire/d-task-1",
        parts: [{}, {}] as DirectiveSummary["parts"],
        lanes: [],
        counts,
        revisionTotal: 0,
        revisionIntegrated: 0,
        childTaskCount: 2,
        parallelLaneCount: 0,
        readiness,
      },
    };
  }

  it("holds the single directive approval until every part is ready", async () => {
    render(
      <I18nProvider language="en">
        <DiffModal taskId="task-1" directive={rootDirective("not_ready")} onClose={vi.fn()} />
      </I18nProvider>,
    );

    await waitFor(() => expect(screen.getByText("Final Branch Verification")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Approve directive" })).toBeDisabled();
    expect(screen.getByText("Approval on hold: 1 part(s) are not ready to integrate yet.")).toBeInTheDocument();
  });

  it("does not offer a separate approval for a child part", async () => {
    render(
      <I18nProvider language="en">
        <DiffModal
          taskId="child-1"
          directive={{ branch: "climpire/d-task-1", isRoot: false, part: null, summary: null }}
          onClose={vi.fn()}
        />
      </I18nProvider>,
    );

    await waitFor(() => expect(screen.getByText("Final Branch Verification")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Approve directive" })).not.toBeInTheDocument();
    expect(screen.getByText(/integrates with the root directive's single CEO approval/)).toBeInTheDocument();
  });

  it("shows conflict files, the owner and a retry action when integration conflicts", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    apiMocks.mergeTask.mockResolvedValueOnce({ ok: false, message: "conflict", conflicts: ["src/a.ts"] });
    render(
      <I18nProvider language="en">
        <DiffModal taskId="task-1" directive={rootDirective("ready_for_approval")} ownerName="Bolt" onClose={vi.fn()} />
      </I18nProvider>,
    );

    await waitFor(() => expect(screen.getByRole("button", { name: "Approve directive" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Approve directive" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Integration conflict: the directive branch was not changed.");
    expect(alert).toHaveTextContent("src/a.ts");
    expect(alert).toHaveTextContent("Bolt resolves these in the retained worktree");

    apiMocks.mergeTask.mockResolvedValueOnce({ ok: true, message: "integrated" });
    fireEvent.click(screen.getByRole("button", { name: /Retry integration/ }));
    expect(await screen.findByRole("status")).toHaveTextContent("Integrated into climpire/d-task-1.");
    expect(apiMocks.mergeTask).toHaveBeenCalledTimes(2);
  });
});
