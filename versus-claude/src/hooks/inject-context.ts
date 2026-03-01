#!/usr/bin/env node

// Layer 1: Context injection — UserPromptSubmit
// Injects methodology state before EVERY user message.

import { StateEngine } from "../state/engine";
import { getCompactGuidance } from "../rules/guidance";

const PHASE_NAMES: Record<number, string> = {
  0: "Problem Discovery",
  1: "Architecture",
  2: "Adversarial Critique",
  3: "Simplification",
  4: "Convergence Gate",
  5: "Code Implementation",
  6: "Tests",
  7: "Post-Review",
};

function main() {
  const workspacePath = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const engine = new StateEngine(workspacePath);
  const state = engine.getPhaseState();

  if (!state) {
    // No project, no injection
    process.exit(0);
  }

  const phase = state.currentPhase;
  const phaseName = PHASE_NAMES[phase] ?? "Unknown";

  // Compact summary (avoid spending too many tokens)
  const lines: string[] = [
    `[Versus] Phase ${phase} — ${phaseName} | Iteration ${state.currentIteration}`,
  ];

  if (state.phase0Score !== null) {
    lines.push(`Score Phase 0: ${state.phase0Score}/100`);
  }

  // Last 3 relevant decisions (Phase-6-aware: prioritize testing decisions)
  let recentDecisions;
  if (phase === 6) {
    const testingDecisions = state.decisions
      .filter((d: any) => d.phase === 6 && d.category === "testing")
      .slice(-3);
    recentDecisions = testingDecisions.length > 0 ? testingDecisions : state.decisions.slice(-3);
  } else {
    recentDecisions = state.decisions.slice(-3);
  }
  if (recentDecisions.length > 0) {
    lines.push(phase === 6 ? "Testing progress:" : "Recent decisions:");
    for (const d of recentDecisions) {
      lines.push(`  [P${d.phase}/${d.category}] ${d.content.substring(0, 100)}`);
    }
  }

  // Code restriction in Phases 0-4
  if (phase < 5) {
    lines.push("RESTRICTION: Phases 0-4 — DO NOT implement code. Use the MCP tools to manage the methodology.");
  }

  // Compact behavioral instructions per phase
  const compactGuidance = getCompactGuidance(phase);
  for (const line of compactGuidance) {
    lines.push(line);
  }

  // Global transition rule — applies to every phase
  lines.push("TRANSITION RULE: After advance_phase() succeeds → YOUR NEXT TOOL CALL is get_phase_guidance() for the new phase. Do NOT write 'advancing to phase X' as text — execute the tool call immediately.");

  // Reminder to use get_phase_guidance for full instructions
  lines.push("For detailed phase instructions: call get_phase_guidance().");

  // Loop counter warning
  const loop = engine.getLoopCounter();
  if (loop.count >= 2) {
    lines.push(`⚠ Loop detector: pattern "${loop.pattern}" executed ${loop.count}x. Threshold: 3.`);
  }

  process.stdout.write(lines.join("\n") + "\n");
  process.exit(0);
}

main();
