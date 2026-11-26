#!/usr/bin/env node

// Layer 0b: Compaction — PreCompact (command)
//
// Was a `type: "prompt"` hook ("call get_phase_state() and save it in MEMORY.md"). Claude
// Code does not support prompt hooks on PreCompact, so it never ran. A PreCompact command's
// stdout becomes instructions for the compaction SUMMARY: tell the summarizer what Versus
// state must survive. Recovery itself is the SessionStart(compact) hook's job.

import { StateEngine } from "../state/engine";
import { getPhaseDefinition } from "../rules/phases";
import { capText, writeAndExit } from "./hook-output";

export function preCompactText(engine: StateEngine): string {
  const st = engine.getPhaseState();
  if (!st) return "";
  const phase = st.currentPhase;
  const pending = engine.getExitCriteriaWithDefs(phase).filter((c) => !c.met).map((c) => c.criterion);
  const recent = st.decisions.slice(-5).map((d) => {
    const flat = d.content.replace(/\s+/g, " ").trim();
    return `  - [P${d.phase}/${d.category}] ${flat.length > 200 ? flat.slice(0, 199) + "…" : flat}`;
  });
  return capText(
    "In the summary, PRESERVE this Versus (IACDM methodology) state verbatim:\n" +
    `- Project "${st.projectName}": Phase ${phase} (${getPhaseDefinition(phase)?.name ?? "?"}), iteration ${st.currentIteration}, cycle ${engine.currentCycle()}.\n` +
    `- Pending exit criteria of Phase ${phase}: ${pending.join(", ") || "none"}.\n` +
    (recent.length ? `- Most recent decisions:\n${recent.join("\n")}\n` : "") +
    "- What was being worked on, and the next step.\n" +
    "- That after compaction the agent must call get_phase_state() and get_phase_guidance() BEFORE acting: " +
    "the methodology text is not carried in the summary.",
    3_500
  );
}

function main() {
  const workspacePath = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  try {
    const t = preCompactText(new StateEngine(workspacePath));
    if (t) { writeAndExit(t); return; }
  } catch { /* fail open */ }
  process.exit(0);
}

if (require.main === module) {
  main();
}
