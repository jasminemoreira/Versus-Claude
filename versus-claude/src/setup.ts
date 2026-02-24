// Shared setup utilities — no external dependencies (only fs/path).
// Used by both extension.ts (VS Code context) and project-tools.ts (MCP context).

import * as fs from "fs";
import * as path from "path";

const MCP_TOOL_PERMISSIONS = [
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
              "MANDATORY: call get_phase_state() from MCP server versus-claude to know the current phase of the Iterative Convergence methodology. Then call get_phase_guidance() to get detailed instructions for the current phase. If it returns a project not initialized error, ask the user if they want to start a new project with init_project(). Every important decision must be recorded with record_decision(). Before advancing phase, use get_exit_criteria() and advance_phase().",
          },
        ],
      },
      {
        matcher: "compact",
        hooks: [
          {
            type: "prompt",
            prompt:
              "CONTEXT RESTORED. MANDATORY: call get_phase_state() and get_phase_guidance() to recover methodology state and instructions. Query get_decisions() for previous decisions. Read MEMORY.md (auto memory) for additional context. Continue where you left off.",
          },
        ],
      },
    ],
  };
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
  for (const perm of MCP_TOOL_PERMISSIONS) {
    if (!allow.includes(perm)) {
      allow.push(perm);
      modified = true;
    }
  }

  if (!settings.hooks) {
    settings.hooks = {};
  }
  const orchestratorHooks = buildOrchestratorHooks(workspace);
  for (const [hookType, hookConfigs] of Object.entries(orchestratorHooks)) {
    if (!settings.hooks[hookType]) {
      settings.hooks[hookType] = hookConfigs;
      modified = true;
    } else {
      const existing = settings.hooks[hookType] as any[];
      for (const config of hookConfigs) {
        const configHook = (config as any).hooks?.[0];
        if (!configHook) continue;
        const alreadyExists = existing.some((e: any) => {
          const eHook = e.hooks?.[0];
          if (!eHook) return false;
          if (configHook.type === "command") {
            return eHook.command === configHook.command;
          }
          if (configHook.type === "prompt") {
            return eHook.prompt === configHook.prompt;
          }
          return false;
        });
        if (!alreadyExists) {
          existing.push(config);
          modified = true;
        }
      }
    }
  }

  if (modified) {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");
  }

  return modified;
}
