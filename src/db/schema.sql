CREATE TABLE IF NOT EXISTS users (
    id          serial PRIMARY KEY,
    login       varchar NOT NULL UNIQUE,
    email       varchar NOT NULL UNIQUE,
    password    varchar NOT NULL,
    bio         text,
    date_joined date DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS sets (
    id            serial PRIMARY KEY,
    user_id       integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title         varchar NOT NULL,
    title_key     varchar NOT NULL,
    slug          varchar NOT NULL DEFAULT '',
    visibility    varchar NOT NULL DEFAULT 'private',
    description   varchar,
    content       text NOT NULL DEFAULT '',
    date_created  date NOT NULL DEFAULT CURRENT_DATE,
    last_activity date NOT NULL DEFAULT CURRENT_DATE
);

ALTER TABLE sets ADD COLUMN IF NOT EXISTS user_id integer;
ALTER TABLE sets ADD COLUMN IF NOT EXISTS content text NOT NULL DEFAULT '';
ALTER TABLE sets ADD COLUMN IF NOT EXISTS description varchar;
ALTER TABLE sets ADD COLUMN IF NOT EXISTS slug varchar NOT NULL DEFAULT '';
ALTER TABLE sets ADD COLUMN IF NOT EXISTS visibility varchar NOT NULL DEFAULT 'private';

UPDATE sets SET visibility = 'private' WHERE visibility IS NULL;
UPDATE sets SET slug = 'set-' || id WHERE slug IS NULL OR slug = '';

DO $$
BEGIN
    ALTER TABLE sets
        ADD CONSTRAINT sets_visibility_check
        CHECK (visibility IN ('private', 'unlisted', 'public'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

UPDATE sets SET content = '' WHERE content IS NULL;

DELETE FROM sets WHERE user_id IS NULL;

ALTER TABLE sets ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE sets ALTER COLUMN content SET NOT NULL;

DO $$
BEGIN
    ALTER TABLE sets
        ADD CONSTRAINT sets_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS sets_user_id_idx ON sets (user_id);
CREATE INDEX IF NOT EXISTS sets_last_activity_idx ON sets (user_id, last_activity DESC);

ALTER TABLE sets ADD COLUMN IF NOT EXISTS title_key varchar;

UPDATE sets
SET title_key = btrim(regexp_replace(lower(title), '\s+', ' ', 'g'))
WHERE title_key IS NULL OR title_key = '';

UPDATE sets s
SET title_key = s.title_key || '-' || s.id
WHERE s.id IN (
    SELECT id FROM (
        SELECT id, row_number() OVER (PARTITION BY user_id, title_key ORDER BY id) AS position
        FROM sets
    ) duplicates
    WHERE duplicates.position > 1
);

ALTER TABLE sets ALTER COLUMN title_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sets_user_title_key_idx ON sets (user_id, title_key);
CREATE UNIQUE INDEX IF NOT EXISTS sets_slug_idx ON sets (slug);
CREATE INDEX IF NOT EXISTS sets_visibility_idx ON sets (visibility);

CREATE TABLE IF NOT EXISTS set_links (
    id          serial PRIMARY KEY,
    from_set_id integer NOT NULL REFERENCES sets (id) ON DELETE CASCADE,
    target_key  varchar NOT NULL,
    label       varchar NOT NULL,
    alias       varchar NOT NULL DEFAULT '',
    UNIQUE (from_set_id, target_key)
);

CREATE INDEX IF NOT EXISTS set_links_from_idx ON set_links (from_set_id);
CREATE INDEX IF NOT EXISTS set_links_target_key_idx ON set_links (target_key);

