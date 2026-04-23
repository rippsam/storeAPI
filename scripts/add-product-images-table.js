const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://storeapi-60py.onrender.com/images';
const db = new Database(path.join(__dirname, '../store.db'));
const memesDir = path.join(__dirname, '../Memes');

db.prepare(`CREATE TABLE IF NOT EXISTS product_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
)`).run();

db.prepare('DELETE FROM product_images').run();

const allFiles = fs.readdirSync(memesDir).filter(function(f) { return f.endsWith('.png'); });

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

// Build pool: first pass uses every image once, second pass fills remaining slots
const pool = shuffle(allFiles).concat(shuffle(allFiles));

const products = db.prepare('SELECT product_id FROM products ORDER BY product_id').all();

// Build count list: equal thirds of 1, 2, 3 — then shuffle so distribution is random across products
const counts = products.map(function(_, i) {
  if (i < Math.floor(products.length / 3)) return 1;
  if (i < Math.floor(products.length * 2 / 3)) return 2;
  return 3;
});
const shuffledCounts = shuffle(counts);

const insert = db.prepare('INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?, ?, ?)');
let poolIdx = 0;

const insertAll = db.transaction(function() {
  products.forEach(function(p, i) {
    const count = shuffledCounts[i];
    for (let s = 0; s < count; s++) {
      insert.run(p.product_id, `${BASE_URL}/${pool[poolIdx % pool.length]}`, s);
      poolIdx++;
    }
  });
});
insertAll();

console.log(`Populated product_images for ${products.length} products (${poolIdx} total image rows).`);
db.close();
