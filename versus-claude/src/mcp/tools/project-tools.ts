// MCP Tools: project initialization

import * as fs from "fs";
import * as path from "path";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { StateEngine } from "../../state/engine";
import { ensureSettings } from "../../setup";

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

const BUNDLE_FILES = ["inject-context.js", "phase-gate.js", "loop-detector.js", "stop-verify.js", "truncation-check.js", "block-destructive.js", "server.js"];

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
      `Structure created: state.json, server.js + 6 hooks (in .versus/), specs/ (9 subfolders), .mcp.json, settings.json. ` +
      `Everything local — no external dependencies. ` +
      `MANDATORY ACTION: Read ${settingsPath} with the Read tool to load permissions and hooks. ` +
      `Then call get_phase_guidance() for Phase 0 instructions. ` +
      `USER TIP: the user can type "retomar Versus" in chat at any time to recover methodology context — treat that phrase as an instruction to call get_phase_state() + get_phase_guidance() + get_decisions().`,
  });
}
