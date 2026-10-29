const REVISION_BLOCK = /\[REVISION REQUEST\]([\s\S]*?)\[\/REVISION REQUEST\]/gi;

export function extractTaskRevisionRequests(taskText: string): string[] {
  return [...taskText.matchAll(REVISION_BLOCK)].map((match) => match[1].trim()).filter(Boolean);
}

export function buildTaskRevisionDepartmentPolicy(taskText: string): string {
  if (extractTaskRevisionRequests(taskText).length === 0) return "";

  return [
    "[CEO REVISION OVERRIDES DEPARTMENTAL SCOPE]",
    "The assigned department is a specialty hint, not permission to refuse or replace the CEO's requested deliverable changes with planning/documentation only.",
    "Implement the requested changes to the actual existing output, including media/design/code where applicable, and verify the changed files.",
    "If a change genuinely requires another specialist, use the supported team delegation workflow and keep this task open until that work is integrated and verified.",
    "Do not report the revision complete while only writing a brief, plan, or README in place of the requested changed deliverable.",
  ].join("\n");
}

export function buildTaskRevisionContext(taskText: string): string {
  const requests = extractTaskRevisionRequests(taskText);
  if (!requests.length) return "";

  const latest = requests[requests.length - 1];
  const requestList = requests.map((request, index) => `${index + 1}. ${request}`).join("\n");
  return [
    "[CEO REVISION REQUESTS — REQUIRED FOR THIS RUN]",
    "The CEO has explicitly requested changes to the existing deliverable. Do not only summarize, re-plan, or repeat the previous result.",
    "Inspect the current files and prior output, implement the requested changes in the project, then run relevant checks and verify the actual updated deliverable against each request.",
    "The latest request is the immediate priority. Earlier requests remain required unless they conflict with a later request.",
    "If the output is unchanged, explain the concrete blocker and do not claim the revision is complete.",
    "Revision history (oldest first):",
    requestList,
    "Latest request to address first:",
    latest,
  ].join("\n");
}
