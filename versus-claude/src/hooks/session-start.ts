#!/usr/bin/env node

// Layer 0: Session start / post-compaction recovery — SessionStart (command)
//
// Until 0.18.0 these were `type: "prompt"` hooks, which Claude Code does not support on
// SessionStart ("prompt-type hooks are not supported for SessionStart events … Use a
// command-type hook instead", recorded 9× in this machine's transcripts). So the
// instruction to load state at session start and after every compaction NEVER ran. Its
// banner ("📍 Versus ativo") appears in 1 of 7 real-project sessions. A command hook's
// plain stdout is added to the model's context (≤10,000 chars).
//
// It also carries the state itself, so the model starts informed even before it calls
// any tool.

import { StateEngine } from "../state/engine";
import { buildInjection } from "./state-block";
import { capText, writeAndExit } from "./hook-output";

/** Budget for the embedded state block; the instructions around it are ~1.6K. */
const STATE_BUDGET = 7_200;

const NO_PROJECT =
  "[Versus] This workspace has Versus hooks but no initialized project (.versus/state.json is missing). " +
  "Before anything else, look at the init_project tool description: it has a BOOTSTRAP PROTOCOL for brownfield " +
  "projects (workspace with existing code) that requires reading surface files, presenting a proposal, getting " +
  "user confirmation, then calling init_project with bootstrap_data. For an empty workspace (greenfield), ask the " +
  "user for a project name and description, then call init_project directly.";

export function sessionStartText(engine: StateEngine, source: string): string {
  const state = engine.getPhaseState();
  if (!state) return NO_PROJECT;

  const compact = source === "compact";
  const steps = compact
    ? [
        "1. Call mcp__versus-claude__get_phase_state() to reload the current phase.",
        "2. Call mcp__versus-claude__get_phase_guidance() to reload the methodology. It is NOT in your context after compaction.",
        "3. Call mcp__versus-claude__get_decisions() to reload previous decisions.",
      ]
    : [
        "1. Call mcp__versus-claude__get_phase_state().",
        "2. Call mcp__versus-claude__get_phase_guidance(). The methodology text comes ONLY from this call.",
      ];
  if (state.currentPhase === 6) {
    steps.push(`${steps.length + 1}. Call get_decisions(phase=6) to recover testing progress. Manual testing spans sessions.`);
  }
  const head =
    (compact
      ? "[Versus] Context was compacted. Before doing ANYTHING else, recover the methodology state:\n"
      : "[Versus] Versus manages the IACDM methodology in this project. Before reading files or exploring the codebase, run:\n") +
    steps.join("\n") +
    "\nDO NOT read .versus/state.json or .versus/server.js directly: use the MCP tools (record_decision, update_score, " +
    "mark_exit_criterion, advance_phase). " +
    (compact
      ? "VISIBILITY: start your first response with a one-line banner, e.g. '📍 Versus retomado — Fase X (name), iteração Y. Continuando: <one line>.'"
      : "VISIBILITY: start your first response with a one-line banner so the user knows Versus is active, e.g. " +
        "'📍 Versus ativo — Fase X (name), iteração Y. Próximo passo: <one line>.'");

  const stateBlock = buildInjection(engine, STATE_BUDGET) ?? "";
  return capText(`${head}\n\nCurrent state (snapshot at session ${compact ? "recovery" : "start"}):\n${stateBlock}`);
}

function main() {
  const workspacePath = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  let input = "";
  process.stdin.setEncoding("utf-8");
  const timeoutId = setTimeout(() => { process.stdin.destroy(); finish("startup"); }, 3000);
  process.stdin.on("data", (c) => { input += c; });
  process.stdin.on("end", () => {
    clearTimeout(timeoutId);
    let source = "startup";
    try { source = (JSON.parse(input) as { source?: string }).source || "startup"; } catch { /* default */ }
    finish(source);
  });
  function finish(source: string) {
    try {
      writeAndExit(sessionStartText(new StateEngine(workspacePath), source));
    } catch {
      process.exit(0);
    }
  }
}

if (require.main === module) {
  main();
}
