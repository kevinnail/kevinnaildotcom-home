-- Use this file to define your SQL tables
-- The SQL in this file will be executed when you run `npm run setup-db`
-- Tables are dropped and recreated on every run, so define DROP TABLE IF EXISTS
-- statements above their CREATE TABLE counterparts as tables are added.

DROP TABLE IF EXISTS photos CASCADE;
DROP TABLE IF EXISTS trips CASCADE;
DROP TABLE IF EXISTS users_admin CASCADE;

CREATE TABLE users_admin (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username      VARCHAR UNIQUE NOT NULL,
  password_hash VARCHAR NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE trips (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL DEFAULT '',
  region      TEXT NOT NULL DEFAULT '',
  url         TEXT NOT NULL,            -- the KML object's public URL
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery     TEXT NOT NULL CHECK (gallery IN ('astro', 'hikes')),
  url         TEXT NOT NULL,
  thumb_url   TEXT,                     -- hikes only; null for astro
  alt         TEXT NOT NULL DEFAULT '',
  caption     TEXT NOT NULL DEFAULT '',
  lat         DOUBLE PRECISION,
  lng         DOUBLE PRECISION,
  taken_at    TIMESTAMPTZ,              -- EXIF capture time; hikes sort key
  trip_id     UUID REFERENCES trips(id) ON DELETE CASCADE,
  sort_order  INTEGER,                  -- astro: hand-curated; hikes: null
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX photos_gallery_sort_idx ON photos (gallery, sort_order);
CREATE INDEX photos_trip_idx ON photos (trip_id);
