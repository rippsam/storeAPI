/**
 * update-images.js
 *
 * Assigns each product a relevant image by extracting sport + product-type
 * keywords from the product name, then fetching matching photos from
 * LoremFlickr (free, no API key). Stable CDN URLs are stored in product_image.
 *
 * Usage:  node scripts/update-images.js
 */

const https    = require('https')
const http     = require('http')
const Database = require('better-sqlite3')
const path     = require('path')

const DB_PATH = path.join(__dirname, '..', 'store.db')
const db = new Database(DB_PATH)

// ── Keyword extraction ────────────────────────────────────────────────────────

// Sport rules — checked in order; FIRST match wins.
// Soccer must come before Football to avoid "Soccer" hitting the Football rule.
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
  { words: ['surfing', 'kayak', 'canoe', 'boating', 'sailing', 'paddling'],   kw: 'surfing'         },
  { words: ['swimming', 'swim', 'dive', 'snorkel'],                           kw: 'swimming'        },
  // Football last — so it doesn't catch "Soccer" names that contain "football" globally
  { words: ['football'],                                                       kw: 'americanfootball'},
]

// Product-type rules — checked after sport; FIRST match wins.
var TYPE_RULES = [
  { words: ['cleat', 'clea'],                          kw: 'cleats'       },
  { words: ['jersey', 'jers'],                         kw: 'jersey'       },
  { words: [' ball', ',ball', ')ball', 'ball '],       kw: 'ball'         },
  { words: [' bat ', ' bat,', 'baseball bat'],         kw: 'bat'          },
  { words: ['helmet', 'helme'],                        kw: 'helmet'       },
  { words: ['glove', 'mitt'],                          kw: 'gloves'       },
  { words: ['shoe', 'sneaker', 'slide', 'boot', 'clog', 'footwear'],
                                                       kw: 'shoes'        },
  { words: ['bike', 'bicycle'],                        kw: 'bicycle'      },
  { words: ['racket', 'racquet'],                      kw: 'racket'       },
  { words: ['club', 'putter', 'driver', 'wedge', 'iron set', 'wood'],
                                                       kw: 'golfclub'     },
  { words: [' bag', ',bag'],                           kw: 'bag'          },
  { words: ['shorts', 'short'],                        kw: 'shorts'       },
  { words: ['jacket', 'hoodie'],                       kw: 'jacket'       },
  { words: ['shirt', 'tee '],                          kw: 'jersey'       },
  { words: ['compression', 'tight', 'capri', ' bra'],  kw: 'sportswear'  },
  { words: ['fuelband', 'fitbit', 'wristband', 'activity tracker',
            'fitness tracker', 'heart rate'],          kw: 'smartwatch'   },
  { words: ['watch', 'gps watch'],                     kw: 'smartwatch'   },
  { words: ['weight set', 'barbell', 'dumbbell', 'kettlebell', 'olympic weight'],
                                                       kw: 'weightlifting'},
  { words: ['bench', 'squat rack'],                    kw: 'gym'          },
  { words: ['elliptical', 'treadmill', 'stationary bike', 'rowing machine'],
                                                       kw: 'gym'          },
  { words: ['tent', 'canopy', 'shelter'],              kw: 'camping'      },
  { words: ['kayak', 'paddle'],                        kw: 'kayaking'     },
  { words: ['wagon', 'folding chair', 'camp chair'],   kw: 'outdoor'      },
  { words: ['inversion'],                              kw: 'fitness'      },
  { words: ['training mask'],                          kw: 'fitness'      },
]

function extractKeyword (name) {
  var lower = name.toLowerCase()

  var sport = null
  for (var i = 0; i < SPORT_RULES.length; i++) {
    var rule = SPORT_RULES[i]
    for (var j = 0; j < rule.words.length; j++) {
      if (lower.indexOf(rule.words[j]) !== -1) {
        sport = rule.kw
        break
      }
    }
    if (sport) break
  }

  var type = null
  for (var i = 0; i < TYPE_RULES.length; i++) {
    var rule = TYPE_RULES[i]
    for (var j = 0; j < rule.words.length; j++) {
      if (lower.indexOf(rule.words[j]) !== -1) {
        type = rule.kw
        break
      }
    }
    if (type) break
  }

  if (sport && type) return sport + ',' + type
  if (sport)         return sport
  if (type)          return type
  return 'sport'
}

// ── HTTP redirect follower ────────────────────────────────────────────────────

function resolveUrl (startUrl, hops) {
  hops = hops || 0
  return new Promise(function (resolve, reject) {
    if (hops > 6) return reject(new Error('Too many redirects'))
    var mod = startUrl.startsWith('https') ? https : http
    var req = mod.get(startUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, function (res) {
      res.resume()
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        var next = res.headers.location
        if (!next.startsWith('http')) next = 'https://loremflickr.com' + next
        resolveUrl(next, hops + 1).then(resolve).catch(reject)
      } else if (res.statusCode === 200) {
        resolve(startUrl)
      } else {
        reject(new Error('HTTP ' + res.statusCode))
      }
    })
    req.on('error', reject)
    req.setTimeout(15000, function () { req.destroy(); reject(new Error('Timeout')) })
  })
}

function sleep (ms) {
  return new Promise(function (r) { return setTimeout(r, ms) })
}

// ── Fetch N unique stable CDN URLs for a keyword ─────────────────────────────

async function fetchImages (keyword, count) {
  var urls    = []
  var seen    = new Set()
  var tries   = 0
  var maxTries = count * 5

  while (urls.length < count && tries < maxTries) {
    tries++
    try {
      var final = await resolveUrl('https://loremflickr.com/400/300/' + keyword)
      if (!seen.has(final)) { seen.add(final); urls.push(final); process.stdout.write('.') }
      await sleep(300)
    } catch (e) {
      await sleep(600)
    }
  }
  return urls
}

// ── Image cache: keyword → [urls] ────────────────────────────────────────────

var imageCache   = {}
var cacheIndexes = {}

async function getNextImage (keyword) {
  // Fetch images if not cached yet
  if (!imageCache[keyword]) {
    process.stdout.write('\n  [' + keyword + '] ')
    var imgs = await fetchImages(keyword, 8)

    // If 2-keyword combo returned fewer than 3 images, fall back to sport only
    if (imgs.length < 3 && keyword.indexOf(',') !== -1) {
      var fallback = keyword.split(',')[0]
      process.stdout.write(' (too few, retrying as "' + fallback + '") ')
      imgs = await fetchImages(fallback, 8)
    }

    imageCache[keyword]   = imgs.length > 0 ? imgs : ['']
    cacheIndexes[keyword] = 0
  }

  var imgs = imageCache[keyword]
  if (imgs.length === 0 || imgs[0] === '') return ''
  var idx = cacheIndexes[keyword]
  cacheIndexes[keyword] = (idx + 1) % imgs.length
  return imgs[idx]
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main () {
  var products = db.prepare('SELECT product_id, product_name FROM products ORDER BY product_id').all()
  console.log('Processing ' + products.length + ' products...')

  // Pre-scan: show which keywords will be needed
  var keywordSet = {}
  products.forEach(function (p) {
    var kw = extractKeyword(p.product_name)
    keywordSet[kw] = (keywordSet[kw] || 0) + 1
  })
  var uniqueKeywords = Object.keys(keywordSet)
  console.log('Unique keyword combos: ' + uniqueKeywords.length)
  console.log(uniqueKeywords.sort().join(', '))

  // Assign image URLs
  var assignments = []
  for (var i = 0; i < products.length; i++) {
    var p  = products[i]
    var kw = extractKeyword(p.product_name)
    var url = await getNextImage(kw)
    assignments.push({ id: p.product_id, url: url })
  }

  // Write all to DB in one transaction
  console.log('\n\nWriting to database...')
  var update = db.prepare('UPDATE products SET product_image = ? WHERE product_id = ?')
  db.transaction(function () {
    assignments.forEach(function (a) {
      if (a.url) update.run(a.url, a.id)
    })
  })()

  var updated = assignments.filter(function (a) { return a.url }).length
  console.log('Done. ' + updated + ' products updated.')
  db.close()
}

main().catch(function (err) {
  console.error('\nFatal:', err.message)
  db.close()
  process.exit(1)
})
