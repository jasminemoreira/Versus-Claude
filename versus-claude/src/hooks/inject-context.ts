#!/usr/bin/env node

// Layer 1: Context injection — UserPromptSubmit
// Injects methodology STATE before every user message.
//
// 0.18.0: this used to inject the complete guidance (~73K) plus every decision of every
// cycle in full (≈100–450K on real projects). Claude Code caps hook output at 10,000
// characters (no setting raises it). Over the cap, the text goes to a file and the model
// gets a 2,000-character preview. Measured in this machine's transcripts: all 73
// injections from Oct–Nov 2026 arrived as that preview, so the model saw the phase header,
// the score and the start of the first decision. The guidance, the Phase 0–4 restriction
// and the S6 warning never reached it.
//
// Now: a state block budgeted under the cap, with the warnings first. The guidance comes
// from get_phase_guidance(), an MCP result (inlined up to 50,000 characters).

import { StateEngine } from "../state/engine";
import { buildInjection } from "./state-block";
import { writeAndExit } from "./hook-output";

export { buildInjection, INJECT_BUDGET } from "./state-block";

function main() {
  const workspacePath = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const engine = new StateEngine(workspacePath);
  const text = buildInjection(engine);
  if (text === null) process.exit(0);
  // Exit only after stdout drains: process.exit() right after write() truncates a piped
  // write at 64 KB (observed when the injection was ~100K).
  writeAndExit(text);
}

// Only run as a hook process — buildInjection() is imported by the test suite.
if (require.main === module) {
  main();
}
