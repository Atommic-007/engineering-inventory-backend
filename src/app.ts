import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import cors from 'cors';
import { categories, parseId, validateItem } from './validation.js';

// An injected query function keeps HTTP error tests independent of a real database.
export type Query = (sql: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
const columns = 'id, name, category, quantity, unit_price::float8 AS unit_price, location, reorder_level, created_at';
const asyncRoute = (handler: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

export function createApp(query: Query) {
  const app = express();
  app.use(cors({ origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173' }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', asyncRoute(async (_req, res) => {
    await query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  }));

  app.get('/items', asyncRoute(async (req, res) => {
    if (Object.keys(req.query).some((key) => !['search', 'category', 'low_stock'].includes(key))) {
      res.status(400).json({ error: 'Unknown query parameter.' }); return;
    }
    const { search, category, low_stock } = req.query;
    if (search !== undefined && (typeof search !== 'string' || !search.trim() || search.trim().length > 100)) {
      res.status(400).json({ error: 'search must be non-empty text of at most 100 characters.' }); return;
    }
    if (category !== undefined && (typeof category !== 'string' || !categories.includes(category as typeof categories[number]))) {
      res.status(400).json({ error: 'Invalid category filter.' }); return;
    }
    if (low_stock !== undefined && low_stock !== 'true' && low_stock !== 'false') {
      res.status(400).json({ error: 'low_stock must be true or false.' }); return;
    }
    const clauses: string[] = [];
    const values: unknown[] = [];
    if (typeof search === 'string') {
      // strpos treats user text literally (including % and _); parameters prevent SQL injection.
      values.push(search.trim());
      clauses.push(`(strpos(lower(name), lower($${values.length})) > 0 OR strpos(lower(location), lower($${values.length})) > 0)`);
    }
    if (category) { values.push(category); clauses.push(`category = $${values.length}`); }
    if (low_stock === 'true') clauses.push('quantity <= reorder_level');
    const where = clauses.length ? ' WHERE ' + clauses.join(' AND ') : '';
    const result = await query(`SELECT ${columns} FROM items${where} ORDER BY created_at DESC, id DESC`, values);
    res.json(result.rows);
  }));

  app.param('id', (req, res, next, value: string) => {
    if (parseId(value) === null) { res.status(400).json({ error: 'ID must be a positive integer up to 2147483647.' }); return; }
    next();
  });
  app.get('/items/:id', asyncRoute(async (req, res) => {
    const result = await query(`SELECT ${columns} FROM items WHERE id = $1`, [Number(req.params.id)]);
    if (!result.rows.length) { res.status(404).json({ error: 'Item not found.' }); return; }
    res.json(result.rows[0]);
  }));
  app.post('/items', asyncRoute(async (req, res) => {
    const { data, error } = validateItem(req.body);
    if (!data) { res.status(400).json({ error }); return; }
    const result = await query(`INSERT INTO items (name, category, quantity, unit_price, location, reorder_level)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${columns}`,
      [data.name, data.category, data.quantity, data.unit_price, data.location, data.reorder_level]);
    res.status(201).json(result.rows[0]);
  }));
  // PUT replaces every editable field; all six fields are required.
  app.put('/items/:id', asyncRoute(async (req, res) => {
    const { data, error } = validateItem(req.body);
    if (!data) { res.status(400).json({ error }); return; }
    const result = await query(`UPDATE items SET name=$1, category=$2, quantity=$3, unit_price=$4,
      location=$5, reorder_level=$6 WHERE id=$7 RETURNING ${columns}`,
      [data.name, data.category, data.quantity, data.unit_price, data.location, data.reorder_level, Number(req.params.id)]);
    if (!result.rows.length) { res.status(404).json({ error: 'Item not found.' }); return; }
    res.json(result.rows[0]);
  }));
  app.delete('/items/:id', asyncRoute(async (req, res) => {
    const result = await query('DELETE FROM items WHERE id=$1 RETURNING id', [Number(req.params.id)]);
    if (!result.rows.length) { res.status(404).json({ error: 'Item not found.' }); return; }
    res.status(204).send();
  }));
  app.use((_req, res) => { res.status(404).json({ error: 'Route not found.' }); });
  const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error.type === 'entity.parse.failed') { res.status(400).json({ error: 'Invalid JSON body.' }); return; }
    if (error.type === 'entity.too.large') { res.status(413).json({ error: 'Request body is too large.' }); return; }
    console.error('Request failed:', error.message);
    res.status(500).json({ error: 'Server or database error. Please try again.' });
  };
  app.use(handleError);
  return app;
}
