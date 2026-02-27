#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import process from 'node:process'

const rootDir = process.cwd()
const srcDir = join(rootDir, 'src')

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) return listFiles(fullPath)
    return [fullPath]
  }))
  return files.flat()
}

function rel(path) {
  return relative(rootDir, path).replaceAll('\\', '/')
}

async function main() {
  const files = (await listFiles(srcDir))
    .filter((path) => path.endsWith('.ts') || path.endsWith('.tsx'))

  const violations = []
  const normalizeSource = 'src/lib/geo/normalizers.ts'
  const metricChipTargets = new Set([
    'src/components/projects/GemeenteCard.tsx',
    'src/components/projects/WijkCard.tsx',
    'src/components/projects/ProjectList.tsx',
  ])
  const searchTargets = new Set([
    'src/components/reports/ReportSearch.tsx',
    'src/components/projects/WijkDetailView.tsx',
    'src/routes/_authenticated/rapporten.tsx',
  ])
  const geojsonHookTargets = new Set([
    'src/components/projects/ProjectList.tsx',
    'src/routes/_authenticated/map.tsx',
  ])

  for (const file of files) {
    const path = rel(file)
    const text = await readFile(file, 'utf8')

    if (path !== normalizeSource && /function\s+normalizeAreaName\s*\(/.test(text)) {
      violations.push(`${path}: local normalizeAreaName declaration found`)
    }
    if (path !== normalizeSource && /function\s+normalizeGemeenteCode\s*\(/.test(text)) {
      violations.push(`${path}: local normalizeGemeenteCode declaration found`)
    }

    if (metricChipTargets.has(path) && /function\s+(MetricChip|WijkMetricChip|WijkCountChip)\s*\(/.test(text)) {
      violations.push(`${path}: local metric-chip implementation found`)
    }

    if (
      searchTargets.has(path) &&
      /data-lpignore|data-1p-ignore|data-bwignore|data-form-type/.test(text)
    ) {
      violations.push(`${path}: anti-autofill attrs should come from SearchInput defaults`)
    }

    if (
      geojsonHookTargets.has(path) &&
      /fetchGemeenteGeoJSON\s*\(|fetchProvincieGeoJSON\s*\(/.test(text)
    ) {
      violations.push(`${path}: direct GeoJSON fetch detected (use shared hooks)`)
    }
  }

  if (violations.length > 0) {
    console.error('Globalization check failed:')
    for (const violation of violations) {
      console.error(`- ${violation}`)
    }
    process.exit(1)
  }

  console.log('Globalization check passed.')
}

main().catch((error) => {
  console.error('Globalization check crashed:', error)
  process.exit(1)
})
