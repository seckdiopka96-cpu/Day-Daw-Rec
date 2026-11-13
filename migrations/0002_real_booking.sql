-- DAY DAW REC: core accounts, verified drivers and geolocated rides.
-- Apply once with: npx wrangler d1 migrations apply DB --remote
-- Existing users, drivers, rides and demo tables are preserved.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS drivers (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  vehicle_type TEXT,
  license_plate TEXT,
  is_available INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS rides (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES users(id),
  driver_id TEXT REFERENCES users(id),
  pickup_address TEXT NOT NULL,
  destination_address TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  price INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE drivers ADD COLUMN approved INTEGER NOT NULL DEFAULT 0;
ALTER TABLE drivers ADD COLUMN latitude REAL;
ALTER TABLE drivers ADD COLUMN longitude REAL;
ALTER TABLE drivers ADD COLUMN location_updated_at INTEGER;
ALTER TABLE rides ADD COLUMN pickup_lat REAL;
ALTER TABLE rides ADD COLUMN pickup_lng REAL;
ALTER TABLE rides ADD COLUMN destination_lat REAL;
ALTER TABLE rides ADD COLUMN destination_lng REAL;
ALTER TABLE rides ADD COLUMN category TEXT;
ALTER TABLE rides ADD COLUMN updated_at INTEGER;

CREATE TABLE IF NOT EXISTS ddr_phone_pending (
  phone TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('client','driver')),
  vehicle_type TEXT,
  license_plate TEXT,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS ddr_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS ddr_sms_limits (
  key_hash TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  window_started_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ddr_sessions_user ON ddr_sessions(user_id);
CREATE INDEX IF NOT EXISTS ddr_sessions_expiry ON ddr_sessions(expires_at);
CREATE INDEX IF NOT EXISTS rides_client_created ON rides(client_id, created_at);
CREATE INDEX IF NOT EXISTS rides_driver_created ON rides(driver_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS ddr_client_active ON rides(client_id)
 WHERE status IN ('pending','accepted','arrived','onboard');
CREATE UNIQUE INDEX IF NOT EXISTS ddr_driver_active ON rides(driver_id)
 WHERE driver_id IS NOT NULL AND status IN ('pending','accepted','arrived','onboard');
