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

// Parse limit/offset query params with defaults and caps
function pagination(query) {
    const limit = Math.min(Math.max(parseInt(query.limit) || 25, 1), 500)
    const offset = Math.max(parseInt(query.offset) || 0, 0)
    return { limit, offset }
}

// Wrap handler to catch sync errors
function wrap(fn) {
    return (req, res, next) => {
        try { fn(req, res, next) } catch (err) { next(err) }
    }
}

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
    const params = []
    if (req.query.category_id) {
        query += ' WHERE product_category_id = ?'
        params.push(req.query.category_id)
    }
    query += ` ORDER BY product_id LIMIT ? OFFSET ?`
    params.push(limit, offset)
    res.json({ data: db.prepare(query).all(...params), limit, offset })
}))

app.get('/products/:id', wrap((req, res) => {
    const row = db.prepare('SELECT * FROM products WHERE product_id = ?').get(req.params.id)
    if (!row) return res.status(404).json({ error: 'Product not found' })
    res.json({ data: row })
}))

// ─── Customers ───────────────────────────────────────────────────────────────

app.get('/customers', wrap((req, res) => {
    const { limit, offset } = pagination(req.query)
    const rows = db.prepare('SELECT * FROM customers ORDER BY customer_id LIMIT ? OFFSET ?').all(limit, offset)
    res.json({ data: rows, limit, offset })
}))

app.get('/customers/:id', wrap((req, res) => {
    const row = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(req.params.id)
    if (!row) return res.status(404).json({ error: 'Customer not found' })
    res.json({ data: row })
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
    const rows = db.prepare(`SELECT * FROM orders ${where} ORDER BY order_id LIMIT ? OFFSET ?`).all(...params, limit, offset)
    res.json({ data: rows, limit, offset })
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

// ─── Error handler ───────────────────────────────────────────────────────────

app.use((err, req, res, next) => {
    console.error(err.message)
    res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
    console.log(`Store API running on port ${PORT}`)
})
