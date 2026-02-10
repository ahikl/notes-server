CREATE TABLE notes
(
	id           TEXT PRIMARY KEY NOT NULL,
	title        TEXT             NOT NULL,
	content      BLOB             NOT NULL,
	iv           BLOB,
	auth_tag     BLOB,
	is_encrypted INTEGER          NOT NULL DEFAULT 1,
	is_deleted   INTEGER          NOT NULL DEFAULT 0,
	created_at   TEXT             NOT NULL,
	updated_at   TEXT             NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_title ON notes (title);
CREATE INDEX IF NOT EXISTS idx_notes_is_deleted ON notes (is_deleted);
CREATE INDEX IF NOT EXISTS idx_notes_is_deleted_updated_at ON notes (is_deleted, updated_at DESC);
