const fs = require('fs')
const path = require('path')
const Database = require('better-sqlite3')

const sqlFile = path.join(__dirname, '..', 'Store-1.sql')
const dbFile = path.join(__dirname, '..', 'store.db')

// Remove existing db if present
if (fs.existsSync(dbFile)) {
    fs.unlinkSync(dbFile)
    console.log('Removed existing store.db')
}

console.log('Reading SQL file...')
let sql = fs.readFileSync(sqlFile, 'utf8')

// Normalize Windows line endings to Unix
sql = sql.replace(/\r\n/g, '\n')

console.log('Cleaning MySQL-specific syntax...')

// Remove MySQL conditional comments: /*!40101 ... */;
sql = sql.replace(/\/\*![\s\S]*?\*\/;?/g, '')

// Remove SET statements (MySQL session vars)
sql = sql.replace(/^SET\s+[^;]+;/gim, '')

// Remove LOCK TABLES and UNLOCK TABLES
sql = sql.replace(/^LOCK\s+TABLES\s+[^;]+;/gim, '')
sql = sql.replace(/^UNLOCK\s+TABLES;/gim, '')

// Remove ENGINE=..., DEFAULT CHARSET=..., AUTO_INCREMENT=... table options
// These appear at the end of CREATE TABLE closing lines like: ) ENGINE=InnoDB ...;
sql = sql.replace(/\)\s*ENGINE\s*=\s*\w+[^;]*;/g, ');')

// Remove AUTO_INCREMENT keyword from column definitions (not the table option above)
sql = sql.replace(/\bAUTO_INCREMENT\b/gi, '')

// Remove unsigned keyword (not needed for SQLite)
sql = sql.replace(/\b(int|tinyint|smallint|mediumint|bigint)\((\d+)\)\s+unsigned\b/gi, 'INTEGER')

// Normalize int(N) to INTEGER for SQLite compatibility
sql = sql.replace(/\b(int|tinyint|smallint|mediumint|bigint)\(\d+\)\b/gi, 'INTEGER')

// Normalize varchar(N) — SQLite supports TEXT natively, but varchar(N) also works; leave as-is

// Convert MySQL backslash-escaped single quotes (\') to SQLite-style doubled single quotes ('')
// Must be done before any further processing
sql = sql.replace(/\\'/g, "''")

// Remove trailing commas before closing parenthesis in CREATE TABLE (can happen after removing lines)
sql = sql.replace(/,(\s*\))/g, '$1')

// Remove SQL comment lines
sql = sql.replace(/^--.*$/gm, '')

// Collapse multiple blank lines
sql = sql.replace(/\n{3,}/g, '\n\n')

console.log('Creating SQLite database...')
const db = new Database(dbFile)

// Split into individual statements and execute
const statements = sql
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

let ok = 0
let skipped = 0

db.transaction(() => {
    for (const stmt of statements) {
        try {
            db.exec(stmt + ';')
            ok++
        } catch (err) {
            // Skip statements that error (usually leftover MySQL artifacts)
            skipped++
            if (process.env.VERBOSE) {
                console.warn('Skipped:', stmt.slice(0, 80), '->', err.message)
            }
        }
    }
})()

db.close()

console.log(`Done. ${ok} statements executed, ${skipped} skipped.`)

// Verify tables
const verify = new Database(dbFile, { readonly: true })
const tables = verify.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
console.log('Tables created:', tables.map(t => t.name).join(', '))

for (const { name } of tables) {
    const count = verify.prepare(`SELECT COUNT(*) as n FROM ${name}`).get()
    console.log(`  ${name}: ${count.n} rows`)
}

verify.close()
