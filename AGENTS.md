# AGENTS.md — Mandatory instructions for Agent Mode

## FIRST ACTION (before anything else):

Call the `get_phase_state` tool from the MCP server `versus-claude`.
This returns the current phase of the Iterative Convergence methodology.

- If it returns a "project not initialized" error: ask the user if they want to start with `init_project`
- If it returns a phase: call `get_phase_guidance` and follow the phase instructions

DO NOT do anything before calling `get_phase_state`. DO NOT ask the user what they want to do.
DO NOT improvise. The methodology flow is determined by the returned state.

## Flow rules:

1. Each interaction starts with `get_phase_state` → `get_phase_guidance`
2. User decisions via `ask_user` (menu with contextualized predefined options)
3. Record decisions with `record_decision`
4. Before advancing a phase: `get_exit_criteria` → `advance_phase`
5. NEVER skip phases (0→7 sequential)
6. NEVER implement code before Phase 5
