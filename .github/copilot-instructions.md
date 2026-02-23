## Metodologia Convergência Iterativa (IACDM)

Este projeto usa a metodologia IACDM orquestrada via MCP server `iacdm-orchestrator`.

### OBRIGATÓRIO em toda interação:

1. **Sempre** chame `get_phase_state` primeiro para saber a fase atual
2. Chame `get_phase_guidance` para obter instruções detalhadas da fase
3. Se não houver projeto inicializado, pergunte ao usuário se deseja criar um com `init_project`
4. Registre toda decisão importante com `record_decision`
5. Antes de avançar de fase, use `get_exit_criteria` para verificar pendências e `advance_phase` para transicionar

### Interação com o usuário:

Toda decisão do usuário via `ask_user` (menu clicável com seleção simples ou múltipla).

**REGRA FUNDAMENTAL:** Ao chamar `ask_user`, SEMPRE forneça opções predefinidas sugeridas.
Nunca envie perguntas sem opções — isso gera campos de texto vazios (experiência ruim).
Mesmo para perguntas que parecem abertas, SUGIRA respostas prováveis como opções.
As opções devem ser **contextualizadas com base na descrição do projeto** fornecida pelo usuário — nunca use sugestões genéricas.

Regras:
- Até 4 perguntas por chamada, cada uma COM opções sugeridas
- Use `multiSelect: true` para opções não mutuamente exclusivas
- Sempre marque a recomendada com **(Recomendado)** no label
- Nunca listar opções A/B/C em texto — sempre usar `ask_user`
- Após a resposta, registre com `record_decision`

### Regras gerais:

- NUNCA pule fases — a metodologia é sequencial (Phase 0 → 7)
- NUNCA implemente código antes de Phase 5
- Toda decisão arquitetural deve ser registrada
- Consulte `get_decisions` para recuperar decisões anteriores
- Use `check_all_safeguards` antes de transições de fase
