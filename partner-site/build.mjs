#!/usr/bin/env node
// Build script — renders .planning/*.md → partner-site/public/*.html
// Wordt aangeroepen door `npm run build` (Vercel + lokaal).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Content lives in partner-site/content/ (copied from .planning/ via `npm run sync`)
// This keeps the Vercel build self-contained — no parent-directory access needed.
const PLANNING = path.join(__dirname, 'content');
const PUBLIC = path.join(__dirname, 'public');
const TEMPLATE = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');

marked.setOptions({
  gfm: true,
  breaks: false,
  pedantic: false,
});

// Post-process HTML: wrap tables for horizontal scroll, soften horizontal rules.
function postProcess(html) {
  return html
    .replace(/<table>/g, '<div class="table-wrap"><table>')
    .replace(/<\/table>/g, '</table></div>')
    .replace(/<hr>/g, '<hr style="border:none;border-top:1px solid rgba(14,17,17,0.06);margin:32px 0;" />');
}

function render({ source, output, title, eyebrow, heading, meta, crossLinkText, crossLinkHref, crossLinkLabel }) {
  const src = fs.readFileSync(path.join(PLANNING, source), 'utf8');

  // Strip the original H1 + opening metadata block; we render those via the hero.
  const cleaned = src
    .replace(/^#\s+[^\n]+\n+/, '')
    .replace(/^\*\*Datum:[^\n]+\n+/, '')
    .replace(/^---\n/, '')
    .replace(/^\n+/, '');

  const html = postProcess(marked.parse(cleaned));

  const out = TEMPLATE
    .replaceAll('{{TITLE}}', title)
    .replaceAll('{{EYEBROW}}', eyebrow)
    .replaceAll('{{HEADING}}', heading)
    .replaceAll('{{META}}', meta)
    .replaceAll('{{CONTENT}}', html)
    .replaceAll('{{CROSSLINK_TEXT}}', crossLinkText)
    .replaceAll('{{CROSSLINK_HREF}}', crossLinkHref)
    .replaceAll('{{CROSSLINK_LABEL}}', crossLinkLabel);

  fs.mkdirSync(PUBLIC, { recursive: true });
  fs.writeFileSync(path.join(PUBLIC, output), out, 'utf8');
  console.log(`✓ ${source}  →  public/${output}`);
}

// Partner-pagina is hand-geschreven HTML (public/partner.html) — niet via markdown gerenderd.
// Reden: partner-pagina heeft toggle/accordion-structuur en gespreksvorm-content
// die slecht past bij linear-markdown. Markdown-versie (.planning/PARTNER-BRIEFING-...md)
// is uitgebreid intern document voor advocaat + notaris, niet voor web-publicatie.

// Investor onepager
render({
  source: 'ANGEL-ONEPAGER-2026-05-13.md',
  output: 'invest.html',
  title: 'Propdex BV — Investor Onepager',
  eyebrow: 'Investor Onepager · Mei 2026',
  heading: 'Propdex BV — Investment Opportunity',
  meta: 'Seed-ronde · Vertrouwelijk · NDA op verzoek beschikbaar',
  crossLinkText: 'Partner-briefing voor uitgebreide deal-context:',
  crossLinkHref: 'https://partner.propdex.nl',
  crossLinkLabel: 'Bekijk partner-briefing',
});

// GEEN index.html — Vercel rewrites in vercel.json sturen root direct naar
// partner.html of invest.html op basis van host. Een aanwezige index.html zou
// voorrang krijgen en de rewrites blokkeren.
const indexPath = path.join(PUBLIC, 'index.html');
if (fs.existsSync(indexPath)) {
  fs.unlinkSync(indexPath);
  console.log('✓ removed stale index.html');
}

console.log('\nBuild compleet. Output: partner-site/public/');
