/**
 * update-descriptions.js
 *
 * Populates product_description in store.db using Groq API (free, no billing required).
 * Uses Llama 3.1 8B to generate realistic product descriptions from product names.
 * Deduplicates by product name. Tracks progress for resumable runs.
 *
 * Usage:  GROQ_API_KEY=your_key node scripts/update-descriptions.js
 */

const https    = require('https')
const fs       = require('fs')
const Database = require('better-sqlite3')
const path     = require('path')

const DB_PATH       = path.join(__dirname, '..', 'store.db')
const PROGRESS_PATH = path.join(__dirname, '.desc-progress.json')
const MAX_DESC_LEN  = 250

const db = new Database(DB_PATH)

function sleep(ms) {
  return new Promise(function(r) { return setTimeout(r, ms) })
}

// ── Progress file ─────────────────────────────────────────────────────────────

function loadProgress() {
  try { return JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8')) }
  catch (e) { return { done: [], descriptions: {} } }
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2))
}

// ── Groq API ──────────────────────────────────────────────────────────────────

function callGroq(productName, apiKey) {
  return new Promise(function(resolve) {
    var prompt =
      'Write a concise 1-2 sentence product description for this sporting goods item: "' +
      productName +
      '". Focus on key features and benefits. Keep it under 200 characters. ' +
      'Return only the description text, no quotes or extra formatting.'

    var body = JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100,
      temperature: 0.7
    })

    var options = {
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }

    var req = https.request(options, function(res) {
      var data = ''
      res.on('data', function(chunk) { data += chunk })
      res.on('end', function() {
        try {
          var json = JSON.parse(data)
          if (json.error) {
            console.error('  Groq error:', json.error.message)
            return resolve(null)
          }
          var text = json.choices &&
                     json.choices[0] &&
                     json.choices[0].message &&
                     json.choices[0].message.content
          if (!text) return resolve(null)
          resolve(text.trim().replace(/^["']|["']$/g, '').slice(0, MAX_DESC_LEN))
        } catch (e) { resolve(null) }
      })
    })

    req.on('error', function() { resolve(null) })
    req.setTimeout(20000, function() { req.destroy(); resolve(null) })
    req.write(body)
    req.end()
  })
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  var apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    console.error('Error: GROQ_API_KEY environment variable is not set.')
    console.error('Usage: GROQ_API_KEY=your_key node scripts/update-descriptions.js')
    process.exit(1)
  }

  var products = db.prepare('SELECT product_id, product_name FROM products ORDER BY product_id').all()
  console.log('Loaded ' + products.length + ' products.')

  // Build uniqueName → [product_ids] map
  var nameMap = {}
  products.forEach(function(p) {
    var name = p.product_name.trim()
    if (!nameMap[name]) nameMap[name] = []
    nameMap[name].push(p.product_id)
  })

  var allNames  = Object.keys(nameMap)
  var progress  = loadProgress()
  var doneSet   = new Set(progress.done)
  var descCache = progress.descriptions || {}
  var remaining = allNames.filter(function(n) { return !doneSet.has(n) })

  console.log('Unique product names: ' + allNames.length)
  console.log('Already processed:    ' + doneSet.size)
  console.log('Remaining:            ' + remaining.length)
  console.log('Estimated time:       ~' + Math.ceil(remaining.length * 2.5 / 60) + ' minutes\n')

  if (remaining.length === 0) {
    console.log('All products already have descriptions. Nothing to do.')
    db.close()
    return
  }

  var succeeded = 0
  var failed    = 0

  for (var i = 0; i < remaining.length; i++) {
    var name = remaining[i]
    var desc = await callGroq(name, apiKey)

    if (desc) {
      descCache[name] = desc
      doneSet.add(name)
      succeeded++
      console.log('[' + doneSet.size + '/' + allNames.length + '] ' + name + '\n  → ' + desc)
    } else {
      failed++
      console.log('[skip] ' + name + ' — failed, will retry next run')
    }

    if ((i + 1) % 10 === 0) {
      progress.done = Array.from(doneSet)
      progress.descriptions = descCache
      saveProgress(progress)
    }

    await sleep(2500)
  }

  progress.done = Array.from(doneSet)
  progress.descriptions = descCache
  saveProgress(progress)

  console.log('\nWriting to database...')
  var update = db.prepare('UPDATE products SET product_description = ? WHERE product_id = ?')
  db.transaction(function() {
    products.forEach(function(p) {
      var desc = descCache[p.product_name.trim()]
      if (desc) update.run(desc, p.product_id)
    })
  })()

  var stillLeft = allNames.length - doneSet.size
  console.log('\nDone.')
  console.log('  Succeeded: ' + succeeded)
  console.log('  Failed:    ' + failed + (failed > 0 ? ' (re-run to retry)' : ''))
  console.log('  Processed: ' + doneSet.size + ' / ' + allNames.length)

  if (stillLeft === 0) {
    console.log('\nALL DESCRIPTIONS UPDATED. Task complete.')
  } else {
    console.log('  Remaining: ' + stillLeft + ' — re-run to continue.')
  }

  db.close()
}

main().catch(function(err) {
  console.error('\nFatal:', err.message)
  db.close()
  process.exit(1)
})
