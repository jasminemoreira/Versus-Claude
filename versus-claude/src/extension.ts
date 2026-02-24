// Extension Core — lifecycle, component registration
// No files are created automatically; everything depends on explicit user action.

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { SidebarProvider } from "./views/sidebar";

let sidebarProvider: SidebarProvider | undefined;
let outputChannel: vscode.OutputChannel;

function log(msg: string) {
  outputChannel?.appendLine(`[Versus] ${new Date().toISOString()} ${msg}`);
}

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel("Versus for Claude");
  context.subscriptions.push(outputChannel);
  log("Activating extension...");

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    log("No workspace open — activation aborted.");
    return;
  }

  const workspacePath = workspaceFolders[0].uri.fsPath;
  const extensionPath = context.extensionPath;
  log(`Workspace: ${workspacePath}`);

  try {
    // Register TreeView sidebar (read-only — does not create files)
    sidebarProvider = new SidebarProvider(workspacePath);
    const treeView = vscode.window.createTreeView("versus-claude.phaseView", {
      treeDataProvider: sidebarProvider,
      showCollapseAll: true,
    });
    context.subscriptions.push(treeView);
    log("TreeView registered.");

    // Command: manual refresh
    context.subscriptions.push(
      vscode.commands.registerCommand("versus-claude.refreshView", () => {
        sidebarProvider?.refresh();
      })
    );
    log("Command refreshView registered.");

    // Command: initialize project (only way to create files in the workspace)
    context.subscriptions.push(
      vscode.commands.registerCommand("versus-claude.initProject", async () => {
        const name = await vscode.window.showInputBox({
          prompt: "Project name",
          placeHolder: "my-project",
        });
        if (!name) return;

        const description = await vscode.window.showInputBox({
          prompt: "Brief description",
          placeHolder: "Project description...",
        });
        if (!description) return;

        try {
          const { StateEngine } = await import("./state/engine");
          const engine = new StateEngine(workspacePath);
          const existing = engine.getPhaseState();
          if (existing) {
            vscode.window.showWarningMessage(
              `Project '${existing.projectName}' already exists (Phase ${existing.currentPhase}).`
            );
            return;
          }

          engine.initProject(name, description);

          // Deploy bundles and configurations (only now, by user action)
          deployServer(extensionPath, workspacePath);
          generateMcpConfig(workspacePath);

          sidebarProvider?.refresh();
          vscode.window.showInformationMessage(
            `Project '${name}' initialized. Phase 0 — Problem Discovery.`
          );
          log("initProject: completed successfully.");
        } catch (err) {
          log(`initProject ERROR: ${String(err)}`);
          vscode.window.showErrorMessage(`Versus: Error initializing project: ${String(err)}`);
        }
      })
    );
    log("Command initProject registered.");

    // If the project was already initialized, update bundles (maintenance)
    const statePath = path.join(workspacePath, ".versus", "state.json");
    if (fs.existsSync(statePath)) {
      deployServer(extensionPath, workspacePath);
      generateMcpConfig(workspacePath);
      log("Existing project detected — bundles and .mcp.json updated.");
    } else {
      log("No Versus project in this workspace — nothing to do on activation.");
    }

    log("Activation completed successfully.");
  } catch (err) {
    log(`ACTIVATION ERROR: ${String(err)}`);
    vscode.window.showErrorMessage(`Versus: Activation error — ${String(err)}`);
  }
}

/**
 * Copies extension bundles to .versus/ in the workspace.
 * Only updates if content has changed (idempotent).
 */
function deployServer(extensionPath: string, workspacePath: string) {
  const bundleDir = path.join(extensionPath, "out", "bundle");
  const targetDir = path.join(workspacePath, ".versus");
  const files = ["inject-context.js", "phase-gate.js", "loop-detector.js", "server.js"];

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  for (const file of files) {
    const src = path.join(bundleDir, file);
    const dest = path.join(targetDir, file);
    if (!fs.existsSync(src)) continue;

    const srcContent = fs.readFileSync(src);
    if (fs.existsSync(dest) && srcContent.equals(fs.readFileSync(dest))) continue;

    fs.writeFileSync(dest, srcContent);
  }
}

/**
 * Creates or updates .mcp.json pointing to the project's LOCAL server.js.
 */
function generateMcpConfig(workspacePath: string) {
  const mcpJsonPath = path.join(workspacePath, ".mcp.json");
  const serverPath = path.join(workspacePath, ".versus", "server.js");

  if (!fs.existsSync(serverPath)) return;

  const mcpEntry = {
    type: "stdio",
    command: "node",
    args: [serverPath],
    env: {},
  };

  let mcpJson: Record<string, any> = { mcpServers: {} };
  if (fs.existsSync(mcpJsonPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(mcpJsonPath, "utf-8"));
      if (existing.mcpServers?.["versus-claude"]) {
        // Already registered and args correct — nothing to do
        if (JSON.stringify(existing.mcpServers["versus-claude"].args) === JSON.stringify(mcpEntry.args)) {
          return;
        }
      }
      mcpJson = existing;
      if (!mcpJson.mcpServers) mcpJson.mcpServers = {};
    } catch {
      mcpJson = { mcpServers: {} };
    }
  }

  mcpJson.mcpServers["versus-claude"] = mcpEntry;
  fs.writeFileSync(mcpJsonPath, JSON.stringify(mcpJson, null, 2) + "\n", "utf-8");
}

export function deactivate() {
  sidebarProvider?.dispose();
}
