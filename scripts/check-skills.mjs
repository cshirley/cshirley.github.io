#!/usr/bin/env node
/**
 * Validate the agent skills in .agents/skills/ and the guidance in AGENTS.md, so they don't
 * drift from the repository.
 *
 *   npm run check:skills
 *
 * Checks each SKILL.md against the Agent Skills spec (https://agentskills.io/specification):
 * frontmatter present, `name` matches the directory (lowercase, hyphens, max 64 characters),
 * `description` present (max 1024 characters), only known fields. Also checks that every repo
 * path in backticks (`docs/…`, `src/…`, `scripts/…`, `.agents/…`) exists, and that every
 * `npm run <script>` is defined in package.json.
 */
import { existsSync, readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { annotate, root } from './lib/dist.mjs';

const skillsDir = path.join(root, '.agents/skills');
const FIELDS = new Set(['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools', 'disable-model-invocation']);
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const scripts = new Set(Object.keys(JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).scripts));
// Paths that are generated, ignored or user-specific, so may not exist in a fresh checkout.
const GENERATED = /^(dist|dist-drafts|medium-export|public\/medium|\.astro|node_modules)(\/|$)/;

const errors = new Set();
const err = (file, msg) => errors.add(`${path.relative(root, file)}: ${msg}`);

function checkReferences(file, text) {
  // Fenced code blocks hold example commands; check their npm scripts but not their paths.
  for (const [, name] of text.matchAll(/npm run ([a-z][\w:-]*)/g)) {
    if (!scripts.has(name)) err(file, `npm script "${name}" is not defined in package.json`);
  }
  const prose = text.replace(/```[\s\S]*?```/g, '');
  for (const [, ref] of prose.matchAll(/`((?:\.agents|\.github|docs|scripts|src|public)\/[^`\s]*)`/g)) {
    const clean = ref.replace(/[)`.,:;]+$/, '');
    if (/[<>*…]|YYYY/.test(clean) || GENERATED.test(clean)) continue; // placeholders and patterns
    if (!existsSync(path.join(root, clean))) err(file, `referenced path does not exist: ${clean}`);
  }
  for (const [, ref] of prose.matchAll(/`([\w.-]+\.(?:md|ts|mjs|json|ya?ml|txt))`/g)) {
    if (ref.includes('/') || ['SKILL.md', 'index.json', 'package.json'].includes(ref)) continue;
    if (!existsSync(path.join(root, ref)) && !existsSync(path.join(path.dirname(file), ref))) {
      err(file, `referenced file does not exist: ${ref}`);
    }
  }
}

const dirs = (await readdir(skillsDir, { withFileTypes: true })).filter((d) => d.isDirectory());
const names = [];
for (const dir of dirs) {
  const file = path.join(skillsDir, dir.name, 'SKILL.md');
  if (!existsSync(file)) {
    err(file, 'missing SKILL.md');
    continue;
  }
  const text = readFileSync(file, 'utf8');
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) {
    err(file, 'missing YAML frontmatter');
    continue;
  }
  let fm;
  try {
    fm = parseYaml(m[1]) ?? {};
  } catch (e) {
    err(file, `invalid frontmatter YAML: ${e.message}`);
    continue;
  }
  for (const key of Object.keys(fm)) if (!FIELDS.has(key)) err(file, `unknown frontmatter field "${key}"`);
  if (typeof fm.name !== 'string' || !NAME.test(fm.name) || fm.name.length > 64) {
    err(file, `name must be lowercase letters, numbers and single hyphens, max 64 chars (got "${fm.name}")`);
  } else if (fm.name !== dir.name) {
    err(file, `name "${fm.name}" must match its directory "${dir.name}"`);
  }
  if (typeof fm.description !== 'string' || !fm.description.trim()) err(file, 'description is required');
  else if (fm.description.length > 1024) err(file, `description is ${fm.description.length} chars (max 1024)`);
  checkReferences(file, text.slice(m[0].length));
  names.push(dir.name);
}

// AGENTS.md must list every skill, and its references must exist.
const agentsFile = path.join(root, 'AGENTS.md');
if (existsSync(agentsFile)) {
  const agents = readFileSync(agentsFile, 'utf8');
  for (const n of names) {
    if (!agents.includes(`.agents/skills/${n}/SKILL.md`)) err(agentsFile, `skill "${n}" is not listed`);
  }
  checkReferences(agentsFile, agents);
}

if (errors.size) {
  for (const e of errors) annotate('error', e);
  console.error(`\n${errors.size} skill problem(s).`);
  process.exit(1);
}
console.log(`Skills OK: ${names.length} skills valid, references in skills and AGENTS.md resolve.`);
