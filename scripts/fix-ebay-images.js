/**
 * fix-ebay-images.js
 * Replaces all eBay CDN image URLs with LoremFlickr fallbacks.
 * Run: node scripts/fix-ebay-images.js
 */

const Database = require('better-sqlite3')
const path     = require('path')

const DB_PATH = path.join(__dirname, '..', 'store.db')
const db      = new Database(DB_PATH)

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
  var lock  = '?lock=' + productId
  for (var i = 0; i < SPORT_RULES.length; i++) {
    for (var j = 0; j < SPORT_RULES[i].words.length; j++) {
      if (lower.indexOf(SPORT_RULES[i].words[j]) !== -1) {
        return 'https://loremflickr.com/400/300/' + SPORT_RULES[i].kw + lock
      }
    }
  }
  return 'https://loremflickr.com/400/300/sport' + lock
}

var rows = db.prepare(
  "SELECT product_id, product_name FROM products WHERE product_image LIKE '%ebayimg.com%'"
).all()

console.log('Replacing ' + rows.length + ' eBay image URLs with LoremFlickr...')

var update = db.prepare('UPDATE products SET product_image = ? WHERE product_id = ?')
db.transaction(function() {
  rows.forEach(function(p) {
    var url = loremFlickrFallback(p.product_name.trim(), p.product_id)
    update.run(url, p.product_id)
  })
})()

console.log('Done. ' + rows.length + ' rows updated.')
db.close()
