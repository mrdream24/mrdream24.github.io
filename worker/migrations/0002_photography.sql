CREATE TABLE IF NOT EXISTS photography_photos (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  public_id TEXT NOT NULL UNIQUE,
  asset_id TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 0,
  width INTEGER NOT NULL DEFAULT 0,
  height INTEGER NOT NULL DEFAULT 0,
  format TEXT NOT NULL DEFAULT 'jpg',
  bytes INTEGER NOT NULL DEFAULT 0,
  exif_json TEXT NOT NULL DEFAULT '{}',
  published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_photography_published_date
  ON photography_photos (published, date DESC, created_at DESC);
