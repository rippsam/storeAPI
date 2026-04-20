/**
 * update-images.js
 *
 * Assigns product images using Pixabay API (free, no payment required).
 * Groups products by brand + product type to minimize API calls.
 * Tracks progress in scripts/.image-progress.json.
 *
 * Usage:  PIXABAY_API_KEY=your_key node scripts/update-images.js
 */

const https    = require('https')
const fs       = require('fs')
const Database = require('better-sqlite3')
const path     = require('path')

const DB_PATH       = path.join(__dirname, '..', 'store.db')
const PROGRESS_PATH = path.join(__dirname, '.image-progress.json')

const db = new Database(DB_PATH)

function sleep(ms) {
  return new Promise(function(r) { return setTimeout(r, ms) })
}

// ── Brand extraction (mirrors home.js) ───────────────────────────────────────

var MULTI_WORD_BRANDS = ['Under Armour', 'New Balance', 'The North Face']

function parseBrand(name) {
  for (var i = 0; i < MULTI_WORD_BRANDS.length; i++) {
    if (name.indexOf(MULTI_WORD_BRANDS[i]) === 0) return MULTI_WORD_BRANDS[i].toLowerCase()
  }
  return name.split(' ')[0].toLowerCase()
}

// ── Sport + type keyword extraction ──────────────────────────────────────────

var SPORT_RULES = [
  { words: ['soccer', 'futbol'],                                              kw: 'soccer'          },
  { words: ['baseball', 'softball', ' bat ', ' bat,', ' bat)'],              kw: 'baseball'        },
  { words: ['basketball', 'hoop'],                                            kw: 'basketball'      },
  { words: ['hockey', 'puck', 'goalie'],                                      kw: 'hockey'          },
  { words: ['tennis', 'racket', 'racquet'],                                   kw: 'tennis'          },
  { words: ['golf', 'putter', 'wedge', 'birdie', 'fairway'],                  kw: 'golf'            },
  { words: ['boxing', 'mma', 'everlast', 'punching bag', 'heavy bag'],        kw: 'boxing'          },
  { words: ['lacrosse'],                                                       kw: 'lacrosse'        },
  { words: ['running shoe', 'run shoe', 'marathon', 'jogging'],               kw: 'running'         },
  { words: ['yoga', 'pilates'],                                                kw: 'yoga'            },
  { words: ['mountain bike', 'road bike', 'bicycle', 'cycling'],              kw: 'cycling'         },
  { words: ['fishing', 'reel', 'fishing rod', 'tackle', 'lure', 'angling'],   kw: 'fishing'         },
  { words: ['hunting', 'archery', 'bow ', 'arrow'],                           kw: 'hunting'         },
  { words: ['hiking', 'camping', 'tent', 'canopy', 'camp chair'],             kw: 'hiking'          },
  { words: ['surfing', 'kayak', 'canoe', 'boating', 'sailing', 'paddling'],   kw: 'water sports'    },
  { words: ['swimming', 'swim', 'dive', 'snorkel'],                           kw: 'swimming'        },
  { words: ['football'],                                                       kw: 'football'        },
]

var TYPE_RULES = [
  { words: ['cleat', 'clea'],                         kw: 'cleats'       },
  { words: ['jersey', 'jers'],                        kw: 'jersey'       },
  { words: [' ball', ',ball', ')ball', 'ball '],      kw: 'ball'         },
  { words: [' bat ', ' bat,', 'baseball bat'],        kw: 'bat'          },
  { words: ['helmet', 'helme'],                       kw: 'helmet'       },
  { words: ['glove', 'mitt'],                         kw: 'gloves'       },
  { words: ['shoe', 'sneaker', 'slide', 'boot', 'clog', 'footwear'],
                                                      kw: 'shoes'        },
  { words: ['bike', 'bicycle'],                       kw: 'bike'         },
  { words: ['racket', 'racquet'],                     kw: 'racket'       },
  { words: ['club', 'putter', 'driver', 'wedge', 'iron set', 'wood'],
                                                      kw: 'golf club'    },
  { words: [' bag', ',bag'],                          kw: 'bag'          },
  { words: ['shorts', 'short'],                       kw: 'shorts'       },
  { words: ['jacket', 'hoodie'],                      kw: 'jacket'       },
  { words: ['shirt', 'tee '],                         kw: 'shirt'        },
  { words: ['compression', 'tight', 'capri', ' bra'], kw: 'sportswear'  },
  { words: ['watch', 'fuelband', 'fitbit', 'wristband', 'activity tracker',
            'fitness tracker', 'heart rate', 'gps watch'],
                                                      kw: 'fitness watch'},
  { words: ['weight set', 'barbell', 'dumbbell', 'kettlebell', 'olympic weight'],
                                                      kw: 'weights'      },
  { words: ['bench', 'squat rack'],                   kw: 'weight bench' },
  { words: ['elliptical'],                            kw: 'elliptical'   },
  { words: ['treadmill'],                             kw: 'treadmill'    },
  { words: ['tent', 'canopy', 'shelter'],             kw: 'tent'         },
  { words: ['kayak', 'paddle'],                       kw: 'kayak'        },
  { words: ['wagon', 'folding chair', 'camp chair'],  kw: 'camping chair'},
  { words: ['inversion'],                             kw: 'inversion table'},
  { words: ['training mask'],                         kw: 'training mask'},
  { words: ['inline skate', 'rollerblade'],           kw: 'inline skates'},
  { words: ['stand-up paddle', 'paddleboard'],        kw: 'paddleboard'  },
  { words: ['cooler'],                                kw: 'cooler'       },
  { words: ['camera'],                                kw: 'action camera'},
  { words: ['sock'],                                  kw: 'socks'        },
  { words: ['backpack'],                              kw: 'backpack'     },
  { words: ['table tennis', 'ping pong'],             kw: 'table tennis' },
]

function extractKeyword(name) {
  var lower = name.toLowerCase()

  var sport = null
  for (var i = 0; i < SPORT_RULES.length; i++) {
    var rule = SPORT_RULES[i]
    for (var j = 0; j < rule.words.length; j++) {
      if (lower.indexOf(rule.words[j]) !== -1) { sport = rule.kw; break }
    }
    if (sport) break
  }

  var type = null
  for (var i = 0; i < TYPE_RULES.length; i++) {
    var rule = TYPE_RULES[i]
    for (var j = 0; j < rule.words.length; j++) {
      if (lower.indexOf(rule.words[j]) !== -1) { type = rule.kw; break }
    }
    if (type) break
  }

  if (sport && type) return sport + ' ' + type
  if (type)          return type
  if (sport)         return sport + ' gear'
  return 'sports equipment'
}

function buildGroupKey(name) {
  var brand   = parseBrand(name)
  var keyword = extractKeyword(name)
  return brand + ' ' + keyword
}

// ── Progress file ─────────────────────────────────────────────────────────────

function loadProgress() {
  try { return JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8')) }
  catch (e) { return { done: [] } }
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2))
}

// ── Pixabay Image Search ──────────────────────────────────────────────────────

function searchPixabay(query, apiKey) {
  return new Promise(function(resolve) {
    var q       = encodeURIComponent(query)
    var options = {
      hostname: 'pixabay.com',
      path: '/api/?key=' + apiKey + '&q=' + q + '&image_type=photo&per_page=3&safesearch=true',
      method: 'GET'
    }

    var req = https.request(options, function(res) {
      var body = ''
      res.on('data', function(chunk) { body += chunk })
      res.on('end', function() {
        try {
          var data = JSON.parse(body)
          if (data.hits && data.hits.length > 0) {
            resolve(data.hits[0].webformatURL || null)
          } else {
            resolve(null)
          }
        } catch (e) { resolve(null) }
      })
    })

    req.on('error', function() { resolve(null) })
    req.setTimeout(15000, function() { req.destroy(); resolve(null) })
    req.end()
  })
}

// ── LoremFlickr fallback ──────────────────────────────────────────────────────

function loremFlickrFallback(productName) {
  var keyword = extractKeyword(productName).split(' ')[0]
  return 'https://loremflickr.com/400/300/' + (keyword || 'sport')
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  var apiKey = process.env.PIXABAY_API_KEY
  if (!apiKey) {
    console.error('Error: PIXABAY_API_KEY environment variable is not set.')
    console.error('Usage: PIXABAY_API_KEY=your_key node scripts/update-images.js')
    process.exit(1)
  }

  var products = db.prepare('SELECT product_id, product_name FROM products ORDER BY product_id').all()
  console.log('Loaded ' + products.length + ' products.')

  // Build groupKey → [product_ids] map
  var groupMap = {}
  products.forEach(function(p) {
    var key = buildGroupKey(p.product_name.trim())
    if (!groupMap[key]) groupMap[key] = []
    groupMap[key].push(p.product_id)
  })

  var allKeys   = Object.keys(groupMap)
  var progress  = loadProgress()
  var doneSet   = new Set(progress.done)
  var remaining = allKeys.filter(function(k) { return !doneSet.has(k) })

  console.log('Unique brand+type groups: ' + allKeys.length)
  console.log('Already processed: ' + doneSet.size)
  console.log('Remaining: ' + remaining.length + '\n')

  if (remaining.length === 0) {
    console.log('All products already have images. Nothing to do.')
    db.close()
    return
  }

  var urlCache  = {}
  var found     = 0
  var fallbacks = 0

  for (var i = 0; i < remaining.length; i++) {
    var key = remaining[i]
    var url = await searchPixabay(key, apiKey)

    if (url) {
      urlCache[key] = url
      found++
    } else {
      // Try sport-only fallback query
      var sportOnly = key.split(' ').slice(1).join(' ')
      url = await searchPixabay(sportOnly, apiKey)
      await sleep(400)

      if (url) {
        urlCache[key] = url
        found++
      } else {
        urlCache[key] = loremFlickrFallback(key)
        fallbacks++
      }
    }

    doneSet.add(key)
    console.log('[' + doneSet.size + '/' + allKeys.length + '] ' + key + '\n  → ' + urlCache[key])
    await sleep(400)
  }

  // Write all to DB
  console.log('\nWriting to database...')
  var update = db.prepare('UPDATE products SET product_image = ? WHERE product_id = ?')
  db.transaction(function() {
    products.forEach(function(p) {
      var key = buildGroupKey(p.product_name.trim())
      var url = urlCache[key]
      if (url) update.run(url, p.product_id)
    })
  })()

  progress.done = Array.from(doneSet)
  saveProgress(progress)

  var stillLeft = allKeys.length - doneSet.size
  console.log('\nDone.')
  console.log('  Pixabay results:       ' + found)
  console.log('  LoremFlickr fallbacks: ' + fallbacks)
  console.log('  Groups processed: ' + doneSet.size + ' / ' + allKeys.length)

  if (stillLeft === 0) {
    console.log('\nALL PRODUCTS UPDATED. Task complete.')
  } else {
    console.log('  Remaining: ' + stillLeft + ' (run again tomorrow)')
  }

  db.close()
}

main().catch(function(err) {
  console.error('\nFatal:', err.message)
  db.close()
  process.exit(1)
})
