// HLI (Human Lead Index) — Anti-Vibe-Coding Metric
// Pure calculation engine. No side effects.

import { PhaseState, PhaseHLI, HLIAlert } from "../state/types";
import { getExitCriteriaForPhase } from "../rules/phases";

// Expected minimum decisions per phase (for decisionDensity component)
const EXPECTED_MIN_DECISIONS: Record<number, number> = {
  0: 5, 1: 4, 2: 3, 3: 2, 4: 1, 5: 3, 6: 2, 7: 2,
};

// Phase 1 expected decision categories
const P1_EXPECTED_CATEGORIES = ["architecture", "pattern", "technology", "constraint"];

// Component weights
const W_CRITERIA = 0.3;
const W_DECISIONS = 0.3;
const W_PHASE_SPECIFIC = 0.4;

// Alert threshold: drop > 2 points on 0-10 scale
const HLI_DROP_THRESHOLD = 2.0;

/**
 * Calculate HLI for a single completed phase.
 * Called when advancePhase() succeeds, with completedPhase = the phase just left.
 */
export function calculatePhaseHLI(state: PhaseState, completedPhase: number): PhaseHLI {
  const criteriaRatio = calcCriteriaRatio(state, completedPhase);
  const decisionDensity = calcDecisionDensity(state, completedPhase);
  const { value: phaseSpecific, label: phaseSpecificLabel } = calcPhaseSpecific(state, completedPhase);

  const score = W_CRITERIA * criteriaRatio + W_DECISIONS * decisionDensity + W_PHASE_SPECIFIC * phaseSpecific;

  return {
    phase: completedPhase,
    score: clamp(score, 0, 1),
    criteriaRatio,
    decisionDensity,
    phaseSpecific,
    phaseSpecificLabel,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Recalculate composite HLI from all phase scores.
 * composite = average of all phaseScores[].score * 10
 */
export function calculateCompositeHLI(phaseScores: PhaseHLI[]): number {
  if (phaseScores.length === 0) return 0;
  const sum = phaseScores.reduce((acc, ps) => acc + ps.score, 0);
  return Math.round((sum / phaseScores.length) * 100) / 10; // 0-10, 1 decimal
}

/**
 * Check for drop alert between the two most recent phase scores.
 * Returns HLIAlert if drop > threshold, or null.
 */
export function checkForDropAlert(phaseScores: PhaseHLI[]): HLIAlert | null {
  if (phaseScores.length < 2) return null;

  const current = phaseScores[phaseScores.length - 1];
  const previous = phaseScores[phaseScores.length - 2];

  const currentScaled = current.score * 10;
  const previousScaled = previous.score * 10;
  const drop = previousScaled - currentScaled;

  if (drop > HLI_DROP_THRESHOLD) {
    return {
      fromPhase: previous.phase,
      toPhase: current.phase,
      drop: Math.round(drop * 10) / 10,
      previousScore: Math.round(previousScaled * 10) / 10,
      currentScore: Math.round(currentScaled * 10) / 10,
      timestamp: new Date().toISOString(),
    };
  }

  return null;
}

// --- Component calculations ---

function calcCriteriaRatio(state: PhaseState, phase: number): number {
  const defs = getExitCriteriaForPhase(phase);
  if (defs.length === 0) return 1.0;

  const metCount = state.exitCriteria.filter(
    (c) => c.phase === phase && c.met
  ).length;

  return metCount / defs.length;
}

function calcDecisionDensity(state: PhaseState, phase: number): number {
  const expectedMin = EXPECTED_MIN_DECISIONS[phase] ?? 2;
  const actual = state.decisions.filter((d) => d.phase === phase).length;
  return Math.min(actual / expectedMin, 1.0);
}

function calcPhaseSpecific(state: PhaseState, phase: number): { value: number; label: string } {
  switch (phase) {
    case 0:
      return {
        value: (state.phase0Score ?? 0) / 100,
        label: "Phase 0 Score",
      };

    case 1: {
      const p1Decisions = state.decisions.filter((d) => d.phase === 1);
      const uniqueCategories = new Set(p1Decisions.map((d) => d.category));
      const coverage = Math.min(uniqueCategories.size / P1_EXPECTED_CATEGORIES.length, 1.0);
      return { value: coverage, label: "Category Diversity" };
    }

    case 2: {
      const iterationCount = countIterationCycles(state);
      return {
        value: Math.min(iterationCount / 2, 1.0),
        label: "Iteration Depth",
      };
    }

    case 3: {
      const iterationCount = countIterationCycles(state);
      return {
        value: Math.min(iterationCount / 2, 1.0),
        label: "Iteration Depth",
      };
    }

    case 4: {
      const total = state.safeguards.length;
      if (total === 0) return { value: 1.0, label: "Safeguard Health" };
      const okCount = state.safeguards.filter((s) => s.status === "ok").length;
      return { value: okCount / total, label: "Safeguard Health" };
    }

    case 5: {
      const loopCount = state.loopCounter?.count ?? 0;
      return {
        value: 1 - Math.min(loopCount / 4, 1.0),
        label: "Loop Efficiency",
      };
    }

    case 6: {
      const hasSpecCoverage = state.decisions.some(
        (d) => d.phase === 6 && d.category === "spec-coverage"
      );
      return {
        value: hasSpecCoverage ? 1.0 : 0.3,
        label: "Spec Coverage",
      };
    }

    case 7: {
      const defs = getExitCriteriaForPhase(7);
      if (defs.length === 0) return { value: 1.0, label: "Lessons Quality" };
      const metCount = state.exitCriteria.filter(
        (c) => c.phase === 7 && c.met
      ).length;
      return { value: metCount / defs.length, label: "Lessons Quality" };
    }

    default:
      return { value: 0.5, label: "Unknown" };
  }
}

/**
 * Count 2↔3 iteration cycles from history[].
 * Each pair of transitions (2→3, 3→2) = 1 full cycle.
 */
function countIterationCycles(state: PhaseState): number {
  const loopTransitions = state.history.filter(
    (h) => (h.from === 2 && h.to === 3) || (h.from === 3 && h.to === 2)
  );
  return Math.ceil(loopTransitions.length / 2);
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
