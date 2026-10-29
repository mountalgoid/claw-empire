import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ChatComposer from "./ChatComposer";

describe("ChatComposer announcement controls", () => {
  it("keeps task/report mode buttons usable and offers task execution from an announcement", () => {
    const onModeChange = vi.fn();
    const onExecuteAnnouncement = vi.fn();
    render(
      <ChatComposer
        mode="announcement"
        input="@Sage review this request"
        selectedAgent={null}
        isDirectiveMode={false}
        isAnnouncementMode
        tr={(_ko, en, _ja, _zh, id) => id ?? en}
        getAgentName={() => ""}
        textareaRef={createRef<HTMLTextAreaElement>()}
        onModeChange={onModeChange}
        onInputChange={vi.fn()}
        onSend={vi.fn()}
        onExecuteAnnouncement={onExecuteAnnouncement}
        onKeyDown={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Tugas/ }));
    fireEvent.click(screen.getByRole("button", { name: /Laporan/ }));
    fireEvent.click(screen.getByRole("button", { name: /Kirim dan eksekusi sebagai tugas/ }));

    expect(onModeChange).toHaveBeenNthCalledWith(1, "task");
    expect(onModeChange).toHaveBeenNthCalledWith(2, "report");
    expect(onExecuteAnnouncement).toHaveBeenCalledOnce();
  });
});
