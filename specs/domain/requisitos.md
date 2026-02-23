# Requisitos — IACDM Orchestrator

## Problema
O Claude perde o estado da metodologia Convergência Iterativa v3.6 durante conversas longas (>50 mensagens) e entre sessões. Sintomas:
- Esquece a fase atual
- Pula fases (vai direto para código)
- Perde decisões tomadas em fases anteriores
- Ignora salvaguardas S0-S7
- Não consulta/popula specs/

## Solução
Extensão VSCode com:
1. **MCP Server** — fonte de verdade externa, fornece tools ao Claude Code
2. **Sidebar read-only** — visualização do estado para o usuário
3. **State persistido** — sobrevive compactação, sessões, crashes

## Usuários
- Interno (INDT) inicialmente, público (open-source) depois

## Decisões Confirmadas
- **1 projeto por workspace** — cada workspace VSCode = 1 instância da metodologia
- **Retomada automática** — ao reabrir, restaura estado exato de onde parou
- **Metodologia fixa** — hardcoded para Convergência Iterativa v3.6
- **Sidebar read-only** — somente visualização, ações via Claude Code + MCP
- **Idioma PT** — interface em português
- **Storage**: `.iacdm/state.json`
- **Specs verificado** — MCP verifica specs/ mas não bloqueia (alerta + permite com confirmação)
- **Hooks removidos** — MCP substitui hooks existentes
- **~12 MCP tools granulares** — propósito claro por ferramenta
- **Violações**: recusar + explicar (sem notificação UI extra)

## Fora de Escopo
| Item | Razão |
|------|-------|
| Gerar código de negócio | Orquestrador gerencia metodologia, não implementa |
| Substituir Claude Code | Complementa, não substitui |
| Editar SKILL.md automaticamente | Só Phase 7 com aprovação manual |
| Múltiplas metodologias/plugins | Hardcoded para CI v3.6 |
| i18n | Interface em português |
| Sidebar interativa | Read-only, ações via MCP |

## Critérios de Sucesso
1. Estado nunca perdido após compactação ou nova sessão
2. Decisões rastreáveis e consultáveis
3. Salvaguardas S0-S7 forçadas pelo servidor
4. Transições de fase validadas com exit criteria
5. Violações explicadas com mensagem clara sobre pendências
