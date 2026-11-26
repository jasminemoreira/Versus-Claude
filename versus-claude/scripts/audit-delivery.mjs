#!/usr/bin/env node
// Delivery audit: what each Versus channel EMITTED vs what REACHED the model, read from a
// project's Claude Code transcripts (~/.claude/projects/<encoded path>/*.jsonl).
//
// Why this exists: for months, the per-message guidance arrived as a 2,000-char preview
// (10,000-char hook cap), the SessionStart/PreCompact hooks never ran (prompt-type is
// unsupported there), and three warnings used a JSON shape nobody reads. All of it was
// silent. The unit tests checked the emitter, not the receiver. Run this on a real
// project after every Claude Code update and before every Versus release.
//
// Evidence rule: what reached the model is the attachment's `content` (and the
// tool_result text), NEVER the hook's `stdout`.
//
// Usage: node scripts/audit-delivery.mjs <project-path> [--since YYYY-MM-DD]

import fs from "fs";
import os from "os";
import path from "path";

const args = process.argv.slice(2);
const project = path.resolve(args.find((a) => !a.startsWith("--")) ?? process.cwd());
const sinceIdx = args.indexOf("--since");
const since = sinceIdx >= 0 ? args[sinceIdx + 1] : "";

const dir = path.join(os.homedir(), ".claude", "projects", project.replace(/[^A-Za-z0-9]/g, "-"));
if (!fs.existsSync(dir)) {
  console.error(`No transcripts for ${project} (looked in ${dir}).`);
  process.exit(1);
}

const hooks = new Map();      // key "Event · script" → stats
const mcp = new Map();        // tool name → stats
const gates = new Map();      // refusal prefix → count
const sessions = [];
const versions = new Set();

const hookKey = (a) => {
  const script = /([\w-]+)\.js/.exec(a.command ?? "")?.[1] ?? (a.hookName ?? "?");
  return `${a.hookEvent ?? "?"} · ${script}`;
};
const stat = (m, k) => {
  if (!m.has(k)) m.set(k, { runs: 0, inline: 0, preview: 0, lost: 0, silent: 0, errors: 0, maxEmitted: 0, maxDelivered: 0, errorText: "" });
  return m.get(k);
};
const textOf = (c) =>
  typeof c === "string" ? c : Array.isArray(c) ? c.map((x) => (typeof x === "string" ? x : x?.text ?? "")).join("\n") : "";

for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".jsonl"))) {
  const s = { file: f, first: "", guidanceCalls: 0, banner: false, injections: 0 };
  const toolNames = new Map();
  for (const line of fs.readFileSync(path.join(dir, f), "utf-8").split("\n")) {
    if (!line.trim()) continue;
    let o;
    try { o = JSON.parse(line); } catch { continue; }
    if (o.timestamp && since && o.timestamp.slice(0, 10) < since) continue;
    if (o.timestamp && !s.first) s.first = o.timestamp;
    if (o.version) versions.add(o.version);

    if (o.type === "attachment") {
      const a = o.attachment ?? {};
      if (!a.hookEvent) continue;
      const st = stat(hooks, hookKey(a));
      st.runs++;
      const emitted = (a.stdout ?? "").length;
      const content = typeof a.content === "string" ? a.content : "";
      st.maxEmitted = Math.max(st.maxEmitted, emitted);
      if (a.type === "hook_non_blocking_error" || (typeof a.exitCode === "number" && a.exitCode !== 0 && a.exitCode !== 2)) {
        st.errors++;
        st.errorText ||= (a.stderr ?? "").split("\n")[0].slice(0, 160);
      } else if (content.includes("persisted-output") || content.includes("Output too large")) {
        st.preview++;
      } else if (emitted > 0 && content.length === 0) {
        st.lost++;          // emitted something, nothing reached the model
      } else if (emitted === 0) {
        st.silent++;        // nothing to say (normal for most gates)
      } else {
        st.inline++;
        st.maxDelivered = Math.max(st.maxDelivered, content.length);
      }
      if (a.hookEvent === "UserPromptSubmit") s.injections++;
      continue;
    }

    const content = o.message?.content;
    if (!Array.isArray(content)) continue;
    for (const c of content) {
      if (c?.type === "tool_use") {
        toolNames.set(c.id, c.name);
        if (String(c.name).endsWith("get_phase_guidance")) s.guidanceCalls++;
      } else if (c?.type === "tool_result") {
        const name = toolNames.get(c.tool_use_id) ?? "";
        const t = textOf(c.content);
        if (name.startsWith("mcp__versus")) {
          const st = stat(mcp, name.replace("mcp__versus-claude__", ""));
          st.runs++;
          if (t.includes("persisted-output") || t.includes("Output too large") || t.includes("saved to")) st.preview++;
          else { st.inline++; st.maxDelivered = Math.max(st.maxDelivered, t.length); }
        }
        const m = /\[Versus\] ([A-Za-z][\w -]{2,28})/.exec(t);
        if (m) gates.set(m[1].trim(), (gates.get(m[1].trim()) ?? 0) + 1);
      } else if (c?.type === "text" && o.type === "assistant") {
        if (/📍 Versus (ativo|retomado)/.test(c.text ?? "")) s.banner = true;
      }
    }
  }
  if (s.first) sessions.push(s);
}

const rows = (m) => [...m.entries()].sort((a, b) => b[1].runs - a[1].runs);
console.log(`# Versus delivery audit — ${project}`);
console.log(`\nTranscripts: ${dir}\nSessions: ${sessions.length}${since ? ` (since ${since})` : ""} · Claude Code versions: ${[...versions].sort().join(", ") || "?"}\n`);

console.log("## Hooks (what reached the model)\n");
console.log("| channel | runs | inline | ⚠ preview (over 10K cap) | ⚠ lost (emitted, not delivered) | ⚠ errors | silent | max emitted | max delivered |");
console.log("|---|---|---|---|---|---|---|---|---|");
for (const [k, v] of rows(hooks)) {
  console.log(`| ${k} | ${v.runs} | ${v.inline} | ${v.preview} | ${v.lost} | ${v.errors} | ${v.silent} | ${v.maxEmitted} | ${v.maxDelivered} |`);
}
const errs = rows(hooks).filter(([, v]) => v.errorText);
if (errs.length) {
  console.log("\nErrors:");
  for (const [k, v] of errs) console.log(`- ${k}: ${v.errorText}`);
}

console.log("\n## MCP tools\n");
console.log("| tool | calls | inline | ⚠ persisted | max delivered |");
console.log("|---|---|---|---|---|");
for (const [k, v] of rows(mcp)) console.log(`| ${k} | ${v.runs} | ${v.inline} | ${v.preview} | ${v.maxDelivered} |`);

console.log("\n## Gate / warning texts seen by the model (tool results)\n");
for (const [k, n] of [...gates.entries()].sort((a, b) => b[1] - a[1])) console.log(`- ${n}× "[Versus] ${k}…"`);

console.log("\n## Sessions\n");
console.log("| session | started | injections | get_phase_guidance calls | banner |");
console.log("|---|---|---|---|---|");
for (const s of sessions.sort((a, b) => a.first.localeCompare(b.first))) {
  console.log(`| ${s.file.slice(0, 8)} | ${s.first.slice(0, 16)} | ${s.injections} | ${s.guidanceCalls} | ${s.banner ? "yes" : "⚠ no"} |`);
}

const bad = rows(hooks).some(([, v]) => v.preview || v.lost || v.errors) || rows(mcp).some(([, v]) => v.preview);
console.log(`\n**Verdict:** ${bad ? "⚠ some channel did not deliver — see the ⚠ columns." : "every channel delivered what it emitted."}`);
process.exit(bad ? 2 : 0);
