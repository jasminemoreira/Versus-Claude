// MCP Tools: phase transitions

import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { StateEngine } from "../../state/engine";

export const advancePhaseTool: Tool = {
  name: "advance_phase",
  description:
    "Requests transition to the next phase. The server validates all exit criteria " +
    "and safeguards before allowing. If criteria are not met, returns an error " +
    "with a detailed list of what's missing. Use get_exit_criteria first to check pending items.",
  inputSchema: {
    type: "object" as const,
    properties: {
      target_phase: {
        type: "number",
        description: "Target phase (0-7). Valid transitions: sequential or loop 2↔3.",
      },
    },
    required: ["target_phase"],
  },
};

export const startIterationTool: Tool = {
  name: "start_iteration",
  description:
    "Starts a new iteration within a cyclic phase (Phase 0, 2, or 3). " +
    "Increments the iteration counter and returns information from the previous iteration.",
  inputSchema: {
    type: "object" as const,
    properties: {
      phase: {
        type: "number",
        description: "Current phase (0, 2, or 3).",
      },
    },
    required: ["phase"],
  },
};

export function handleAdvancePhase(engine: StateEngine, args: { target_phase: number }): string {
  const result = engine.advancePhase(args.target_phase);
  if (result.ok) {
    const newState = engine.getPhaseState();
    return JSON.stringify({
      success: true,
      message: `Advanced to Phase ${args.target_phase}.`,
      currentPhase: newState?.currentPhase,
      currentIteration: newState?.currentIteration,
    });
  } else {
    return JSON.stringify({
      success: false,
      error: result.error.message,
      missingCriteria: result.error.missingCriteria,
      specsWarnings: result.error.specsWarnings,
    });
  }
}

export function handleStartIteration(engine: StateEngine, args: { phase: number }): string {
  const result = engine.startIteration(args.phase);
  if (result.ok) {
    return JSON.stringify({
      success: true,
      phase: result.value.phase,
      iterationNumber: result.value.iterationNumber,
    });
  } else {
    return JSON.stringify({ success: false, error: result.error });
  }
}
