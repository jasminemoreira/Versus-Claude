// TreeView Sidebar — read-only view of the methodology state

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

  /** Polling: checks every 3s if state.json changed (creation, removal, or content) */
  private setupPolling(): void {
    this.pollTimer = setInterval(() => {
      const statePath = path.join(this.workspacePath, ".versus", "state.json");
      try {
        const stat = fs.statSync(statePath);
        const mtime = stat.mtimeMs;
        if (mtime !== this.lastMtime) {
          // File created or modified since last check
          this.lastMtime = mtime;
          this.refresh();
        }
      } catch {
        // File does not exist
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
      return [new StateItem("No project initialized", "", "info")];
    }

    if (!element) {
      return this.getRootItems();
    }

    return element.children || [];
  }

  private getRootItems(): StateItem[] {
    if (!this.state) return [];

    const items: StateItem[] = [];

    // Project
    items.push(new StateItem(
      this.state.projectName,
      this.state.projectDescription,
      "project"
    ));

    // Current phase
    const phaseName = PHASE_NAMES[this.state.currentPhase] ?? "Unknown";
    const phaseItem = new StateItem(
      `Phase ${this.state.currentPhase} — ${phaseName}`,
      `Iteration ${this.state.currentIteration}`,
      "phase"
    );
    items.push(phaseItem);

    // Score (se Phase 0)
    if (this.state.phase0Score !== null) {
      const scoreIcon = this.state.phase0Score >= 90 ? "pass" : "warning";
      items.push(new StateItem(
        `Score Phase 0: ${this.state.phase0Score}/100`,
        this.state.phase0Score >= 90 ? "Threshold reached" : "Below threshold (90)",
        scoreIcon
      ));
    }

    // HLI (Human Lead Index)
    if (this.state.hli && this.state.hli.phaseScores.length > 0) {
      const hli = this.state.hli;
      const latestAlert = hli.alerts.length > 0
        ? hli.alerts[hli.alerts.length - 1]
        : null;
      const hasActiveAlert = latestAlert !== null &&
        (latestAlert.toPhase === this.state.currentPhase - 1 || latestAlert.toPhase === this.state.currentPhase);

      const hliIcon = hasActiveAlert ? "hli-alert"
        : hli.composite >= 7.0 ? "hli-good"
        : hli.composite >= 4.0 ? "hli-warning"
        : "hli-poor";

      const phaseChildren = hli.phaseScores.map((ps) => {
        const pName = PHASE_NAMES[ps.phase] ?? "Unknown";
        const scaled = Math.round(ps.score * 100) / 10;
        const isAlerted = hli.alerts.some((a) => a.toPhase === ps.phase);

        const components: StateItem[] = [
          new StateItem(`Criteria: ${Math.round(ps.criteriaRatio * 100)}%`, "", "info"),
          new StateItem(`Decisions: ${Math.round(ps.decisionDensity * 100)}%`, "", "info"),
          new StateItem(`${ps.phaseSpecificLabel}: ${Math.round(ps.phaseSpecific * 100)}%`, "", "info"),
        ];

        return new StateItem(
          `P${ps.phase} ${pName}: ${scaled.toFixed(1)}`,
          isAlerted ? "DROP" : "",
          isAlerted ? "warning" : "decision",
          components
        );
      });

      items.push(new StateItem(
        `HLI: ${hli.composite.toFixed(1)}/10`,
        hasActiveAlert ? "Score drop detected" : `${hli.phaseScores.length} phases evaluated`,
        hliIcon,
        phaseChildren
      ));
    }

    // Decisions
    const decisionsItem = new StateItem(
      `Decisions: ${this.state.decisions.length}`,
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

    // Safeguards
    const violated = this.state.safeguards.filter((s) => s.status === "violated");
    const warnings = this.state.safeguards.filter((s) => s.status === "warning");
    const sgIcon = violated.length > 0 ? "error" : warnings.length > 0 ? "warning" : "pass";
    const sgItem = new StateItem(
      `Safeguards`,
      `${violated.length} violated, ${warnings.length} warnings`,
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

    // Last updated
    const updated = new Date(this.state.updatedAt);
    items.push(new StateItem(
      `Updated: ${updated.toLocaleString("en-US")}`,
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
      case "hli-good": return new vscode.ThemeIcon("dashboard", new vscode.ThemeColor("testing.iconPassed"));
      case "hli-warning": return new vscode.ThemeIcon("dashboard", new vscode.ThemeColor("testing.iconQueued"));
      case "hli-poor": return new vscode.ThemeIcon("dashboard", new vscode.ThemeColor("testing.iconFailed"));
      case "hli-alert": return new vscode.ThemeIcon("bell-dot", new vscode.ThemeColor("testing.iconFailed"));
      default: return new vscode.ThemeIcon("circle-outline");
    }
  }
}
