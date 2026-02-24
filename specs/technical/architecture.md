# Architecture — Versus for Claude

## Pattern: Modular Monolith | Principles: KISS + YAGNI

## Modules

### 1. Extension Core (`src/extension.ts`)
- **Responsibility:** VS Code extension lifecycle — activation, deactivation, component registration
- **Depends on:** all other modules (orchestrates initialization)
- **Interface:**
  - `activate(context: ExtensionContext): void` — registers sidebar, generates .mcp.json
  - `deactivate(): void` — cleanup

### 2. MCP Server (`src/mcp/server.ts`, `src/mcp/tools/*.ts`)
- **Responsibility:** Expose 12 MCP tools to Claude Code via stdio. Receives calls, delegates to State Engine, returns results/errors
- **Depends on:** State Engine, Methodology Rules
- **Interface:** MCP Protocol (JSON-RPC via stdio)
  - `ListToolsRequest` → returns catalog of 12 tools
  - `CallToolRequest` → executes tool, returns result or error
- **Execution:** Separate child process (spawned by Extension Core)
- **Communication with Extension Core:** via shared state.json file + file watcher

### 3. State Engine (`src/state/engine.ts`, `src/state/types.ts`)
- **Responsibility:** Manage persistent state — read/write state.json, validate transitions, record decisions
- **Depends on:** Methodology Rules (for validation)
- **Interface:**
  ```typescript
  // Query
  getPhaseState(): PhaseState
  getDecisions(phase?: number): Decision[]
  getExitCriteria(phase: number): ExitCriterion[]

  // Transitions
  advancePhase(target: number): Result<void, TransitionError>
  startIteration(phase: number): IterationInfo

  // Recording
  recordDecision(phase: number, category: string, content: string): Decision
  updateScore(score: number, breakdown: ScoreBreakdown): void
  markExitCriterion(phase: number, criterion: string, met: boolean): void

  // Safeguards
  checkSafeguard(id: string): SafeguardStatus
  checkAllSafeguards(): SafeguardStatus[]

  // Specs
  checkSpecsStatus(): SpecsStatus

  // Project
  initProject(name: string, description: string): void
  ```
- **Persistence:** `.versus/state.json` in the workspace
- **State:** Singleton per workspace

### 4. Methodology Rules (`src/rules/methodology.ts`, `src/rules/phases.ts`, `src/rules/safeguards.ts`)
- **Responsibility:** Define Iterative Convergence v3.6 rules — exit criteria per phase, safeguard definitions, transition rules
- **Depends on:** nothing (pure data)
- **Interface:**
  ```typescript
  // Definitions
  getPhaseDefinition(phase: number): PhaseDefinition
  getExitCriteriaDefinitions(phase: number): ExitCriterionDef[]
  getSafeguardDefinition(id: string): SafeguardDef

  // Validation
  validateTransition(from: number, to: number, state: PhaseState): ValidationResult
  validateSafeguard(id: string, state: PhaseState): SafeguardResult
  ```
- **Nature:** Data/configuration module, stateless. Hardcoded IC v3.6 rules.

### 5. TreeView Sidebar (`src/views/sidebar.ts`)
- **Responsibility:** Native read-only UI — display current phase, score, iteration, decisions, safeguards
- **Depends on:** State Engine (via Extension Core)
- **Interface:**
  - Implements `vscode.TreeDataProvider<StateItem>`
  - `refresh(): void` — called when state.json changes
  - No user interaction (read-only)
- **Update:** File watcher on state.json triggers TreeView `refresh()`

## Main Types

```typescript
interface PhaseState {
  projectName: string
  projectDescription: string
  currentPhase: number        // 0-7
  currentIteration: number    // within the phase
  phase0Score: number | null  // 0-100
  phase0Breakdown: ScoreBreakdown | null
  decisions: Decision[]
  exitCriteria: ExitCriterionState[]  // per phase
  safeguards: SafeguardState[]
  specsStatus: SpecsStatus
  createdAt: string           // ISO timestamp
  updatedAt: string
  history: PhaseTransition[]  // transition log
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
  id: string                  // "S0" to "S7"
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

## Data Flow

```
Claude Code → (stdio/MCP) → MCP Server → State Engine → state.json
                                              ↓
                                       Methodology Rules
                                       (validates transition)
                                              ↓
state.json → (file watcher) → Extension Core → TreeView.refresh()
```

## File Structure

```
versus-claude/
├── src/
│   ├── extension.ts              # Extension Core
│   ├── mcp/
│   │   ├── server.ts             # MCP server entry (separate process)
│   │   └── tools/
│   │       ├── index.ts          # Registration of all tools
│   │       ├── state-tools.ts    # get_phase_state, get_decisions, get_exit_criteria
│   │       ├── transition-tools.ts  # advance_phase, start_iteration
│   │       ├── record-tools.ts   # record_decision, update_score, mark_exit_criterion
│   │       ├── safeguard-tools.ts   # check_safeguard, check_all_safeguards
│   │       ├── specs-tools.ts    # check_specs_status
│   │       └── project-tools.ts  # init_project
│   ├── state/
│   │   ├── engine.ts             # State Engine
│   │   └── types.ts              # TypeScript Types
│   ├── rules/
│   │   ├── methodology.ts        # Rules facade
│   │   ├── phases.ts             # Phase and exit criteria definitions
│   │   └── safeguards.ts         # Safeguard definitions S0-S7
│   └── views/
│       └── sidebar.ts            # TreeDataProvider (read-only)
├── package.json                  # VS Code Manifest
├── tsconfig.json
└── .mcp.json                     # Automatically generated
```

## Architectural Decisions

| Decision | Reason |
|----------|--------|
| MCP server as child process | Fault isolation, MCP stdio pattern |
| State in JSON on filesystem | Simple, readable, versionable persistence |
| Communication via file watcher | Decouples MCP server from sidebar without complex IPC |
| Hardcoded rules (not config) | KISS — IC v3.6 is fixed, no parser needed |
| Native TreeView (not Webview) | Less boilerplate, native VS Code, read-only by nature |
| Minimal hook + strong descriptions | Addresses P1 (Claude may not call tools). Lightweight dual layer |
| 1 file per tool group | Organization without over-engineering |
| Workspace path via env var | MCP server (separate process) needs to know where to read/write state |
