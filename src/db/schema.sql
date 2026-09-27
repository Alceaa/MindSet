-- Схема БД MindSet.
--
-- Файл идемпотентный: его можно применять повторно.
-- Причина появления: в репозитории не было описания схемы, а при живых таблицах
-- не хватало колонки sets.user_id — сеты не принадлежали пользователю и были
-- видны всем.

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
    date_created  date NOT NULL DEFAULT CURRENT_DATE,
    last_activity date NOT NULL DEFAULT CURRENT_DATE
);

-- Миграция для БД, созданных до появления владельца у сета.
ALTER TABLE sets ADD COLUMN IF NOT EXISTS user_id integer;

-- Сеты без владельца принадлежать никому не могут: их нельзя показать ни под
-- одним пользователем, а NOT NULL без этого не поставить. Удаляем их.
DELETE FROM sets WHERE user_id IS NULL;

ALTER TABLE sets ALTER COLUMN user_id SET NOT NULL;

DO $$
BEGIN
    ALTER TABLE sets
        ADD CONSTRAINT sets_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS sets_user_id_idx ON sets (user_id);
