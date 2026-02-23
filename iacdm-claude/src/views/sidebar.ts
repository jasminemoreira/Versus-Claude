// TreeView Sidebar — visualização read-only do estado da metodologia

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { PhaseState } from "../state/types";

const PHASE_NAMES: Record<number, string> = {
  0: "Problem Discovery",
  1: "Architecture",
  2: "Adversarial Critique",
  3: "Simplification",
  4: "Convergence Gate",
  5: "Code Implementation",
  6: "Tests",
  7: "Post-Review",
};

export class SidebarProvider implements vscode.TreeDataProvider<StateItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<StateItem | undefined | null>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private state: PhaseState | null = null;
  private watcher: vscode.FileSystemWatcher | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastMtime: number = 0;

  constructor(private workspacePath: string) {
    this.loadState();
    this.setupWatcher();
    this.setupPolling();
  }

  refresh(): void {
    this.loadState();
    this._onDidChangeTreeData.fire(null);
  }

  dispose(): void {
    this.watcher?.dispose();
    if (this.pollTimer) clearInterval(this.pollTimer);
    this._onDidChangeTreeData.dispose();
  }

  private loadState(): void {
    const statePath = path.join(this.workspacePath, ".versus", "state.json");
    try {
      if (fs.existsSync(statePath)) {
        const raw = fs.readFileSync(statePath, "utf-8");
        this.state = JSON.parse(raw) as PhaseState;
      } else {
        this.state = null;
      }
    } catch {
      this.state = null;
    }
  }

  private setupWatcher(): void {
    const pattern = new vscode.RelativePattern(
      this.workspacePath,
      ".versus/state.json"
    );
    this.watcher = vscode.workspace.createFileSystemWatcher(pattern);
    this.watcher.onDidChange(() => this.refresh());
    this.watcher.onDidCreate(() => this.refresh());
    this.watcher.onDidDelete(() => this.refresh());
  }

  /** Polling: verifica a cada 3s se state.json mudou (criação, remoção ou conteúdo) */
  private setupPolling(): void {
    this.pollTimer = setInterval(() => {
      const statePath = path.join(this.workspacePath, ".versus", "state.json");
      try {
        const stat = fs.statSync(statePath);
        const mtime = stat.mtimeMs;
        if (mtime !== this.lastMtime) {
          // Arquivo criado ou modificado desde última verificação
          this.lastMtime = mtime;
          this.refresh();
        }
      } catch {
        // Arquivo não existe
        if (this.state) {
          this.lastMtime = 0;
          this.refresh();
        }
      }
    }, 3000);
  }

  getTreeItem(element: StateItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: StateItem): StateItem[] {
    if (!this.state) {
      return [new StateItem("Nenhum projeto inicializado", "", "info")];
    }

    if (!element) {
      return this.getRootItems();
    }

    return element.children || [];
  }

  private getRootItems(): StateItem[] {
    if (!this.state) return [];

    const items: StateItem[] = [];

    // Projeto
    items.push(new StateItem(
      this.state.projectName,
      this.state.projectDescription,
      "project"
    ));

    // Fase atual
    const phaseName = PHASE_NAMES[this.state.currentPhase] ?? "Desconhecida";
    const phaseItem = new StateItem(
      `Phase ${this.state.currentPhase} — ${phaseName}`,
      `Iteração ${this.state.currentIteration}`,
      "phase"
    );
    items.push(phaseItem);

    // Score (se Phase 0)
    if (this.state.phase0Score !== null) {
      const scoreIcon = this.state.phase0Score >= 90 ? "pass" : "warning";
      items.push(new StateItem(
        `Score Phase 0: ${this.state.phase0Score}/100`,
        this.state.phase0Score >= 90 ? "Limiar atingido" : "Abaixo do limiar (90)",
        scoreIcon
      ));
    }

    // Decisões
    const decisionsItem = new StateItem(
      `Decisões: ${this.state.decisions.length}`,
      "",
      "decisions",
      this.state.decisions.slice(-5).map(
        (d) => new StateItem(
          `[P${d.phase}] ${d.category}`,
          d.content.length > 80 ? d.content.substring(0, 80) + "..." : d.content,
          "decision"
        )
      )
    );
    items.push(decisionsItem);

    // Salvaguardas
    const violated = this.state.safeguards.filter((s) => s.status === "violated");
    const warnings = this.state.safeguards.filter((s) => s.status === "warning");
    const sgIcon = violated.length > 0 ? "error" : warnings.length > 0 ? "warning" : "pass";
    const sgItem = new StateItem(
      `Salvaguardas`,
      `${violated.length} violadas, ${warnings.length} alertas`,
      sgIcon,
      this.state.safeguards.map(
        (s) => new StateItem(
          `${s.id}: ${s.status}`,
          s.details || "",
          s.status === "violated" ? "error" : s.status === "warning" ? "warning" : "pass"
        )
      )
    );
    items.push(sgItem);

    // Última atualização
    const updated = new Date(this.state.updatedAt);
    items.push(new StateItem(
      `Atualizado: ${updated.toLocaleString("pt-BR")}`,
      "",
      "info"
    ));

    return items;
  }
}

class StateItem extends vscode.TreeItem {
  children?: StateItem[];

  constructor(
    label: string,
    description: string,
    iconType: string,
    children?: StateItem[]
  ) {
    super(
      label,
      children && children.length > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );
    this.description = description;
    this.children = children;
    this.iconPath = StateItem.getIcon(iconType);
    this.tooltip = description || label;
  }

  private static getIcon(type: string): vscode.ThemeIcon {
    switch (type) {
      case "project": return new vscode.ThemeIcon("folder");
      case "phase": return new vscode.ThemeIcon("layers");
      case "pass": return new vscode.ThemeIcon("check", new vscode.ThemeColor("testing.iconPassed"));
      case "warning": return new vscode.ThemeIcon("warning", new vscode.ThemeColor("testing.iconQueued"));
      case "error": return new vscode.ThemeIcon("error", new vscode.ThemeColor("testing.iconFailed"));
      case "decisions": return new vscode.ThemeIcon("checklist");
      case "decision": return new vscode.ThemeIcon("arrow-right");
      case "info": return new vscode.ThemeIcon("info");
      default: return new vscode.ThemeIcon("circle-outline");
    }
  }
}
