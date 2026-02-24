# Versus for Claude

**Iterative Convergence methodology v3.6 orchestrator for Claude Code.**

Transforms LLMs from reactive assistants into disciplined agents that follow a structured 8-phase process — from problem discovery to delivery with tests and post-review.

## Features

- **8 sequential phases** with verifiable exit criteria — no skipping steps
- **8 safeguards (S0-S7)** that prevent common AI agent errors (premature convergence, scope creep, reimplementation)
- **Convergence score** (0-100) that gates advancement until the problem is truly understood
- **15 MCP tools** for state management, decision recording, and phase transitions
- **3 Claude Code hooks** — context injection, edit blocking in early phases, loop detection
- **Persistent decision registry** that survives context switches
- **Gateway guard** that detects when models skip loading context
- **Adversarial critique** with 7 universal + 8 conditional lenses
- **VS Code sidebar** showing methodology state in real time

## How It Works

```
Phase 0: Problem Discovery    → Understand before solving (score >= 90 to advance)
Phase 1: Architecture         → Define modules, interfaces, patterns
Phase 2: Adversarial Critique → Attack the architecture with specialized lenses
Phase 3: Simplification       → Address criticals, simplify (loops with Phase 2)
Phase 4: Convergence Gate     → Validate all exit criteria + safeguards
Phase 5: Implementation       → Code the final architecture
Phase 6: Tests                → 100% passing + exploratory testing
Phase 7: Post-Review          → Lessons learned, update specs
```

## Quick Start

1. Install the extension
2. Open the Command Palette (`Ctrl+Shift+P`) and run **Versus Claude: Initialize Project**
3. Use Claude Code in your project — the agent is automatically guided by the methodology

Or ask Claude Code directly:
> "Initialize a Versus project called my-project"

## Claude Code Hooks

| Hook | Event | Function |
|---|---|---|
| **inject-context** | `UserPromptSubmit` | Injects phase, score, and recent decisions into each prompt |
| **phase-gate** | `PreToolUse` (Edit/Write) | Blocks code editing in Phases 0-4 |
| **loop-detector** | `PreToolUse` (Bash) | Detects repetitive test executions (>3x) |

## The 8 Safeguards

| ID | Name | Protects Against |
|---|---|---|
| S0 | Problem Convergence | Advancing without understanding the problem |
| S1 | Anti-Bug | Simplification that introduces bugs |
| S2 | Stopping Criterion | AI deciding when to stop (user's decision) |
| S3 | Premature Convergence | Stopping iteration too early |
| S4 | Explicit Verification | Skipping human validation at gates |
| S5 | Scope Preservation | Scope creep during critique-simplification |
| S6 | Do Not Reimplement | Recreating what already exists |
| S7 | Sequence Discipline | Starting tangential discussions during implementation |

## Requirements

- VS Code >= 1.85.0
- Claude Code CLI installed

## Companion Extension

Use **[Versus for Copilot](https://marketplace.visualstudio.com/items?itemName=indt.versus-copilot)** for GitHub Copilot Agent Mode integration. Both extensions share the same `.versus/state.json` format.

## License

[MIT](LICENSE) - Developed at [INDT](https://www.indt.org.br/) (Institute for Technological Development).
