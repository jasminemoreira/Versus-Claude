# Requirements — Versus for Claude

## Problem
Claude loses the Iterative Convergence v3.6 methodology state during long conversations (>50 messages) and between sessions. Symptoms:
- Forgets the current phase
- Skips phases (jumps straight to code)
- Loses decisions made in earlier phases
- Ignores safeguards S0-S7
- Does not consult/populate specs/

## Solution
VS Code extension with:
1. **MCP Server** — external source of truth, provides tools to Claude Code
2. **Read-only sidebar** — state visualization for the user
3. **Persisted state** — survives compaction, sessions, crashes

## Users
- Public (open-source)

## Confirmed Decisions
- **1 project per workspace** — each VS Code workspace = 1 methodology instance
- **Automatic resume** — on reopen, restores exact state from where it left off
- **Fixed methodology** — hardcoded for Iterative Convergence v3.6
- **Read-only sidebar** — view only, actions via Claude Code + MCP
- **Language EN** — English interface
- **Storage**: `.versus/state.json`
- **Specs verified** — MCP checks specs/ but does not block (alerts + allows with confirmation)
- **Hooks removed** — MCP replaces existing hooks
- **~12 granular MCP tools** — clear purpose per tool
- **Violations**: refuse + explain (no extra UI notification)

## Out of Scope
| Item | Reason |
|------|--------|
| Generate business code | Orchestrator manages methodology, does not implement |
| Replace Claude Code | Complements, does not replace |
| Edit SKILL.md automatically | Only Phase 7 with manual approval |
| Multiple methodologies/plugins | Hardcoded for IC v3.6 |
| i18n | English interface |
| Interactive sidebar | Read-only, actions via MCP |

## Success Criteria
1. State never lost after compaction or new session
2. Decisions traceable and queryable
3. Safeguards S0-S7 enforced by the server
4. Phase transitions validated with exit criteria
5. Violations explained with clear message about pending items
