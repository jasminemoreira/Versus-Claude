// Shared setup utilities — no external dependencies (only fs/path).
// Used by both extension.ts (VS Code context) and project-tools.ts (MCP context).

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

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
        matcher: "Edit|Write",
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
              "If get_phase_state returns an error, ask the user if they want to initialize with init_project(). " +
              "If in Phase 6: also call get_decisions(phase=6) to recover testing progress — manual testing spans sessions.",
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
              "Continue where you left off only AFTER completing all 4 steps above.",
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
