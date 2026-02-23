// MCP Tools: inicialização de projeto

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
 * Resolve o diretório dos bundles.
 * Se rodando do bundle (out/bundle/server.js) → bundles estão no mesmo dir (__dirname).
 * Se rodando do source (out/mcp/tools/project-tools.js) → bundles em out/bundle/.
 */
function getBundleDir(): string {
  if (fs.existsSync(path.join(__dirname, "inject-context.js"))) {
    return __dirname;
  }
  return path.resolve(__dirname, "..", "..", "bundle");
}

/**
 * Copia os 4 bundles para .versus/ no projeto.
 * Retorna true se algum arquivo foi criado/atualizado.
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
      continue; // bundle não encontrado, pular
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
 * Gera hooks config usando caminhos LOCAIS do projeto (.versus/).
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
              "ANTES da compactacao: chame get_phase_state() e salve o resultado em MEMORY.md (no seu diretorio de auto memory). Inclua: fase atual, iteracao, decisoes-chave, proximos passos.",
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
              "OBRIGATORIO: chame get_phase_state() do MCP server versus-claude para saber a fase atual da metodologia Convergencia Iterativa. Em seguida chame get_phase_guidance() para obter as instrucoes detalhadas da fase atual. Se retornar erro de projeto nao inicializado, pergunte ao usuario se deseja iniciar um novo projeto com init_project(). Toda decisao importante deve ser registrada com record_decision(). Antes de avancar de fase, use get_exit_criteria() e advance_phase().",
          },
        ],
      },
      {
        matcher: "compact",
        hooks: [
          {
            type: "prompt",
            prompt:
              "CONTEXTO RESTAURADO. OBRIGATORIO: chame get_phase_state() e get_phase_guidance() para recuperar estado e instrucoes da metodologia. Consulte get_decisions() para decisoes anteriores. Leia MEMORY.md (auto memory) para contexto adicional. Continue de onde parou.",
          },
        ],
      },
    ],
  };
}

/**
 * Cria ou atualiza .mcp.json no workspace para registrar o MCP server LOCAL.
 * O server.js está em .versus/server.js do próprio projeto.
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

  // Verificar se já está correto
  const existing = mcpJson.mcpServers["versus-claude"];
  if (existing && JSON.stringify(existing.args) === JSON.stringify(expectedConfig.args)) {
    return false;
  }

  mcpJson.mcpServers["versus-claude"] = expectedConfig;
  fs.writeFileSync(mcpPath, JSON.stringify(mcpJson, null, 2) + "\n", "utf-8");
  return true;
}

/**
 * Garante que settings.json tenha as permissões MCP e hooks do orquestrador.
 * Preserva permissões e hooks existentes do usuário.
 */
function ensureSettings(workspace: string): boolean {
  const settingsPath = path.join(workspace, ".claude", "settings.json");
  const settingsDir = path.dirname(settingsPath);

  if (!fs.existsSync(settingsDir)) {
    fs.mkdirSync(settingsDir, { recursive: true });
  }

  // Ler settings existente ou criar vazio
  let settings: Record<string, any> = {};
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    } catch {
      settings = {};
    }
  }

  let modified = false;

  // Garantir permissions.allow contém todas as tools MCP
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

  // Garantir hooks do orquestrador
  if (!settings.hooks) {
    settings.hooks = {};
  }
  const orchestratorHooks = buildOrchestratorHooks(workspace);
  for (const [hookType, hookConfigs] of Object.entries(orchestratorHooks)) {
    if (!settings.hooks[hookType]) {
      settings.hooks[hookType] = hookConfigs;
      modified = true;
    } else {
      // Verificar se os hooks do orquestrador já estão presentes
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
    "Inicializa um novo projeto com a metodologia Convergência Iterativa. " +
    "Cria state.json em .versus/ e começa na Phase 0. " +
    "Se já existe um projeto, retorna erro — use get_phase_state para verificar.",
  inputSchema: {
    type: "object" as const,
    properties: {
      name: {
        type: "string",
        description: "Nome do projeto.",
      },
      description: {
        type: "string",
        description: "Descrição breve do projeto.",
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
      error: `Projeto '${existing.projectName}' já existe (Phase ${existing.currentPhase}). Use get_phase_state para consultar.`,
    });
  }

  const state = engine.initProject(args.name, args.description);

  const workspace = engine.getWorkspace();

  // Copiar bundles para .versus/ do projeto
  const bundlesDeployed = deployBundles(workspace);

  // Criar specs/ e subpastas se não existem
  const specsDir = path.join(workspace, "specs");
  let specsCreated = false;
  if (!fs.existsSync(specsDir)) {
    for (const sub of SPECS_SUBDIRS) {
      fs.mkdirSync(path.join(specsDir, sub), { recursive: true });
    }
    specsCreated = true;
  }

  // Garantir .mcp.json apontando para server.js LOCAL
  const mcpCreated = ensureMcpJson(workspace);

  // Garantir settings.json com permissões e hooks
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
      `PROJETO NOVO '${args.name}' inicializado em ${workspace}. ` +
      `Este é um projeto INDEPENDENTE e AUTÔNOMO — NÃO busque specs, decisões ou código de outros projetos. ` +
      `Estrutura criada: state.json, server.js + 3 hooks (em .versus/), specs/ (9 subpastas), .mcp.json, settings.json. ` +
      `Tudo local — nenhuma dependência externa. ` +
      `AÇÃO OBRIGATÓRIA: Leia ${settingsPath} com a ferramenta Read para carregar permissões e hooks. ` +
      `Em seguida chame get_phase_guidance() para instruções da Phase 0.`,
  });
}
