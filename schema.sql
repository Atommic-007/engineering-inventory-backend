-- Reconnect DBeaver to engineering_inventory before executing this file.
CREATE TABLE IF NOT EXISTS items (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL CHECK (length(trim(name)) > 0),
  category VARCHAR(30) NOT NULL CHECK (category IN ('Electrical', 'Measurement', 'Safety', 'Mechanical')),
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  location VARCHAR(60) NOT NULL CHECK (length(trim(location)) > 0),
  reorder_level INTEGER NOT NULL DEFAULT 5 CHECK (reorder_level >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
