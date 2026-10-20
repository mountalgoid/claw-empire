export const MINIMAX_TEXT_MODELS = ["MiniMax-M3.1-Flash", "MiniMax-M3"];

export function isDirectMiniMaxProvider(baseUrl: string): boolean {
  try {
    const url = new URL(baseUrl);
    return (
      url.protocol === "https:" &&
      ["api.minimax.io", "api.minimaxi.com"].includes(url.hostname) &&
      /^\/(?:v1|anthropic(?:\/v1)?)(?:\/(?:models|messages|chat\/completions))?\/?$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

// Apply only to discovery/default choices, never to explicit model selections.
export function currentMiniMaxChoices(models: readonly string[]): string[] {
  const isTextModel = (model: string) => /(?:^|\/)minimax[-/](?:m\d|text)|(?:^|\/)abab\d/i.test(model);
  const rank = (model: string) => {
    if (/(?:^|\/)minimax-m3\.1-flash(?:-free|:free)?$/i.test(model)) return 0;
    if (/(?:^|\/)minimax-m3$/i.test(model)) return 1;
    return 2;
  };
  const choices = [...new Set(models)].filter((model) => !isTextModel(model) || rank(model) < 2);
  const textModels = choices.filter(isTextModel).sort((a, b) => rank(a) - rank(b));
  let index = 0;
  return choices.map((model) => (isTextModel(model) ? textModels[index++] : model));
}

export function apiModelChoices(models: readonly string[], baseUrl: string): string[] {
  if (isDirectMiniMaxProvider(baseUrl)) return currentMiniMaxChoices([...MINIMAX_TEXT_MODELS, ...models]);
  if (baseUrl.replace(/\/+$/, "") === "https://opencode.ai/inference/go/anthropic/v1") {
    // This endpoint documents M3; Flash uses a different protocol endpoint.
    return currentMiniMaxChoices(["minimax-m3", ...models]).filter((model) => !/^minimax-m3\.1-flash/i.test(model));
  }
  return currentMiniMaxChoices(models);
}
