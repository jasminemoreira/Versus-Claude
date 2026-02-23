# AGENTS.md — Instruções obrigatórias para Agent Mode

## PRIMEIRA AÇÃO (antes de qualquer outra coisa):

Chame a tool `get_phase_state` do MCP server `iacdm-orchestrator`.
Isso retorna a fase atual da metodologia IACDM Convergência Iterativa.

- Se retornar erro "projeto não inicializado": pergunte ao usuário se deseja iniciar com `init_project`
- Se retornar uma fase: chame `get_phase_guidance` e siga as instruções da fase

NÃO faça nada antes de chamar `get_phase_state`. NÃO pergunte ao usuário o que quer fazer.
NÃO improvise. O fluxo da metodologia é determinado pelo estado retornado.

## Regras do fluxo:

1. Cada interação começa com `get_phase_state` → `get_phase_guidance`
2. Decisões do usuário via `ask_user` (menu com opções predefinidas contextualizadas)
3. Registre decisões com `record_decision`
4. Antes de avançar fase: `get_exit_criteria` → `advance_phase`
5. NUNCA pule fases (0→7 sequencial)
6. NUNCA implemente código antes de Phase 5
