# Glossary — Versus for Claude

| Term | Definition |
|------|------------|
| Orchestrator | VS Code extension (MCP server + sidebar) that manages the Iterative Convergence methodology state |
| IACDM | Iterative Adversarial Convergence Development Methodology — technical name for Iterative Convergence |
| State | JSON object persisted in `.versus/state.json`: current phase, iteration, score, decisions, safeguards |
| MCP (Model Context Protocol) | Protocol that allows exposing extra tools to Claude Code via a server |
| MCP Tool | Individual tool exposed by the MCP server (e.g., `get_phase_state`, `advance_phase`) |
| Gate | Exit criteria validation that blocks transitions between phases |
| Sidebar | Read-only visual panel in VS Code showing real-time state |
| Phase | Methodology phase (0-7), each with entry/exit criteria |
| Iteration | Cycle within a phase (especially Phases 0 and 2-3) |
| Decision | Decision recorded during any phase, persisted in the state |
| Safeguard | Protection rule (S0-S7) verified by the server |
| Exit Criteria | Conditions that must be met to exit a phase |
| specs/ | Directory containing domain knowledge, references, and test data |
