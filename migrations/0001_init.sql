-- DAY DAW REC demonstration rooms. No real customer PII or payments.
CREATE TABLE IF NOT EXISTS ddr_rooms(
 id TEXT PRIMARY KEY,
 invite TEXT NOT NULL UNIQUE,
 created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS ddr_members(
 id TEXT PRIMARY KEY,
 room_id TEXT NOT NULL REFERENCES ddr_rooms(id),
 role TEXT NOT NULL CHECK(role IN ('client','driver')),
 token_hash TEXT NOT NULL UNIQUE,
 online INTEGER NOT NULL DEFAULT 1,
 joined_at INTEGER NOT NULL,
 UNIQUE(room_id,role)
);
CREATE INDEX IF NOT EXISTS ddr_members_room ON ddr_members(room_id);
CREATE TABLE IF NOT EXISTS ddr_rides(
 id TEXT PRIMARY KEY,
 room_id TEXT NOT NULL REFERENCES ddr_rooms(id),
 client_id TEXT NOT NULL,
 driver_id TEXT,
 origin TEXT NOT NULL,
 destination TEXT NOT NULL,
 category TEXT NOT NULL,
 fare INTEGER NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pending','accepted','arrived','onboard','finished','declined','cancelled')),
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ddr_rides_room ON ddr_rides(room_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ddr_single_active_ride ON ddr_rides(room_id)
 WHERE status IN ('pending','accepted','arrived','onboard');
