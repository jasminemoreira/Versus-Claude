// Detailed behavioral instructions per phase of Iterative Convergence v3.6
// Consumed by inject-context.ts (summary) and get_phase_guidance MCP tool (full)

export interface PhaseGuidance {
  phase: number;
  summary: string;       // ~100 chars for inject-context
  rules: string[];       // applicable global rules
  instructions: string;  // full phase instructions
}

// Global rules injected according to phase
const GLOBAL_RULES = {
  R1: "R1: Evaluate triggers before coding. If triggered → Phase 0. Never skip to implementation.",
  R2: "R2: Every user decision via AskUserQuestion. ALWAYS provide suggested options (single or multi-select) — never send questions without options. Up to 4 questions/call. multiSelect for non-exclusive. Recommended first with '(Recommended)'. Never list options A/B/C in text.",
  R3: "R3: Maximum 1 file per response. Indicate 'File X/N'. Exception: files <30 LOC groupable if total <50% of limit.",
  R4_TIMING: {
    0: "R4: Populate specs/ — refs, domain, competitors.",
    1: "R4: Populate specs/ — technical, models, examples.",
    5: "R4: Consult specs/technical, examples, references, datasets BEFORE each module.",
    6: "R4: Use specs/datasets (ground truth), specs/validation (criteria), specs/technical (ranges).",
    7: "R4: Update specs/validation (results), specs/technical (final decisions), specs/references.",
  },
};

// [G9] Property 1 — Generative Invariance + [G12] Adoption criterion
const ACTIVATION_TRIGGERS = `## ACTIVATION TRIGGERS

### Fundamental principle (Generative Invariance):
The methodology does NOT improve the model — it improves the PROCESS. The same LLM operates with or without the methodology. The difference is external verification at each gate.

### Adoption criterion (risk asymmetry):
Cost of applying to a simple project ≈ 20 min overhead. Cost of NOT applying to a complex project ≈ hours/days of rework.
Formal rule: apply when C_methodology_overhead < P(error) × C_undetected_error.

### Evaluate in sequence BEFORE proposing implementation:
1. Does not involve creating/modifying code → Answer directly
2. Requirement has vague words ("fancy", "scalable") → USE METHODOLOGY
3. Involves architectural decision → USE METHODOLOGY
4. User mentioned methodology → MANDATORY
5. Signs of hidden complexity → USE METHODOLOGY

Complexity signals (just 1 is enough): multiple domains, external integrations, request doesn't fit in 1 sentence, AI can't visualize complete solution, uncertainty about complexity.
Golden rule: if you can't assert it's simple, it's not simple.

When activating: announce detected triggers, observed signals, phases 0-7 summary, declare no coding until passing through Phases 0-4.`;

// [G1] Anti-patterns — referenced in relevant phases
const ANTIPATTERNS = `## ANTI-PATTERNS TO AVOID

| # | Anti-pattern | Description | Antidote |
|---|-------------|-------------|----------|
| AP1 | Validation theater | Asking the AI "is this design good?" and accepting affirmative response. AI has agreement bias (RLHF). | Never ask for validation — ask for REFUTATION. |
| AP2 | Complexity as false solution | When critique reveals fragility, adding components instead of simplifying. "Second-system effect" (Brooks). | Each iteration must simplify, not complexify. |
| AP3 | Monolithic session | Design, code, and tests in a single conversation. Context saturates and quality degrades. | One session per phase, one phase per module. |
| AP4 | Implicit assumption | The design works — as long as unlisted conditions are true. | Assumptions lens in Phase 2 + assumptions in Phase 1. |
| AP5 | Absence of human-AV | Relying exclusively on automated tests. Semantic adequacy and domain correctness require human judgment. | S4 expanded + mandatory manual testing. |
| AP6 | Skipping Phase 0 | Starting with architecture without understanding the problem. Wrong complexity propagates through all phases. Cost: 100×. | S0: Score ≥90 mandatory. |
| AP7 | Coding without reference | Implementing algorithms without consulting specs/ or literature. The AI will generate plausible code with invented parameters. | S6: Tier 1/2/3 + specs/technical populated. |
| AP8 | Convergent perfectionism | Infinite cycles seeking "perfect" design. | Stop criterion: <15% change + 0 critical → advance. S2: stopping is the user's decision. |
| AP9 | Silent scope creep | Adding features during Phases 2-3 without operator approval. | S5: Scope is the user's. Phase 2-3 suggests, never decides. |`;

const PHASE_0_GUIDANCE = `## Phase 0 — Problem Discovery Loop
### Verification: Human-AV (operator validates synthesis and teach-back)

### Step 0: Read ALL content from specs/ before asking questions. Build on what already exists.

### HIERARCHICAL SEMANTIC ANALYSIS (HSA) — 5-level exploration:
Explore the problem systematically from the broadest context (Domain) to the concrete deliverable (Product). Each level builds on the previous. Use AskUserQuestion (R2) at every level.

---

### Level 1 — DOMAIN (Context & Vocabulary)
Establish the semantic universe of the problem before diving into specifics.

| Sub-area | Key Questions |
|----------|--------------|
| Vocabulary | Key terms and definitions. Synonyms to avoid? |
| Vague Terms | Clarify: "fancy"→concrete, "scalable"→N users, "fast"→ms |
| Theoretical Field | What discipline(s) does this belong to? What foundational knowledge applies? |
| Methodologies | Are there established methodologies or standards in this domain? |
| Tools & Ecosystem | What tools, platforms, and libraries define this domain's landscape? |

**Technical AND scientific research (MANDATORY for specialized domains):**
If the project involves DSP, ML, bioinformatics, engineering, sciences etc.: research BEFORE architecture:
- **Scientific:** Peer-reviewed reference papers, theoretical foundations of the domain, applicable mathematical/physical models, constants and parameters validated by literature
- **Technical:** Candidate algorithms with trade-offs, reference implementations, published benchmarks, mature tools and libraries
- **Competitive:** Competing solutions, state of the art, known gaps
- Deposit EVERYTHING in specs/ (references, technical, competitors)
- Each numerical parameter MUST have a cited source (paper, standard, specification)
- Rule: "Do not implement an algorithm without a verifiable bibliographic reference"

---

### Level 2 — PROBLEM (5W1H)
Define the problem precisely using the 5W1H framework.

| Sub-area | Key Questions |
|----------|--------------|
| Why (Motivation) | Why is it needed? What happens without it? What pain does it solve? |
| Who (Actors) | Who are the users? Who are the stakeholders? Who is affected? |
| What (Scope) | What exactly needs to be done? What is the core capability? |
| When (Timing) | When is it needed? Are there temporal constraints, deadlines, sequences? |
| Where (Context) | Where does it run? What environment, platform, infrastructure? |
| How (Approach) | How should it work at a high level? Any mandatory approach or constraint? |

---

### Level 3 — ELEMENTS (Parts & Constraints)
Identify the concrete components, entities, and constraints of the system.

| Sub-area | Key Questions |
|----------|--------------|
| Components | What are the main parts/modules of the system? |
| Entities | What data entities, models, or domain objects exist? |
| Resources | What external resources are needed (APIs, DBs, services, files)? |
| Actors | What human or system actors interact with each component? |
| Constraints | Technical limitations, resource constraints. Assumed premises? |

---

### Level 4 — PROCESSES (Flows & Feasibility)
Map the dynamic behavior: how components interact, transform, and communicate.

| Sub-area | Key Questions |
|----------|--------------|
| Use Cases | 3-5 main scenarios (actor/objective/flow). Edge cases? |
| Relationships | How do components relate? What are the dependencies? |
| Transformations | What data transformations occur? What are the inputs/outputs? |
| Flows | What are the main execution flows? What triggers them? |
| Events | What events does the system react to? What does it emit? |
| Tech Feasibility | Does the target platform support the fundamental mechanisms? |

**Tech Feasibility (MANDATORY VERIFICATION):**
**LESSON LEARNED:** Tech feasibility of the target platform must be VERIFIED, not assumed.
Before advancing, answer EXPLICITLY:
- Does the target platform support the fundamental mechanisms needed? (APIs, protocols, extensibility)
- In porting/migration projects: does the destination platform have capability parity with the source?
- Which capabilities are ESSENTIAL vs. DESIRABLE? Is any essential one absent?

If any essential capability is absent → BLOCKER. Do not advance without resolution.
Do not cut scope to fit the technology. Compare alternatives with table (requirements × techs, LOC, libs, platform). Ask the user via AskUserQuestion.

---

### Level 5 — PRODUCT (Deliverables & Criteria)
Define what "done" looks like — the expected output and how to measure success.

| Sub-area | Key Questions |
|----------|--------------|
| Desired Result | What is the final deliverable? What does the user get? |
| Deliverables | Concrete artifacts: files, APIs, interfaces, documentation? |
| Success Criteria | How do we measure success? (measurable and verifiable) |
| Acceptance Criteria | What must be true for the user to accept the result? |
| Out of Scope (YAGNI) | What NOT to do, with cost/benefit justification |

---

### CROSS-CUTTING — Documentation & Research (all levels):
| Sub-area | Action |
|----------|--------|
| Documentation | Specs, RFCs, legacy code, issues. Content in specs/? |
| Web Research | If specs/ has critical gaps, ask user permission to research. Options: research and deposit / research and present / don't research. Cite source/URL in all deposited material. |

---

### SYNTHESIS (Teach-Back) — Mandatory template:
\`\`\`markdown
# My Understanding (Iteration N)

## Level 1 — Domain
### Vocabulary (term | understanding | example)
### Domain Context (field, methodologies, relevant standards)

## Level 2 — Problem
### Summary in 3 Sentences (problem, not solution)
### 5W1H (Why | Who | What | When | Where | How)

## Level 3 — Elements
### Components & Entities identified
### Constraints & Assumptions

## Level 4 — Processes
### Main Use Cases (actor/objective/flow/concrete example)
### Key Flows & Relationships

## Level 5 — Product
### Deliverables & Success Criteria (measurable and verifiable)
### Out of Scope (item | reason)

## Remaining Ambiguities
## Questions for Next Iteration
\`\`\`

### VALIDATION — via AskUserQuestion: correct / almost / incomplete / wrong
**CAUTION AP1 (Validation theater):** The human evaluates the WRITTEN SYNTHESIS, does not ask the AI if it's correct.

### CONVERGENCE ASSESSMENT (0-100) — use update_score():
| Criterion | Weight |
|-----------|--------|
| Problem Clarity | 10 |
| Complete Use Cases | 15 |
| Defined Vocabulary | 10 |
| Resolved Ambiguities | 15 |
| Explicit Out of Scope | 10 |
| Success Criteria | 10 |
| Validated Assumptions | 10 |
| Documentation/Research (technical+scientific) + specs/ | 5 |
| User Confirmed | 10 |
| AI Confident | 5 |

≥90 → Phase 1 | 70-89 → +1 iteration | <70 → multiple iterations
**CAUTION AP8 (Perfectionism):** Score ≥90 is sufficient. Don't aim for 100.

### Implementation Feasibility — evaluate per component:
- Tier 1: Does a mature lib exist? → USE IT
- Tier 2: Is there a documented algorithm with a reference implementation? → PORT IT
- Tier 3: Neither of the above. If complex domain → mandatory PoC before Phase 1`;

// [G4] 4 architecture questions + [G6] decoupled sessions
const PHASE_1_GUIDANCE = `## Phase 1 — Architecture
### Verification: Human-AV (operator validates adequacy and completeness)

### Step 0: Consult and populate specs/
Read specs/technical, examples, models, design. If critical technical/scientific material is missing, research and deposit BEFORE defining modules.

### The 4 questions architecture MUST answer:
1. **Decomposition.** What are the modules? What are their responsibilities? Where are the boundaries? (SRP, Separation of Concerns)
2. **Interfaces.** How do modules communicate? What are the contracts? (Design by Contract)
3. **Assumptions.** What does the system assume as true? Implicit assumptions are the most common source of failures. (Leveson)
4. **Negative scope.** What does the system deliberately NOT do? Conscious limitations prevent scope creep.

### Granularity principle (E = I₀/C):
Each module must be understandable by the AI in a SINGLE interaction. If it doesn't fit in context with its dependencies, it needs to be decomposed. Interfaces work as "executable summaries" — the AI doesn't need module B's code, only B's interface.

### Step 1: Pattern and Principle Collection (2 AskUserQuestion calls):

**Call 1 (up to 4 questions):**
1. Architectural Pattern (single): Clean Architecture / Layered / Hexagonal / Modular Monolith
2. Cross-cutting Principles (multi): SOLID / KISS+YAGNI / DDD / Composition over Inheritance
3. Concurrency (single): Single-threaded / Actor Model / Message Queue / N/A

**Call 2 (up to 4 questions):**
4. Relevant GoF (multi): select the most pertinent + "None specific"
5. Fowler Patterns — Domain (single): Domain Model / Transaction Script / Table Module
6. Fowler Patterns — Data (single): Repository+Data Mapper / Active Record / Table Data Gateway

Present summary in table, confirm via AskUserQuestion.

### Technological Validation:
If >1 tech option: comparative table (requirements × techs, LOC, dependencies, LLM context consumption).
Assumptions verified with evidence (specs/technical), not assumed. **CAUTION AP4 (Implicit assumptions).**
If tech forces scope reduction → wrong tech.

### Progressive Scope:
When maturity/risk is unequal: maturity map (req | mature lib? | LOC | risk).
Offer via AskUserQuestion: progressive scope (v1.0 mature, v2.0 rest) / all in v1.0 / other.
Progressive scope ≠ cut: preserves 100%, distributes across versions.

### Session planning (decoupled cycle):
Future work will follow independent sessions:
- Design Session (Phases 0-4): context = domain + constraints → architecture + interfaces
- Code Session (Phase 5): context = architecture + module interface → 100% dedicated
- Test Session (Phase 6): context = interface + contract → no need for internal code
- Validation Session: CI/CD runs tests → AI only invoked for corrections
**CAUTION AP3 (Monolithic session):** Separating phases into distinct sessions preserves context efficiency.`;

// [G2] Critique-response asymmetry + [G3] Concentration analysis + [G8] AV types + [G10] Gate criteria
const PHASE_2_GUIDANCE = `## Phase 2 — Adversarial Critique
### Verification: Human-AV + AG (7 universal + up to 8 conditional lenses as operationally distinct AVs)

### Critique-response asymmetry principle:
**Phase 2 = MULTIPLE agents to ATTACK** (lens diversity is value).
**Phase 3 = UNIFIED agent to RESPOND** (corrections must be integrated into the whole).
**Human operator = ARBITRATE trade-offs** (systemic vision).
Different lenses see different flaws. Isolated responses may be individually correct but systemically contradictory.

### Universal Lenses (ALL always applied — low cost in planning, high risk if omitted):
| Lens | Central Question | Exclusive Failure Class |
|------|-----------------|------------------------|
| Assumptions | What does this design assume as true without declaring? | Failures from hidden assumptions |
| Architectural | Can each module be replaced, removed, or tested in isolation? | Hidden coupling, circular dependencies, SRP violation |
| Implementability | Can I code this module in a single session with available context? | Incomplete specs, insufficient granularity |
| Scientific | Does each value/formula/algorithm have a verifiable bibliographic reference? | Invented parameters, plausibility-based logic |
| Security | How would an attacker exploit this with minimal effort? | Unanalyzed attack surface |
| Performance | Where are the bottlenecks? Asymptotic behavior? | Hidden bottlenecks, degradation at scale |
| Regulatory | Does each normative requirement have traceability to a module? | Non-compliance with applicable standards |

Selection principle: if removing this lens, is there a failure class that NO other lens detects? If yes → legitimate. If not → redundancy.

### Conditional Lenses (activate based on project context from ProjectSpec):
| Lens | Central Question | Exclusive Failure Class | Activate when... |
|------|-----------------|------------------------|------------------|
| Resilience | What happens when an external dependency fails, responds slowly, or returns unexpected data? | Cascading failures, retry storms, partial outages | External dependencies (APIs, DBs, queues, third-party services) |
| UI/UX | Can the user complete their task without frustration, confusion, or error? | Confusing flows, dead-end states, missing feedback, accessibility failures | User-facing interface |
| Migration / Coexistence | What breaks during the transition from old to new? Is there a rollback path? | Data loss in migration, functional regression vs. legacy, impossible rollback | Replacing or modifying existing production system |
| Sustainability / Proportionality | Is resource consumption proportionate to value delivered? Cost at 10× scale? | GPU where CPU suffices, heavy model for simple task, infinite data retention | Significant computational costs (AI/ML, data processing, cloud-native) |
| Ethical / Human Impact | Who is potentially harmed? Are there audit, correction, and transparency mechanisms? | Algorithmic bias, digital exclusion, automated decisions without human recourse | Automated decisions about people (scoring, classification, moderation) |
| Process / Workflow | Are processes, state transitions, actor responsibilities, and exception paths complete? | Orphaned states, ambiguous handoffs, missing actors, happy-path bias | Multi-actor flows, state machines, or business processes |
| Governance / Accountability | Is every action attributable? Does every data entity have a defined owner? | No data ownership, no accountability, shadow data flows | Multiple teams, data domains, or compliance (SOC2, LGPD, HIPAA) |
| Observability / Operability | Can degradation be detected and incidents diagnosed in production without code changes? | Opaque systems where nobody can figure out why it failed | Production systems with operational requirements |

Conditional lens activation: review ProjectSpec (stack, constraints, out-of-scope) and activate applicable lenses. Record activated set with record_decision(category='architecture').

### Protocol per lens:
1. Apply central question to EACH module
2. Classify findings: 🔴 Critical (blocks) | 🟡 Important (degrades) | 🟢 Suggestion
3. Finding = concrete evidence, not opinion
4. Passes are independent (one lens at a time)
**CAUTION AP1 (Validation theater):** Never ask "is it good?". Ask for refutation.

### Coverage Matrix (mandatory):
Table of modules × lenses (universal + activated conditional) with severities.

### Concentration analysis (MANDATORY after the matrix):
- **Concentration by module:** Module with findings across ALL lenses → probably poorly conceived → requires REDESIGN, not patch.
- **Concentration by lens:** Lens with findings across ALL modules → SYSTEMIC failure (e.g.: no parameter has a reference, no module testable in isolation).
- Document concentration patterns with record_decision().

### Exit Gate:
- Zero 🔴 to advance → all must be addressed in Phase 3
- Each 🟡 requires EXPLICIT decision: treat OR accept risk WITH DOCUMENTED justification (record_decision)
- 🟢 can be deferred to v2.0 (record in record_decision)

### BOUNDARY RULE (Scope vs Architecture):
Phase 2-3 CAN: change libs/patterns/communication, simplify modules, add technical mechanisms.
Phase 2-3 CANNOT: cut requirements, add features, change target audience/use cases.
TEST: "Does this change WHAT the system does?" or "WHO it serves?" → If yes = SCOPE → back to Phase 0.
**CAUTION AP9 (Silent scope creep).**`;

// [G2] Asymmetry: unified agent to respond
const PHASE_3_GUIDANCE = `## Phase 3 — Simplification
### Verification: Human-AV (operator validates that complexity decreased and scope preserved)

### Asymmetry principle (continuation of Phase 2):
Phase 2 attacked with MULTIPLE lenses. Phase 3 responds with UNIFIED VISION.
Individually correct corrections may be systemically contradictory.
Integrate all responses into the whole — don't correct module by module in isolation.
Trade-offs resolved by the HUMAN OPERATOR (S2: stopping criterion is the user's).

### Purpose: Simplify V(N) → V(N+1), eliminating complexity.
**CAUTION AP2 (Complexity as false solution):** Each iteration must SIMPLIFY, not complexify.

### Mandatory distinction:
- Adding Worker/cache/fallback = architecture (OK)
- Adding tutorial/button/animation = feature (FORBIDDEN)

### If LOC increased >10%: MANDATORY justification documented with record_decision().

### Post-cycle 2-3 decision (via AskUserQuestion):
| Structural change | Critical | Action |
|---|---|---|
| <15% | 0 | → Phase 4 |
| 15-25% | 0-1 | 1 more iteration |
| >25% | 2+ | Multiple iterations |

**CAUTION AP8 (Perfectionism):** The stopping criterion is honesty — we know what works, what we assume, and what we don't know.

### Anti-Scope-Creep Checklist (MANDATORY before advancing):
1. ALL Phase 0 requirements covered
2. No unsolicited features added
3. What the system DOES hasn't changed (only HOW)
4. Phase 0 use cases remain valid`;

// [G8] AV types explicit
const PHASE_4_GUIDANCE = `## Phase 4 — Convergence Gate
### Verification: Human-AV (operator validates convergence with rigorous criteria)

Validate complete convergence — this gate decides if the design is ready for code:

1. Verify ALL exit criteria of Phases 2-3 (use get_exit_criteria for Phase 2 and Phase 3)
2. Verify ALL safeguards S1-S5 (use check_all_safeguards)
3. Verify: are the 4 P1 questions still answered? (Decomposition, Interfaces, Assumptions, Negative scope)
4. Verify: did the matrix concentration analysis reveal unresolved systemic failures?
5. Verify: is specs/ populated with technical and scientific references needed for Phase 5?
6. Only advance to Phase 5 if EVERYTHING is OK
7. If something failed → return to Phase 2 or 3 as needed

**CAUTION AP6 (Skipping phases):** Don't advance with pending items. The cost of discovering problems in Phase 5-6 is 10× higher than solving them here.`;

// [G6] decoupled sessions + [G8] AV types
const PHASE_5_GUIDANCE = `## Phase 5 — Code Implementation
### Verification: Automated-AV (compile, lint, type check) | Dedicated session per module

### Decoupled session principle:
Each module must be implementable in an independent session. Required context: architecture document (~2k tokens) + module interface + relevant specs/. If more is needed → insufficient granularity (return to P1).
**CAUTION AP3 (Monolithic session).**

### BEFORE each module, consult:
- specs/technical (algorithm, formulas, params)
- specs/examples (reference code)
- specs/references (original paper)
- specs/datasets (test data)
If numerical parameters without values in specs/ → STOP and research. Reference source in code.
**CAUTION AP7 (Coding without reference).**

### Apply S6 (Tier 1/2/3) per module:
- Tier 1: Does a mature lib exist? → USE IT. New code = UI + integration + glue.
- Tier 2: Documented algorithm with ref? → PORT literally (same structure, same names, test against same inputs).
- Tier 3: Neither of the above. If complex domain → deposit logic in specs/technical before coding.

### Checklist per module: mature lib? → if not, why? → documented algorithm? → portable implementation? → decision with record_decision().

### Apply S7 (Discipline):
After each file: mark completed, identify next, announce "X/N completed, next: Y", start immediately. Don't start tangential discussions.

### S6 alarm signal (immediate STOP):
If creating heuristics for problems with known solutions, debugging complex logic written from scratch, doing trial-and-error on something deterministic, or spending >2 iterations on the same module → STOP, communicate, seek reference implementation (Tier 2).`;

// [G8] AV types
const PHASE_6_GUIDANCE = `## Phase 6 — Tests
### Verification: Automated-AV (unit tests, integration) + Human-AV (manual exploratory testing)

### Specs-based tests:
- specs/datasets → test against ground truth (if empty, generate synthetic data and deposit)
- specs/validation → each criterion ≥ 1 test
- specs/technical → outputs within documented ranges

### S4 — Explicit Verification: NEVER assume tests passed. Always execute and verify output.
**CAUTION AP5 (Absence of human-AV):** Automated tests verify formalizable properties. Semantic adequacy, usability, and domain correctness REQUIRE human judgment.

### Manual Exploratory Testing (MANDATORY before Phase 7):
1. Start the application
2. Execute each Phase 0 use case as an end user
3. Test edge cases: rapid/double clicks, empty inputs, interruptions, timeouts
4. Evaluate feedback: are messages understandable? Non-technical errors? Actionable results?
5. Document and fix issues

Both (automated + manual) are mandatory gates. Neither replaces the other.`;

// [G5] Meta-iteration v1→v2 + [G11] double-loop + [G8] AV type
const PHASE_7_GUIDANCE = `## Phase 7 — Post-Review
### Verification: Human-AV (operator evaluates lessons and approves method changes)

### Update specs/:
- specs/validation → actual results (expected vs obtained)
- specs/technical → final decisions, discarded algorithms and why
- specs/references → references discovered during correction

### Double-loop learning (Argyris):
Single-loop: evaluate the PRODUCT (does the software work?).
Double-loop: evaluate the PROCESS (did the methodology work? Where was there friction?).
Phase 7 does BOTH.

### Methodology Self-Improvement (5 steps):

**Step 1 — Human collection (mandatory FIRST):** Ask via AskUserQuestion if any part caused friction or failed. The human experienced the process and detects friction that the AI doesn't perceive about itself.

**Step 2 — AI self-assessment (complementary):** Phase that lacked checklist, absent safeguard, inadequate template, valueless rule, recurring pattern.

**Step 3 — Consolidate** in table (source [human/AI] | phase | proposal | justification).

**Step 4 — Apply** via AskUserQuestion: review one by one (recommended) / apply all / don't update. For each diff, show before/after and request approval. Proposals go through gate: operator approves or rejects.

**Step 5 — Increment version** of SKILL.md.

Limits: AI has agreement bias about itself. Human detects friction → AI proposes → human approves. Never modify SKILL.md without approval.

### Meta-iteration v1.0 → v2.0:
If the project evolves to a new version:
- specs/ from v1.0 is the BASELINE for v2.0 — knowledge is NOT lost between cycles
- Phase 0 of v2.0 starts from existing specs/ (doesn't restart from zero)
- Previous decisions (get_decisions) serve as context — what was discarded and why
- Negative scope from v1.0 can become v2.0 scope (with operator approval)
- Phase 7 lessons from v1.0 feed into v2.0's process
Record version decision with record_decision(category='scope').`;

const FULL_GUIDANCE: Record<number, string> = {
  0: PHASE_0_GUIDANCE,
  1: PHASE_1_GUIDANCE,
  2: PHASE_2_GUIDANCE,
  3: PHASE_3_GUIDANCE,
  4: PHASE_4_GUIDANCE,
  5: PHASE_5_GUIDANCE,
  6: PHASE_6_GUIDANCE,
  7: PHASE_7_GUIDANCE,
};

/**
 * Returns the FULL guidance for the phase (for MCP tool get_phase_guidance).
 * Includes: global rules + triggers + anti-patterns + phase instructions.
 */
export function getFullGuidance(phase: number): string {
  const parts: string[] = [];

  // Global rules always applicable
  parts.push("## ACTIVE GLOBAL RULES");
  parts.push(GLOBAL_RULES.R2); // R2 always active

  if (phase < 5) {
    parts.push(GLOBAL_RULES.R1);
  }
  if (phase === 5) {
    parts.push(GLOBAL_RULES.R3);
  }

  // R4 phase-specific timing
  const r4 = GLOBAL_RULES.R4_TIMING[phase as keyof typeof GLOBAL_RULES.R4_TIMING];
  if (r4) {
    parts.push(r4);
  }

  // Activation triggers (relevant in Phase 0 or pre-methodology)
  if (phase === 0) {
    parts.push("");
    parts.push(ACTIVATION_TRIGGERS);
  }

  // Anti-patterns (include in all phases — they are global alerts)
  parts.push("");
  parts.push(ANTIPATTERNS);

  // Full phase instructions
  const phaseGuidance = FULL_GUIDANCE[phase];
  if (phaseGuidance) {
    parts.push("");
    parts.push(phaseGuidance);
  }

  return parts.join("\n");
}

/**
 * Returns COMPACT guidance for the phase (for inject-context.ts).
 * Maximum ~200 chars to avoid spending too many tokens.
 */
export function getCompactGuidance(phase: number): string[] {
  const lines: string[] = [];

  switch (phase) {
    case 0:
      lines.push("INSTRUCTIONS P0: HSA 5-level exploration (1.Domain 2.Problem-5W1H 3.Elements 4.Processes 5.Product). AskUserQuestion per level. Mandatory teach-back. Technical+scientific research if specialized domain. Tier 1/2/3 feasibility. Score ≥90.");
      lines.push("R2: Every decision via AskUserQuestion. AP1: never ask for validation, ask for REFUTATION.");
      break;
    case 1:
      lines.push("INSTRUCTIONS P1: 4 questions (Decomposition, Interfaces, Assumptions, Negative scope). 2 AskUserQuestion calls (patterns). Granularity: each module fits in 1 AI session.");
      lines.push("R2+R4: specs/technical,models,examples. AP3: plan decoupled sessions for P5-P6.");
      break;
    case 2:
      lines.push("INSTRUCTIONS P2: 7 universal + conditional lenses on EACH module → 🔴🟡🟢. Activate conditional lenses from ProjectSpec. Matrix + concentration analysis (module×lenses). ASYMMETRY: multiple agents attack, unified responds in P3.");
      lines.push("BOUNDARY: do NOT cut/add requirements. AP1: ask for refutation, not validation.");
      break;
    case 3:
      lines.push("INSTRUCTIONS P3: Simplify V(N)→V(N+1) with UNIFIED vision. <15%/0crit→P4, 15-25%→+1iter, >25%→multiple. Anti-scope-creep checklist.");
      lines.push("ASYMMETRY: integrate all corrections into the whole. AP2: simplify, not complexify. AP8: don't seek perfection.");
      break;
    case 4:
      lines.push("INSTRUCTIONS P4: Convergence gate. Exit criteria P2-P3 + safeguards S1-S5 + 4 P1 questions + specs/ complete. get_exit_criteria() + check_all_safeguards().");
      break;
    case 5:
      lines.push("INSTRUCTIONS P5: Consult specs/ BEFORE each module. S6: Tier 1(lib)→2(port)→3(new). S7: mark completed, announce X/N, start next.");
      lines.push("R3: 1 file/response. AP7: never code without reference. STOP if trial-and-error or >2 iter.");
      break;
    case 6:
      lines.push("INSTRUCTIONS P6: Specs-based tests + S4 (execute and verify). AP5: human-AV irreplaceable for semantic adequacy.");
      lines.push("MANDATORY MANUAL TEST: 5 steps. Both (automated+manual) are gates. Neither replaces the other.");
      break;
    case 7:
      lines.push("INSTRUCTIONS P7: Double-loop: evaluate PRODUCT and PROCESS. Update specs/. 5 steps: human first→AI→consolidate→apply→version.");
      lines.push("Meta-iteration: specs/ from v1.0 is v2.0 baseline. NEVER modify SKILL.md without approval.");
      break;
  }

  return lines;
}
