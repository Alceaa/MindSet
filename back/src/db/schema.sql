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

ALTER TABLE sets ADD COLUMN IF NOT EXISTS forbid_copies boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS author_tombstones (
    id           serial PRIMARY KEY,
    login        varchar NOT NULL,
    date_deleted date NOT NULL DEFAULT CURRENT_DATE
);

CREATE UNIQUE INDEX IF NOT EXISTS author_tombstones_login_idx ON author_tombstones (lower(login));

CREATE TABLE IF NOT EXISTS saved_sets (
    id             serial PRIMARY KEY,
    owner_user_id  integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    set_id         integer REFERENCES sets (id) ON DELETE SET NULL,
    source_user_id integer REFERENCES users (id) ON DELETE SET NULL,
    source_login   varchar NOT NULL DEFAULT '',
    source_slug    varchar NOT NULL DEFAULT '',
    title          varchar NOT NULL DEFAULT '',
    description    varchar NOT NULL DEFAULT '',
    content        text NOT NULL DEFAULT '',
    frozen         boolean NOT NULL DEFAULT false,
    frozen_auto    boolean NOT NULL DEFAULT false,
    revoked_at     timestamptz,
    date_saved     date NOT NULL DEFAULT CURRENT_DATE,
    last_update    date NOT NULL DEFAULT CURRENT_DATE
);

CREATE UNIQUE INDEX IF NOT EXISTS saved_sets_owner_set_uq ON saved_sets (owner_user_id, set_id);

CREATE INDEX IF NOT EXISTS saved_sets_owner_idx ON saved_sets (owner_user_id, last_update DESC);
CREATE INDEX IF NOT EXISTS saved_sets_set_idx ON saved_sets (set_id);
CREATE INDEX IF NOT EXISTS saved_sets_owner_source_idx ON saved_sets (owner_user_id, source_login, source_slug);

CREATE INDEX IF NOT EXISTS set_links_from_idx ON set_links (from_set_id);
CREATE INDEX IF NOT EXISTS set_links_target_key_idx ON set_links (target_key);

ALTER TABLE set_links ADD COLUMN IF NOT EXISTS to_set_id integer;
ALTER TABLE set_links ADD COLUMN IF NOT EXISTS target_user_id integer;
ALTER TABLE set_links ADD COLUMN IF NOT EXISTS resolved_once boolean NOT NULL DEFAULT false;

UPDATE set_links l
SET to_set_id = s.id,
    target_user_id = s.user_id,
    resolved_once = true
FROM sets s, sets f
WHERE f.id = l.from_set_id
  AND s.user_id = f.user_id
  AND s.title_key = l.target_key
  AND l.to_set_id IS NULL;

DO $$
BEGIN
    ALTER TABLE set_links
        ADD CONSTRAINT set_links_to_set_id_fkey
        FOREIGN KEY (to_set_id) REFERENCES sets (id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS set_links_to_set_idx ON set_links (to_set_id);

ALTER TABLE set_links ADD COLUMN IF NOT EXISTS target_login varchar NOT NULL DEFAULT '';
ALTER TABLE set_links ADD COLUMN IF NOT EXISTS target_slug varchar NOT NULL DEFAULT '';

UPDATE set_links l
SET target_login = u.login,
    target_slug = s.slug
FROM sets s
JOIN users u ON u.id = s.user_id
WHERE l.to_set_id = s.id
  AND (l.target_login = '' OR l.target_slug = '');

UPDATE set_links l
SET target_login = u.login
FROM sets f
JOIN users u ON u.id = f.user_id
WHERE f.id = l.from_set_id
  AND l.to_set_id IS NULL
  AND l.target_login = ''
  AND NOT l.target_key LIKE '@%';

CREATE INDEX IF NOT EXISTS set_links_target_owner_idx ON set_links (from_set_id, target_login, target_slug);

CREATE TABLE IF NOT EXISTS set_tombstones (
    id             serial PRIMARY KEY,
    set_id         integer NOT NULL UNIQUE,
    deadline       date    NOT NULL,
    forbid_applied boolean NOT NULL DEFAULT false
);

ALTER TABLE set_tombstones ADD COLUMN IF NOT EXISTS owner_user_id integer;

CREATE INDEX IF NOT EXISTS set_tombstones_owner_idx ON set_tombstones (owner_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS set_tombstones_set_id_idx ON set_tombstones (set_id);

ALTER TABLE saved_sets
    ADD COLUMN IF NOT EXISTS tombstone_id integer
    REFERENCES set_tombstones (id) ON DELETE SET NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar varchar NOT NULL DEFAULT '';

ALTER TABLE users ADD COLUMN IF NOT EXISTS token_epoch integer NOT NULL DEFAULT 0;

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS email_tokens (
    id         serial PRIMARY KEY,
    user_id    integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind       varchar NOT NULL,
    token_hash varchar NOT NULL,
    expires_at timestamptz NOT NULL,
    used_at    timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_tokens_hash_idx ON email_tokens (token_hash);
CREATE INDEX IF NOT EXISTS email_tokens_user_kind_idx ON email_tokens (user_id, kind);

ALTER TABLE email_tokens ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;

ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_email boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS pending_registrations (
    id         serial PRIMARY KEY,
    login      varchar NOT NULL,
    email      varchar NOT NULL,
    password   varchar NOT NULL,
    token_hash varchar NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS pending_registrations_login_idx ON pending_registrations (lower(login));
CREATE UNIQUE INDEX IF NOT EXISTS pending_registrations_email_idx ON pending_registrations (lower(email));
CREATE INDEX IF NOT EXISTS pending_registrations_token_idx ON pending_registrations (token_hash);

ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by integer REFERENCES users (id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS invites (
    id         serial PRIMARY KEY,
    token_hash varchar NOT NULL,
    note       varchar NOT NULL DEFAULT '',
    created_by integer REFERENCES users (id) ON DELETE SET NULL,
    used_at    timestamptz,
    used_by    integer REFERENCES users (id) ON DELETE SET NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invites_token_idx ON invites (token_hash);
CREATE INDEX IF NOT EXISTS invites_created_idx ON invites (created_at DESC);

ALTER TABLE pending_registrations ADD COLUMN IF NOT EXISTS invite_id integer REFERENCES invites (id) ON DELETE SET NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS role varchar NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_reason varchar NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_by integer REFERENCES users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);
CREATE INDEX IF NOT EXISTS users_blocked_idx ON users (blocked_at);

CREATE TABLE IF NOT EXISTS news (
    id           serial PRIMARY KEY,
    title        varchar NOT NULL,
    body         text NOT NULL DEFAULT '',
    is_published boolean NOT NULL DEFAULT true,
    author_id    integer REFERENCES users (id) ON DELETE SET NULL,
    published_at timestamptz NOT NULL DEFAULT now(),
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz
);

CREATE INDEX IF NOT EXISTS news_published_idx ON news (published_at DESC);

ALTER TABLE news ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS news_pinned_idx ON news (is_pinned DESC, published_at DESC);

CREATE TABLE IF NOT EXISTS admin_actions (
    id          serial PRIMARY KEY,
    admin_id    integer REFERENCES users (id) ON DELETE SET NULL,
    admin_login varchar NOT NULL DEFAULT '',
    action      varchar NOT NULL,
    target_type varchar NOT NULL,
    target_id   integer,
    details     varchar NOT NULL DEFAULT '',
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_actions_created_idx ON admin_actions (created_at DESC);

CREATE TABLE IF NOT EXISTS bug_reports (
    id         serial PRIMARY KEY,
    user_id    integer REFERENCES users (id) ON DELETE SET NULL,
    login      varchar NOT NULL DEFAULT '',
    page       varchar NOT NULL DEFAULT '',
    topic      varchar NOT NULL,
    message    text NOT NULL,
    status     varchar NOT NULL DEFAULT 'new',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bug_reports_created_idx ON bug_reports (created_at DESC);

DO $$
BEGIN
    IF to_regclass('public.announcements') IS NOT NULL THEN
        INSERT INTO news (title, body, is_published, published_at)
        SELECT a.title, a.body, true, a.date_posted
        FROM announcements a
        WHERE NOT EXISTS (SELECT 1 FROM news);
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM users GROUP BY lower(login) HAVING count(*) > 1) THEN
        RAISE NOTICE 'users_login_lower_idx не создан: есть логины, различающиеся только регистром';
    ELSE
        EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS users_login_lower_idx ON users (lower(login))';
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS follows (
    follower_id   integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    followed_id   integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    date_followed date    NOT NULL DEFAULT CURRENT_DATE,
    PRIMARY KEY (follower_id, followed_id)
);

ALTER TABLE follows DROP CONSTRAINT IF EXISTS follows_not_self_check;

DO $$
BEGIN
    ALTER TABLE follows
        ADD CONSTRAINT follows_not_self_check
        CHECK (follower_id <> followed_id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS follows_followed_idx ON follows (followed_id);
CREATE INDEX IF NOT EXISTS follows_follower_idx ON follows (follower_id);

CREATE TABLE IF NOT EXISTS set_likes (
    set_id     integer NOT NULL REFERENCES sets (id) ON DELETE CASCADE,
    user_id    integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    date_liked timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (set_id, user_id)
);

CREATE INDEX IF NOT EXISTS set_likes_set_idx ON set_likes (set_id);

CREATE TABLE IF NOT EXISTS set_comments (
    id           serial PRIMARY KEY,
    set_id       integer NOT NULL REFERENCES sets (id) ON DELETE CASCADE,
    user_id      integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    body         text NOT NULL,
    date_created timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS set_comments_set_idx ON set_comments (set_id, id);
