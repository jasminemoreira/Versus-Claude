## Metodologia Convergencia Iterativa (Versus)

Este projeto usa a metodologia Convergencia Iterativa orquestrada via MCP server `versus-claude`.

### OBRIGATORIO em toda interacao:

1. **Sempre** chame `get_phase_state` primeiro para saber a fase atual
2. Chame `get_phase_guidance` para obter instrucoes detalhadas da fase
3. Se nao houver projeto inicializado, pergunte ao usuario se deseja criar um com `init_project`
4. Registre toda decisao importante com `record_decision`
5. Antes de avancar de fase, use `get_exit_criteria` para verificar pendencias e `advance_phase` para transicionar

### Interacao com o usuario:

Toda decisao do usuario via `ask_user` (menu clicavel com selecao simples ou multipla).

**REGRA FUNDAMENTAL:** Ao chamar `ask_user`, SEMPRE forneca opcoes predefinidas sugeridas.
Nunca envie perguntas sem opcoes — isso gera campos de texto vazios (experiencia ruim).
Mesmo para perguntas que parecem abertas, SUGIRA respostas provaveis como opcoes.
As opcoes devem ser **contextualizadas com base na descricao do projeto** fornecida pelo usuario — nunca use sugestoes genericas.

Regras:
- Ate 4 perguntas por chamada, cada uma COM opcoes sugeridas
- Use `multiSelect: true` para opcoes nao mutuamente exclusivas
- Sempre marque a recomendada com **(Recomendado)** no label
- Nunca listar opcoes A/B/C em texto — sempre usar `ask_user`
- Apos a resposta, registre com `record_decision`

### Regras gerais:

- NUNCA pule fases — a metodologia e sequencial (Phase 0 → 7)
- NUNCA implemente codigo antes de Phase 5
- Toda decisao arquitetural deve ser registrada
- Consulte `get_decisions` para recuperar decisoes anteriores
- Use `check_all_safeguards` antes de transicoes de fase
