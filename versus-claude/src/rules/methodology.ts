// Facade das regras da Convergência Iterativa v3.6

import { PhaseState } from "../state/types";
import {
  PhaseDefinition,
  ExitCriterionDef,
  getPhaseDefinition,
  getExitCriteriaForPhase,
  isValidTransition,
} from "./phases";
import {
  SafeguardDef,
  SafeguardResult,
  getSafeguardDefinition,
  getSafeguardsForPhase,
  validateSafeguard,
} from "./safeguards";

export interface ValidationResult {
  valid: boolean;
  missingCriteria: string[];
  specsWarnings: string[];
  safeguardViolations: string[];
}

export {
  PhaseDefinition,
  ExitCriterionDef,
  SafeguardDef,
  SafeguardResult,
};

export function getPhase(phase: number): PhaseDefinition | undefined {
  return getPhaseDefinition(phase);
}

export function getExitCriteria(phase: number): ExitCriterionDef[] {
  return getExitCriteriaForPhase(phase);
}

export function getSafeguard(id: string): SafeguardDef | undefined {
  return getSafeguardDefinition(id);
}

export function getApplicableSafeguards(phase: number): SafeguardDef[] {
  return getSafeguardsForPhase(phase);
}

export function checkSafeguard(id: string, state: PhaseState): SafeguardResult {
  return validateSafeguard(id, state);
}

export function checkAllSafeguards(state: PhaseState): SafeguardResult[] {
  const applicable = getSafeguardsForPhase(state.currentPhase);
  return applicable.map((s) => validateSafeguard(s.id, state));
}

export function validatePhaseTransition(
  from: number,
  to: number,
  state: PhaseState,
  exitCriteriaMet: Map<string, boolean>
): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    missingCriteria: [],
    specsWarnings: [],
    safeguardViolations: [],
  };

  // Verificar se transição é válida
  if (!isValidTransition(from, to)) {
    result.valid = false;
    result.missingCriteria.push(
      `Transição de Phase ${from} para Phase ${to} não é permitida. Transições válidas: sequencial ou loop 2↔3.`
    );
    return result;
  }

  // Verificar exit criteria da fase atual (para avançar)
  if (to > from) {
    const criteria = getExitCriteriaForPhase(from);
    for (const criterion of criteria) {
      if (criterion.required && !exitCriteriaMet.get(criterion.criterion)) {
        result.valid = false;
        result.missingCriteria.push(
          `[Phase ${from}] ${criterion.criterion}: ${criterion.description}`
        );
      }
    }
  }

  // Verificar Phase 0 score especificamente
  if (from === 0 && to === 1) {
    if (state.phase0Score === null || state.phase0Score < 90) {
      result.valid = false;
      result.missingCriteria.push(
        `Score Phase 0 = ${state.phase0Score ?? "null"}. Necessário >= 90.`
      );
    }
  }

  // Verificar salvaguardas aplicáveis
  const safeguards = getSafeguardsForPhase(from);
  for (const safeguard of safeguards) {
    const check = validateSafeguard(safeguard.id, state);
    if (check.status === "violated") {
      result.valid = false;
      result.safeguardViolations.push(`${safeguard.id}: ${check.details}`);
    }
  }

  return result;
}
