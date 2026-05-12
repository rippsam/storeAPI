const express = require('express')
const Database = require('better-sqlite3')
const path = require('path')

const app = express()
const PORT = process.env.PORT || 3000
const DB_PATH = path.join(__dirname, '..', 'store.db')

app.use('/images', express.static(path.join(__dirname, '../Memes')))

// Allow requests from any origin (needed for the frontend website)
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET')
    next()
})

const db = new Database(DB_PATH, { readonly: true })

// Cache record counts at startup — DB is read-only so these never change
const COUNTS = {
    departments: db.prepare('SELECT COUNT(*) as n FROM departments').get().n,
    categories:  db.prepare('SELECT COUNT(*) as n FROM categories').get().n,
    products:    db.prepare('SELECT COUNT(*) as n FROM products').get().n,
    customers:   db.prepare('SELECT COUNT(*) as n FROM customers').get().n,
    orders:      db.prepare('SELECT COUNT(*) as n FROM orders').get().n,
}

// Parse limit/offset query params with defaults and caps
function pagination(query) {
    const rawLimit  = Number(query.limit)
    const rawOffset = Number(query.offset)
    const limit  = Math.min(Math.max(Number.isInteger(rawLimit)  && rawLimit  > 0 ? rawLimit  : 25, 1), 500)
    const offset = Number.isInteger(rawOffset) && rawOffset >= 0 ? rawOffset : 0
    return { limit, offset }
}

// Wrap handler to catch sync errors
function wrap(fn) {
    return (req, res, next) => {
        try { fn(req, res, next) } catch (err) { next(err) }
    }
}

// ─── Root ────────────────────────────────────────────────────────────────────

app.get('/', wrap((req, res) => {
    res.json({
        name: 'Store API',
        description: 'Read-only REST API for a sports retail store',
        base_url: 'https://storeapi-60py.onrender.com',
        counts: COUNTS,
        endpoints: [
            'GET /',
            'GET /departments',
            'GET /departments/:id',
            'GET /departments/:id/categories',
            'GET /categories',
            'GET /categories/:id',
            'GET /products',
            'GET /products/search',
            'GET /products/:id',
            'GET /products/:id/images',
            'GET /customers',
            'GET /customers/:id',
            'GET /customers/:id/orders',
            'GET /orders',
            'GET /orders/:id',
            'GET /orders/:id/items',
        ]
    })
}))

// ─── Departments ─────────────────────────────────────────────────────────────

app.get('/departments', wrap((req, res) => {
    const rows = db.prepare('SELECT * FROM departments ORDER BY department_id').all()
    res.json({ data: rows })
}))

app.get('/departments/:id', wrap((req, res) => {
    const row = db.prepare('SELECT * FROM departments WHERE department_id = ?').get(req.params.id)
    if (!row) return res.status(404).json({ error: 'Department not found' })
    res.json({ data: row })
}))

app.get('/departments/:id/categories', wrap((req, res) => {
    const dept = db.prepare('SELECT department_id FROM departments WHERE department_id = ?').get(req.params.id)
    if (!dept) return res.status(404).json({ error: 'Department not found' })
    const rows = db.prepare('SELECT * FROM categories WHERE category_department_id = ? ORDER BY category_id').all(req.params.id)
    res.json({ data: rows })
}))

// ─── Categories ──────────────────────────────────────────────────────────────

app.get('/categories', wrap((req, res) => {
    let query = 'SELECT * FROM categories'
    const params = []
    if (req.query.department_id) {
        query += ' WHERE category_department_id = ?'
        params.push(req.query.department_id)
    }
    query += ' ORDER BY category_id'
    res.json({ data: db.prepare(query).all(...params) })
}))

app.get('/categories/:id', wrap((req, res) => {
    const row = db.prepare('SELECT * FROM categories WHERE category_id = ?').get(req.params.id)
    if (!row) return res.status(404).json({ error: 'Category not found' })
    res.json({ data: row })
}))

// ─── Products ────────────────────────────────────────────────────────────────

app.get('/products', wrap((req, res) => {
    const { limit, offset } = pagination(req.query)
    let query = 'SELECT * FROM products'
    let countQuery = 'SELECT COUNT(*) as total FROM products'
    const params = []
    const countParams = []
    if (req.query.category_id) {
        query += ' WHERE product_category_id = ?'
        countQuery += ' WHERE product_category_id = ?'
        params.push(req.query.category_id)
        countParams.push(req.query.category_id)
    }
    query += ' ORDER BY product_id LIMIT ? OFFSET ?'
    params.push(limit, offset)
    const total = db.prepare(countQuery).get(...countParams).total
    res.json({ data: db.prepare(query).all(...params), total, limit, offset })
}))

app.get('/products/search', wrap((req, res) => {
    const q = (req.query.q || '').trim()
    const { limit, offset } = pagination(req.query)
    if (!q) return res.json({ data: [], total: 0, limit, offset })
    const term = `%${q}%`
    const total = db.prepare('SELECT COUNT(*) as total FROM products WHERE product_name LIKE ?').get(term).total
    const rows = db.prepare(
        'SELECT * FROM products WHERE product_name LIKE ? ORDER BY product_id LIMIT ? OFFSET ?'
    ).all(term, limit, offset)
    res.json({ data: rows, total, limit, offset })
}))

app.get('/products/:id', wrap((req, res) => {
    const row = db.prepare('SELECT * FROM products WHERE product_id = ?').get(req.params.id)
    if (!row) return res.status(404).json({ error: 'Product not found' })
    res.json({ data: row })
}))

app.get('/products/:id/images', wrap((req, res) => {
    const product = db.prepare('SELECT product_id FROM products WHERE product_id = ?').get(req.params.id)
    if (!product) return res.status(404).json({ error: 'Product not found' })
    const rows = db.prepare('SELECT image_url FROM product_images WHERE product_id = ? ORDER BY sort_order').all(req.params.id)
    res.json({ data: rows.map(function(r) { return r.image_url }) })
}))

// ─── Customers ───────────────────────────────────────────────────────────────

app.get('/customers', wrap((req, res) => {
    const { limit, offset } = pagination(req.query)
    const total = db.prepare('SELECT COUNT(*) as total FROM customers').get().total
    const rows = db.prepare('SELECT customer_id, customer_fname, customer_lname, customer_email, customer_street, customer_city, customer_state, customer_zipcode FROM customers ORDER BY customer_id LIMIT ? OFFSET ?').all(limit, offset)
    res.json({ data: rows, total, limit, offset })
}))

app.get('/customers/:id', wrap((req, res) => {
    const row = db.prepare('SELECT customer_id, customer_fname, customer_lname, customer_email, customer_street, customer_city, customer_state, customer_zipcode FROM customers WHERE customer_id = ?').get(req.params.id)
    if (!row) return res.status(404).json({ error: 'Customer not found' })
    res.json({ data: row })
}))

app.get('/customers/:id/orders', wrap((req, res) => {
    const customer = db.prepare('SELECT customer_id FROM customers WHERE customer_id = ?').get(req.params.id)
    if (!customer) return res.status(404).json({ error: 'Customer not found' })
    const { limit, offset } = pagination(req.query)
    const total = db.prepare('SELECT COUNT(*) as total FROM orders WHERE order_customer_id = ?').get(req.params.id).total
    const rows = db.prepare('SELECT * FROM orders WHERE order_customer_id = ? ORDER BY order_id LIMIT ? OFFSET ?').all(req.params.id, limit, offset)
    res.json({ data: rows, total, limit, offset })
}))

// ─── Orders ──────────────────────────────────────────────────────────────────

app.get('/orders', wrap((req, res) => {
    const { limit, offset } = pagination(req.query)
    const conditions = []
    const params = []

    if (req.query.customer_id) {
        conditions.push('order_customer_id = ?')
        params.push(req.query.customer_id)
    }
    if (req.query.status) {
        conditions.push('order_status = ?')
        params.push(req.query.status.toUpperCase())
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''
    const total = db.prepare(`SELECT COUNT(*) as total FROM orders ${where}`).get(...params).total
    const rows = db.prepare(`SELECT * FROM orders ${where} ORDER BY order_id LIMIT ? OFFSET ?`).all(...params, limit, offset)
    res.json({ data: rows, total, limit, offset })
}))

app.get('/orders/:id', wrap((req, res) => {
    const row = db.prepare('SELECT * FROM orders WHERE order_id = ?').get(req.params.id)
    if (!row) return res.status(404).json({ error: 'Order not found' })
    res.json({ data: row })
}))

app.get('/orders/:id/items', wrap((req, res) => {
    const order = db.prepare('SELECT order_id FROM orders WHERE order_id = ?').get(req.params.id)
    if (!order) return res.status(404).json({ error: 'Order not found' })
    const rows = db.prepare('SELECT * FROM order_items WHERE order_item_order_id = ? ORDER BY order_item_id').all(req.params.id)
    res.json({ data: rows })
}))

// ─── 404 handler ─────────────────────────────────────────────────────────────

app.use((req, res) => {
    res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` })
})

// ─── Error handler ───────────────────────────────────────────────────────────

app.use((err, req, res, next) => {
    console.error(err.message)
    res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
    console.log(`Store API running on port ${PORT}`)
})
