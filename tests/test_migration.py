"""Smoke-test SQL migrations on both a fresh database and the already-created D1 tables."""
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = [ROOT / "migrations/0001_init.sql", ROOT / "migrations/0002_real_booking.sql"]
EXISTING = """
CREATE TABLE users (
 id TEXT PRIMARY KEY, full_name TEXT NOT NULL, phone TEXT UNIQUE NOT NULL,
 role TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE drivers (
 user_id TEXT PRIMARY KEY, vehicle_type TEXT, license_plate TEXT,
 is_available INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE TABLE rides (
 id TEXT PRIMARY KEY, client_id TEXT NOT NULL, driver_id TEXT,
 pickup_address TEXT NOT NULL, destination_address TEXT NOT NULL,
 status TEXT DEFAULT 'pending', price INTEGER,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (client_id) REFERENCES users(id),
 FOREIGN KEY (driver_id) REFERENCES users(id)
);
CREATE TABLE ddr_rooms (
 id TEXT PRIMARY KEY, invite TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL
);
CREATE TABLE ddr_members (
 id TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES ddr_rooms(id),
 role TEXT NOT NULL CHECK(role IN ('client','driver')),
 token_hash TEXT NOT NULL UNIQUE,
 online INTEGER NOT NULL DEFAULT 1,
 joined_at INTEGER NOT NULL,
 UNIQUE(room_id,role)
);
"""

for label, existing in [("fresh", ""), ("existing", EXISTING)]:
    with sqlite3.connect(":memory:") as conn:
        conn.executescript("PRAGMA foreign_keys=ON;" + existing)
        for migration in MIGRATIONS:
            conn.executescript(migration.read_text(encoding="utf-8"))
        def cols(table):
            return {row[1] for row in conn.execute(f"PRAGMA table_info({table})")}
        assert {"id", "phone", "role"}.issubset(cols("users"))
        assert {"approved", "latitude", "longitude", "location_updated_at"}.issubset(cols("drivers"))
        assert {"destination_lat", "pickup_lng", "updated_at"}.issubset(cols("rides"))
        assert {"token_hash", "expires_at"}.issubset(cols("ddr_sessions"))
        assert "ddr_phone_pending" in {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        conn.execute("INSERT INTO users(id,full_name,phone,role) VALUES(?,?,?,?)", ("client","Client Test","+221770000000","client"))
        conn.execute("INSERT INTO users(id,full_name,phone,role) VALUES(?,?,?,?)", ("driver","Driver Test","+221770000001","driver"))
        conn.execute("INSERT INTO drivers(user_id,vehicle_type,license_plate,approved) VALUES(?,?,?,0)", ("driver","Voiture","TEST 100"))
        conn.execute("INSERT INTO rides(id,client_id,driver_id,pickup_address,destination_address,status,price,category,updated_at,pickup_lat,pickup_lng,destination_lat,destination_lng) VALUES(?,?,?,?,?,'pending',?,?,?,?,?,?,?)",
                     ("ride","client","driver","Dakar","Pikine",2500,"Standard",1,14.7,-17.4,14.75,-17.39))
        assert conn.execute("SELECT count(*) FROM rides").fetchone()[0] == 1
    print(f"Migration check passed: {label}")
