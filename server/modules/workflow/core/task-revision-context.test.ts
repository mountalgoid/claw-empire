import { describe, expect, it } from "vitest";
import {
  buildTaskRevisionContext,
  buildTaskRevisionDepartmentPolicy,
  extractTaskRevisionRequests,
} from "./task-revision-context.ts";

describe("task revision execution context", () => {
  it("promotes CEO revision requests to required implementation and verification criteria", () => {
    const taskText = [
      "Original task: Create a product page.",
      "[REVISION REQUEST]\nFix the mobile navigation overlap.\n[/REVISION REQUEST]",
      "[REVISION REQUEST]\nMake the price selector update the displayed total.\n[/REVISION REQUEST]",
    ].join("\n\n");

    const context = buildTaskRevisionContext(taskText);

    expect(context).toContain("REQUIRED FOR THIS RUN");
    expect(context).toContain("implement the requested changes");
    expect(context).toContain("Fix the mobile navigation overlap.");
    expect(context).toContain("Make the price selector update the displayed total.");
    expect(context).toContain("Latest request to address first:\nMake the price selector update the displayed total.");
    expect(context).toContain("If the output is unchanged");
  });

  it("adds no revision block when a task has no revision request", () => {
    expect(buildTaskRevisionContext("Create a product page.")).toBe("");
  });

  it("recognizes revisions and overrides planning-only department restrictions", () => {
    const description =
      "Plan content.\n[REVISION REQUEST]\nFix the candle chart spacing in the generated images.\n[/REVISION REQUEST]";

    expect(extractTaskRevisionRequests(description)).toEqual(["Fix the candle chart spacing in the generated images."]);
    expect(buildTaskRevisionDepartmentPolicy(description)).toContain("not permission to refuse");
    expect(buildTaskRevisionDepartmentPolicy(description)).toContain("actual existing output");
  });

  it("does not override department scope for ordinary tasks", () => {
    expect(buildTaskRevisionDepartmentPolicy("Create a content strategy.")).toBe("");
  });
});
