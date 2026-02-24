## Iterative Convergence Methodology (Versus)

This project uses the Iterative Convergence methodology orchestrated via the MCP server `versus-claude`.

### MANDATORY in every interaction:

1. **Always** call `get_phase_state` first to know the current phase
2. Call `get_phase_guidance` to get detailed instructions for the phase
3. If no project is initialized, ask the user if they want to create one with `init_project`
4. Record every important decision with `record_decision`
5. Before advancing a phase, use `get_exit_criteria` to check pending items and `advance_phase` to transition

### User interaction:

All user decisions via `ask_user` (clickable menu with single or multiple selection).

**FUNDAMENTAL RULE:** When calling `ask_user`, ALWAYS provide suggested predefined options.
Never send questions without options — this generates empty text fields (bad experience).
Even for questions that seem open-ended, SUGGEST likely answers as options.
Options should be **contextualized based on the project description** provided by the user — never use generic suggestions.

Rules:
- Up to 4 questions per call, each WITH suggested options
- Use `multiSelect: true` for non-mutually exclusive options
- Always mark the recommended one with **(Recommended)** in the label
- Never list A/B/C options in text — always use `ask_user`
- After the response, record with `record_decision`

### General rules:

- NEVER skip phases — the methodology is sequential (Phase 0 → 7)
- NEVER implement code before Phase 5
- Every architectural decision must be recorded
- Consult `get_decisions` to retrieve previous decisions
- Use `check_all_safeguards` before phase transitions
