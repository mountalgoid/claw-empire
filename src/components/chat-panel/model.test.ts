import { describe, expect, it } from "vitest";
import type { Agent } from "../../types";
import { findMentionedAgent } from "./model";

const sage = { id: "agent-sage", name: "Sage", name_ko: "세이지" } as Agent;

describe("findMentionedAgent", () => {
  it("resolves a mentioned agent by localized or default name without case sensitivity", () => {
    expect(findMentionedAgent("Please review this, @sage", [sage])).toBe(sage);
    expect(findMentionedAgent("세이지, mohon periksa", [sage])).toBeNull();
    expect(findMentionedAgent("@세이지 mohon periksa", [sage])).toBe(sage);
  });

  it("does not select an agent when no explicit mention is present", () => {
    expect(findMentionedAgent("Sage, please review this", [sage])).toBeNull();
  });
});
