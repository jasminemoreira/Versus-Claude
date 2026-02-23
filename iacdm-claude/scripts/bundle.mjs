#!/usr/bin/env node

// Bundla os 4 entry points em arquivos standalone (sem dependências externas)
// Resultado: out/bundle/ com 4 arquivos self-contained

import { build } from "esbuild";
import { rmSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outDir = resolve(root, "out", "bundle");

// Limpar e recriar
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const entryPoints = [
  { in: resolve(root, "src", "hooks", "inject-context.ts"), out: "inject-context" },
  { in: resolve(root, "src", "hooks", "phase-gate.ts"), out: "phase-gate" },
  { in: resolve(root, "src", "hooks", "loop-detector.ts"), out: "loop-detector" },
  { in: resolve(root, "src", "mcp", "server.ts"), out: "server" },
];

try {
  await build({
    entryPoints: entryPoints.map((e) => ({ in: e.in, out: e.out })),
    bundle: true,
    platform: "node",
    target: "node18",
    format: "cjs",
    outdir: outDir,
    minify: false,        // legível para debug
    sourcemap: false,
    external: [],          // tudo inline, sem dependências externas
  });

  console.log("Bundle concluído em out/bundle/:");
  for (const e of entryPoints) {
    console.log(`  ${e.out}.js`);
  }
} catch (err) {
  console.error("Erro no bundle:", err);
  process.exit(1);
}
