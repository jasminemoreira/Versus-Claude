# Arquitetura — Versus for Claude

## Padrão: Modular Monolith | Princípios: KISS + YAGNI

## Módulos

### 1. Extension Core (`src/extension.ts`)
- **Responsabilidade:** Lifecycle da extensão VSCode — activation, deactivation, registro de componentes
- **Depende de:** todos os outros módulos (orquestra inicialização)
- **Interface:**
  - `activate(context: ExtensionContext): void` — registra sidebar, gera .mcp.json
  - `deactivate(): void` — cleanup

### 2. MCP Server (`src/mcp/server.ts`, `src/mcp/tools/*.ts`)
- **Responsabilidade:** Expor 12 MCP tools ao Claude Code via stdio. Recebe chamadas, delega ao State Engine, retorna resultados/erros
- **Depende de:** State Engine, Methodology Rules
- **Interface:** Protocolo MCP (JSON-RPC via stdio)
  - `ListToolsRequest` → retorna catálogo de 12 tools
  - `CallToolRequest` → executa tool, retorna resultado ou erro
- **Execução:** Processo filho separado (spawned pela Extension Core)
- **Comunicação com Extension Core:** via arquivo state.json compartilhado + file watcher

### 3. State Engine (`src/state/engine.ts`, `src/state/types.ts`)
- **Responsabilidade:** Gerenciar estado persistente — ler/escrever state.json, validar transições, registrar decisões
- **Depende de:** Methodology Rules (para validação)
- **Interface:**
  ```typescript
  // Consulta
  getPhaseState(): PhaseState
  getDecisions(phase?: number): Decision[]
  getExitCriteria(phase: number): ExitCriterion[]

  // Transições
  advancePhase(target: number): Result<void, TransitionError>
  startIteration(phase: number): IterationInfo

  // Registro
  recordDecision(phase: number, category: string, content: string): Decision
  updateScore(score: number, breakdown: ScoreBreakdown): void
  markExitCriterion(phase: number, criterion: string, met: boolean): void

  // Salvaguardas
  checkSafeguard(id: string): SafeguardStatus
  checkAllSafeguards(): SafeguardStatus[]

  // Specs
  checkSpecsStatus(): SpecsStatus

  // Projeto
  initProject(name: string, description: string): void
  ```
- **Persistência:** `.versus/state.json` no workspace
- **Estado:** Singleton por workspace

### 4. Methodology Rules (`src/rules/methodology.ts`, `src/rules/phases.ts`, `src/rules/safeguards.ts`)
- **Responsabilidade:** Definir regras da Convergência Iterativa v3.6 — exit criteria por fase, definições de salvaguardas, regras de transição
- **Depende de:** nenhum (dados puros)
- **Interface:**
  ```typescript
  // Definições
  getPhaseDefinition(phase: number): PhaseDefinition
  getExitCriteriaDefinitions(phase: number): ExitCriterionDef[]
  getSafeguardDefinition(id: string): SafeguardDef

  // Validação
  validateTransition(from: number, to: number, state: PhaseState): ValidationResult
  validateSafeguard(id: string, state: PhaseState): SafeguardResult
  ```
- **Natureza:** Módulo de dados/configuração, sem estado. Regras hardcoded da CI v3.6.

### 5. TreeView Sidebar (`src/views/sidebar.ts`)
- **Responsabilidade:** UI read-only nativa — mostrar fase atual, score, iteração, decisões, salvaguardas
- **Depende de:** State Engine (via Extension Core)
- **Interface:**
  - Implementa `vscode.TreeDataProvider<StateItem>`
  - `refresh(): void` — chamado quando state.json muda
  - Sem interação do usuário (read-only)
- **Atualização:** File watcher no state.json dispara `refresh()` do TreeView

## Tipos Principais

```typescript
interface PhaseState {
  projectName: string
  projectDescription: string
  currentPhase: number        // 0-7
  currentIteration: number    // dentro da fase
  phase0Score: number | null  // 0-100
  phase0Breakdown: ScoreBreakdown | null
  decisions: Decision[]
  exitCriteria: ExitCriterionState[]  // por fase
  safeguards: SafeguardState[]
  specsStatus: SpecsStatus
  createdAt: string           // ISO timestamp
  updatedAt: string
  history: PhaseTransition[]  // log de transições
}

interface Decision {
  id: string
  phase: number
  category: string            // "architecture", "pattern", "constraint", etc.
  content: string
  timestamp: string
}

interface ExitCriterionState {
  phase: number
  criterion: string
  met: boolean
  details?: string
}

interface SafeguardState {
  id: string                  // "S0" a "S7"
  status: "ok" | "warning" | "violated"
  details?: string
}

interface SpecsStatus {
  [directory: string]: {
    populated: boolean
    fileCount: number
  }
}

interface PhaseTransition {
  from: number
  to: number
  timestamp: string
  criteria_met: string[]
}
```

## Fluxo de Dados

```
Claude Code → (stdio/MCP) → MCP Server → State Engine → state.json
                                              ↓
                                       Methodology Rules
                                       (valida transição)
                                              ↓
state.json → (file watcher) → Extension Core → TreeView.refresh()
```

## Estrutura de Arquivos

```
versus-claude/
├── src/
│   ├── extension.ts              # Extension Core
│   ├── mcp/
│   │   ├── server.ts             # MCP server entry (processo separado)
│   │   └── tools/
│   │       ├── index.ts          # Registro de todas as tools
│   │       ├── state-tools.ts    # get_phase_state, get_decisions, get_exit_criteria
│   │       ├── transition-tools.ts  # advance_phase, start_iteration
│   │       ├── record-tools.ts   # record_decision, update_score, mark_exit_criterion
│   │       ├── safeguard-tools.ts   # check_safeguard, check_all_safeguards
│   │       ├── specs-tools.ts    # check_specs_status
│   │       └── project-tools.ts  # init_project
│   ├── state/
│   │   ├── engine.ts             # State Engine
│   │   └── types.ts              # Tipos TypeScript
│   ├── rules/
│   │   ├── methodology.ts        # Facade das regras
│   │   ├── phases.ts             # Definições de fases e exit criteria
│   │   └── safeguards.ts         # Definições de salvaguardas S0-S7
│   └── views/
│       └── sidebar.ts            # TreeDataProvider (read-only)
├── package.json                  # Manifest VSCode
├── tsconfig.json
└── .mcp.json                     # Gerado automaticamente
```

## Decisões Arquiteturais

| Decisão | Razão |
|---------|-------|
| MCP server como processo filho | Isolamento de falhas, padrão MCP stdio |
| State em JSON no filesystem | Persistência simples, legível, versionável |
| Comunicação via file watcher | Desacopla MCP server da sidebar sem IPC complexo |
| Regras hardcoded (não config) | KISS — CI v3.6 é fixa, não precisa de parser |
| TreeView nativo (não Webview) | Menos boilerplate, nativo VSCode, read-only por natureza |
| Hook mínimo + descriptions fortes | Resolver P1 (Claude pode não chamar tools). Dupla camada leve |
| 1 arquivo por grupo de tools | Organização sem over-engineering |
| Workspace path via env var | MCP server (processo separado) precisa saber onde ler/escrever state |
