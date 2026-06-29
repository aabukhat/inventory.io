#!/usr/bin/env node
/**
 * scripts/generate-products.js
 *
 * Downloads the Iowa Liquor Sales (Past 30 Days) public dataset
 * (Iowa Alcoholic Beverages Division, Creative Commons Attribution 4.0)
 * and regenerates the liquor section of src/lib/products.js.
 *
 * The beer / seltzer / cider section is left untouched.
 *
 * Usage:  node scripts/generate-products.js
 *         npm run generate-products
 *
 * Data source (dataset 1075):
 *   https://data.iowa.gov/Sales-Distribution/Iowa-Liquor-Sales/m3tr-qhgy
 */

import https from 'https'
import readline from 'readline'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname  = path.dirname(fileURLToPath(import.meta.url))
const PRODUCTS_PATH = path.join(__dirname, '..', 'src', 'lib', 'products.js')

// Iowa Data Hub dataset ID for "Iowa Liquor Sales, Past 30 Days"
// Provides a current, ~50MB snapshot — large enough for comprehensive product
// coverage, small enough to download in seconds.
const IOWA_DATASET_ID = 1075
const IOWA_API_BASE   = 'https://idh-be.iowa.gov'

// ─── Iowa category_name → app type (null = skip entirely) ────────────────────
// Iowa uses ALL CAPS; we normalise with .toLowerCase() before lookup.
const CAT_MAP = {
  '100% agave tequila':                   'liquor',
  'aged dark rum':                        'liquor',
  'american brandies':                    'liquor',
  'american cordials & liqueur':          'liquor',
  'american cordials & liqueurs':         'liquor',
  'american distilled spirit specialty':  'liquor',
  'american dry gins':                    'liquor',
  'american flavored vodka':              'liquor',
  'american schnapps':                    'liquor',
  'american sloe gins':                   'liquor',
  'american vodkas':                      'liquor',
  'blended whiskies':                     'liquor',
  'bottled in bond bourbon':              'liquor',
  'canadian whiskies':                    'liquor',
  'cocktails/rtd':                         null,
  'coffee liqueurs':                      'liquor',
  'corn whiskies':                        'liquor',
  'cream liqueurs':                       'liquor',
  'flavored gin':                         'liquor',
  'flavored rum':                         'liquor',
  'flavored vodka':                       'liquor',
  'gold rum':                             'liquor',
  'imported brandies':                    'liquor',
  'imported cordials & liqueur':          'liquor',
  'imported cordials & liqueurs':         'liquor',
  'imported distilled spirit specialty':  'liquor',
  'imported dry gins':                    'liquor',
  'imported flavored vodka':              'liquor',
  'imported schnapps':                    'liquor',
  'imported vodka':                       'liquor',
  'imported vodkas':                      'liquor',
  'irish whiskies':                       'liquor',
  'japanese whiskies':                    'liquor',
  'mezcal':                               'liquor',
  'mixto tequila':                        'liquor',
  'neutral grain spirits':                'liquor',
  'neutral grain spirits flavored':       'liquor',
  'scotch whiskies':                      'liquor',
  'silver rum':                           'liquor',
  'single barrel straight bourbon':       'liquor',
  'single barrel bourbon whiskies':       'liquor',
  'single malt scotch':                   'liquor',
  'spiced rum':                           'liquor',
  'straight bourbon whiskies':            'liquor',
  'straight rye whiskies':                'liquor',
  'tennessee whiskies':                   'liquor',
  'triple sec':                           'liquor',
  'whiskey liqueur':                      'liquor',
  'white rum':                            'liquor',
  'special order items':                   null,
  'temporary & specialty packages':        null,
}

// ─── bottle_volume_ml → { defaultUnit, defaultSize } ─────────────────────────
function mlToUnit(ml) {
  const v = Number(ml) || 750
  if (v <=   60) return { defaultUnit: 'shooter',   defaultSize: '50ml'  }
  if (v <=  250) return { defaultUnit: 'half pint', defaultSize: '200ml' }
  if (v <=  500) return { defaultUnit: 'pint',      defaultSize: '375ml' }
  if (v <=  900) return { defaultUnit: 'fifth',     defaultSize: '750ml' }
  if (v <= 1100) return { defaultUnit: 'liter',     defaultSize: '1L'    }
  return               { defaultUnit: 'handle',    defaultSize: '1.75L' }
}

// ─── Title-case conversion (Iowa data is ALL CAPS) ────────────────────────────
const KEEP_UPPER = new Set([
  'ipa', 'rtd', 'xo', 'vsop', 'vs', 'vso', 'abv', 'usa', 'prf', 'ii', 'iii',
  'iv', 'vi', 'yr', 'yrs', 'pk', 'nv', 'dew', 'wl', 'og', 'xl',
])
const KEEP_LOWER = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'for', 'nor', 'so', 'yet',
  'at', 'by', 'in', 'of', 'on', 'to', 'up', 'as', 'w', 'de', 'la', 'le',
])

function toTitleCase(str) {
  return str
    .toLowerCase()
    .replace(/\b[a-z']+\b/g, (word, offset) => {
      const raw = word.replace(/'/g, '')
      if (KEEP_UPPER.has(raw)) return word.toUpperCase()
      if (KEEP_LOWER.has(raw) && offset > 0) return word
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    // fix possessives: "Maker'S" → "Maker's"
    .replace(/(\w)'(\w)/g, (_, a, b) => `${a}'${b.toLowerCase()}`)
}

// ─── Simple CSV line parser (handles quoted fields with embedded commas) ──────
function parseCSVLine(line) {
  const fields = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++ }
      else inQ = !inQ
    } else if (c === ',' && !inQ) {
      fields.push(cur); cur = ''
    } else {
      cur += c
    }
  }
  fields.push(cur)
  return fields
}

// ─── HTTPS GET — follows up to 5 redirects, returns a readable stream ─────────
function getStream(url, hops = 0) {
  return new Promise((resolve, reject) => {
    if (hops > 5) return reject(new Error('Too many redirects'))
    https.get(url, { headers: { 'User-Agent': 'drink-inventory-generator/1.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume()
        return getStream(res.headers.location, hops + 1).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) {
        res.resume()
        return reject(new Error(`HTTP ${res.statusCode} — ${url.slice(0, 80)}`))
      }
      resolve(res)
    }).on('error', reject)
  })
}

// ─── Stream-parse the CSV, deduplicate, return product map ───────────────────
async function fetchAndProcess() {
  const url = `${IOWA_API_BASE}/api/v1/datasets/${IOWA_DATASET_ID}/rows.csv`
  process.stdout.write('connecting to Iowa Data Hub...\n')

  const stream = await getStream(url)

  return new Promise((resolve, reject) => {
    // key: `${cleanName.lower}` → best entry (prefer size closest to 750ml)
    const best = new Map()
    const unknownCats = new Set()

    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })
    let header = null
    let idxName = -1, idxCat = -1, idxMl = -1
    let rowCount = 0

    rl.on('line', line => {
      if (!line.trim()) return
      const fields = parseCSVLine(line)

      if (!header) {
        header = fields
        idxName = header.indexOf('im_desc')
        idxCat  = header.indexOf('category_name')
        idxMl   = header.indexOf('bottle_volume_ml')
        if (idxName < 0 || idxCat < 0 || idxMl < 0) {
          rl.close()
          return reject(new Error('Expected columns not found in CSV header: ' + header.join(', ')))
        }
        return
      }

      rowCount++
      if (rowCount % 10000 === 0) process.stdout.write(`  processing row ${rowCount.toLocaleString()}...\r`)

      const rawName = (fields[idxName] || '').trim()
      const rawCat  = (fields[idxCat]  || '').trim()
      const ml      = Number(fields[idxMl]) || 750

      const type = CAT_MAP[rawCat.toLowerCase()]
      if (type === undefined) { unknownCats.add(rawCat); return }
      if (type === null) return

      const name = toTitleCase(rawName)
      if (!name || name.length < 3) return

      const key = name.toLowerCase()
      const unit = mlToUnit(ml)

      if (!best.has(key)) {
        best.set(key, { name, type, ...unit, _cat: rawCat, _ml: ml })
      } else {
        const prev = best.get(key)
        if (Math.abs(ml - 750) < Math.abs(prev._ml - 750)) {
          best.set(key, { name, type, ...unit, _cat: rawCat, _ml: ml })
        }
      }
    })

    rl.on('close', () => {
      process.stdout.write('\n')
      console.log(`  rows processed: ${rowCount.toLocaleString()}`)
      if (unknownCats.size > 0) {
        console.warn(`  [warn] unmapped categories (skipped):`)
        for (const c of [...unknownCats].sort()) console.warn(`    - ${c}`)
      }
      resolve([...best.values()])
    })

    rl.on('error', reject)
    stream.on('error', reject)
  })
}

// ─── Sort and group products by Iowa category for comment headers ─────────────
function organise(products) {
  return products.sort((a, b) => {
    const c = a._cat.localeCompare(b._cat)
    return c !== 0 ? c : a.name.localeCompare(b.name)
  })
}

// ─── Format one JS product line ───────────────────────────────────────────────
function fmt({ name, type, defaultUnit, defaultSize }) {
  const n = (JSON.stringify(name) + ',').padEnd(53)
  const t = `'${type}',`.padEnd(10)
  const u = `'${defaultUnit}',`.padEnd(14)
  return `  { name: ${n} type: ${t} defaultUnit: ${u} defaultSize: '${defaultSize}' },`
}

// ─── Replace the auto-generated section in products.js ───────────────────────
function inject(products) {
  const IOWA_BEGIN   = '  // BEGIN:liquor'
  const IOWA_END     = '  // END:liquor'
  const MANUAL_BEGIN = '  // BEGIN:manual'
  const MANUAL_END   = '  // END:manual'

  const src = fs.readFileSync(PRODUCTS_PATH, 'utf8')
  if (!src.includes(IOWA_BEGIN) || !src.includes(IOWA_END)) {
    throw new Error(`Marker comments not found in ${PRODUCTS_PATH}`)
  }

  // Preserve any existing manual entries
  let manualLines = []
  if (src.includes(MANUAL_BEGIN) && src.includes(MANUAL_END)) {
    const markerPos    = src.indexOf(MANUAL_BEGIN)
    const contentStart = src.indexOf('\n', markerPos) + 1  // skip past the BEGIN line
    const contentEnd   = src.indexOf(MANUAL_END)
    manualLines = src.slice(contentStart, contentEnd).split('\n').filter(l => l.trim())
  }

  // Build the Iowa section
  const lines = [`${IOWA_BEGIN} — auto-generated by scripts/generate-products.js`]
  let lastCat = null

  for (const p of organise(products)) {
    if (p._cat !== lastCat) {
      if (lines.length > 1) lines.push('')
      lines.push(`  // ${p._cat}`)
      lastCat = p._cat
    }
    lines.push(fmt(p))
  }

  lines.push(IOWA_END)

  // Re-append the manual section if it has entries
  if (manualLines.length > 0) {
    lines.push(`  ${MANUAL_BEGIN.trim()} — preserved across regenerations`)
    lines.push(...manualLines)
    lines.push(MANUAL_END)
  }

  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  // Match from IOWA_BEGIN through MANUAL_END (if present) or IOWA_END
  const endMarker = src.includes(MANUAL_END) ? MANUAL_END : IOWA_END
  const re = new RegExp(`${esc(IOWA_BEGIN)}[\\s\\S]*?${esc(endMarker)}`)
  fs.writeFileSync(PRODUCTS_PATH, src.replace(re, lines.join('\n')), 'utf8')
}

// ─── Main ─────────────────────────────────────────────────────────────────────
console.log('drink-inventory · product generator')
console.log('source: Iowa Alcoholic Beverages Division / Iowa Data Hub (CC BY 4.0)\n')

let products
try {
  products = await fetchAndProcess()
} catch (err) {
  console.error(`\nfetch failed: ${err.message}`)
  process.exit(1)
}

console.log(`unique liquor products found: ${products.length}`)
inject(products)
console.log(`\nupdated ${PRODUCTS_PATH}`)

const updated = fs.readFileSync(PRODUCTS_PATH, 'utf8')
const staticCount = (updated.match(/type: '(?:beer|seltzer|cider)'/g) || []).length
console.log(`  liquor entries : ${products.length}`)
console.log(`  beer/seltzer/cider: ${staticCount}`)
console.log('\ndone. run `npm run build` to verify.')
