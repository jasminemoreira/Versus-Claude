// Shared setup utilities — no external dependencies (only fs/path).
// Used by both extension.ts (VS Code context) and project-tools.ts (MCP context).

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const SPECS_README_CONTENT = `# specs/ — Material de referência para a metodologia

O assistente (Claude/Copilot/Qwen) lê destes diretórios durante as fases
0-7. Popule com conteúdo do seu projeto antes de iniciar cada fase.

## Como operar o Versus

**Retomar contexto:** digite \`retomar Versus\` no chat. O assistente
recarrega a fase atual, decisões e instruções. Use sempre que o chat
perder contexto (reinício do VSCode, conversa longa, trocou de modelo).

**MCP não foi descoberto:** se você já tinha o chat aberto quando
inicializou o projeto, feche e reabra — o MCP server só é detectado ao
iniciar uma nova sessão.

## Subdiretórios

- **domain/** — conhecimento de domínio, glossário, regras de negócio, invariantes
- **references/** — papers, artigos, documentação externa citada no design
- **technical/** — algoritmos, fórmulas, parâmetros numéricos com fontes
- **examples/** — implementações de referência (para port em S6 Tier 2)
- **design/** — mockups, wireframes, referências de UX
- **models/** — modelos de domínio, modelos de dados, relacionamentos
- **datasets/** — dados de teste, entradas de exemplo, saídas esperadas
- **validation/** — critérios de aceitação, cenários de teste, métricas de sucesso
- **competitors/** — produtos similares analisados em P0

## Qual pasta alimenta qual fase

- **Fase 0-1:** domain, references, technical, competitors
- **Fase 1:** + examples, design, models
- **Fase 5:** technical, examples, models, datasets
- **Fase 6:** validation, datasets
`;

/**
 * Writes specs/README.md if it does not already exist.
 * Never overwrites — respects user customizations.
 * Returns true if the file was created.
 */
export function ensureSpecsReadme(workspace: string): boolean {
  const readmePath = path.join(workspace, "specs", "README.md");
  if (fs.existsSync(readmePath)) return false;
  const specsDir = path.dirname(readmePath);
  if (!fs.existsSync(specsDir)) {
    fs.mkdirSync(specsDir, { recursive: true });
  }
  fs.writeFileSync(readmePath, SPECS_README_CONTENT, "utf-8");
  return true;
}

// Permissions auto-approved in user projects when the extension initializes.
// Includes MCP tools + general development tools so Claude can work without
// permission prompts for routine operations (read, write, search, execute).
const AUTO_APPROVED_PERMISSIONS = [
  // MCP tools
  "mcp__versus-claude__get_phase_state",
  "mcp__versus-claude__get_decisions",
  "mcp__versus-claude__get_exit_criteria",
  "mcp__versus-claude__advance_phase",
  "mcp__versus-claude__start_iteration",
  "mcp__versus-claude__record_decision",
  "mcp__versus-claude__update_score",
  "mcp__versus-claude__mark_exit_criterion",
  "mcp__versus-claude__check_safeguard",
  "mcp__versus-claude__check_all_safeguards",
  "mcp__versus-claude__check_specs_status",
  "mcp__versus-claude__init_project",
  "mcp__versus-claude__get_phase_guidance",
  "mcp__versus-claude__update_project_spec",
  "mcp__versus-claude__start_new_cycle",
  // General development tools
  "Read",
  "Write",
  "Edit",
  "Glob",
  "Grep",
  "Bash",
  "WebFetch",
  "WebSearch",
  "NotebookEdit",
];

/**
 * Generates hooks config using LOCAL project paths (.versus/).
 */
function buildOrchestratorHooks(workspace: string): Record<string, any> {
  const orchDir = path.join(workspace, ".versus");

  return {
    UserPromptSubmit: [
      {
        hooks: [
          {
            type: "command",
            command: `node "${path.join(orchDir, "inject-context.js")}"`,
          },
        ],
      },
    ],
    PreToolUse: [
      {
        // Bash too: shell writes (`cat > src/x <<EOF`) bypassed the gate entirely before 0.17.0
        matcher: "Edit|Write|MultiEdit|NotebookEdit|Bash",
        hooks: [
          {
            type: "command",
            command: `node "${path.join(orchDir, "phase-gate.js")}"`,
          },
        ],
      },
      {
        matcher: "Bash",
        hooks: [
          {
            type: "command",
            command: `node "${path.join(orchDir, "loop-detector.js")}"`,
          },
        ],
      },
      {
        matcher: "Bash",
        hooks: [
          {
            type: "command",
            command: `node "${path.join(orchDir, "block-destructive.js")}"`,
          },
        ],
      },
    ],
    PostToolUse: [
      {
        matcher: "Grep|Bash",
        hooks: [
          {
            type: "command",
            command: `node "${path.join(orchDir, "truncation-check.js")}"`,
          },
        ],
      },
      {
        matcher: "Bash",
        hooks: [
          {
            type: "command",
            command: `node "${path.join(orchDir, "test-outcome.js")}"`,
          },
        ],
      },
    ],
    Stop: [
      {
        hooks: [
          {
            type: "command",
            command: `node "${path.join(orchDir, "stop-verify.js")}"`,
            timeout: 120,
          },
        ],
      },
    ],
    PreCompact: [
      {
        hooks: [
          {
            type: "prompt",
            prompt:
              "BEFORE compaction: call get_phase_state() and save the result in MEMORY.md (in your auto memory directory). Include: current phase, iteration, key decisions, next steps.",
          },
        ],
      },
    ],
    SessionStart: [
      {
        matcher: "",
        hooks: [
          {
            type: "prompt",
            prompt:
              "STOP. Before doing ANYTHING else — before reading any files, before exploring the codebase — you MUST execute these two MCP tool calls RIGHT NOW:\n" +
              "1. Call mcp__versus-claude__get_phase_state() to load the current methodology phase\n" +
              "2. Call mcp__versus-claude__get_phase_guidance() to get detailed instructions\n" +
              "DO NOT read .versus/state.json or .versus/server.js directly. DO NOT skip these calls. " +
              "The MCP server versus-claude manages the IACDM methodology state. All methodology interactions MUST go through MCP tools: " +
              "record_decision() for decisions, update_score() for scoring, mark_exit_criterion() for criteria, advance_phase() for transitions. " +
              "If get_phase_state returns an error (project not initialized), look at the init_project tool description: it has a BOOTSTRAP PROTOCOL for brownfield projects (workspace with existing code) that requires reading surface files, presenting a proposal, getting user confirmation, then calling init_project with bootstrap_data. For empty workspaces (greenfield), just ask the user for a project name and description, then call init_project directly. " +
              "If in Phase 6: also call get_decisions(phase=6) to recover testing progress — manual testing spans sessions.\n" +
              "VISIBILITY: after loading state, START your first response with a one-line banner so the user knows Versus is active, e.g.: '📍 Versus ativo — Fase X (name), iteração Y. Próximo passo: <one line>.' The user must SEE that methodology context was loaded; do not load silently.",
          },
        ],
      },
      {
        matcher: "compact",
        hooks: [
          {
            type: "prompt",
            prompt:
              "STOP. Context was compacted. Before doing ANYTHING else, you MUST recover methodology state:\n" +
              "1. Call mcp__versus-claude__get_phase_state() to reload current phase\n" +
              "2. Call mcp__versus-claude__get_phase_guidance() to reload instructions\n" +
              "3. Call mcp__versus-claude__get_decisions() to reload previous decisions\n" +
              "4. Read MEMORY.md (auto memory) for additional context\n" +
              "DO NOT read .versus/state.json or .versus/server.js directly. DO NOT skip these calls. " +
              "Continue where you left off only AFTER completing all 4 steps above.\n" +
              "VISIBILITY: after recovering, START your first response with a one-line banner so the user knows Versus recovered, e.g.: '📍 Versus retomado — Fase X (name), iteração Y. Continuando: <one line>.'",
          },
        ],
      },
    ],
  };
}

/**
 * Writes MCP tool permissions to ~/.claude/settings.json (global).
 * Only touches permissions.allow — never writes hooks (workspace-specific).
 * Called on activation so permissions work even in fresh workspaces.
 */
export function ensureGlobalPermissions(): void {
  const globalDir = path.join(os.homedir(), ".claude");
  const globalPath = path.join(globalDir, "settings.json");

  if (!fs.existsSync(globalDir)) {
    fs.mkdirSync(globalDir, { recursive: true });
  }

  let settings: Record<string, any> = {};
  if (fs.existsSync(globalPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(globalPath, "utf-8"));
    } catch {
      settings = {};
    }
  }

  if (!settings.permissions) { settings.permissions = { allow: [] }; }
  if (!settings.permissions.allow) { settings.permissions.allow = []; }

  const allow: string[] = settings.permissions.allow;
  let modified = false;
  for (const perm of AUTO_APPROVED_PERMISSIONS) {
    if (!allow.includes(perm)) {
      allow.push(perm);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(globalPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");
  }
}

/**
 * Ensures settings.json has MCP permissions and orchestrator hooks.
 * Preserves existing user permissions and hooks.
 */
export function ensureSettings(workspace: string): boolean {
  const settingsPath = path.join(workspace, ".claude", "settings.json");
  const settingsDir = path.dirname(settingsPath);

  if (!fs.existsSync(settingsDir)) {
    fs.mkdirSync(settingsDir, { recursive: true });
  }

  let settings: Record<string, any> = {};
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    } catch {
      settings = {};
    }
  }

  let modified = false;

  if (!settings.permissions) {
    settings.permissions = { allow: [] };
  }
  if (!settings.permissions.allow) {
    settings.permissions.allow = [];
  }
  const allow: string[] = settings.permissions.allow;
  for (const perm of AUTO_APPROVED_PERMISSIONS) {
    if (!allow.includes(perm)) {
      allow.push(perm);
      modified = true;
    }
  }

  if (!settings.hooks) {
    settings.hooks = {};
  }
  // Force-replace all orchestrator hooks to ensure prompts stay current.
  // Previous versions appended hooks; now we overwrite the entire hook type
  // so stale prompts don't linger alongside updated ones.
  const orchestratorHooks = buildOrchestratorHooks(workspace);
  for (const [hookType, hookConfigs] of Object.entries(orchestratorHooks)) {
    const prev = JSON.stringify(settings.hooks[hookType] ?? null);
    settings.hooks[hookType] = hookConfigs;
    if (JSON.stringify(hookConfigs) !== prev) {
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");
  }

  return modified;
}
