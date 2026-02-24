# Versus for Claude

**Iterative Convergence methodology v3.7 orchestrator for Claude Code.**

A VS Code extension that prevents Claude from skipping steps, losing decisions, and forgetting context during complex projects. It works as a copilot for the copilot: an MCP server that manages state, validates transitions, and enforces methodological discipline.

---

## The Problem

LLMs in agent mode (Claude Code, Copilot, etc.) suffer from three systemic problems in non-trivial projects:

1. **Amnesia** -- after context compaction or a new session, the model forgets the project phase, decisions made, and pending criteria
2. **Code anxiety** -- the model jumps straight to implementation without understanding the problem, defining architecture, or validating decisions
3. **Scope drift** -- without external constraints, the model adds unsolicited features, reimplements existing libraries, and diverges from the objective

Versus solves this with **persistent external state** + **transition gates** + **active safeguards**.

---

## How It Works

```
                                    VS Code
                    ┌─────────────────────────────────────────┐
                    │                                         │
                    │   ┌─────────┐        ┌──────────────┐  │
                    │   │ Sidebar │◄───────│  state.json   │  │
                    │   │ (view)  │  watch  │  (.versus/)  │  │
                    │   └─────────┘        └──────┬───────┘  │
                    │                             │          │
                    │                        read/write      │
                    │                             │          │
  ┌──────────┐  MCP stdio   ┌─────────────────────┴───┐     │
  │  Claude  │◄────────────►│      MCP Server         │     │
  │   Code   │   13 tools   │  (validation + rules)   │     │
  └──────────┘              └─────────────────────────┘     │
                    │                                         │
                    │   ┌─────────────────────────────────┐  │
                    │   │  Hooks (inject-context,         │  │
                    │   │  phase-gate, loop-detector)     │  │
                    │   └─────────────────────────────────┘  │
                    └─────────────────────────────────────────┘
```

The extension exposes **13 MCP tools** that Claude Code uses automatically. Three hooks reinforce the behavior:

| Hook | Event | Function |
|------|-------|----------|
| inject-context | UserPromptSubmit | Injects current phase and rules at the start of each message |
| phase-gate | PreToolUse (Edit/Write) | Blocks code editing before Phase 5 |
| loop-detector | PreToolUse (Bash) | Detects loops of repeated commands (>3x) |

---

## The Methodology: Iterative Convergence

Eight sequential phases with validated exit gates. The model only advances when all exit criteria are met.

```
Phase 0  Problem Discovery        (iterative loop, score >= 90/100)
   |
Phase 1  Architecture             (modules + interfaces + patterns)
   |
Phase 2  Adversarial Critique  ┐
   |                           │  loop until convergence
Phase 3  Simplification        ┘
   |
Phase 4  Convergence Gate         (final design validation)
   |
Phase 5  Code Implementation      (1 file per response)
   |
Phase 6  Tests                    (100% passing + manual exploratory)
   |
Phase 7  Post-Review              (lessons learned + meta-iteration)
```

### Phase 0 -- Problem Discovery

The model asks iterative questions to understand the problem. A convergence score (0-100) with 10 weighted criteria measures the quality of understanding:

| Criterion | Weight |
|-----------|--------|
| Problem clarity | 10 |
| Use cases | 15 |
| Shared vocabulary | 10 |
| Ambiguities resolved | 15 |
| Out of scope defined | 10 |
| Success criteria | 10 |
| Explicit assumptions | 10 |
| Documentation (specs/) | 5 |
| User confirmed | 10 |
| AI confident | 5 |

**Score >= 90 required to advance.** The model cannot skip this phase.

### Phases 2-3 -- Adversarial Loop

The architecture is attacked with 7 specialized lenses (performance, security, maintainability, edge cases, dependencies, simplicity, alternatives) and simplified iteratively. The loop repeats until critiques are addressed.

### Safeguards S0-S7

Protection rules verifiable at any time:

| ID | Name | Protects against |
|----|------|-----------------|
| S0 | Problem Convergence | Advancing without understanding the problem |
| S1 | Anti-Bug | Simplification that introduces bugs |
| S2 | Stopping Criterion | AI deciding on its own when to stop |
| S3 | Premature Convergence | Stopping iterations too early |
| S4 | Explicit Verification | Skipping human validation at gates |
| S5 | Scope Preservation | Adding unsolicited features |
| S6 | Do Not Reimplement | Recreating what already exists as a library |
| S7 | Sequence Discipline | Jumping between files without completing |

---

## Installation

### Prerequisites

- VS Code 1.85+
- Claude Code (extension)
- Node.js 18+

### Via .vsix

```bash
code --install-extension versus-claude-0.2.0.vsix
```

Or: `Ctrl+Shift+P` > "Extensions: Install from VSIX..."

### From source

```bash
git clone git@github.com:jasminemoreira/Versus-Claude.git
cd Versus-Claude/versus-claude
npm install
npm run build
npx @vscode/vsce package --allow-missing-repository
code --install-extension versus-claude-*.vsix
```

---

## Usage

### 1. Initialize a project

`Ctrl+Shift+P` > **"Versus Claude: Initialize Project"** > name and description.

This creates in the workspace:

```
.versus/
├── state.json            # methodology state
├── server.js             # MCP server
├── inject-context.js     # hook: context
├── phase-gate.js         # hook: editing gate
└── loop-detector.js      # hook: anti-loop

.mcp.json                 # MCP server registration for Claude Code
.claude/settings.json     # permissions and hooks

specs/
├── references/
├── domain/
├── technical/
├── examples/
├── design/
├── models/
├── datasets/
├── validation/
└── competitors/
```

### 2. Work with Claude Code

Open Claude Code normally. The SessionStart hook makes Claude call `get_phase_state()` automatically and follow the methodology.

### 3. Monitor via sidebar

The "Versus" panel in the activity bar shows in real time: current phase, iteration, score, latest decisions, and safeguard status.

---

## 13 MCP Tools

### Query
| Tool | Description |
|------|-------------|
| `get_phase_state` | Current phase, iteration, score, summary |
| `get_phase_guidance` | Detailed phase instructions (rules, questions, checklists) |
| `get_decisions` | Recorded decisions (optional phase filter) |
| `get_exit_criteria` | Exit criteria with status (met/pending) |
| `check_specs_status` | File count per specs/ subdirectory |

### Transition
| Tool | Description |
|------|-------------|
| `advance_phase` | Advance to next phase (validates exit criteria) |
| `start_iteration` | New iteration in cyclic phases (0, 2, 3) |

### Recording
| Tool | Description |
|------|-------------|
| `record_decision` | Persist decision (phase, category, content) |
| `update_score` | Update Phase 0 score with per-criterion breakdown |
| `mark_exit_criterion` | Mark criterion as met/pending |

### Safeguards
| Tool | Description |
|------|-------------|
| `check_safeguard` | Check specific safeguard (S0-S7) |
| `check_all_safeguards` | Overview of all safeguards |

### Project
| Tool | Description |
|------|-------------|
| `init_project` | Initialize project (state + bundles + specs + configs) |

---

## Compatibility with Versus for Copilot

The methodology state lives in `.versus/` -- a neutral directory shared between extensions. This means you can:

- Start a project with Claude Code and continue with Copilot (or vice versa)
- Use both in the same workspace without conflict
- The `state.json` is identical and interchangeable

See the sibling project: [Versus for Copilot](https://github.com/jasminemoreira/Versus-Copilot) (same concept for GitHub Copilot Agent Mode).

---

## Zero footprint

The extension **does not create any files automatically**. Everything only happens when you execute "Initialize Project" from the command palette. If you install the extension and never use it, your workspace remains untouched.

---

## Repository Structure

```
Versus-Claude/
├── versus-claude/           # VS Code extension
│   ├── src/
│   │   ├── extension.ts        # lifecycle (lazy init)
│   │   ├── mcp/
│   │   │   ├── server.ts       # MCP server (stdio)
│   │   │   └── tools/          # 13 tools organized by group
│   │   ├── state/
│   │   │   ├── engine.ts       # state.json read/write
│   │   │   └── types.ts        # TypeScript types
│   │   ├── rules/
│   │   │   ├── phases.ts       # phase and exit criteria definitions
│   │   │   ├── safeguards.ts   # S0-S7
│   │   │   ├── guidance.ts     # behavioral instructions per phase
│   │   │   └── methodology.ts  # validation facade
│   │   ├── hooks/
│   │   │   ├── inject-context.ts
│   │   │   ├── phase-gate.ts
│   │   │   └── loop-detector.ts
│   │   └── views/
│   │       └── sidebar.ts      # TreeDataProvider (read-only)
│   ├── package.json
│   └── tsconfig.json
├── specs/                  # project specifications
└── AGENTS.md               # Agent Mode instructions
```

---

## License

MIT
