require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS errors (
      id SERIAL PRIMARY KEY,
      error_date DATE NOT NULL,
      error_type VARCHAR(150) NOT NULL,
      error_value NUMERIC(12, 2) DEFAULT 0,
      description TEXT NOT NULL,
      worker VARCHAR(150) NOT NULL,
      note TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS workers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(150) UNIQUE NOT NULL
    );
  `);
  console.log('Database ready');
}

// ── Грешки ──────────────────────────────────────────────────────────────────

app.get('/api/errors', async (req, res) => {
  const { from, to, worker } = req.query;
  let query = 'SELECT * FROM errors WHERE 1=1';
  const params = [];

  if (from) { params.push(from); query += ` AND error_date >= $${params.length}`; }
  if (to)   { params.push(to);   query += ` AND error_date <= $${params.length}`; }
  if (worker && worker !== 'all') {
    params.push(worker);
    query += ` AND worker ILIKE $${params.length}`;
  }

  query += ' ORDER BY error_date DESC, created_at DESC';
  const { rows } = await pool.query(query, params);
  res.json(rows);
});

app.post('/api/errors', async (req, res) => {
  const { error_date, error_type, error_value, description, worker, note } = req.body;
  if (!error_date || !error_type || !description || !worker) {
    return res.status(400).json({ error: 'Попълнете всички задължителни полета' });
  }
  const { rows } = await pool.query(
    `INSERT INTO errors (error_date, error_type, error_value, description, worker, note)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [error_date, error_type, error_value || 0, description, worker, note || '']
  );
  // auto-add worker
  await pool.query(
    `INSERT INTO workers (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
    [worker]
  );
  res.json(rows[0]);
});

app.delete('/api/errors/:id', async (req, res) => {
  await pool.query('DELETE FROM errors WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ── Работници ───────────────────────────────────────────────────────────────

app.get('/api/workers', async (req, res) => {
  const { rows } = await pool.query('SELECT name FROM workers ORDER BY name');
  res.json(rows.map(r => r.name));
});

app.post('/api/workers', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Въведете име' });
  await pool.query(`INSERT INTO workers (name) VALUES ($1) ON CONFLICT DO NOTHING`, [name]);
  res.json({ ok: true });
});

// ── Статистики ───────────────────────────────────────────────────────────────

app.get('/api/stats', async (req, res) => {
  const { from, to, worker } = req.query;
  let where = '1=1';
  const params = [];
  if (from)   { params.push(from);   where += ` AND error_date >= $${params.length}`; }
  if (to)     { params.push(to);     where += ` AND error_date <= $${params.length}`; }
  if (worker && worker !== 'all') {
    params.push(worker);
    where += ` AND worker ILIKE $${params.length}`;
  }

  const [summary, byType, byWorker, byMonth] = await Promise.all([
    pool.query(`SELECT COUNT(*) as total, COALESCE(SUM(error_value),0) as total_value FROM errors WHERE ${where}`, params),
    pool.query(`SELECT error_type, COUNT(*) as cnt, COALESCE(SUM(error_value),0) as val FROM errors WHERE ${where} GROUP BY error_type ORDER BY cnt DESC`, params),
    pool.query(`SELECT worker, COUNT(*) as cnt, COALESCE(SUM(error_value),0) as val FROM errors WHERE ${where} GROUP BY worker ORDER BY cnt DESC`, params),
    pool.query(`SELECT TO_CHAR(error_date,'YYYY-MM') as month, COUNT(*) as cnt, COALESCE(SUM(error_value),0) as val FROM errors WHERE ${where} GROUP BY month ORDER BY month`, params),
  ]);

  res.json({
    summary: summary.rows[0],
    byType: byType.rows,
    byWorker: byWorker.rows,
    byMonth: byMonth.rows,
  });
});

initDB()
  .then(() => app.listen(PORT, () => console.log(`Server running on port ${PORT}`)))
  .catch(err => { console.error('DB init failed', err); process.exit(1); });
