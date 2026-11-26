// Output shapes Claude Code actually honours, per event (hooks docs, "JSON output" and the
// per-event sections). Before 0.18.0 three hooks emitted a top-level `{additionalContext}`,
// which is not a documented shape: the transcript records it with `content: ''`, so it never
// reached the model. That covered the S6 escalation, the truncation warning and the stop
// warnings. Every hook goes through these helpers now, and the channel tests check the
// shapes.

/** Claude Code's cap per hook text field / plain stdout. Over it, the model gets a 2,000-char
 *  preview plus a file path. No setting raises it. */
export const HOOK_TEXT_CAP = 10_000;

/** Keeps a text under the cap. A truncated warning beats one replaced by a preview. */
export function capText(text: string, cap = HOOK_TEXT_CAP - 200): string {
  return text.length <= cap ? text : text.slice(0, cap - 40) + "\n…[truncated by Versus to fit the hook cap]";
}

/** PostToolUse: context for the model, next to the tool result. */
export function postToolUseContext(text: string): string {
  return JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: capText(text) } });
}

/** Stop, non-blocking: a message shown to the USER. (Stop's additionalContext makes the model
 *  continue the conversation, which would turn every turn-end warning into another turn.) */
export function stopUserMessage(text: string): string {
  return JSON.stringify({ systemMessage: capText(text) });
}

/** Stop, blocking: the reason goes to the model, and it keeps working. */
export function stopBlock(reason: string): string {
  return JSON.stringify({ decision: "block", reason: capText(reason) });
}

/** Writes and exits only after stdout drains (an exit right after write() truncates pipes). */
export function writeAndExit(text: string, code = 0): void {
  process.stdout.write(text.endsWith("\n") ? text : text + "\n", () => process.exit(code));
}
