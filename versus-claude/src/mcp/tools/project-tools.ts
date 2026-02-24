// MCP Tools: project initialization

import * as fs from "fs";
import * as path from "path";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { StateEngine } from "../../state/engine";

const SPECS_SUBDIRS = [
  "references",
  "domain",
  "technical",
  "examples",
  "design",
  "models",
  "datasets",
  "validation",
  "competitors",
];

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

const BUNDLE_FILES = ["inject-context.js", "phase-gate.js", "loop-detector.js", "server.js"];

/**
 * Resolves the bundle directory.
 * If running from bundle (out/bundle/server.js) → bundles are in the same dir (__dirname).
 * If running from source (out/mcp/tools/project-tools.js) → bundles in out/bundle/.
 */
function getBundleDir(): string {
  if (fs.existsSync(path.join(__dirname, "inject-context.js"))) {
    return __dirname;
  }
  return path.resolve(__dirname, "..", "..", "bundle");
}

/**
 * Copies the 4 bundles to .versus/ in the project.
 * Returns true if any file was created/updated.
 */
function deployBundles(workspace: string): boolean {
  const bundleDir = getBundleDir();
  const targetDir = path.join(workspace, ".versus");

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  let deployed = false;
  for (const file of BUNDLE_FILES) {
    const src = path.join(bundleDir, file);
    const dest = path.join(targetDir, file);

    if (!fs.existsSync(src)) {
      continue; // bundle not found, skip
    }

    const srcContent = fs.readFileSync(src);
    const destExists = fs.existsSync(dest);
    const destContent = destExists ? fs.readFileSync(dest) : null;

    if (!destExists || !srcContent.equals(destContent!)) {
      fs.writeFileSync(dest, srcContent);
      deployed = true;
    }
  }

  return deployed;
}

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
 * Creates or updates .mcp.json in the workspace to register the LOCAL MCP server.
 * The server.js is in .versus/server.js of the project itself.
 */
function ensureMcpJson(workspace: string): boolean {
  const mcpPath = path.join(workspace, ".mcp.json");
  const serverPath = path.join(workspace, ".versus", "server.js");

  const expectedConfig = {
    type: "stdio",
    command: "node",
    args: [serverPath],
    env: {},
  };

  let mcpJson: Record<string, any> = { mcpServers: {} };
  if (fs.existsSync(mcpPath)) {
    try {
      mcpJson = JSON.parse(fs.readFileSync(mcpPath, "utf-8"));
      if (!mcpJson.mcpServers) mcpJson.mcpServers = {};
    } catch {
      mcpJson = { mcpServers: {} };
    }
  }

  // Check if already correct
  const existing = mcpJson.mcpServers["versus-claude"];
  if (existing && JSON.stringify(existing.args) === JSON.stringify(expectedConfig.args)) {
    return false;
  }

  mcpJson.mcpServers["versus-claude"] = expectedConfig;
  fs.writeFileSync(mcpPath, JSON.stringify(mcpJson, null, 2) + "\n", "utf-8");
  return true;
}

/**
 * Ensures settings.json has MCP permissions and orchestrator hooks.
 * Preserves existing user permissions and hooks.
 */
function ensureSettings(workspace: string): boolean {
  const settingsPath = path.join(workspace, ".claude", "settings.json");
  const settingsDir = path.dirname(settingsPath);

  if (!fs.existsSync(settingsDir)) {
    fs.mkdirSync(settingsDir, { recursive: true });
  }

  // Read existing settings or create empty
  let settings: Record<string, any> = {};
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    } catch {
      settings = {};
    }
  }

  let modified = false;

  // Ensure permissions.allow contains all MCP tools
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

  // Ensure orchestrator hooks
  if (!settings.hooks) {
    settings.hooks = {};
  }
  const orchestratorHooks = buildOrchestratorHooks(workspace);
  for (const [hookType, hookConfigs] of Object.entries(orchestratorHooks)) {
    if (!settings.hooks[hookType]) {
      settings.hooks[hookType] = hookConfigs;
      modified = true;
    } else {
      // Check if orchestrator hooks are already present
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

export const initProjectTool: Tool = {
  name: "init_project",
  description:
    "Initializes a new project with the Iterative Convergence methodology. " +
    "Creates state.json in .versus/ and starts at Phase 0. " +
    "If a project already exists, returns an error — use get_phase_state to check.",
  inputSchema: {
    type: "object" as const,
    properties: {
      name: {
        type: "string",
        description: "Project name.",
      },
      description: {
        type: "string",
        description: "Brief project description.",
      },
    },
    required: ["name", "description"],
  },
};

export function handleInitProject(
  engine: StateEngine,
  args: { name: string; description: string }
): string {
  const existing = engine.getPhaseState();
  if (existing) {
    return JSON.stringify({
      success: false,
      error: `Project '${existing.projectName}' already exists (Phase ${existing.currentPhase}). Use get_phase_state to query.`,
    });
  }

  const state = engine.initProject(args.name, args.description);

  const workspace = engine.getWorkspace();

  // Copy bundles to .versus/ of the project
  const bundlesDeployed = deployBundles(workspace);

  // Create specs/ and subfolders if they don't exist
  const specsDir = path.join(workspace, "specs");
  let specsCreated = false;
  if (!fs.existsSync(specsDir)) {
    for (const sub of SPECS_SUBDIRS) {
      fs.mkdirSync(path.join(specsDir, sub), { recursive: true });
    }
    specsCreated = true;
  }

  // Ensure .mcp.json pointing to LOCAL server.js
  const mcpCreated = ensureMcpJson(workspace);

  // Ensure settings.json with permissions and hooks
  const settingsUpdated = ensureSettings(workspace);

  const settingsPath = path.join(workspace, ".claude", "settings.json");

  return JSON.stringify({
    success: true,
    projectName: state.projectName,
    currentPhase: state.currentPhase,
    workspace,
    bundlesDeployed,
    specsCreated,
    mcpCreated,
    settingsUpdated,
    message:
      `NEW PROJECT '${args.name}' initialized in ${workspace}. ` +
      `This is an INDEPENDENT and AUTONOMOUS project — DO NOT fetch specs, decisions, or code from other projects. ` +
      `Structure created: state.json, server.js + 3 hooks (in .versus/), specs/ (9 subfolders), .mcp.json, settings.json. ` +
      `Everything local — no external dependencies. ` +
      `MANDATORY ACTION: Read ${settingsPath} with the Read tool to load permissions and hooks. ` +
      `Then call get_phase_guidance() for Phase 0 instructions.`,
  });
}
