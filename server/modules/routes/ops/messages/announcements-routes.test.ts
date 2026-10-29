import { afterEach, describe, expect, it, vi } from "vitest";
import { registerAnnouncementRoutes } from "./announcements-routes.ts";

describe("announcement mention routing", () => {
  afterEach(() => vi.useRealTimers());

  it("opens direct agent interaction for @mentions without turning it into task delegation", async () => {
    vi.useFakeTimers();
    let route: ((req: any, res: any) => Promise<void>) | undefined;
    const scheduleAgentReply = vi.fn();
    const handleTaskDelegation = vi.fn();
    const findTeamLeader = vi.fn(() => ({ id: "lead-1" }));
    const db = { prepare: vi.fn(() => ({ get: vi.fn(() => ({ id: "agent-1", department_id: "design" })) })) };
    const ctx = {
      app: { post: vi.fn((_path: string, handler: typeof route) => { route = handler; }) },
      db,
      broadcast: vi.fn(),
    } as any;
    const deps = {
      IdempotencyConflictError: class extends Error {},
      StorageBusyError: class extends Error {},
      resolveMessageIdempotencyKey: () => "key-1",
      recordMessageIngressAuditOr503: () => true,
      insertMessageWithIdempotency: vi.fn(async () => ({ message: { id: "message-1", content: "@Sage check this" }, created: true })),
      recordAcceptedIngressAuditOrRollback: vi.fn(async () => true),
      scheduleAnnouncementReplies: vi.fn(),
      detectMentions: () => ({ deptIds: [], agentIds: ["agent-1"] }),
      scheduleAgentReply,
      findTeamLeader,
      handleTaskDelegation,
    } as any;
    registerAnnouncementRoutes(ctx, deps);
    const response = { status: vi.fn(function (this: any) { return this; }), json: vi.fn() };

    await route?.({ body: { content: "@Sage check this" } }, response);
    await vi.advanceTimersByTimeAsync(8000);

    expect(scheduleAgentReply).toHaveBeenCalledWith("agent-1", "@Sage check this", "chat");
    expect(handleTaskDelegation).not.toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });
});
