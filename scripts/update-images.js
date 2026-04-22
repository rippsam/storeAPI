/**
 * update-images.js
 *
 * Replaces LoremFlickr fallback images with real product images via Bing Image Search API.
 * Only processes products currently using LoremFlickr in the DB.
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

const DELAY_MS = 350    // ~170 RPM, well under Bing F0 limit of 3 TPS

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

// ── HTTPS GET ─────────────────────────────────────────────────────────────────

function httpsGet(options) {
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

// ── Bing Image Search ─────────────────────────────────────────────────────────

function searchBing(productName, apiKey) {
  var query = encodeURIComponent(productName)
  var options = {
    hostname: 'api.bing.microsoft.com',
    path: '/v7.0/images/search?q=' + query + '&count=5&imageType=Photo&safeSearch=Off',
    method: 'GET',
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey
    }
  }

  return httpsGet(options).then(function(res) {
    try {
      if (res.statusCode !== 200) {
        console.error('  Bing error:', res.statusCode, res.body.substring(0, 120))
        return null
      }
      var data = JSON.parse(res.body)
      var values = data.value
      if (!values || values.length === 0) return null
      // Return first valid contentUrl
      for (var i = 0; i < values.length; i++) {
        var u = values[i].contentUrl
        if (u && /^https?:\/\//i.test(u)) return u
      }
      return null
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

function loremFlickrFallback(name, productId) {
  var lower = name.toLowerCase()
  var lock = '?lock=' + (productId || Math.abs(name.split('').reduce(function(h, c) { return (h * 31 + c.charCodeAt(0)) | 0; }, 0)))
  for (var i = 0; i < SPORT_RULES.length; i++) {
    for (var j = 0; j < SPORT_RULES[i].words.length; j++) {
      if (lower.indexOf(SPORT_RULES[i].words[j]) !== -1) {
        return 'https://loremflickr.com/400/300/' + SPORT_RULES[i].kw + lock
      }
    }
  }
  return 'https://loremflickr.com/400/300/sport' + lock
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  var apiKey = process.env.BING_API_KEY
  if (!apiKey) {
    console.error('Error: BING_API_KEY must be set.')
    console.error('Usage: export $(cat .image-api-keys | xargs) && node scripts/update-images.js')
    process.exit(1)
  }

  // Load all products + their current image URLs from DB
  var products = db.prepare('SELECT product_id, product_name, product_image FROM products ORDER BY product_id').all()
  console.log('Loaded ' + products.length + ' products.')

  // Find unique names that still use LoremFlickr in the DB
  var loremNames = new Set()
  var nameToIds  = {}
  products.forEach(function(p) {
    var name = p.product_name.trim()
    if (!nameToIds[name]) nameToIds[name] = []
    nameToIds[name].push(p.product_id)
    if (p.product_image && p.product_image.indexOf('loremflickr.com') !== -1) {
      loremNames.add(name)
    }
  })

  var progress = loadProgress()
  var urlCache = progress.urls || {}

  // Skip names already upgraded this run (i.e. saved with a non-loremflickr URL)
  var doneThisRun = new Set(
    (progress.done || []).filter(function(n) {
      return urlCache[n] && urlCache[n].indexOf('loremflickr.com') === -1
    })
  )

  var remaining = Array.from(loremNames).filter(function(n) { return !doneThisRun.has(n) })

  console.log('Products using LoremFlickr: ' + loremNames.size)
  console.log('Already upgraded this run:  ' + doneThisRun.size)
  console.log('Remaining:                  ' + remaining.length + '\n')

  if (remaining.length === 0) {
    console.log('No LoremFlickr images left to replace. Nothing to do.')
    db.close()
    return
  }

  var realImages = 0
  var fallbacks  = 0
  var processed  = 0

  for (var i = 0; i < remaining.length; i++) {
    var name     = remaining[i]
    var finalUrl = null

    var candidate = await searchBing(name, apiKey)

    if (candidate) {
      var valid = await validateImageUrl(candidate)
      if (valid) {
        finalUrl = candidate
        realImages++
      }
    }

    if (!finalUrl) {
      // Keep existing LoremFlickr URL (with lock) rather than generating a new one
      var existing = products.find(function(p) { return p.product_name.trim() === name })
      finalUrl = (existing && existing.product_image) || loremFlickrFallback(name, nameToIds[name][0])
      fallbacks++
    }

    processed++
    urlCache[name] = finalUrl
    doneThisRun.add(name)
    console.log('[' + processed + '/' + remaining.length + '] ' + name.substring(0, 55) + '\n  → ' + finalUrl)

    // Save progress every 10 items
    if (processed % 10 === 0) {
      saveProgress({ done: Array.from(doneThisRun), urls: urlCache })
    }

    if (i < remaining.length - 1) await sleep(DELAY_MS)
  }

  // Write upgraded URLs to DB (only update rows that got a real image)
  console.log('\nWriting to database...')
  var update = db.prepare('UPDATE products SET product_image = ? WHERE product_id = ?')
  db.transaction(function() {
    Object.keys(urlCache).forEach(function(name) {
      var u = urlCache[name]
      if (!u || u.indexOf('loremflickr.com') !== -1) return   // skip fallbacks
      var ids = nameToIds[name] || []
      ids.forEach(function(id) { update.run(u, id) })
    })
  })()

  saveProgress({ done: Array.from(doneThisRun), urls: urlCache })

  var pct = realImages + fallbacks > 0
    ? Math.round(100 * realImages / (realImages + fallbacks))
    : 0
  console.log('\nDone.')
  console.log('  Real product images: ' + realImages + ' (' + pct + '%)')
  console.log('  LoremFlickr kept:    ' + fallbacks)
  console.log('  Processed: ' + processed + ' / ' + remaining.length)

  db.close()
}

main().catch(function(err) {
  console.error('\nFatal:', err.message)
  db.close()
  process.exit(1)
})
