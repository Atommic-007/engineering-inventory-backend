import 'dotenv/config';
import { pool } from './db.js';
import { createApp } from './app.js';

const app = createApp((sql, values) => pool.query(sql, values));
const port = Number(process.env.PORT ?? 3000);
try {
  await pool.query('SELECT 1');
  const server = app.listen(port, () => console.log(`Inventory API: http://localhost:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => { server.close(() => { void pool.end().then(() => process.exit(0)); }); });
  }
} catch (error) {
  console.error('Cannot connect to local PostgreSQL. Check Docker, DBeaver setup and .env.', error);
  await pool.end();
  process.exitCode = 1;
}
