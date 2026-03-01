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
  R5: `R5: Mandatory Display — essential outputs MUST be shown in chat. Do NOT process internally without displaying.
Per phase:
- P0: Score breakdown table (all 10 criteria + weights + total). Teach-back synthesis (full 5-level template). Delivery Target question.
- P1: 4 architecture answers. Pattern summary table. Progressive Scope decision (if applicable). Technology comparison table (if >1 option).
- P2: Coverage matrix (modules × lenses with 🔴🟡🟢). Concentration analysis (by module + by lens). Activated conditional lenses list. Exit gate summary.
- P3: Post-cycle decision (AI computes structural change % and criticals, presents recommendation, user confirms). Anti-scope-creep checklist verification. LOC justification (if >10% increase).
- P4: Convergence verification report (exit criteria + safeguards + specs status). LLM Switch Point notification.
- P5: Progress announcements ("X/N completed, next: Y") after each file.
- P6: Test Map (spec→test→type). Spec Coverage Report (COVERED/NOT COVERED/GAPS). Testing status record (TESTING STATUS / PASS / FAIL / NEXT). Manual testing report.
- P7: Double-loop learning report. Consolidation table (source | phase | proposal | justification). Meta-iteration offer.
Rule: If you computed it, SHOW it. The user cannot validate what they cannot see.`,
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

**Delivery Target (MANDATORY question via AskUserQuestion):**
Ask: "What is the delivery target for this project?"
- Option 1: "Complete product" — all requirements delivered in a single cycle. No scope splitting unless a technical blocker exists.
- Option 2: "MVP first, then iterate" — minimal viable product, with deferred features planned for future cycles.
- Option 3: "Prototype / proof of concept" — disposable, for validation only.

Record the answer with record_decision(category='scope', content='DELIVERY TARGET: ...').
This decision conditions Phase 1's Progressive Scope: if the user chose "Complete product", do NOT offer v1.0/v2.0 scope splitting unless there is an explicit technical blocker (missing platform capability, immature dependency). The AI must not reduce scope by preference — only by necessity.

---

### CROSS-CUTTING — Documentation & Research (all levels):
| Sub-area | Action |
|----------|--------|
| Documentation | Specs, RFCs, legacy code, issues. Content in specs/? |
| Web Research | If specs/ has critical gaps, ask user permission to research. Options: research and deposit / research and present / don't research. Cite source/URL in all deposited material. |

---

### SYNTHESIS (Teach-Back) — Mandatory template (⚠️ MUST DISPLAY full template in chat):
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

### CONVERGENCE ASSESSMENT (0-100) — use update_score() (⚠️ MUST DISPLAY breakdown table in chat):
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
| AI Confident (can answer "why?" for every scope, assumption, and decision) | 5 |

≥90 → Phase 1 | 70-89 → +1 iteration | <70 → multiple iterations
**If score < 90:** call start_iteration() to open the next iteration, then continue HSA focusing on the criteria with lowest scores. Do NOT offer to advance to Phase 1 — iterate until score ≥ 90.
**If score ≥ 90:** call advance_phase() to advance to Phase 1. Inform the user.
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
**FIRST:** Check the Phase 0 delivery target decision (get_decisions with category='scope', look for 'DELIVERY TARGET').
- If "Complete product": do NOT offer v1.0/v2.0 scope splitting. All requirements must be delivered in a single cycle. Only split if there is an explicit TECHNICAL BLOCKER (missing platform capability, immature dependency, infeasible Tier 3 without PoC). If splitting is forced by a blocker, document the blocker clearly with record_decision().
- If "MVP first" or "Prototype": offer progressive scope as below.

When maturity/risk is unequal: maturity map (req | mature lib? | LOC | risk).
Offer via AskUserQuestion: progressive scope (v1.0 mature, v2.0 rest) / all in v1.0 / other.
Progressive scope ≠ cut: preserves 100%, distributes across versions.
**The AI must NEVER reduce scope by preference — only by documented technical necessity.**

### Session planning (decoupled cycle):
Future work will follow independent sessions:
- Design Session (Phases 0-4): context = domain + constraints → architecture + interfaces
- Code Session (Phase 5): context = architecture + module interface → 100% dedicated
- Test Session (Phase 6): context = interface + contract → no need for internal code
- Validation Session: CI/CD runs tests → AI only invoked for corrections
**CAUTION AP3 (Monolithic session):** Separating phases into distinct sessions preserves context efficiency.

### Next Step (MANDATORY after user confirms architecture):
Call advance_phase() to move to Phase 2. Then call get_phase_guidance() and begin Phase 2 immediately: record activated lenses and start the adversarial critique.`;

// [G2] Critique-response asymmetry + [G3] Concentration analysis + [G8] AV types + [G10] Gate criteria
const PHASE_2_GUIDANCE = `## Phase 2 — Adversarial Critique
### Verification: Human-AV + AG (7 universal + up to 12 conditional lenses as operationally distinct AVs)

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
| Control Engineering | Where does the system generate an error signal and correct it? Risk of oscillation or state drift? | Systems that react to events but don't regulate state — oscillation, drift, runaway feedback | State synchronization, runtime configuration affecting behavior, self-correcting or feedback-driven systems |
| Game Theory | Do system actors have aligned incentives? Where does the design assume cooperation and may encounter strategic defection? | Architectures that work under cooperation assumptions but collapse under adversarial or strategic behavior | Multiple independent actors, public API, external integrations, marketplace or platform design |
| Linguistics / Grammar | Is the interface contract unambiguous? Can two correct implementations of the same contract produce incompatible behaviors? | Protocol ambiguity — two correct implementations that are mutually incompatible | Inter-component communication, protocol definitions, message formats, interface contracts between independent teams |
| Mechanical Engineering | Where are the tolerances? Does the system tolerate variation or only work at exact specification? | Rigid coupling disguised as tolerance — failure from small deviations in dependency versions, environment, or load | Module maintenance, system evolution, long-lived systems with technical debt accumulation |

Conditional lens activation: review ProjectSpec (stack, constraints, out-of-scope) and activate applicable lenses. Record activated set with record_decision(category='architecture').

### Protocol per lens:
1. Apply central question to EACH module
2. Classify findings: 🔴 Critical (blocks) | 🟡 Important (degrades) | 🟢 Suggestion
3. Finding = concrete evidence, not opinion
4. Passes are independent (one lens at a time)
**CAUTION AP1 (Validation theater):** Never ask "is it good?". Ask for refutation.

### Coverage Matrix (mandatory) (⚠️ MUST DISPLAY complete table in chat — do NOT summarize or skip modules/lenses):
Table of modules × lenses (universal + activated conditional) with severities.

### Concentration analysis (MANDATORY after the matrix) (⚠️ MUST DISPLAY analysis in chat):
- **Concentration by module:** Module with findings across ALL lenses → probably poorly conceived → requires REDESIGN, not patch.
- **Concentration by lens:** Lens with findings across ALL modules → SYSTEMIC failure (e.g.: no parameter has a reference, no module testable in isolation).
- Document concentration patterns with record_decision().

### Exit Gate (⚠️ MUST DISPLAY gate summary in chat — show total 🔴/🟡/🟢 counts):
- 🔴 Criticals → will be addressed in Phase 3. Do NOT block advancement — Phase 3 exists precisely to resolve criticals.
- 🟡 Important → Phase 3 addresses them or records explicit acceptance with justification (record_decision)
- 🟢 Suggestions → can be deferred to v2.0 (record_decision)
- Zero findings → offer via AskUserQuestion: advance to Phase 3 (optional refinement) OR skip to Phase 4

### Next Step (MANDATORY after displaying gate summary):
Phase 3 always follows Phase 2 when findings exist. After displaying the gate:
- If any findings (🔴/🟡/🟢): call advance_phase() → Phase 3. Inform: "Advancing to Phase 3 to address [N 🔴 criticals, N 🟡 important]."
- If zero findings: offer via AskUserQuestion: "Advance to Phase 3 (optional refinement)" or "Advance to Phase 4 directly".
Do NOT stop and wait. Do NOT block on 🔴 count — criticals are addressed IN Phase 3, not before entering it.

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

### Post-cycle 2-3 decision (⚠️ MUST DISPLAY — the AI computes, the user confirms):
**The user CANNOT know the structural change % — only the AI can compute it.** Do NOT ask the user to choose a percentage range. Instead:

**Step 1 — Compute (AI does this):**
- Compare V(N) architecture with V(N+1): count modules added, removed, or significantly restructured
- Structural change % = (modules changed / total modules) × 100
- Count remaining 🔴 criticals from the Phase 2 matrix that were NOT resolved

**Step 2 — Present (⚠️ MUST DISPLAY in chat):**
Show the computed values AND the reference table:
\`\`\`
Structural change: X% (Y of Z modules changed)
Remaining criticals: N
\`\`\`
| Structural change | Critical | Action |
|---|---|---|
| <15% | 0 | → Phase 4 |
| 15-25% | 0-1 | 1 more iteration |
| >25% | 2+ | Multiple iterations |

**Recommended action: [action based on computed values]**

**Step 3 — Confirm (via AskUserQuestion):**
Present the recommendation and ask: accept recommendation / override (user chooses different action).
The user validates the RECOMMENDATION, not the raw data.

**Step 4 — Execute the agreed action (do NOT stop after confirmation):**
- "→ Phase 4": call advance_phase(), then call get_phase_guidance() and begin Phase 4 convergence verification immediately.
- "1 more iteration" or "Multiple iterations": call start_iteration(), then return to Phase 2 critique with the updated architecture V(N+1). Announce: "Starting iteration N of the 2-3 loop. Returning to Phase 2 critique — apply all lenses to V(N+1)."

**CAUTION AP8 (Perfectionism):** The stopping criterion is honesty — we know what works, what we assume, and what we don't know.

### Anti-Scope-Creep Checklist (MANDATORY before advancing) (⚠️ MUST DISPLAY checklist with ✅/❌ in chat):
1. ALL Phase 0 requirements covered
2. No unsolicited features added
3. What the system DOES hasn't changed (only HOW)
4. Phase 0 use cases remain valid`;

// [G8] AV types explicit
const PHASE_4_GUIDANCE = `## Phase 4 — Convergence Gate
### Verification: Human-AV (operator validates convergence with rigorous criteria)

Validate complete convergence — this gate decides if the design is ready for code (⚠️ MUST DISPLAY convergence verification report with ✅/❌ per item):

1. ✅/❌ Verify ALL exit criteria of Phases 2-3 (use get_exit_criteria for Phase 2 and Phase 3)
2. ✅/❌ Verify ALL safeguards S1-S5 (use check_all_safeguards)
3. ✅/❌ Verify: are the 4 P1 questions still answered? (Decomposition, Interfaces, Assumptions, Negative scope)
4. ✅/❌ Verify: did the matrix concentration analysis reveal unresolved systemic failures?
5. ✅/❌ Verify: is specs/ populated with technical and scientific references needed for Phase 5?
6. Only advance to Phase 5 if EVERYTHING is ✅
7. If something is ❌ → return to Phase 2 or 3 as needed

**CAUTION AP6 (Skipping phases):** Don't advance with pending items. The cost of discovering problems in Phase 5-6 is 10× higher than solving them here.

### LLM Switch Point (⚠️ MUST DISPLAY this notification to the user):
Phase 4 is the natural boundary for switching LLMs to reduce cost. Phases 0-4 (design) require high reasoning capability — use the most capable model available. Phases 5-7 (implementation, tests, review) require code generation and execution — a cheaper/faster model is sufficient since the architecture is already validated and documented in specs/.
Inform the user: "The architecture is fully validated. From Phase 5 onward, you can switch to a faster/cheaper model (e.g., Sonnet instead of Opus) — the design decisions are persisted in state.json and specs/, so no context is lost."

### Next Step (MANDATORY when all items are ✅):
1. Display the LLM Switch Point notification to the user (mandatory before advancing — see above).
2. Call advance_phase() to move to Phase 5.
3. Call get_phase_guidance() and begin Phase 5 implementation immediately: consult specs/ for the first module and start coding.`;

// [G6] decoupled sessions + [G8] AV types
const PHASE_5_GUIDANCE = `## Phase 5 — Code Implementation
### Verification: Automated-AV (compile, lint, type check) | Dedicated session per module

### Decoupled session principle:
Each module must be implementable in an independent session. Required context: architecture document (~2k tokens) + module interface + relevant specs/. If more is needed → insufficient granularity (return to P1).
**CAUTION AP3 (Monolithic session).**

### If starting in a NEW SESSION (LLM Switch or resumed project):
The methodology is context-safe: all decisions persist in state.json, all specs in specs/. To recover context:
1. Call get_decisions() — all architecture, patterns, scope, and P3 decisions.
2. Call check_specs_status() — which spec directories are populated.
3. Read populated specs/ (specs/technical, specs/models, specs/design).
In a CONTINUOUS session (P0→P5 without interruption), the conversation context already holds all decisions — proceed directly to modules.

### BEFORE each module, consult:
- specs/technical (algorithm, formulas, params)
- specs/examples (reference code)
- specs/references (original paper)
- specs/datasets (test data)
If numerical parameters without values in specs/ → STOP and research. Reference source in code.
**CAUTION AP7 (Coding without reference).**

### Binding Constraints from P1/P3 (MUST be respected before writing any code):
The technology stack, patterns, and negative scope decided in P1 (and revised in P3) are HARD CONSTRAINTS. Before coding any module, confirm:
- Tech stack: use ONLY the languages, runtimes, and frameworks explicitly selected in P1.
- Patterns: apply ONLY the architectural patterns chosen. Do not import new patterns.
- Negative scope: do NOT implement anything listed as out-of-scope.
If unsure, check get_decisions(phase=1) — never assume or default to a familiar tech.

### Apply S6 (Tier 1/2/3) per module:
- Tier 1: Does a mature lib exist AND was it approved in P1? → USE IT. New code = UI + integration + glue.
- Tier 2: Documented algorithm with ref? → PORT literally (same structure, same names, test against same inputs).
- Tier 3: Neither of the above. If complex domain → deposit logic in specs/technical before coding.

### Checklist per module: mature lib? → if not, why? → documented algorithm? → portable implementation? → decision with record_decision().

### Apply S7 (Discipline):
After each file: mark completed, identify next, announce "X/N completed, next: Y", start immediately.
Do NOT ask permission between files — implement sequentially and autonomously. Only stop for actual decisions (ambiguity, blocker, Tier choice). Don't start tangential discussions.

### S6 alarm signal (immediate STOP):
If creating heuristics for problems with known solutions, debugging complex logic written from scratch, doing trial-and-error on something deterministic, or spending >2 iterations on the same module → STOP, communicate, seek reference implementation (Tier 2).

### Next Step (MANDATORY when all modules are implemented):
Call advance_phase() to move to Phase 6. Then call get_phase_guidance() and begin Phase 6 testing immediately: recover scope from specs/ and build the Test Map.`;

// [G8] AV types
const PHASE_6_GUIDANCE = `## Phase 6 — Tests
### Verification: Automated-AV (unit tests, integration) + Human-AV (manual exploratory testing)

### S4 — Explicit Verification: NEVER assume tests passed. Always execute and verify output.
**CAUTION AP5 (Absence of human-AV):** Automated tests verify formalizable properties. Semantic adequacy, usability, and domain correctness REQUIRE human judgment.

### Step 1 — Spec-Driven Test Protocol (MANDATORY before writing any test):
Test against SPECS, not against implementation. The code you wrote is suspect — the specs are the source of truth.

**1.1. Recover scope:**
- Call get_decisions(phase=0) → list ALL use cases
- Read specs/validation → list ALL validation criteria
- Read specs/technical → list ALL technical constraints

**1.2. Build the Test Map (⚠️ MUST DISPLAY):**
For EACH spec item, declare:
| Spec | Test | Verifies | Type |
|------|------|----------|------|
| UC-1: User login | test_login_valid_credentials | Correct redirect + session created | Positive |
| UC-1: User login | test_login_invalid_password | Error message shown, no session | Negative |
| VAL-3: Response < 200ms | test_search_response_time | Measures actual response time against 200ms threshold | Positive |

Rules:
- Every use case from Phase 0 → at least 1 positive + 1 negative test
- Every criterion from specs/validation → at least 1 test that verifies the EXACT criterion (not a proxy)
- Every constraint from specs/technical → at least 1 test within documented ranges
- Minimum ratio: 1 negative test for every 2 positive tests

**1.3. Distinguish "test green" from "spec met":**
A passing test only validates a spec if it verifies the EXACT criterion. Examples of FALSE coverage:
- Spec says "< 200ms" → test checks "returns results" (no timing) → spec NOT verified
- Spec says "supports 100 concurrent users" → test checks single user → spec NOT verified
- Spec says "error message is user-friendly" → test checks error is thrown → spec NOT verified

### Step 2 — Write and Execute Tests:
- specs/datasets → test against ground truth (if empty, generate synthetic data and deposit in specs/datasets)
- Execute ALL tests. Read output carefully. Fix failures before proceeding.
- After all automated tests pass, run the actual application/artifact and verify behavior end-to-end.

### Step 3 — Record Spec Coverage (MANDATORY):
Record the coverage checklist as a persistent, traceable decision:
record_decision(phase=6, category='spec-coverage', content='SPEC COVERAGE REPORT: ...')

The content MUST follow this structure:
- COVERED: [list of spec items with their test names and result]
- NOT COVERED: [list of spec items not testable automatically + justification]
- NEGATIVE TESTS: [count positive / count negative / ratio]
- GAPS: [any spec where test exists but does NOT verify the exact criterion]

### Step 4 — Manual Exploratory Testing (MANDATORY before Phase 7):
**Important: manual testing MUST be performed by the human user, not simulated by the AI.**
The AI cannot replicate real user interactions. After automated tests pass:
1. Present the test plan to the user: list the Phase 0 use cases they must execute and the edge cases to test.
2. Record the testing status with record_decision(phase=6, category='testing') BEFORE the user leaves.
3. Wait for the user to return with their test results. Do NOT mark manual_testing as met or advance to Phase 7 before the user reports results.

What the user must test:
- Start the application
- Execute each Phase 0 use case as an end user
- Test edge cases: rapid/double clicks, empty inputs, interruptions, timeouts
- Evaluate feedback: are messages understandable? Non-technical errors? Actionable results?
- Document and report issues back to this session

Both (automated + manual) are mandatory gates. Neither replaces the other.

### Multi-Session Testing Protocol:
Manual testing often spans multiple sessions (user tests outside Claude, returns with feedback).
To maintain continuity across sessions:

**BEFORE the user leaves to test (⚠️ MUST DISPLAY testing status summary in chat):**
Record a testing decision summarizing the current state:
record_decision(phase=6, category='testing', content='TESTING STATUS: ...')
The content MUST use this structure:
- Line 1: TESTING STATUS: [automated-pending | automated-done | manual-in-progress | manual-done]
- Line 2: PASS: [list of what passed] (or "none yet")
- Line 3: FAIL: [list of known issues] (or "none")
- Line 4: NEXT: [what to test next / what user should focus on]

**WHEN the user returns with test feedback:**
1. Call get_decisions(phase=6) to recover ALL Phase 6 testing decisions
2. Read the most recent testing-category decisions to reconstruct context
3. Record the user's feedback as a new testing decision
4. Update exit criteria based on feedback (mark_exit_criterion for manual_testing, edge_cases)
5. If issues found: fix them, then record updated status

**WHEN fixing issues from manual testing:**
After each fix, record a testing decision noting: what was fixed, what still needs retesting.
This ensures the NEXT session knows exactly what changed since the last test round.

### Next Step (MANDATORY when all testing is complete):
Both automated and manual testing must be done before advancing. When both gates are ✅: call advance_phase() to move to Phase 7. Then call get_phase_guidance() and begin Phase 7 post-review immediately.`;

// [G5] Meta-iteration v1→v2 + [G11] double-loop + [G8] AV type
const PHASE_7_GUIDANCE = `## Phase 7 — Post-Review
### Verification: Human-AV (operator evaluates lessons and approves method changes)

### Update specs/:
- specs/validation → actual results (expected vs obtained)
- specs/technical → final decisions, discarded algorithms and why
- specs/references → references discovered during correction

### Double-loop learning (Argyris) (⚠️ MUST DISPLAY both evaluations in chat):
Single-loop: evaluate the PRODUCT (does the software work?).
Double-loop: evaluate the PROCESS (did the methodology work? Where was there friction?).
Phase 7 does BOTH.

### Methodology Self-Improvement (5 steps):

**Step 1 — Human collection (mandatory FIRST):** Ask via AskUserQuestion if any part caused friction or failed. The human experienced the process and detects friction that the AI doesn't perceive about itself.

**Step 2 — AI self-assessment (complementary):** Phase that lacked checklist, absent safeguard, inadequate template, valueless rule, recurring pattern.

**Step 3 — Consolidate** in table (⚠️ MUST DISPLAY table in chat: source [human/AI] | phase | proposal | justification).

**Step 4 — Apply** via AskUserQuestion: review one by one (recommended) / apply all / don't update. For each diff, show before/after and request approval. Proposals go through gate: operator approves or rejects.

**Step 5 — Increment version** of SKILL.md.

Limits: AI has agreement bias about itself. Human detects friction → AI proposes → human approves. Never modify SKILL.md without approval.

### Meta-iteration v1.0 → v2.0 (⚠️ MUST DISPLAY offer in chat):
After completing all Phase 7 steps, you MUST offer the user the option to start a new development cycle via AskUserQuestion:
- Option 1: "Start v2.0 cycle" — calls start_new_cycle() to reset to Phase 0 while preserving all context
- Option 2: "Project complete" — no further action, methodology concludes

If the user chooses to start a new cycle:
1. Call start_new_cycle() — this preserves decisions, projectSpec, history, and specs/
2. specs/ from the previous cycle is the BASELINE — knowledge is NOT lost between cycles
3. Phase 0 of the new cycle starts from existing specs/ (doesn't restart from zero)
4. Previous decisions (get_decisions) serve as context — what was discarded and why
5. Negative scope from the previous cycle can become new scope (with operator approval)
6. Phase 7 lessons feed into the new cycle's process
7. Call get_phase_guidance() to load Phase 0 instructions for the new cycle

IMPORTANT: Do NOT use init_project() for meta-iteration — that wipes all previous context. Use start_new_cycle() which preserves the knowledge base.`;

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
  parts.push(GLOBAL_RULES.R5); // R5 always active — mandatory display

  if (phase < 5) {
    parts.push(GLOBAL_RULES.R1);
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
 *
 * MAINTENANCE CHECKLIST — run when changing full guidance (getFullGuidance / PHASE_X_GUIDANCE):
 * □ Lens names changed?           → Update (1)Assumptions... list in case 2
 * □ Transition sequence changed?  → Update AFTER/WHEN lines in affected case
 * □ New R5 mandatory display?     → Update R5 reminder line in affected case
 * □ New MCP tool name added?      → Update tool call references in affected case
 * □ Run `npm test`                → compact content tests catch missing key terms automatically
 */
export function getCompactGuidance(phase: number): string[] {
  const lines: string[] = [];

  switch (phase) {
    case 0: // ← full: PHASE_0_GUIDANCE — HSA, scoring, teach-back, feasibility tiers
      lines.push("INSTRUCTIONS P0: HSA 5-level exploration (1.Domain 2.Problem-5W1H 3.Elements 4.Processes 5.Product). AskUserQuestion per level. Mandatory teach-back. Technical+scientific research if specialized domain. Tier 1/2/3 feasibility. Score ≥90."); // ← [HIERARCHICAL SEMANTIC ANALYSIS]
      lines.push("R2: Every decision via AskUserQuestion. AP1: never ask for validation, ask for REFUTATION."); // ← [R2, AP1]
      lines.push("R5: MUST DISPLAY score breakdown table + teach-back synthesis + delivery target question. If you computed it, SHOW it."); // ← [CONVERGENCE ASSESSMENT, VALIDATION, TEACH-BACK]
      lines.push("FLOW: After recording user answers → proceed IMMEDIATELY to next HSA level or to synthesis. NEVER write 'I will proceed with X' as text and stop — just do X."); // ← [HSA flow, Synthesis timing]
      lines.push("AFTER SCORE: score ≥90 → advance_phase() to Phase 1, then IMMEDIATELY call get_phase_guidance() and begin Phase 1 work — do NOT stop. Score <90 → call start_iteration() and continue HSA focusing on lowest-scoring criteria. Do NOT offer to advance."); // ← [CONVERGENCE ASSESSMENT → ≥90 / <90]
      lines.push("DO: Ask questions, explore the problem, populate specs/. | DON'T: Write source code (even via terminal), jump to solutions, skip HSA levels, stop after displaying score."); // ← [Step 0, Implementation Feasibility]
      break;
    case 1: // ← full: PHASE_1_GUIDANCE — 4 architecture questions, patterns, granularity
      lines.push("INSTRUCTIONS P1: 4 questions (Decomposition, Interfaces, Assumptions, Negative scope). 2 AskUserQuestion calls (patterns). Granularity: each module fits in 1 AI session."); // ← [4 architecture questions, Granularity]
      lines.push("FLOW: After recording user answers → proceed IMMEDIATELY to draft the 4 architecture answers (decomposition, interfaces, assumptions, negative scope) and present the pattern summary table. NEVER write 'I will draft X next' as text and stop — just do it."); // ← [P1 intra-phase flow]
      lines.push("R2+R4: specs/technical,models,examples. AP3: plan decoupled sessions for P5-P6. R5: MUST DISPLAY 4 architecture answers + pattern table + tech comparison."); // ← [R2, R4, AP3, R5]
      lines.push("WHEN DONE: After user confirms architecture → call advance_phase(), then get_phase_guidance() and begin Phase 2 critique immediately."); // ← [Exit criteria / transition to P2]
      lines.push("DO: Define modules, interfaces, patterns via AskUserQuestion. | DON'T: Write implementation code, create source files, start coding."); // ← [AP3, Decoupled session principle]
      break;
    case 2: // ← full: PHASE_2_GUIDANCE — 7 universal lenses, conditional lenses, DTLs, protocol, matrix
      lines.push("INSTRUCTIONS P2: STEP 1 — Record activated lenses FIRST: call record_decision(category='architecture', content='ACTIVATED LENSES: [list]. NOT ACTIVATED: [lens — reason]') before starting critique. STEP 2 — Apply ALL 7 UNIVERSAL lenses on EACH module → 🔴🟡🟢: (1)Assumptions (2)Architectural (3)Implementability (4)Scientific (5)Security (6)Performance (7)Regulatory. Then apply all activated conditional lenses. Absence of findings is valid — do NOT skip any lens. Do NOT invent lens names. Matrix + concentration analysis (module×lenses). ASYMMETRY: multiple agents attack, unified responds in P3."); // ← [Universal Lenses table, Conditional lens activation, Protocol per lens]
      lines.push("MODULE BOUNDARY: Apply lenses to ONLY the modules defined in P1 — do NOT propose new module boundaries or restructure decomposition here. If module granularity is insufficient, flag it as a finding for P3 to resolve."); // ← [P1 module boundary enforcement in P2]
      lines.push("FLOW: After recording activated lenses → immediately start applying them (lens 1 on all modules → lens 2 → ... → exit gate). NEVER write 'I will now apply lens X' as text and stop — just apply it."); // ← [P2 intra-phase flow]
      lines.push("BOUNDARY: do NOT cut/add requirements. P1 negative scope items CANNOT become implementation proposals — flag as out-of-scope if they appear. AP1: ask for refutation, not validation. R5: MUST DISPLAY full coverage matrix + concentration analysis + exit gate summary."); // ← [Coverage Matrix, Concentration analysis, Exit Gate, P1 negative scope guard]
      lines.push("AFTER GATE: If findings → YOUR NEXT TOOL CALL is advance_phase() to Phase 3 — do NOT write 'advancing' as text, then get_phase_guidance() and begin Phase 3. If zero findings → AskUserQuestion (Phase 3 optional or Phase 4). Do NOT block on 🔴 count — criticals are addressed IN Phase 3."); // ← [Exit Gate]
      lines.push("DO: Record lenses, apply all, advance to Phase 3 after gate. | DON'T: Block advancement because of 🔴 criticals, stop silently after gate summary, skip any lens."); // ← [Protocol per lens, AP1]
      break;
    case 3: // ← full: PHASE_3_GUIDANCE — simplification, change %, recommendation, anti-scope-creep
      lines.push("INSTRUCTIONS P3: Simplify V(N)→V(N+1) with UNIFIED vision. AI COMPUTES structural change % and critical count, then presents recommendation. User confirms or overrides. Anti-scope-creep checklist."); // ← [Purpose, Step 3 recommendation]
      lines.push("FLOW: Immediately compute change % and critical count, then display recommendation and checklist — all in one continuous turn. NEVER write 'I will compute X' as text and stop — just compute and display."); // ← [P3 intra-phase flow]
      lines.push("ASYMMETRY: integrate all corrections into the whole. AP2: simplify, not complexify. AP8: don't seek perfection. R5: MUST DISPLAY computed % + criticals + recommendation + checklist ✅/❌. Do NOT ask user to choose percentage range."); // ← [Asymmetry principle, AP2, AP8, R5]
      lines.push("AFTER CONFIRMATION: YOUR NEXT TOOL CALL — '→ Phase 4': advance_phase() then get_phase_guidance() and begin P4. 'More iterations': start_iteration() then advance_phase() to Phase 2, then get_phase_guidance(). Do NOT write 'advancing' as text — call the tool immediately."); // ← [Step 4 — Post-cycle decision]
      lines.push("ANTI-SCOPE-CREEP checklist (MUST DISPLAY ✅/❌ for each): 1. All P0 use cases still covered. 2. No unsolicited features added. 3. WHAT the system does hasn't changed (only HOW). 4. P1 negative scope is still negative — no item from P1 'NOT do' list was silently promoted."); // ← [P3 anti-scope-creep — P1 negative scope guard added]
      lines.push("DO: Simplify architecture, address criticals, compute change %, verify P1 negative scope. | DON'T: Add features, increase complexity, stop after confirmation without executing the action."); // ← [AP2, S5, Anti-scope-creep checklist]
      break;
    case 4: // ← full: PHASE_4_GUIDANCE — convergence verification, safeguards, LLM switch
      lines.push("INSTRUCTIONS P4: Convergence gate. Exit criteria P2-P3 + safeguards S1-S5 + 4 P1 questions + specs/ complete. get_exit_criteria() + check_all_safeguards()."); // ← [Convergence verification report]
      lines.push("FLOW: Call get_exit_criteria() then check_all_safeguards() then display convergence report — all in one continuous turn. NEVER write 'I will now call X' as text and stop — just call it."); // ← [P4 intra-phase flow]
      lines.push("WHEN ALL ✅: call advance_phase() to Phase 5, then get_phase_guidance() and begin Phase 5 immediately. R5: MUST DISPLAY convergence report ✅/❌. LLM Switch notification is in full guidance (get_phase_guidance()) — do NOT display it again in this turn."); // ← [LLM Switch dedup, Exit Gate P4→P5]
      lines.push("DO: Verify all exit criteria, run safeguard checks, check specs/. | DON'T: Skip verification steps, advance without confirming convergence, display LLM Switch notification twice."); // ← [Steps 1-6]
      break;
    case 5: // ← full: PHASE_5_GUIDANCE — implementation, S6 tiers, S7 progress, decoupled sessions
      lines.push("INSTRUCTIONS P5: Consult specs/ BEFORE each module (specs/technical, specs/examples, specs/models). S6: Tier 1(lib)→2(port)→3(new). S7: announce X/N completed — YOUR NEXT TOOL CALL must be the first step of module X+1. Do NOT end your turn between modules."); // ← [BEFORE each module, S6, S7]
      lines.push("FLOW: [per module: consult specs/ → implement → mark done → start next] → advance when all done. NEVER write 'I will now implement module X' as text and stop — just start implementing it."); // ← [P5 intra-phase flow]
      lines.push("IF STARTING IN A NEW SESSION (LLM Switch or resumed project): call get_decisions() + check_specs_status() FIRST to recover context. In a continuous session, proceed directly to implementation."); // ← [context recovery — conditional, not mandatory]
      lines.push("BINDING CONSTRAINTS: The tech stack, patterns, and out-of-scope items decided in P1/P3 are HARD CONSTRAINTS — visible in the 'Recent decisions' above. DO NOT introduce any library, framework, runtime, or technology not explicitly selected in P1. If the decision says 'vanilla JS', do not use Node.js. If it says 'no framework', do not use one."); // ← [P1 decision enforcement]
      lines.push("Do NOT ask permission between files — implement autonomously. AP7: never code without reference. STOP only for blockers or >2 iter on same module."); // ← [AP7]
      lines.push("WHEN ALL MODULES DONE: YOUR NEXT TOOL CALL is advance_phase() to Phase 6, then get_phase_guidance() and begin Phase 6 immediately."); // ← [Exit: P5→P6]
      lines.push("DO: Implement modules sequentially, consult specs/ before each, respect P1 binding constraints. | DON'T: Introduce unapproved tech, run tests, start manual testing — that is Phase 6."); // ← [Validation Session, AP3]
      break;
    case 6: // ← full: PHASE_6_GUIDANCE — spec-driven testing, test map, manual testing handoff
      lines.push("INSTRUCTIONS P6: SPEC-DRIVEN testing — test against SPECS, not implementation. Step 1: recover scope: get_decisions(phase=0) for use cases + get_decisions(phase=3) for any scope revisions from P3 + specs/validation + specs/technical. Merge P0 and P3 scope — P3 may have revised boundaries. Step 2: build Test Map (⚠️ MUST DISPLAY) mapping every spec→test with Type(positive/negative). Every use case: ≥1 positive + ≥1 negative. Ratio: 1 negative per 2 positives minimum."); // ← [Step 1, Step 2 — Test Map, P3 scope merge]
      lines.push("FLOW: Recover scope → build Test Map → execute automated tests → record coverage → hand off to user — all without stopping to announce next steps. NEVER write 'I will now test X' as text and stop — just do it."); // ← [P6 intra-phase flow]
      lines.push("DISTINGUISH 'test green' vs 'spec met': test must verify EXACT criterion (not proxy). Step 3: record_decision(category='spec-coverage') with COVERED/NOT COVERED/NEGATIVE TESTS/GAPS. Step 4: Manual testing — HUMAN USER tests, NOT AI. Present test plan, record_decision(category='testing') with STATUS/PASS/FAIL/NEXT, then WAIT for user to return. Only mark manual_testing met after user confirms. On return: get_decisions(phase=6)."); // ← [Step 3 — coverage, Step 4 — manual testing handoff]
      lines.push("WHEN TESTING COMPLETE: YOUR NEXT TOOL CALL is advance_phase() to Phase 7, then get_phase_guidance() and begin Phase 7 immediately."); // ← [Exit: P6→P7]
      lines.push("BINDING CONSTRAINTS in test code: use ONLY the tech stack approved in P1 (check get_decisions(phase=1) if unsure). Do NOT introduce test frameworks or runtimes not approved in P1."); // ← [P1 tech binding in P6 test code]
      lines.push("DO: Write spec-driven tests, execute them, hand off manual testing to user, wait for return. | DON'T: Simulate manual testing mentally, mark manual_testing without user confirmation, use unapproved tech in test code."); // ← [AP5, Step 4]
      break;
    case 7: // ← full: PHASE_7_GUIDANCE — double-loop, consolidation, meta-iteration
      lines.push("INSTRUCTIONS P7: Double-loop: evaluate PRODUCT and PROCESS. Update specs/. 5 steps: human first→AI→consolidate→apply→version."); // ← [Double-loop learning]
      lines.push("Meta-iteration: After completing P7, offer start_new_cycle() via AskUserQuestion. NEVER use init_project() for v2 — it wipes context. NEVER modify SKILL.md without approval. R5: MUST DISPLAY double-loop report + consolidation table + meta-iteration offer."); // ← [Meta-iteration, start_new_cycle]
      lines.push("DO: Collect human feedback first, update specs/, offer meta-iteration. | DON'T: Use init_project() instead of start_new_cycle(), modify SKILL.md without approval."); // ← [Step 1 — human first, S6]
      break;
  }

  return lines;
}
