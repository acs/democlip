#!/usr/bin/env node
// Check the ontology: the graph is well formed, and every [[id]] the Markdown
// refers to resolves to a node in it. Run with `npm run ontology:check`.
//
// The graph is the machine source and the Markdown is the human view; [[id]] is the
// seam between them, and this is what keeps the two in step.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '..', 'docs', 'ontology');

const errors = [];
const warnings = [];

const fail = (message) => errors.push(message);

// ---- the graph ------------------------------------------------------------
let graph;
try {
  graph = JSON.parse(readFileSync(join(dir, 'ontology.jsonld'), 'utf8'));
} catch (error) {
  console.error(`ontology.jsonld is not valid JSON: ${error.message}`);
  process.exit(1);
}

if (!Array.isArray(graph['@graph'])) {
  console.error('ontology.jsonld has no @graph array');
  process.exit(1);
}

const nodes = graph['@graph'];
const byId = new Map();

for (const node of nodes) {
  if (typeof node['@id'] !== 'string' || node['@id'].length === 0) {
    fail(`a node has no @id: ${JSON.stringify(node).slice(0, 80)}`);
    continue;
  }
  if (byId.has(node['@id'])) fail(`duplicate @id: ${node['@id']}`);
  byId.set(node['@id'], node);
  if (typeof node.label !== 'string') fail(`${node['@id']} has no label`);
  if (typeof node.summary !== 'string' && node['@type'] !== 'Rule') {
    fail(`${node['@id']} has no summary`);
  }
}

const resolves = (id) => typeof id === 'string' && byId.has(id);

for (const node of nodes) {
  for (const relation of node.relations ?? []) {
    if (!resolves(relation.target)) fail(`${node['@id']} relates to unknown '${relation.target}'`);
  }
  for (const id of node.realises ?? []) {
    if (!resolves(id)) fail(`${node['@id']} realises unknown '${id}'`);
  }
  if (node['@type'] === 'Rule') {
    // A rule of the codebase is owned by the process, not by a concept, so the owner
    // is optional; a rule of the domain names the concept that enforces it.
    if (node.owner !== undefined && !resolves(node.owner)) {
      fail(`${node['@id']} has an unknown owner '${node.owner}'`);
    }
    if (typeof node.proof !== 'string' || node.proof.length === 0) {
      fail(`${node['@id']} has no proof`);
    }
  }
}

// ---- the references -------------------------------------------------------
const reference = /\[\[([a-z0-9-]+)\]\]/g;
const referenced = new Set();
const pages = readdirSync(dir).filter((name) => name.endsWith('.md'));

for (const page of pages) {
  // Inline code spans are prose — the README explains the convention with a literal
  // [[id]]. Fenced blocks (the mermaid diagrams) are kept, so their references count.
  const text = readFileSync(join(dir, page), 'utf8').replace(/`[^`\n]*`/g, '');
  for (const match of text.matchAll(reference)) {
    referenced.add(match[1]);
    if (!byId.has(match[1])) fail(`${page} refers to [[${match[1]}]], which is not a node`);
  }
}

for (const id of byId.keys()) {
  if (!referenced.has(id)) warnings.push(`${id} is in the graph but not referred to by any page`);
}

// ---- report ---------------------------------------------------------------
const counts = nodes.reduce((tally, node) => {
  const type = node['@type'];
  tally[type] = (tally[type] ?? 0) + 1;
  return tally;
}, {});

console.log(`ontology: ${nodes.length} nodes (${Object.entries(counts).map(([t, n]) => `${n} ${t}`).join(', ')})`);
console.log(`references: ${referenced.size} distinct ids across ${pages.length} pages`);

if (warnings.length > 0) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const warning of warnings) console.log(`  - ${warning}`);
}

if (errors.length > 0) {
  console.error(`\n${errors.length} error(s):`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log('\nok');
