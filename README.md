# Versus for Claude

**IACDM (Iterative Adversarial Convergence Development Methodology) orchestrator for Claude Code.**

An original methodology created by [Jasmine Moreira](https://github.com/jasminemoreira) that transforms LLMs from reactive code generators into disciplined agents following a structured 8-phase process — from problem discovery to delivery with tests and post-review.

## The Problem: the Verification Gap

In 2025, AI-assisted development reached critical mass. Platforms like Lovable, Cursor, Claude Code, and ChatGPT allow anyone to generate complete applications from natural language. The phenomenon — dubbed *vibe coding* by Andrej Karpathy — transformed the perception of who can build software and how fast.

The empirical data tells a different story:

- **METR study (2025):** 16 experienced developers using Cursor Pro with Claude 3.5/3.7 Sonnet predicted AI would make them 24% faster. After measurement: they were **19% slower**. A 39-point gap between perception and reality.
- **CVE-2025-48757 (Lovable):** 10.3% of 1,645 showcase apps had critical security flaws — 303 endpoints exposing personal data, API keys, and payment info. One researcher compromised multiple apps in 47 minutes.
- **GitClear (2025):** Refactoring dropped from 25% to 10% of changes; copy-pasted code rose from 8.3% to 12.3%. Stack Overflow 2025 recorded the first decline in positive sentiment toward AI coding tools.

**The critical observation:** these problems aren't tool-specific. Lovable uses Claude. Claude Code uses Claude. ChatGPT uses GPT. Cursor uses both. All operate as stochastic generators: `P(token_n | context)`. None of them verify what they produce. Internal verification capability is **zero** in all cases.

The real distinction isn't between tools. It's between two modes of operation:

| Without methodology | With Iterative Convergence |
|---|---|
| `prompt → AG → artifact → delivery` | `design → G₀ → critique → G₁ → ... → tests → G₅ → delivery` |
| Verification gap open | Discrete gates with automatic-AV and human-AV |
| Errors detected at `t = production` | Errors detected at `t = gate_k` (earliest possible phase) |
| Perception: +20% / Reality: −19% (METR) | Measurable at each gate (concrete feedback) |

**Iterative Convergence was born from this observation:** the quality of AI-assisted software is determined by the process, not the tool.

## Three Core Theses

1. **The quality of AI-assisted software is determined by the quality of the design that precedes code generation**, not by the generative capability of the model.
2. **AI is most productive when operating on granular work units** with explicit scope, documented assumptions, and well-defined interfaces — maximizing the useful-information/context-consumed ratio.
3. **Deep understanding of the problem is a precondition for any technical decision.** Understanding the wrong problem is orders of magnitude more expensive than understanding it slowly.

## The AG/AV Model: External Verification

An LLM (the **Generative Agent**, AG) has no internal function `V(artifact) → {correct, incorrect}`. This is the **verification gap**: the space between what is generated and what is verifiable by the generator itself.

The methodology closes this gap by instituting **external Verification Agents** (AV) at discrete **gates**:

```
F₀ → G₀ → F₁ → G₁ → ... → Fₙ → Gₙ → delivery
      ↑              ↑                    ↑
  AV evaluates   AV evaluates        AV evaluates
  (rejects →     (rejects →          (rejects →
   feedback)      feedback)           feedback)
```

- **AV-automatic:** tests, linters, compilers, type checkers — binary verdict on specific properties.
- **AV-human:** the operator — evaluates semantic adequacy, usability, domain correctness, and properties that escape automatic verification.

**Key properties:**
- *Generative Invariance:* the methodology doesn't improve the model. It improves the process.
- *Observability:* each gate makes artifact properties observable that would be invisible without external verification.
- *Temporal error localization:* errors are detected at `t = gate_k`, always before delivery.
- *Reconditioning quality:* when an AV rejects an artifact, the feedback constitutes concrete information that conditions the next generation — qualitatively superior to the original prompt.

## The 8 Phases

| # | Phase | Purpose | Principal artifact |
|---|---|---|---|
| 0 | Problem Discovery | Understand domain and problem before any technical solution | Validated document (score ≥90/100) + specs/ populated |
| 1 | Architecture | Define modules, interfaces, and technical contracts | Architecture V1 (~2k tokens) |
| 2 | Adversarial Critique | Attack architecture with specialized lenses (N passes) | Coverage matrix (modules × lenses) |
| 3 | Simplification | Simplify without introducing bugs; generate V(N+1) | Simplified architecture |
| 4 | Convergence Gate | Validate convergence with rigorous criteria | Final approved architecture |
| 5 | Code Implementation | Implement without backtracking; one module at a time | Functional code |
| 6 | Tests | Test against interfaces; mandatory manual testing | 100% tests passing |
| 7 | Post-Review | Systematic learning; methodology evolution | Lessons + method improvement proposal |

Phases 2-3 form an iterative loop (typically 1-3 iterations). Phase 7 implements **double-loop learning** (Argyris, 1977): evaluating both the product and the process itself.

## Phase 0: Hierarchical Semantic Analysis (HSA)

Phase 0 is the most distinctive contribution. It formalizes an observation: **understanding the wrong problem is 100x more expensive than understanding it slowly.**

The HSA structures exploration in five levels, each building on the previous:

| Level | Focus | What is sought |
|---|---|---|
| 1. Domain | The universe where the problem exists | Vocabulary, theoretical field, technical field, methodologies, tools, state of the art |
| 2. Problem | What needs to be solved | 5W1H: who, what, when, where, why, how is it solved today |
| 3. Elements | The parts that compose the problem | Components, entities, resources, actors, constraints |
| 4. Processes | How the parts relate | Flows, transformations, dependencies, events, feedback cycles |
| 5. Product | What is expected at the end | Deliverables, acceptance criteria, result format, success metrics |

The hierarchy enforces **epistemic order** (understand the domain before decomposing the problem), **structure-dynamics separation** (elements vs. processes as orthogonal dimensions), and **early shared vocabulary** (terminological ambiguities resolved at the cheapest possible level).

## Adversarial Critique with Specialized Lenses

Phase 2 operates in N specialized passes, each with its own lens and central question. The principle: **if removing this lens means a class of failure goes undetected, the lens is legitimate.**

| Universal lens | Central question |
|---|---|
| Assumptions | What does this design assume as truth without declaring it? |
| Architectural | Can each module be replaced, removed, or tested in isolation? |
| Implementability | Can I code this module in one session with available context? |
| Scientific | Does every value, formula, and algorithm have a verifiable reference? |
| Security | How would an attacker exploit this surface with minimal effort? |
| Performance | Where are the bottlenecks and what is the asymptotic behavior? |
| Regulatory | Does every normative requirement have traceability to a module? |

**Critical asymmetry:** multiple agents to attack, unified agent to respond, human operator to arbitrate trade-offs. The **coverage matrix** (modules × lenses) reveals concentration patterns — a module with findings across all lenses needs redesign, not patches.

## Context Efficiency and Granularization

The operational constraint of current LLMs isn't generation capacity — it's the finite context window. The methodology maximizes:

```
E = I₀ / C
```

Where `E` = context efficiency, `I₀` = relevant information, `C` = total context consumed. In a monolithic system, `E` tends to zero as the system grows. In a granularized system with explicit interfaces, `E` stays high because each interaction provides only the interface signature (compact) and the current module code (relevant).

**The decoupled session cycle:**
- **Design Session** (Phases 0-4): context = domain + constraints → architecture + interfaces
- **Code Session** (Phase 5): context = architecture + module interface → 100% dedicated
- **Test Session** (Phase 6): context = interface + contract → no internal code needed
- **Validation Session:** CI/CD runs tests → AI only invoked for corrections

## The Knowledge Repository (specs/)

The `specs/` directory functions as a persistent external memory that accumulates knowledge across sessions and phases. It addresses both the AI's finite context window and the operator's finite working memory.

Three key properties:
- **Traceability:** every technical decision has a trail in specs/. The rule "never implement an algorithm without a bibliographic reference" prevents code generation based on statistical plausibility.
- **Inter-session persistence:** the operator returning after weeks finds accumulated context. The AI consults specs/ before asking questions.
- **Inter-version transferability:** if the project evolves to v2.0, Phase 0 starts from v1.0's specs/ as baseline. Knowledge is never lost between cycles.

## Anti-Patterns

| # | Anti-pattern | Description |
|---|---|---|
| AP1 | Validation theater | Asking the AI "is this design good?" and accepting the affirmative. Antidote: never ask for validation; ask for refutation. |
| AP2 | Complexity as false solution | Adding components when critique reveals fragility. Each iteration must simplify. |
| AP3 | Monolithic session | Design, code, and tests in a single conversation. Context saturates. |
| AP4 | Implicit assumption | The design works — as long as conditions nobody listed are true. |
| AP5 | Absence of human-AV | Trusting exclusively in automated tests. Semantic adequacy requires human judgment. |
| AP6 | Skipping Phase 0 | Starting with architecture without understanding the problem. The most expensive anti-pattern: 100x base cost. |
| AP7 | Coding without reference | Implementing domain algorithms without consulting specs/ or literature. |
| AP8 | Perfectionist convergence | Infinite cycles seeking "perfect" design. The stopping criterion is honesty. |
| AP9 | Silent scope creep | Adding features during Phases 2-3 without operator approval. |

## Relation to Existing Methods

| Tradition / Method | Incorporated principle | Adaptation |
|---|---|---|
| Spiral Model (Boehm, 1986) | Iterative cycles with risk analysis | Risk evaluated is design fragility; AI is risk analysis partner |
| Design by Contract (Meyer, 1992) | Pre/post-conditions and invariants | Explicit assumptions and negative scope function as informal contracts |
| Falsificationism (Popper, 1959) | Knowledge advances by refutation | Adversarial critique seeks to refute the design, not validate it |
| Red Teaming (NSA/DARPA) | Dedicated team attacking the system | AI assumes red team role under adversarial prompt |
| ATAM (Kazman et al., 2000) | Scenario-based architectural trade-offs | Each critique cycle evaluates trade-offs and forces explicit decisions |
| KISS / YAGNI (XP, Beck 1999) | Simplicity as value | Each iteration must simplify, not complexify |
| TDD (Beck, 2003) | Tests drive design | Adversarial critique functions as "design test" before code |
| ADR (Nygard, 2011) | Decision documentation with context | Documented assumptions and limitations serve equivalent role |

## Installation

### From VS Code Marketplace
Search for **"Versus for Claude"** in Extensions, or:
```
ext install jasminemoreira.versus-claude
```

### From Source
```bash
cd versus-claude
npm install && npm run build
npx @vscode/vsce package --no-dependencies
code --install-extension versus-claude-*.vsix
```

## Quick Start

1. Open the Command Palette (`Ctrl+Shift+P`) → **Versus Claude: Initialize Project**
2. Use Claude Code in your project — the agent is automatically guided by the methodology

## Companion Extension

Use **[Versus for Copilot](https://github.com/jasminemoreira/Versus-Copilot)** for GitHub Copilot Agent Mode integration. Both extensions share the same `.versus/state.json` format.

## License

[MIT](versus-claude/LICENSE.txt)

---

*Created by [Jasmine Moreira](https://github.com/jasminemoreira). Developed and validated on the Goitacaz project (2025-2026).*

> *"A converged design is not a finished design, but one that is certainly ready to evolve."*
