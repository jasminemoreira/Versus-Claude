# Glossário — Versus for Claude

| Termo | Definição |
|-------|-----------|
| Orquestrador | Extensão VSCode (MCP server + sidebar) que gerencia estado da metodologia Convergência Iterativa |
| IACDM | Iterative Adversarial Convergence Development Methodology — nome técnico da Convergência Iterativa |
| State | Objeto JSON persistido em `.versus/state.json`: fase atual, iteração, score, decisões, salvaguardas |
| MCP (Model Context Protocol) | Protocolo que permite expor ferramentas extras ao Claude Code via servidor |
| MCP Tool | Ferramenta individual exposta pelo MCP server (ex: `get_phase_state`, `advance_phase`) |
| Gate | Validação de exit criteria que bloqueia transição entre fases |
| Sidebar | Painel visual read-only no VSCode mostrando estado em tempo real |
| Phase | Fase da metodologia (0-7), cada uma com entry/exit criteria |
| Iteration | Ciclo dentro de uma fase (especialmente Phases 0 e 2-3) |
| Decision | Decisão registrada durante qualquer fase, persistida no state |
| Safeguard | Regra de proteção (S0-S7) verificada pelo servidor |
| Exit Criteria | Condições que devem ser atendidas para sair de uma fase |
| specs/ | Diretório com conhecimento de domínio, referências, dados de teste |
