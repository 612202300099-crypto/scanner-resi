-- Migration: desty_counts cache table
CREATE TABLE IF NOT EXISTS desty_counts (
    id INTEGER PRIMARY KEY DEFAULT 1,
    ready_to_ship INTEGER DEFAULT 0,
    processed INTEGER DEFAULT 0,
    to_process INTEGER DEFAULT 0,
    in_delivery INTEGER DEFAULT 0,
    delivered INTEGER DEFAULT 0,
    shipping INTEGER DEFAULT 0,
    unpaid INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE desty_counts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON desty_counts;
CREATE POLICY "Allow all" ON desty_counts FOR ALL USING (true);

INSERT INTO desty_counts (id, ready_to_ship, processed, to_process, in_delivery, delivered, shipping, unpaid)
VALUES (1, 199, 199, 0, 353, 1843, 2196, 6)
ON CONFLICT (id) DO UPDATE SET
  ready_to_ship = 199, processed = 199, to_process = 0,
  in_delivery = 353, delivered = 1843, shipping = 2196, unpaid = 6,
  updated_at = NOW();
