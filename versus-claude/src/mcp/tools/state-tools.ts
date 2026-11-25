// MCP Tools: state queries

import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { StateEngine } from "../../state/engine";
import { validateSafeguard } from "../../rules/safeguards";
import { ProjectSpec, Decision, specEntryValue } from "../../state/types";

// get_phase_state is the gateway-guard call — the one the model is told to make before
// anything. The chat host paginates a large tool result to disk, so if this spills, the
// model operates WITHOUT seeing project state. Measured on Goitacaz/Tools it was 49 KB
// (39 KB recentDecisions, 7 KB projectSpec, 2 KB from a heredoc test command) — well past
// the host's ~5.7 KB inline threshold. These budgets keep the snapshot lean. The full
// spec is injected into every message by inject-context, and full decisions are one
// get_decisions() away, so trimming here loses the model nothing it cannot recover.
const SPEC_PER_LIST = 6;          // newest N kept per list; older discarded WHOLE and counted
const DECISION_MAXLEN = 200;      // per-decision content cap before discarding any
const DECISION_BUDGET = 2200;     // total chars for recentDecisions

/** Newest SPEC_PER_LIST values per list, normalized to plain strings (the {value,phase,at}
 *  stamp is metadata for external analysis in state.json, never read by the model). Whole
 *  entries are discarded from the OLDER side and counted — a spec entry is a distinct
 *  commitment (a lone constraint), so it is not truncated into another one; each list is
 *  capped independently so a 200-item stack cannot crowd two constraints out of the snapshot. */
function budgetSpec(spec: ProjectSpec | undefined): { spec: Record<string, string[]>; omitted: number } {
  const out: Record<string, string[]> = { stack: [], outOfScope: [], patterns: [], constraints: [] };
  let omitted = 0;
  for (const key of ["stack", "outOfScope", "patterns", "constraints"] as const) {
    const values = ((spec?.[key] ?? []) as ProjectSpec[typeof key]).map(specEntryValue);
    if (values.length > SPEC_PER_LIST) { omitted += values.length - SPEC_PER_LIST; out[key] = values.slice(-SPEC_PER_LIST); }
    else out[key] = values;
  }
  return { spec: out, omitted };
}

/** Most-recent decisions, each content SHORTENED before any whole decision is dropped, up
 *  to a char budget. Returns how many were shown so the caller can point at get_decisions. */
function budgetDecisions(decisions: Decision[]): { shown: Array<{ phase: number; category: string; content: string }>; shownCount: number } {
  const shown: Array<{ phase: number; category: string; content: string }> = [];
  let used = 0;
  for (let i = decisions.length - 1; i >= 0; i--) {
    const d = decisions[i];
    const content = d.content.length > DECISION_MAXLEN ? d.content.slice(0, DECISION_MAXLEN).trimEnd() + "…" : d.content;
    const entry = { phase: d.phase, category: d.category, content };
    const cost = JSON.stringify(entry).length;
    if (used + cost > DECISION_BUDGET && shown.length > 0) break;
    shown.push(entry);
    used += cost;
  }
  shown.reverse();
  return { shown, shownCount: shown.length };
}

export const getPhaseStateTool: Tool = {
  name: "get_phase_state",
  description:
    "MUST be called at the start of each interaction. Returns the current phase, iteration, score, " +
    "decisions, and safeguards of the Iterative Convergence methodology. " +
    "Without calling this tool, you don't know which phase you're in or what to do.",
  inputSchema: {
    type: "object" as const,
    properties: {},
    required: [],
  },
};

export const getDecisionsTool: Tool = {
  name: "get_decisions",
  description:
    "Queries decisions made in any phase of the methodology. " +
    "Use to retrieve previous decisions before making new ones.",
  inputSchema: {
    type: "object" as const,
    properties: {
      phase: {
        type: "number",
        description: "Phase number (0-7). If omitted, returns all decisions.",
      },
    },
    required: [],
  },
};

export const getExitCriteriaTool: Tool = {
  name: "get_exit_criteria",
  description:
    "Returns the exit criteria of a phase with status (met/pending). " +
    "Use to find out what's missing before attempting to advance phase.",
  inputSchema: {
    type: "object" as const,
    properties: {
      phase: {
        type: "number",
        description: "Phase number (0-7).",
      },
    },
    required: ["phase"],
  },
};

export function handleGetPhaseState(engine: StateEngine): string {
  const state = engine.getPhaseState();
  if (!state) {
    return JSON.stringify({
      error: "Project not initialized. Call init_project first.",
    });
  }
  // Mark that the model loaded context (gateway guard)
  engine.touchPhaseStateCheck();

  // Budgeted so the gateway-guard result stays inline (does not spill to disk).
  const { spec: specBudgeted, omitted: specOmitted } = budgetSpec(state.projectSpec);
  const { shown: recentDecisions, shownCount } = budgetDecisions(state.decisions);
  const lastTestOutcome = state.lastTestOutcome
    ? { ...state.lastTestOutcome, command: state.lastTestOutcome.command && state.lastTestOutcome.command.length > DECISION_MAXLEN
        ? state.lastTestOutcome.command.slice(0, DECISION_MAXLEN).trimEnd() + "…"
        : state.lastTestOutcome.command }
    : null;

  // Detect Phase 7 completion → hint to offer new cycle
  let phase7Hint: string | undefined;
  if (state.currentPhase === 7) {
    const p7Criteria = state.exitCriteria.filter((c) => c.phase === 7);
    const allMet = p7Criteria.length > 0 && p7Criteria.every((c) => c.met);
    if (allMet) {
      phase7Hint = "ACTION REQUIRED: Phase 7 exit criteria are ALL met. You MUST offer the user a new development cycle via AskUserQuestion: Option 1 'Start next cycle' (calls start_new_cycle()) / Option 2 'Project complete'. Do NOT skip this step.";
    }
  }

  // Detect "ready to advance" state for any phase < 7 — all criteria met but phase not advanced
  let readyToAdvanceHint: string | undefined;
  if (state.currentPhase < 7) {
    const phaseCriteria = engine.getExitCriteriaWithDefs(state.currentPhase);
    const allMet = phaseCriteria.length > 0 && phaseCriteria.every((c) => c.met);
    if (allMet) {
      readyToAdvanceHint = `⚠️ READY TO ADVANCE — Phase ${state.currentPhase} exit criteria are ALL met but currentPhase is still ${state.currentPhase}. Your VERY NEXT tool call MUST be advance_phase(target_phase=${state.currentPhase + 1}). Do NOT write summary text. Do NOT wait for user input. Continue work into Phase ${state.currentPhase + 1} in the same turn.`;
    }
  }

  const result: Record<string, any> = {
    projectName: state.projectName,
    projectDescription: state.projectDescription,
    projectSpec: specBudgeted,
    currentPhase: state.currentPhase,
    currentIteration: state.currentIteration,
    phase0Score: state.phase0Score,
    decisionsCount: state.decisions.length,
    recentDecisions,
    // Computed LIVE (not the cached state.safeguards[].status, refreshed only by
    // check_all_safeguards) so the reported status reflects what advance_phase would
    // enforce right now — e.g. an S6 loop block shows even if no one re-checked.
    safeguards: state.safeguards.map((s) => ({ id: s.id, status: validateSafeguard(s.id, state).status })),
    // What the test-outcome hook last witnessed (I.2). Without this a stuck
    // tests_passing gate was undiagnosable through the MCP interface — the agent had
    // to read .versus/state.json directly, bypassing the interface the methodology offers.
    lastTestOutcome,
    updatedAt: state.updatedAt,
  };

  if (specOmitted > 0) {
    result._specNote = `projectSpec shows the newest ${SPEC_PER_LIST} per list; ${specOmitted} older entries omitted here. The FULL spec is injected into every message.`;
  }
  if (state.decisions.length > shownCount || recentDecisions.some((d) => d.content.endsWith("…"))) {
    result._decisionsNote = `recentDecisions: newest ${shownCount} of ${state.decisions.length}, content trimmed. Call get_decisions(phase?) for the full text.`;
  }

  if (phase7Hint) {
    result._phase7Action = phase7Hint;
  }
  if (readyToAdvanceHint) {
    result._nextAction = readyToAdvanceHint;
  }

  return JSON.stringify(result);
}

export function handleGetDecisions(engine: StateEngine, args: { phase?: number }): string {
  const all = engine.getDecisions(args.phase);
  // Budget to stay inline (a full dump was 144 KB on Goitacaz/Tools — it spills, and
  // get_phase_state now points here for full text, so this call must not spill in turn).
  // Newest first, full content per decision, up to a char budget; a single decision that
  // alone exceeds the budget is truncated with a marker rather than spilling. Narrowing by
  // phase returns fewer, so the full text of any one decision is reachable that way.
  const BUDGET = 5000;
  const shown: Decision[] = [];
  let used = 0;
  for (let i = all.length - 1; i >= 0; i--) {
    let d = all[i];
    let cost = JSON.stringify(d).length;
    if (shown.length === 0 && cost > BUDGET) {
      const keep = Math.max(0, BUDGET - (cost - d.content.length));
      d = { ...d, content: d.content.slice(0, keep).trimEnd() + `… [truncated; ${d.content.length} chars — narrow by phase]` };
      cost = JSON.stringify(d).length;
    }
    if (used + cost > BUDGET && shown.length > 0) break;
    shown.push(d);
    used += cost;
  }
  shown.reverse();
  const result: Record<string, unknown> = { count: all.length, shown: shown.length, decisions: shown };
  if (shown.length < all.length) {
    result._note = `Showing the newest ${shown.length} of ${all.length}${args.phase !== undefined ? ` in Phase ${args.phase}` : ""}. Narrow with get_decisions(phase) for the rest.`;
  }
  return JSON.stringify(result);
}

export function handleGetExitCriteria(engine: StateEngine, args: { phase: number }): string {
  const criteria = engine.getExitCriteriaWithDefs(args.phase);
  const met = criteria.filter((c) => c.met).length;
  const total = criteria.length;
  return JSON.stringify({ phase: args.phase, met, total, criteria });
}

export const updateProjectSpecTool: Tool = {
  name: "update_project_spec",
  description:
    "Updates the project's structured technical context (stack, out-of-scope, patterns, constraints). " +
    "Use to register technical decisions in a structured way. " +
    "Items are added (merged), never overwritten. Duplicates are ignored.",
  inputSchema: {
    type: "object" as const,
    properties: {
      stack: {
        type: "array",
        items: { type: "string" },
        description: "Approved technologies for the project (e.g., ['TypeScript', 'Node 18+', 'MCP SDK']).",
      },
      outOfScope: {
        type: "array",
        items: { type: "string" },
        description: "Items explicitly excluded from scope (e.g., ['Local models', 'Web UI']).",
      },
      patterns: {
        type: "array",
        items: { type: "string" },
        description: "Architectural patterns to follow (e.g., ['MCP server standalone', 'shared state.json']).",
      },
      constraints: {
        type: "array",
        items: { type: "string" },
        description: "Hard constraints of the project (e.g., ['Copilot-only', 'No external dependencies']).",
      },
    },
    required: [],
  },
};

export function handleUpdateProjectSpec(
  engine: StateEngine,
  args: { stack?: string[]; outOfScope?: string[]; patterns?: string[]; constraints?: string[] }
): string {
  engine.updateProjectSpec(args);
  const spec = engine.getProjectSpec();
  return JSON.stringify({
    success: true,
    projectSpec: spec,
    message: "Project spec updated. This context is returned in every call to get_phase_state.",
  });
}
