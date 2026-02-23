# AGENTS.md — Instrucoes obrigatorias para Agent Mode

## PRIMEIRA ACAO (antes de qualquer outra coisa):

Chame a tool `get_phase_state` do MCP server `versus-claude`.
Isso retorna a fase atual da metodologia Convergencia Iterativa.

- Se retornar erro "projeto nao inicializado": pergunte ao usuario se deseja iniciar com `init_project`
- Se retornar uma fase: chame `get_phase_guidance` e siga as instrucoes da fase

NAO faca nada antes de chamar `get_phase_state`. NAO pergunte ao usuario o que quer fazer.
NAO improvise. O fluxo da metodologia e determinado pelo estado retornado.

## Regras do fluxo:

1. Cada interacao comeca com `get_phase_state` → `get_phase_guidance`
2. Decisoes do usuario via `ask_user` (menu com opcoes predefinidas contextualizadas)
3. Registre decisoes com `record_decision`
4. Antes de avancar fase: `get_exit_criteria` → `advance_phase`
5. NUNCA pule fases (0→7 sequencial)
6. NUNCA implemente codigo antes de Phase 5
