import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTaskPreviewArtifacts, manageTaskArtifact } from "../api";
import AssetLibrary from "./AssetLibrary";
import type { Task } from "../types";

vi.mock("../api", () => ({
  getTaskPreviewArtifacts: vi.fn(),
  manageTaskArtifact: vi.fn(),
}));

const fetchArtifacts = vi.mocked(getTaskPreviewArtifacts);
const manageArtifact = vi.mocked(manageTaskArtifact);

function makeTask(id: string, title: string, sourceTaskId: string | null = null): Task {
  return {
    id,
    title,
    description: null,
    department_id: null,
    assigned_agent_id: null,
    project_id: "project-1",
    project_name: "Studio Konten",
    status: "done",
    priority: 1,
    task_type: "general",
    project_path: "/projects/studio-konten",
    result: null,
    started_at: null,
    completed_at: 10,
    created_at: 1,
    updated_at: 10,
    source_task_id: sourceTaskId,
  };
}

describe("AssetLibrary", () => {
  beforeEach(() => {
    fetchArtifacts.mockReset();
    manageArtifact.mockReset();
    manageArtifact.mockResolvedValue();
    fetchArtifacts.mockResolvedValue([
      {
        name: "poster.png",
        path: "content/week-01/poster.png",
        kind: "image",
        mime: "image/png",
        size_bytes: 2048,
        url: "/api/tasks/root-task/preview/content/week-01/poster.png",
      },
    ]);
  });

  it("organizes assets under project and task names, loading files on demand", async () => {
    render(<AssetLibrary tasks={[makeTask("root-task", "Konten Minggu Pertama"), makeTask("child-task", "Desain Poster", "root-task")]} uiLanguage="id" />);

    expect(screen.getByText("Pustaka proyek")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Studio Konten/ }));
    expect(screen.getByText("Konten Minggu Pertama")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Konten Minggu Pertama/ }));
    expect(screen.getByText("Desain Poster")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("poster.png")).toBeInTheDocument());
    expect(screen.getByText("content/week-01")).toBeInTheDocument();
    expect(fetchArtifacts).toHaveBeenCalledWith("root-task");
  });

  it("lets the CEO rename, move and delete generated files", async () => {
    render(<AssetLibrary tasks={[makeTask("root-task", "Konten Minggu Pertama")]} uiLanguage="id" />);
    fireEvent.click(screen.getByRole("button", { name: /Studio Konten/ }));
    fireEvent.click(screen.getByRole("button", { name: /Konten Minggu Pertama/ }));
    await screen.findByText("poster.png");

    fireEvent.click(screen.getByRole("button", { name: "Kelola" }));
    fireEvent.change(screen.getByLabelText("Path aset baru"), { target: { value: "content/week-01/cover.png" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan" }));
    await waitFor(() => expect(manageArtifact).toHaveBeenCalledWith({
      taskId: "root-task",
      operation: "rename",
      source: "task",
      path: "content/week-01/poster.png",
      destination: "content/week-01/cover.png",
    }));

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Hapus" }));
    await waitFor(() => expect(manageArtifact).toHaveBeenLastCalledWith({
      taskId: "root-task",
      operation: "delete",
      source: "task",
      path: "content/week-01/poster.png",
    }));
    confirmSpy.mockRestore();
  });
});
