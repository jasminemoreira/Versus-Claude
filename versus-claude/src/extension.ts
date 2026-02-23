// Extension Core — lifecycle, registro de componentes
// Nenhum arquivo é criado automaticamente; tudo depende de ação explícita do usuário.

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
  log("Ativando extensão...");

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    log("Nenhum workspace aberto — ativação abortada.");
    return;
  }

  const workspacePath = workspaceFolders[0].uri.fsPath;
  const extensionPath = context.extensionPath;
  log(`Workspace: ${workspacePath}`);

  try {
    // Registrar TreeView sidebar (somente leitura — não cria arquivos)
    sidebarProvider = new SidebarProvider(workspacePath);
    const treeView = vscode.window.createTreeView("versus-claude.phaseView", {
      treeDataProvider: sidebarProvider,
      showCollapseAll: true,
    });
    context.subscriptions.push(treeView);
    log("TreeView registrada.");

    // Comando: refresh manual
    context.subscriptions.push(
      vscode.commands.registerCommand("versus-claude.refreshView", () => {
        sidebarProvider?.refresh();
      })
    );
    log("Comando refreshView registrado.");

    // Comando: inicializar projeto (única forma de criar arquivos no workspace)
    context.subscriptions.push(
      vscode.commands.registerCommand("versus-claude.initProject", async () => {
        const name = await vscode.window.showInputBox({
          prompt: "Nome do projeto",
          placeHolder: "meu-projeto",
        });
        if (!name) return;

        const description = await vscode.window.showInputBox({
          prompt: "Descrição breve",
          placeHolder: "Descrição do projeto...",
        });
        if (!description) return;

        try {
          const { StateEngine } = await import("./state/engine");
          const engine = new StateEngine(workspacePath);
          const existing = engine.getPhaseState();
          if (existing) {
            vscode.window.showWarningMessage(
              `Projeto '${existing.projectName}' já existe (Phase ${existing.currentPhase}).`
            );
            return;
          }

          engine.initProject(name, description);

          // Deploy bundles e configurações (somente agora, por ação do usuário)
          deployServer(extensionPath, workspacePath);
          generateMcpConfig(workspacePath);

          sidebarProvider?.refresh();
          vscode.window.showInformationMessage(
            `Projeto '${name}' inicializado. Phase 0 — Problem Discovery.`
          );
          log("initProject: concluído com sucesso.");
        } catch (err) {
          log(`initProject ERRO: ${String(err)}`);
          vscode.window.showErrorMessage(`Versus: Erro ao inicializar projeto: ${String(err)}`);
        }
      })
    );
    log("Comando initProject registrado.");

    // Se o projeto já foi inicializado antes, atualizar bundles (manutenção)
    const statePath = path.join(workspacePath, ".versus", "state.json");
    if (fs.existsSync(statePath)) {
      deployServer(extensionPath, workspacePath);
      generateMcpConfig(workspacePath);
      log("Projeto existente detectado — bundles e .mcp.json atualizados.");
    } else {
      log("Nenhum projeto Versus neste workspace — nada a fazer na ativação.");
    }

    log("Ativação concluída com sucesso.");
  } catch (err) {
    log(`ERRO NA ATIVAÇÃO: ${String(err)}`);
    vscode.window.showErrorMessage(`Versus: Erro na ativação — ${String(err)}`);
  }
}

/**
 * Copia os bundles da extensão para .versus/ do workspace.
 * Só atualiza se o conteúdo mudou (idempotente).
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
 * Cria ou atualiza .mcp.json apontando para o server.js LOCAL do projeto.
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
        // Já registrado e args corretos — nada a fazer
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
