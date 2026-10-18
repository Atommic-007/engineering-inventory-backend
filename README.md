# Engineering Inventory Backend
Express + TypeScript + pg.Pool. Reference: T14–T16 course slides.

Create the local PostgreSQL Docker database `engineering_inventory` in DBeaver,
then run `schema.sql` in that database. Copy `.env.example` to `.env` and set the
matching password. Run `npm install`, then `npm run dev`.

- `GET /health`: database readiness.
- `GET /items`: newest first; optional `search`, `category`, `low_stock=true|false`.
- `GET /items/:id`: a single item.
- `POST /items`: create; 201 response.
- `PUT /items/:id`: replace all six editable fields; 200 response.
- `DELETE /items/:id`: delete; 204 with no response body.

POST/PUT JSON fields: `name`, `category`, `quantity`, `unit_price`, `location`,
`reorder_level`. ID and created_at are database-generated. Valid categories:
Electrical, Measurement, Safety, Mechanical. Quantities and reorder levels are
nonnegative integers; unit_price is a nonnegative number with <=2 decimal places.
Required strings cannot be blank. Unknown body/query fields are rejected.

HTTP errors: 400 invalid input/JSON; 404 missing item/route; 413 body too large;
500 unexpected server/database error. See source for exact numeric/string limits.

Run `npm run check`, `npm test`, `npm run build`. With local Docker ready, run
`npm run test:db` to execute a rolled-back temporary-table integration check.
Tests in `npm test` use an injected database stub.

Frontend origin defaults to http://localhost:5173; API port defaults to 3000.
Keep .env private and include .env.example in GitHub.
