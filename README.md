# Versus for Claude

**Orquestrador da metodologia Convergencia Iterativa v3.7 para Claude Code.**

Uma extensao VS Code que impede o Claude de pular etapas, perder decisoes e esquecer o contexto durante projetos complexos. Funciona como um copiloto do copiloto: um MCP server que gerencia estado, valida transicoes e forca disciplina metodologica.

---

## O Problema

LLMs em modo agente (Claude Code, Copilot, etc.) sofrem de tres problemas sistematicos em projetos nao-triviais:

1. **Amnesia** -- apos compactacao de contexto ou nova sessao, o modelo esquece a fase do projeto, decisoes tomadas e criterios pendentes
2. **Ansiedade de codigo** -- o modelo pula direto para implementacao sem entender o problema, definir arquitetura ou validar decisoes
3. **Deriva de escopo** -- sem restricoes externas, o modelo adiciona features nao solicitadas, reimplementa bibliotecas existentes e diverge do objetivo

O Versus resolve isso com **estado externo persistente** + **gates de transicao** + **salvaguardas ativas**.

---

## Como Funciona

```
                                    VS Code
                    ┌─────────────────────────────────────────┐
                    │                                         │
                    │   ┌─────────┐        ┌──────────────┐  │
                    │   │ Sidebar │◄───────│  state.json   │  │
                    │   │ (view)  │  watch  │  (.versus/)  │  │
                    │   └─────────┘        └──────┬───────┘  │
                    │                             │          │
                    │                        read/write      │
                    │                             │          │
  ┌──────────┐  MCP stdio   ┌─────────────────────┴───┐     │
  │  Claude  │◄────────────►│      MCP Server         │     │
  │   Code   │   13 tools   │  (validacao + regras)   │     │
  └──────────┘              └─────────────────────────┘     │
                    │                                         │
                    │   ┌─────────────────────────────────┐  │
                    │   │  Hooks (inject-context,         │  │
                    │   │  phase-gate, loop-detector)     │  │
                    │   └─────────────────────────────────┘  │
                    └─────────────────────────────────────────┘
```

A extensao expoe **13 MCP tools** que o Claude Code usa automaticamente. Tres hooks reforcam o comportamento:

| Hook | Evento | Funcao |
|------|--------|--------|
| inject-context | UserPromptSubmit | Injeta fase atual e regras no inicio de cada mensagem |
| phase-gate | PreToolUse (Edit/Write) | Bloqueia edicao de codigo antes de Phase 5 |
| loop-detector | PreToolUse (Bash) | Detecta loops de comandos repetidos (>3x) |

---

## A Metodologia: Convergencia Iterativa

Oito fases sequenciais com gates de saida validados. O modelo so avanca quando todos os exit criteria sao atendidos.

```
Phase 0  Problem Discovery        (loop iterativo, score >= 90/100)
   |
Phase 1  Architecture             (modulos + interfaces + padroes)
   |
Phase 2  Adversarial Critique  ┐
   |                           │  loop ate convergencia
Phase 3  Simplification        ┘
   |
Phase 4  Convergence Gate         (validacao final do design)
   |
Phase 5  Code Implementation      (1 arquivo por resposta)
   |
Phase 6  Tests                    (100% passando + manual exploratorio)
   |
Phase 7  Post-Review              (licoes aprendidas + meta-iteracao)
```

### Phase 0 -- Problem Discovery

O modelo faz perguntas iterativas para entender o problema. Um score de convergencia (0-100) com 10 criterios ponderados mede a qualidade do entendimento:

| Criterio | Peso |
|----------|------|
| Clareza do problema | 10 |
| Casos de uso | 15 |
| Vocabulario compartilhado | 10 |
| Ambiguidades resolvidas | 15 |
| Fora de escopo definido | 10 |
| Criterios de sucesso | 10 |
| Premissas explicitas | 10 |
| Documentacao (specs/) | 5 |
| Usuario confirmou | 10 |
| IA confiante | 5 |

**Score >= 90 obrigatorio para avancar.** O modelo nao consegue pular essa fase.

### Phases 2-3 -- Loop Adversarial

A arquitetura e atacada com 7 lentes especializadas (performance, seguranca, manutenibilidade, edge cases, dependencias, simplicidade, alternativas) e simplificada iterativamente. O loop repete ate que as criticas sejam enderecadas.

### Salvaguardas S0-S7

Regras de protecao verificaveis em qualquer momento:

| ID | Nome | Protege contra |
|----|------|----------------|
| S0 | Convergencia no Problema | Avancar sem entender o problema |
| S1 | Anti-Bug | Simplificacao que introduz bugs |
| S2 | Criterio de Parada | IA decidindo por conta quando parar |
| S3 | Convergencia Prematura | Parar iteracoes cedo demais |
| S4 | Verificacao Explicita | Pular validacao humana nos gates |
| S5 | Preservacao de Escopo | Adicionar features nao solicitadas |
| S6 | Nao Reimplementar | Recriar o que ja existe como biblioteca |
| S7 | Disciplina de Sequencia | Pular entre arquivos sem completar |

---

## Instalacao

### Pre-requisitos

- VS Code 1.85+
- Claude Code (extensao)
- Node.js 18+

### Via .vsix

```bash
code --install-extension versus-claude-0.2.0.vsix
```

Ou: `Ctrl+Shift+P` > "Extensions: Install from VSIX..."

### Via source

```bash
git clone git@github.com:jasminemoreira/Versus-Claude.git
cd Versus-Claude/versus-claude
npm install
npm run build
npx @vscode/vsce package --allow-missing-repository
code --install-extension versus-claude-*.vsix
```

---

## Uso

### 1. Inicializar um projeto

`Ctrl+Shift+P` > **"Versus: Inicializar Projeto"** > nome e descricao.

Isso cria no workspace:

```
.versus/
├── state.json            # estado da metodologia
├── server.js             # MCP server
├── inject-context.js     # hook: contexto
├── phase-gate.js         # hook: gate de edicao
└── loop-detector.js      # hook: anti-loop

.mcp.json                 # registro do MCP server para Claude Code
.claude/settings.json     # permissoes e hooks

specs/
├── references/
├── domain/
├── technical/
├── examples/
├── design/
├── models/
├── datasets/
├── validation/
└── competitors/
```

### 2. Trabalhar com Claude Code

Abra o Claude Code normalmente. O hook SessionStart faz o Claude chamar `get_phase_state()` automaticamente e seguir a metodologia.

### 3. Acompanhar pela sidebar

O painel "Versus" na activity bar mostra em tempo real: fase atual, iteracao, score, ultimas decisoes e status das salvaguardas.

---

## 13 MCP Tools

### Consulta
| Tool | Descricao |
|------|-----------|
| `get_phase_state` | Fase atual, iteracao, score, resumo |
| `get_phase_guidance` | Instrucoes detalhadas da fase (regras, perguntas, checklists) |
| `get_decisions` | Decisoes registradas (filtro por fase opcional) |
| `get_exit_criteria` | Criterios de saida com status (atendido/pendente) |
| `check_specs_status` | Contagem de arquivos por subdiretorio de specs/ |

### Transicao
| Tool | Descricao |
|------|-----------|
| `advance_phase` | Avanca para proxima fase (valida exit criteria) |
| `start_iteration` | Nova iteracao em fases ciclicas (0, 2, 3) |

### Registro
| Tool | Descricao |
|------|-----------|
| `record_decision` | Persiste decisao (fase, categoria, conteudo) |
| `update_score` | Atualiza score Phase 0 com breakdown por criterio |
| `mark_exit_criterion` | Marca criterio como atendido/pendente |

### Salvaguardas
| Tool | Descricao |
|------|-----------|
| `check_safeguard` | Verifica salvaguarda especifica (S0-S7) |
| `check_all_safeguards` | Panorama de todas as salvaguardas |

### Projeto
| Tool | Descricao |
|------|-----------|
| `init_project` | Inicializa projeto (state + bundles + specs + configs) |

---

## Compatibilidade com Versus for Copilot

O estado da metodologia fica em `.versus/` -- um diretorio neutro compartilhado entre extensoes. Isso significa que voce pode:

- Iniciar um projeto com Claude Code e continuar com Copilot (ou vice-versa)
- Usar ambos no mesmo workspace sem conflito
- O `state.json` e identico e intercambiavel

Veja o projeto irmao: [Versus for Copilot](https://github.com/jasminemoreira/Versus) (mesmo conceito para GitHub Copilot Agent Mode).

---

## Zero footprint

A extensao **nao cria nenhum arquivo automaticamente**. Tudo so acontece quando voce executa "Inicializar Projeto" pela paleta de comandos. Se voce instalar a extensao e nunca usar, seu workspace permanece intacto.

---

## Estrutura do Repositorio

```
Versus-Claude/
├── versus-claude/           # extensao VS Code
│   ├── src/
│   │   ├── extension.ts        # lifecycle (lazy init)
│   │   ├── mcp/
│   │   │   ├── server.ts       # MCP server (stdio)
│   │   │   └── tools/          # 13 tools organizadas por grupo
│   │   ├── state/
│   │   │   ├── engine.ts       # leitura/escrita do state.json
│   │   │   └── types.ts        # tipos TypeScript
│   │   ├── rules/
│   │   │   ├── phases.ts       # definicoes de fases e exit criteria
│   │   │   ├── safeguards.ts   # S0-S7
│   │   │   ├── guidance.ts     # instrucoes comportamentais por fase
│   │   │   └── methodology.ts  # facade de validacao
│   │   ├── hooks/
│   │   │   ├── inject-context.ts
│   │   │   ├── phase-gate.ts
│   │   │   └── loop-detector.ts
│   │   └── views/
│   │       └── sidebar.ts      # TreeDataProvider (read-only)
│   ├── package.json
│   └── tsconfig.json
├── specs/                  # especificacoes do proprio projeto
└── AGENTS.md               # instrucoes para Agent Mode
```

---

## Licenca

MIT
