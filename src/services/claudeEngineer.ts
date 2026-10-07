import { ENGINEER_SYSTEM, engineerMessage, type EngineerBrief } from "../domain/engineer";

// Free questions to the race engineer go to Claude straight from this browser with the viewer's
// own API key (there is no backend). The key lives only in this browser's storage and is sent
// only to the Anthropic API. The SDK is loaded on the first question, never at start-up.

const KEY_STORAGE = "svl-engineer-key";

export function readKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}
export function writeKey(key: string) {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key);
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    // Storage blocked (private window): the key lasts until the page closes.
  }
}

export class EngineerError extends Error {}

/** One stateless question: the brief and the question go out, one radio reply comes back. */
export async function askClaude(key: string, brief: EngineerBrief, question: string, signal?: AbortSignal) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 1 });
  try {
    const response = await client.beta.messages.create(
      {
        model: "claude-opus-5-5",
        max_tokens: 16000,
        // A short radio call: low effort keeps it quick and cheap.
        output_config: { effort: "low" },
        // If a safety classifier declines, the API reruns the request on a fallback model.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: ENGINEER_SYSTEM,
        messages: [{ role: "user", content: engineerMessage(brief, question) }],
      },
      { signal },
    );
    if (response.stop_reason === "refusal") throw new EngineerError("The engineer can't answer that one.");
    const text = response.content
      .flatMap((b) => (b.type === "text" ? [b.text] : []))
      .join(" ")
      .trim();
    if (!text) throw new EngineerError("No reply on the radio. Try again.");
    return text;
  } catch (e) {
    if (e instanceof EngineerError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new EngineerError("The API key was rejected. Check it in settings.");
    if (e instanceof Anthropic.PermissionDeniedError) throw new EngineerError("This API key can't use the model.");
    if (e instanceof Anthropic.RateLimitError) throw new EngineerError("Rate limited. Give it a moment.");
    if (e instanceof Anthropic.APIUserAbortError) throw e;
    if (e instanceof Anthropic.APIConnectionError) throw new EngineerError("No connection to the API.");
    if (e instanceof Anthropic.APIError) throw new EngineerError(`The API returned an error (${e.status ?? "network"}).`);
    throw e;
  }
}
