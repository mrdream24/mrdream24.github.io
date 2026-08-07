CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  images_json TEXT NOT NULL DEFAULT '[]',
  archive_path TEXT,
  archive_status TEXT NOT NULL DEFAULT 'pending',
  published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_published_date
  ON notes (published, date DESC);

CREATE INDEX IF NOT EXISTS idx_notes_archive_status
  ON notes (archive_status);
