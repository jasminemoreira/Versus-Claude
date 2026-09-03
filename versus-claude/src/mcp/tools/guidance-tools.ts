// MCP Tools: detailed behavioral instructions per phase

import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { StateEngine } from "../../state/engine";
import { getPhaseDefinition } from "../../rules/phases";

export const getPhaseGuidanceTool: Tool = {
  name: "get_phase_guidance",
  description:
    "Confirms the current (or specified) phase and points you to its guidance, which is " +
    "ALREADY in your injected context this turn — the complete methodology (every phase, " +
    "global rules, anti-patterns) is injected before every message. Call it when entering a " +
    "phase to focus on the right section; it no longer repeats the full text inline (that " +
    "made the result spill to disk). Complements get_phase_state, which returns the state.",
  inputSchema: {
    type: "object" as const,
    properties: {
      phase: {
        type: "number",
        description: "Phase number (0-7). If omitted, uses the current phase.",
      },
    },
    required: [],
  },
};

export function handleGetPhaseGuidance(engine: StateEngine, args: { phase?: number }): string {
  const state = engine.getPhaseState();
  if (!state) {
    return JSON.stringify({
      error: "Project not initialized. Call init_project first.",
    });
  }

  const phase = args.phase ?? state.currentPhase;

  if (phase < 0 || phase > 7) {
    return JSON.stringify({ error: `Invalid phase: ${phase}. Use 0-7.` });
  }

  const heading = `## Phase ${phase} — ${getPhaseDefinition(phase)?.name ?? "Unknown"}`;

  // Pointer, not the full text. The complete guidance (all phases) is injected into every
  // message by inject-context, so repeating the ~8 KB phase section here was pure redundancy
  // that spilled the tool result to disk. Point at the section the model already has.
  return JSON.stringify({
    phase,
    currentPhase: state.currentPhase,
    guidancePointer:
      `Phase ${phase} guidance is already in your injected context this turn — read the ` +
      `"${heading}" section and follow it. The full methodology (every phase, global rules, ` +
      `anti-patterns) is injected before every message; this tool intentionally does not repeat ` +
      `it inline, to stay within the host's inline size limit.`,
  });
}
