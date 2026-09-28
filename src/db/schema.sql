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
    description   varchar,
    content       text NOT NULL DEFAULT '',
    date_created  date NOT NULL DEFAULT CURRENT_DATE,
    last_activity date NOT NULL DEFAULT CURRENT_DATE
);

ALTER TABLE sets ADD COLUMN IF NOT EXISTS user_id integer;
ALTER TABLE sets ADD COLUMN IF NOT EXISTS content text NOT NULL DEFAULT '';
ALTER TABLE sets ADD COLUMN IF NOT EXISTS description varchar;

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

