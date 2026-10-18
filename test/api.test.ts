import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp, type Query } from '../src/app.js';
import { parseId, validateItem } from '../src/validation.js';
const valid = { name: 'Meter', category: 'Electrical', quantity: 3, unit_price: 1500.25, location: 'A1', reorder_level: 5 };
test('IDs reject zero, negatives, decimals, text and overflowing integers', () => {
  for (const id of ['0','-1','1.5','abc','1e2','2147483648','99999999999999999999','01']) assert.equal(parseId(id), null);
  assert.equal(parseId('1'), 1);
});
test('required fields, types, ranges, whitespace, decimal precision and unknown fields', () => {
  assert.ok(validateItem(valid).data);
  assert.equal(validateItem({ ...valid, name: ' Meter ' }).data?.name, 'Meter');
  const invalid: unknown[] = [null, [], 'hello', {},
    ...Object.keys(valid).map(key => { const b = { ...valid } as Record<string, unknown>; delete b[key]; return b; }),
    ...['', '   ', 42, false, 'a'.repeat(101)].map(name => ({ ...valid, name })),
    ...['', '   ', 42, 'a'.repeat(61)].map(location => ({ ...valid, location })),
    ...['Other', '', 1, null].map(category => ({ ...valid, category })),
    ...[-1, 1.5, '3', false, null, 2147483648].map(quantity => ({ ...valid, quantity })),
    ...[-1, 1.5, '3', false, null].map(reorder_level => ({ ...valid, reorder_level })),
    ...[-1, 0.001, '1', null, false, Infinity, NaN, 100000000].map(unit_price => ({ ...valid, unit_price })),
    { ...valid, id: 1 }];
  for (const b of invalid) assert.ok(validateItem(b).error, JSON.stringify(b));
  assert.ok(validateItem({ ...valid, quantity: 0, reorder_level: 0, unit_price: 0 }).data);
});
test('invalid requests are rejected before hitting PostgreSQL', async () => {
  let calls = 0;
  const app = createApp(async () => { calls++; return { rows: [] }; });
  for (const path of ['/items/0','/items/-1','/items/text','/items?search=','/items?category=','/items?low_stock=-1','/items?low_stock=','/items?search=x&search=y','/items?unknown=1']) {
    assert.equal((await request(app).get(path)).status, 400, path);
  }
  assert.equal((await request(app).post('/items').send({ ...valid, quantity: -1 })).status, 400);
  assert.equal((await request(app).put('/items/1').send({})).status, 400);
  assert.equal((await request(app).post('/items').set('Content-Type','application/json').send('{bad')).status, 400);
  assert.equal(calls, 0);
});
test('CRUD success codes and parameterized input', async () => {
  const calls: { sql: string; values?: unknown[] }[] = [];
  const query: Query = async (sql, values) => {
    calls.push({ sql, values });
    return { rows: [{ ...valid, id: 1, created_at: '2026-10-15T00:00:00Z' }] };
  };
  const app = createApp(query);
  assert.equal((await request(app).get('/items')).status, 200);
  assert.equal((await request(app).get('/items/1')).status, 200);
  const maliciousName = "Meter'); DROP TABLE items;--";
  assert.equal((await request(app).post('/items').send({ ...valid, name: maliciousName })).status, 201);
  assert.equal(calls.at(-1)?.values?.[0], maliciousName);
  assert.ok(!calls.at(-1)?.sql.includes(maliciousName));
  assert.equal((await request(app).put('/items/1').send(valid)).status, 200);
  assert.equal(calls.at(-1)?.values?.[6], 1);
  assert.equal((await request(app).delete('/items/1')).status, 204);
  assert.equal((await request(app).get('/items?search=Meter&category=Electrical&low_stock=true')).status, 200);
  assert.deepEqual(calls.at(-1)?.values, ['Meter', 'Electrical']);
});
test('missing records return 404; database errors return safe 500 JSON', async () => {
  const empty = createApp(async () => ({ rows: [] }));
  assert.equal((await request(empty).get('/items/999')).status, 404);
  assert.equal((await request(empty).put('/items/999').send(valid)).status, 404);
  assert.equal((await request(empty).delete('/items/999')).status, 404);
  const broken = createApp(async () => { throw new Error('private database detail'); });
  for (const [method, path] of [['get','/items'],['post','/items'],['put','/items/1'],['delete','/items/1']] as const) {
    const result = await request(broken)[method](path).send(valid);
    assert.equal(result.status, 500);
    assert.ok(!JSON.stringify(result.body).includes('private database detail'));
  }
  const cors = await request(empty).options('/items').set('Origin','http://localhost:5173').set('Access-Control-Request-Method','POST');
  assert.equal(cors.headers['access-control-allow-origin'], 'http://localhost:5173');
});
