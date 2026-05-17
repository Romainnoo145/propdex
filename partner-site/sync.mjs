#!/usr/bin/env node
// Sync script — kopieert .planning/PARTNER-BRIEFING-*.md en .planning/ANGEL-ONEPAGER-*.md
// naar partner-site/content/ zodat de Vercel-build self-contained is.
//
// Run vóór commit: `npm run sync` (vanuit partner-site/)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const PLANNING = path.join(REPO_ROOT, '.planning');
const CONTENT = path.join(__dirname, 'content');

const FILES = [
  'PARTNER-BRIEFING-2026-05-13.md',
  'ANGEL-ONEPAGER-2026-05-13.md',
];

fs.mkdirSync(CONTENT, { recursive: true });

let changed = 0;
for (const file of FILES) {
  const src = path.join(PLANNING, file);
  const dst = path.join(CONTENT, file);
  if (!fs.existsSync(src)) {
    console.error(`✗ source missing: ${src}`);
    process.exit(1);
  }
  const srcContent = fs.readFileSync(src, 'utf8');
  const dstContent = fs.existsSync(dst) ? fs.readFileSync(dst, 'utf8') : '';
  if (srcContent !== dstContent) {
    fs.writeFileSync(dst, srcContent, 'utf8');
    console.log(`✓ synced  ${file}`);
    changed++;
  } else {
    console.log(`= unchanged  ${file}`);
  }
}

console.log(`\n${changed > 0 ? `Synced ${changed} file(s). Don't forget to git add content/ + commit.` : 'No changes needed.'}`);
