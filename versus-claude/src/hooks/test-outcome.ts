#!/usr/bin/env node

// Layer 3b: Test outcome recorder — PostToolUse (Bash)
// The counting half of safeguard S6. A PreToolUse hook cannot see the result of
// a run, so the old detector counted executions and blocked the final green run
// — the one moment where running tests is most legitimate (S4 requires it).
// This hook counts only FAILED runs; a passing run clears the counter.
//
// Bias is deliberate: only positive evidence of failure counts. When the output
// is ambiguous we record nothing — a false "failed" would push toward a bogus
// block, a missed failure only delays a legitimate one.

import { createHash } from "crypto";
import { StateEngine, LOOP_FAILURE_THRESHOLD } from "../state/engine";
import { TestProvenance } from "../state/types";

interface HookInput {
  tool_name?: string;
  tool_input?: { command?: string };
  // Bash tool_response is { stdout, stderr, exit_code } (exit_code is snake_case and
  // numeric); older builds may send a plain string. Handle both.
  tool_response?: string | { stdout?: string; stderr?: string; exit_code?: number } | Record<string, unknown>;
  tool_use_id?: string;
  session_id?: string;
}

/** Text to classify from a Bash tool_response — stdout+stderr when structured, the
 *  string itself otherwise. Used only as the FALLBACK when no exit_code is present. */
function responseText(resp: HookInput["tool_response"]): string {
  if (typeof resp === "string") return resp;
  if (resp && typeof resp === "object") {
    const o = resp as { stdout?: string; stderr?: string };
    if (typeof o.stdout === "string" || typeof o.stderr === "string") {
      return `${o.stdout ?? ""}\n${o.stderr ?? ""}`;
    }
    return JSON.stringify(resp);
  }
  return "";
}

const TEST_PATTERNS = [
  /\bnpm\s+test\b/i,
  /\bnpx\s+(jest|vitest|mocha)\b/i,
  /\bpytest\b/i,
  /\bpython\s+-m\s+(pytest|unittest)\b/i,
  /\bcargo\s+test\b/i,
  /\bgo\s+test\b/i,
  /\bnpm\s+run\s+test\b/i,
  /\bnode\s+.*test/i,
];

function isTestCommand(cmd: string): boolean {
  return TEST_PATTERNS.some((p) => p.test(cmd));
}

// Explicit "nothing failed" statements. Checked FIRST: "0 failed" and
// "failures: 0" contain the word "failed"/"failures" and would otherwise
// trip the failure markers below.
const CLEAN_MARKERS = [
  /\b0\s+(tests?\s+)?fail(ed|ures?|ing)?\b/i,
  /\bfail(ed|ures?)\s*[:=]\s*0\b/i,
  /\ball\s+tests?\s+passed\b/i,
  /\btest\s+result:\s*ok\b/i,          // cargo
  /^ok\s|^PASS\b/im,                    // go test / jest summary line
];

const PASS_MARKERS = [
  /\b\d+\s+(tests?\s+)?pass(ed|ing)\b/i,
  /\btests?:\s+\d+\s+passed/i,
  /\b\d+\s+passed\b/i,
  /=+\s*\d+\s+passed[^=]*=+/i,          // pytest summary
];

const FAIL_MARKERS = [
  /\bexit\s+code:?\s*[1-9]\d*\b/i,
  /\b[1-9]\d*\s+(tests?\s+)?fail(ed|ing|ures?)\b/i,
  /\bfail(ed|ures?)\s*[:=]\s*[1-9]\d*\b/i,
  /\bassertion(error| failed)\b/i,
  /\btest\s+result:\s*FAILED\b/i,
  /^FAIL\b/im,
  /\b(SyntaxError|ReferenceError|TypeError)\b/,
  /\bnpm\s+ERR!/i,
  /✗|✖|×/,
];

type Outcome = "pass" | "fail" | "unknown";

export function detectOutcome(output: string): Outcome {
  const clean = CLEAN_MARKERS.some((p) => p.test(output));

  // A clean marker does not by itself mean success: "0 failed" can sit next to a
  // crash. Only a failure marker that is NOT explained by the clean phrasing counts.
  const failed = FAIL_MARKERS.some((p) => p.test(output));

  if (failed && !clean) return "fail";
  if (failed && clean) {
    // Both present — e.g. "0 failed" plus a stack trace. Trust the hard signals only.
    const hard = /\bexit\s+code:?\s*[1-9]\d*\b/i.test(output) || /^FAIL\b/im.test(output);
    return hard ? "fail" : "pass";
  }
  if (clean || PASS_MARKERS.some((p) => p.test(output))) return "pass";
  return "unknown";
}

/**
 * Language-agnostic exit status from a sanctioned `echo "VERSUS_TEST_EXIT=$?"` appended
 * to the test command. The harness on this platform (the VS Code extension) does not put
 * a numeric exit code in the hook payload — confirmed from the recorded provenance of a
 * real run — so the command surfaces the shell's own `$?` as a fixed token. It is a
 * NUMBER, not prose, so it works whatever language or format the runner prints in — which
 * is why the English-only output markers do not need to grow a translation per locale.
 * Returns the LAST occurrence (the final run in a multi-command block).
 */
export function detectExitCode(output: string): number | undefined {
  const ms = [...output.matchAll(/VERSUS_TEST_EXIT=(\d+)/g)];
  return ms.length ? parseInt(ms[ms.length - 1][1], 10) : undefined;
}

function emit(msg?: string): void {
  if (msg) {
    process.stdout.write(JSON.stringify({ additionalContext: msg }) + "\n");
  }
  process.exit(0);
}

function main() {
  const workspacePath = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const engine = new StateEngine(workspacePath);
  const state = engine.getPhaseState();

  if (!state || state.currentPhase < 5) {
    emit();
    return;
  }

  let input = "";
  process.stdin.setEncoding("utf-8");

  const timeoutId = setTimeout(() => {
    process.stdin.destroy();
    emit();
  }, 5000);

  process.stdin.on("data", (chunk) => { input += chunk; });
  process.stdin.on("end", () => {
    clearTimeout(timeoutId);
    let command = "";
    let isTest = false;
    try {
      const hookInput: HookInput = JSON.parse(input);
      command = hookInput.tool_input?.command || "";
      isTest = isTestCommand(command);
      if (!isTest) {
        emit();
        return;
      }

      const resp = hookInput.tool_response;
      const output = responseText(resp);

      // The process exit code is the ONLY language-agnostic signal — a green suite exits 0
      // whatever language or format the runner prints in. Precedence:
      //   1. harness `exit_code` if this platform supplies it (the VS Code extension does NOT);
      //   2. the sanctioned `echo "VERSUS_TEST_EXIT=$?"` token — a number, not prose, so it
      //      survives any runner/locale (this is what makes the marker family unnecessary);
      //   3. output markers, English-only, as a last resort — NOT expanded per language.
      const harnessExit =
        resp && typeof resp === "object" && typeof (resp as { exit_code?: unknown }).exit_code === "number"
          ? (resp as { exit_code: number }).exit_code
          : undefined;
      const echoExit = detectExitCode(output);
      const exitCode = typeof harnessExit === "number" ? harnessExit : echoExit;
      const exitSource: TestProvenance["exitSource"] =
        typeof harnessExit === "number" ? "harness" : typeof echoExit === "number" ? "echo" : undefined;

      const outcome: Outcome =
        typeof exitCode === "number" ? (exitCode === 0 ? "pass" : "fail") : detectOutcome(output);

      // I.5: provenance. Does not prevent forgery — it makes a workaround legible in a
      // post-mortem, which is exactly what the four bypassed projects lacked.
      const provenance: TestProvenance = {
        source: "harness",
        toolUseId: hookInput.tool_use_id,
        sessionId: hookInput.session_id,
        outputBytes: Buffer.byteLength(output, "utf-8"),
        outputSha256: createHash("sha256").update(output).digest("hex"),
        exitCode,
        exitSource,
      };

      // I.1: an `unknown` outcome is recorded like any other — it must not leave a
      // stale `fail` frozen in place. recordTestOutcome keeps it out of the S6 count.
      const { count } = engine.recordTestOutcome(command, outcome, provenance);

      if (outcome === "fail" && count >= LOOP_FAILURE_THRESHOLD) {
        emit(
          `[Versus] S6: ${count} consecutive failed runs with no diagnosis recorded. ` +
          `The next test run will be BLOCKED until you name the cause via ` +
          `record_decision(phase=${state.currentPhase}, category='diagnosis', content='...'). ` +
          `If you already know why this failed, record it now and keep going.`
        );
        return;
      }

      if (outcome === "fail" && count === LOOP_FAILURE_THRESHOLD - 1) {
        emit(
          `[Versus] S6: ${count} failed runs in a row with no diagnosis recorded. ` +
          `Record the root cause of this failure with record_decision(category='diagnosis') ` +
          `before the next run, or S6 will block it.`
        );
        return;
      }

      emit();
    } catch {
      // I.1 (pt.4): if we already knew this was a test command, a malformed payload or
      // downstream error must not make the run vanish — record it as unknown.
      if (isTest) {
        try { engine.recordTestOutcome(command, "unknown", { source: "unknown" }); } catch { /* ignore */ }
      }
      emit();
    }
  });
}

// Only run as a hook process — detectOutcome() is imported by the test suite.
if (require.main === module) {
  main();
}
