// Run after completing Docker + DBeaver setup: npm run test:db
// Temporary table and transaction leave your real items table untouched.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import request from 'supertest';
import { pool } from '../src/db.js';
import { createApp } from '../src/app.js';
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const schema = await readFile(new URL('../schema.sql', import.meta.url), 'utf8');
  await client.query(schema.replace('CREATE TABLE IF NOT EXISTS items', 'CREATE TEMP TABLE items'));
  const app = createApp((sql, values) => client.query(sql, values));
  const body = { name: 'Integration Meter', category: 'Electrical', quantity: 2, unit_price: 12.50, location: 'Test', reorder_level: 5 };
  const created = await request(app).post('/items').send(body);
  assert.equal(created.status, 201);
  const id = created.body.id;
  assert.equal(created.body.unit_price, 12.5);
  assert.equal((await request(app).get(`/items/${id}`)).body.name, body.name);
  assert.equal((await request(app).get('/items?low_stock=true')).body.length, 1);
  assert.equal((await request(app).put(`/items/${id}`).send({ ...body, quantity: 10 })).body.quantity, 10);
  assert.equal((await request(app).get('/items?low_stock=true')).body.length, 0);
  assert.equal((await request(app).delete(`/items/${id}`)).status, 204);
  assert.equal((await request(app).get(`/items/${id}`)).status, 404);
  console.log('PASS: real PostgreSQL create, read, update, delete, low-stock query and numeric response.');
} finally {
  await client.query('ROLLBACK');
  client.release();
  await pool.end();
}
