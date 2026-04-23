const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://storeapi-60py.onrender.com/images';
const db = new Database(path.join(__dirname, '../store.db'));
const memesDir = path.join(__dirname, '../Memes');

const images = fs.readdirSync(memesDir).filter(function(f) { return f.endsWith('.png'); });

// Fisher-Yates shuffle
for (let i = images.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  const tmp = images[i];
  images[i] = images[j];
  images[j] = tmp;
}

const products = db.prepare('SELECT product_id FROM products').all();
const update = db.prepare('UPDATE products SET product_image = ? WHERE product_id = ?');

products.forEach(function(p, i) {
  update.run(`${BASE_URL}/${images[i % images.length]}`, p.product_id);
});

console.log(`Assigned images to ${products.length} products.`);
db.close();
