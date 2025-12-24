-- Migration number: 0001 	 2025-12-24T05:43:29.724Z

CREATE TABLE notes (
    id           TEXT PRIMARY KEY, 
    title        TEXT NOT NULL,
    content      TEXT NOT NULL,
    is_encrypted  INTEGER NOT NULL DEFAULT 0,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notes_title ON notes (title);