/**
 * update-images.js
 *
 * Assigns product images using Gemini 2.5 Flash base knowledge.
 * Asks Gemini for a direct image CDN URL for each product (no search grounding).
 * Validates each URL with a HEAD request to confirm it's a real image.
 * Falls back to LoremFlickr if no valid URL found.
 *
 * Usage:
 *   export $(cat .image-api-keys | xargs) && node scripts/update-images.js
 */

const https    = require('https')
const http     = require('http')
const fs       = require('fs')
const Database = require('better-sqlite3')
const path     = require('path')
const url      = require('url')

const DB_PATH       = path.join(__dirname, '..', 'store.db')
const PROGRESS_PATH = path.join(__dirname, '.image-progress.json')

const DELAY_MS = 2000   // ~30 RPM (no search grounding = much faster)

const db = new Database(DB_PATH)

function sleep(ms) {
  return new Promise(function(r) { return setTimeout(r, ms) })
}

// ── Progress file ─────────────────────────────────────────────────────────────

function loadProgress() {
  try { return JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8')) }
  catch (e) { return { done: [], urls: {} } }
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2))
}

// ── HTTPS request ─────────────────────────────────────────────────────────────

function httpsPost(options, body) {
  return new Promise(function(resolve, reject) {
    var req = https.request(options, function(res) {
      var chunks = []
      res.on('data', function(c) { chunks.push(c) })
      res.on('end', function() {
        resolve({ statusCode: res.statusCode, body: Buffer.concat(chunks).toString() })
      })
    })
    req.on('error', reject)
    req.setTimeout(20000, function() { req.destroy(new Error('timeout')) })
    req.write(body)
    req.end()
  })
}

// ── Validate image URL ────────────────────────────────────────────────────────

function validateImageUrl(rawUrl) {
  return new Promise(function(resolve) {
    try {
      var parsed = new url.URL(rawUrl)
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return resolve(false)
      var lib = parsed.protocol === 'https:' ? https : http
      var opts = {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'HEAD',
        headers: { 'User-Agent': 'Mozilla/5.0' }
      }
      var req = lib.request(opts, function(res) {
        var ct = res.headers['content-type'] || ''
        // Accept 200 with image content-type, or any URL that ends in image extension
        var isImage = ct.indexOf('image') !== -1
        var hasImgExt = /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(rawUrl)
        resolve(res.statusCode === 200 && (isImage || hasImgExt))
      })
      req.on('error', function() { resolve(false) })
      req.setTimeout(8000, function() { req.destroy(); resolve(false) })
      req.end()
    } catch (e) { resolve(false) }
  })
}

// ── Gemini: get image URL from base knowledge ─────────────────────────────────

function getImageUrl(productName, apiKey) {
  var prompt =
    'What is a direct product image URL for "' + productName + '"? ' +
    'This must be a real URL from a retailer CDN such as i.ebayimg.com, ' +
    'm.media-amazon.com, scene7.com, images.nike.com, or similar. ' +
    'Return ONLY the URL itself with no other text, or the word "none" if you are not confident the URL is real and valid.'

  var body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }]
  })

  var options = {
    hostname: 'generativelanguage.googleapis.com',
    path: '/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  }

  return httpsPost(options, body).then(function(res) {
    try {
      var data = JSON.parse(res.body)
      if (data.error) {
        console.error('  Gemini error:', data.error.code, data.error.message)
        return null
      }
      var text = data.candidates &&
                 data.candidates[0] &&
                 data.candidates[0].content &&
                 data.candidates[0].content.parts &&
                 data.candidates[0].content.parts[0] &&
                 data.candidates[0].content.parts[0].text
      if (!text) return null
      text = text.trim()
      if (text === 'none' || text.toLowerCase().startsWith('none')) return null

      // Extract first https URL
      var match = text.match(/https?:\/\/[^\s"'<>\]]+/i)
      return match ? match[0] : null
    } catch (e) { return null }
  }).catch(function() { return null })
}

// ── LoremFlickr fallback ──────────────────────────────────────────────────────

var SPORT_RULES = [
  { words: ['soccer', 'futbol'],                           kw: 'soccer'           },
  { words: ['baseball', 'softball', ' bat '],              kw: 'baseball'         },
  { words: ['basketball', 'hoop'],                         kw: 'basketball'       },
  { words: ['hockey', 'puck'],                             kw: 'hockey'           },
  { words: ['tennis', 'racket', 'racquet'],                kw: 'tennis'           },
  { words: ['golf', 'putter', 'wedge', 'iron', 'driver'],  kw: 'golf'            },
  { words: ['boxing', 'mma'],                              kw: 'boxing'           },
  { words: ['yoga', 'pilates'],                            kw: 'yoga'             },
  { words: ['bike', 'bicycle', 'cycling'],                 kw: 'cycling'          },
  { words: ['fishing', 'tackle', 'rod', 'reel'],           kw: 'fishing'          },
  { words: ['hiking', 'camping', 'tent', 'backpack'],      kw: 'hiking'           },
  { words: ['swimming', 'swim'],                           kw: 'swimming'         },
  { words: ['running', 'marathon'],                        kw: 'running'          },
  { words: ['football'],                                   kw: 'americanfootball' },
  { words: ['lacrosse'],                                   kw: 'lacrosse'         },
  { words: ['volleyball'],                                 kw: 'volleyball'       },
  { words: ['ski', 'skiing', 'snowboard'],                 kw: 'skiing'           },
  { words: ['racquetball', 'squash'],                      kw: 'racquetball'      },
]

function loremFlickrFallback(name) {
  var lower = name.toLowerCase()
  for (var i = 0; i < SPORT_RULES.length; i++) {
    for (var j = 0; j < SPORT_RULES[i].words.length; j++) {
      if (lower.indexOf(SPORT_RULES[i].words[j]) !== -1) {
        return 'https://loremflickr.com/400/300/' + SPORT_RULES[i].kw
      }
    }
  }
  return 'https://loremflickr.com/400/300/sport'
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  var apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('Error: GEMINI_API_KEY must be set.')
    console.error('Usage: export $(cat .image-api-keys | xargs) && node scripts/update-images.js')
    process.exit(1)
  }

  var products = db.prepare('SELECT product_id, product_name FROM products ORDER BY product_id').all()
  console.log('Loaded ' + products.length + ' products.')

  var nameMap = {}
  products.forEach(function(p) {
    var name = p.product_name.trim()
    if (!nameMap[name]) nameMap[name] = []
    nameMap[name].push(p.product_id)
  })

  var allNames  = Object.keys(nameMap)
  var progress  = loadProgress()
  var doneSet   = new Set(progress.done)
  var urlCache  = progress.urls || {}
  var remaining = allNames.filter(function(n) { return !doneSet.has(n) })

  console.log('Unique product names: ' + allNames.length)
  console.log('Already processed:    ' + doneSet.size)
  console.log('Remaining:            ' + remaining.length + '\n')

  if (remaining.length === 0) {
    console.log('All products already have images. Nothing to do.')
    db.close()
    return
  }

  var realImages = 0
  var fallbacks  = 0

  for (var i = 0; i < remaining.length; i++) {
    var name     = remaining[i]
    var finalUrl = null

    var candidate = await getImageUrl(name, apiKey)

    if (candidate) {
      var valid = await validateImageUrl(candidate)
      if (valid) {
        finalUrl = candidate
        realImages++
      }
    }

    if (!finalUrl) {
      finalUrl = loremFlickrFallback(name)
      fallbacks++
    }

    urlCache[name] = finalUrl
    doneSet.add(name)
    console.log('[' + doneSet.size + '/' + allNames.length + '] ' + name.substring(0, 55) + '\n  → ' + finalUrl)

    // Save progress every 10 items
    if (doneSet.size % 10 === 0) {
      saveProgress({ done: Array.from(doneSet), urls: urlCache })
    }

    if (i < remaining.length - 1) await sleep(DELAY_MS)
  }

  // Write to DB
  console.log('\nWriting to database...')
  var update = db.prepare('UPDATE products SET product_image = ? WHERE product_id = ?')
  db.transaction(function() {
    products.forEach(function(p) {
      var u = urlCache[p.product_name.trim()]
      if (u) update.run(u, p.product_id)
    })
  })()

  saveProgress({ done: Array.from(doneSet), urls: urlCache })

  var pct = Math.round(100 * realImages / (realImages + fallbacks))
  console.log('\nDone.')
  console.log('  Real product images: ' + realImages + ' (' + pct + '%)')
  console.log('  LoremFlickr:         ' + fallbacks)
  console.log('  Total: ' + doneSet.size + ' / ' + allNames.length)

  if (allNames.length === doneSet.size) console.log('\nALL PRODUCTS UPDATED.')
  else console.log('  Run again to continue.')

  db.close()
}

main().catch(function(err) {
  console.error('\nFatal:', err.message)
  db.close()
  process.exit(1)
})
