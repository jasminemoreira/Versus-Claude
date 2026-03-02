#!/usr/bin/env node

// Layer 1: Context injection — UserPromptSubmit
// Injects methodology state before EVERY user message.

import { StateEngine } from "../state/engine";
import { getCompactGuidance } from "../rules/compact-guidance";
import { getPhaseDefinition } from "../rules/phases";

function main() {
  const workspacePath = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const engine = new StateEngine(workspacePath);
  const state = engine.getPhaseState();

  if (!state) {
    // No project, no injection
    process.exit(0);
  }

  const phase = state.currentPhase;
  const phaseName = getPhaseDefinition(phase)?.name ?? "Unknown";

  // Compact summary (avoid spending too many tokens)
  const lines: string[] = [
    `[Versus] Phase ${phase} — ${phaseName} | Iteration ${state.currentIteration}`,
  ];

  if (state.phase0Score !== null) {
    lines.push(`Score Phase 0: ${state.phase0Score}/100`);
  }

  // Last 3 relevant decisions (phase-aware: P6 prioritizes testing, P2+P3 pin ACTIVATED LENSES)
  let recentDecisions;
  if (phase === 6) {
    const testingDecisions = state.decisions
      .filter((d) => d.phase === 6 && d.category === "testing")
      .slice(-3);
    recentDecisions = testingDecisions.length > 0 ? testingDecisions : state.decisions.slice(-3);
  } else if (phase === 2 || phase === 3) {
    const lensDecision = [...state.decisions]
      .reverse()
      .find((d) => d.phase === 2 && d.category === "architecture" && d.content.includes("ACTIVATED LENSES"));
    const last3 = state.decisions.slice(-3);
    if (lensDecision && !last3.find((d) => d.id === lensDecision.id)) {
      recentDecisions = [lensDecision, ...state.decisions.slice(-2)];
    } else {
      recentDecisions = last3;
    }
  } else {
    recentDecisions = state.decisions.slice(-3);
  }
  if (recentDecisions.length > 0) {
    lines.push(phase === 6 ? "Testing progress:" : "Recent decisions:");
    for (const d of recentDecisions) {
      lines.push(`  [P${d.phase}/${d.category}] ${d.content.substring(0, 100)}`);
    }
  }

  // P2: warn if ACTIVATED LENSES decision is missing (Step 1 not yet executed)
  if (phase === 2) {
    const hasLensDecision = recentDecisions.some((d) => d.content.includes("ACTIVATED LENSES"));
    if (!hasLensDecision) {
      lines.push("⚠ P2 STEP 1 MISSING: No lens activation decision found. Call record_decision(category='architecture', content='ACTIVATED LENSES: [list]. NOT ACTIVATED: [lens — reason]') BEFORE applying any lens.");
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

  // Loop counter warning
  const loop = engine.getLoopCounter();
  if (loop.count >= 2) {
    lines.push(`⚠ Loop detector: pattern "${loop.pattern}" executed ${loop.count}x. Threshold: 3.`);
  }

  process.stdout.write(lines.join("\n") + "\n");
  process.exit(0);
}

main();
