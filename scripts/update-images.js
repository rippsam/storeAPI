/**
 * update-images.js
 *
 * For each product category, fetches relevant sport photos from LoremFlickr
 * (free, no API key), follows the redirect to capture stable CDN image URLs,
 * and writes them into the product_image column of store.db.
 *
 * Usage:  node scripts/update-images.js
 */

const https    = require('https')
const http     = require('http')
const Database = require('better-sqlite3')
const path     = require('path')

const DB_PATH = path.join(__dirname, '..', 'store.db')
const db = new Database(DB_PATH)

// ── Category → search keyword mapping ────────────────────────────────────────
const KEYWORDS = {
  2:  'soccer',
  3:  'baseball',
  4:  'basketball',
  5:  'lacrosse',
  6:  'tennis',
  7:  'hockey',
  8:  'sport',
  9:  'cardio',
  10: 'weightlifting',
  11: 'fitness',
  12: 'boxing',
  13: 'smartwatch',
  14: 'yoga',
  15: 'training',
  16: 'fitness',
  17: 'cleats',
  18: 'sneakers',
  19: 'shoes',
  20: 'shoes',
  21: 'sportswear',
  22: 'accessories',
  23: 'sportswear',
  24: 'sportswear',
  25: 'sportswear',
  26: 'sportswear',
  27: 'golf',
  28: 'sport',
  29: 'sport',
  30: 'golf',
  31: 'golf',
  32: 'golf',
  33: 'golf',
  34: 'golf',
  35: 'golf',
  36: 'golf',
  37: 'electronics',
  38: 'golf',
  39: 'sport',
  40: 'accessories',
  41: 'sport',
  42: 'bicycle',
  43: 'hiking',
  44: 'hunting',
  45: 'fishing',
  46: 'outdoors',
  47: 'boating',
  48: 'surfing'
}

// ── Follow redirects to get the final stable CDN URL ─────────────────────────
function resolveUrl (startUrl, hops) {
  hops = hops || 0
  return new Promise(function (resolve, reject) {
    if (hops > 6) return reject(new Error('Too many redirects'))

    const mod = startUrl.startsWith('https') ? https : http
    const req = mod.get(startUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, function (res) {
      res.resume() // drain the response body

      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let next = res.headers.location
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
  return new Promise(function (resolve) { return setTimeout(resolve, ms) })
}

// ── Fetch up to `target` unique image URLs for a keyword ─────────────────────
async function fetchImages (keyword, target) {
  const urls  = []
  const seen  = new Set()
  let   tries = 0
  const max   = target * 4 // allow extra attempts to get unique ones

  while (urls.length < target && tries < max) {
    tries++
    const src = 'https://loremflickr.com/400/300/' + keyword
    try {
      const final = await resolveUrl(src)
      if (!seen.has(final)) {
        seen.add(final)
        urls.push(final)
        process.stdout.write('.')
      }
      await sleep(300) // be polite to the server
    } catch (err) {
      await sleep(600)
    }
  }

  return urls
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main () {
  const categories = db.prepare(`
    SELECT c.category_id, c.category_name, COUNT(p.product_id) AS cnt
    FROM   categories c
    JOIN   products   p ON p.product_category_id = c.category_id
    GROUP  BY c.category_id
    HAVING cnt > 0
    ORDER  BY c.category_id
  `).all()

  const update = db.prepare('UPDATE products SET product_image = ? WHERE product_id = ?')

  let totalUpdated = 0

  for (const cat of categories) {
    const keyword = KEYWORDS[cat.category_id] || 'sport'
    const target  = Math.min(cat.cnt, 15) // up to 15 unique images per category

    process.stdout.write('\n[' + cat.category_id + '] ' + cat.category_name +
      ' (' + cat.cnt + ' products) "' + keyword + '" → ')

    const images = await fetchImages(keyword, target)

    if (images.length === 0) {
      console.log('SKIPPED (no images returned)')
      continue
    }

    const products = db.prepare(
      'SELECT product_id FROM products WHERE product_category_id = ? ORDER BY product_id'
    ).all(cat.category_id)

    db.transaction(function () {
      products.forEach(function (p, i) {
        update.run(images[i % images.length], p.product_id)
      })
    })()

    totalUpdated += products.length
    console.log(' ' + products.length + ' products updated')
  }

  console.log('\nFinished. ' + totalUpdated + ' products updated.')
  db.close()
}

main().catch(function (err) {
  console.error('\nFatal:', err.message)
  db.close()
  process.exit(1)
})
