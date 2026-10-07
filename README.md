# MindSet — backend

API на Go (Fiber v2) + PostgreSQL.

## Запуск

```bash
cd back/src
cp .env.example .env
go run .
```

Сервер поднимается на порту из `PORT` (по умолчанию `8080`), проверка живости — `GET /health`.

`.env` ищется в текущем каталоге, в `./src/.env` и рядом с бинарником; можно указать
файл явно через переменную окружения `ENV_FILE`.

## Переменные окружения

| Переменная | Назначение |
|---|---|
| `ENV` | `development` (по умолчанию) или `production`. В проде детали ошибок не уходят клиенту, `SameSite=None`, cookie `Secure` |
| `PORT` | Порт HTTP-сервера |
| `DATABASE_URL` | Строка подключения к PostgreSQL |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Разные секреты для access- и refresh-токенов |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | Время жизни токенов (`15m`, `168h`) |
| `COOKIE_DOMAIN` | Пусто = host-only cookie. Заполнять только при реальной необходимости |
| `COOKIE_SECURE` | `true` за HTTPS |
| `COOKIE_SAME_SITE` | Пусто = `Lax` в dev и `None` в проде |
| `ALLOWED_ORIGINS` | Список origin'ов фронтенда через запятую для CORS |
| `BCRYPT_COST` | Стоимость хеширования пароля (10–15, по умолчанию 12) |

## Схема БД

Схема лежит в [`src/db/schema.sql`](src/db/schema.sql) и применяется идемпотентно:

```bash
psql "$DATABASE_URL" -f src/db/schema.sql
```

* `users.login` и `users.email` — уникальные;
* `sets.user_id` — владелец сета, `NOT NULL` + `ON DELETE CASCADE`;
* `sets.content` — markdown-содержимое сета (`text NOT NULL DEFAULT ''`);
* `set_links` — wikilink-связи (`target_key` + разрешённый `to_set_id`) с направлением для графа;
* `saved_sets` — копии (снимки) чужих сетов: `set_id` обнуляется `ON DELETE SET NULL`, тело может быть отозвано (`revoked_at`);
* `set_tombstones` — отложенные удаления: срок `deadline`, владелец `owner_user_id`, признак `forbid_applied`;
* `author_tombstones` — отметка об удалившемся авторе (для публичных снимков);
* даты (`date_created`, `last_activity`, `date_joined`) имеют `DEFAULT CURRENT_DATE`.

Схема применяется командой (её достаточно запустить один раз после `git pull`):

```bash
cd back/src
go run ./cmd/migrate
```

## Маршруты

| Метод | Путь | Доступ | Описание |
|---|---|---|---|
| GET | `/health` | публичный | Проверка сервера и БД |
| POST | `/auth/register` | публичный | Регистрация (409, если логин или почта заняты) |
| POST | `/auth/login` | публичный | Вход, ставит HttpOnly cookie с токенами |
| POST | `/auth/refresh` | по refresh-токену | Продление сессии |
| POST | `/auth/logout` | публичный | Удаление cookie с токенами |
| GET | `/auth/me` | по access-токену | Текущий пользователь |
| GET | `/sets` | по access-токену | Список сетов (краткая сводка, без содержимого) |
| POST | `/sets` | по access-токену | Создание сета |
| GET | `/sets/:id` | по access-токену | Сет с содержимым, `links` и `backlinks` (чужие сеты → 404) |
| PUT | `/sets/:id` | по access-токену | Обновление сета, `last_activity = CURRENT_DATE` |
| DELETE | `/sets/:id` | по access-токену | Удаление сета; тело `{"forbid_copies":true}` удаляет и копии сразу, иначе копии замораживаются до ярлыка (30 дней) |
| GET | `/sets/:id/copy-stats` | по access-токену | Сколько копий у сета и у скольких аккаунтов (только владелец) |
| GET | `/graph` | по access-токену | Граф связей: `nodes` (свои и внешние), `edges` (одно ребро на пару, `one_sided` = направление стрелки) |
| GET | `/public/sets` | публичный | Каталог публичных сетов (`limit`, `offset`, `q`) |
| GET | `/public/sets/:slug` | публичный | Публичный сет с автором, `links` и `backlinks` |
| GET | `/public/snapshots/:id` | публичный | Публичный снимок (копия), пока автор не отозвал доступ |
| GET | `/saved-sets` | по access-токену | Библиотека снимков: `saved` и раздел `attention` |
| POST | `/saved-sets` | по access-токену | Сохранение копии публичного сета (`slug`), 403 при `forbid_copies` |
| GET | `/saved-sets/:id` | по access-токену | Свой снимок, доступен и при отозванном доступе |
| POST | `/saved-sets/:id/refresh` | по access-токену | Обновление снимка из источника |
| POST | `/saved-sets/:id/freeze` | по access-токену | Ручная заморозка (409 для снимка без живого источника) |
| DELETE | `/saved-sets/:id` | по access-токену | Удаление снимка из библиотеки |
| GET | `/set-tombstones` | по access-токену | Ярлыки отложенных удалений владельца |
| POST | `/set-tombstones/:id/forbid-copies` | по access-токену | Досрочный запрет копий по ярлыку (только владелец) |


Формат ответов:

```json
{ "status": "success", "user": { "id": 1, "login": "octocat", "email": "o@example.com" } }
{ "status": "fail", "message": "Неверный пароль" }
{ "status": "fail", "message": "Проверьте правильность заполнения полей",
  "errors": [{ "field": "password", "tag": "min", "message": "Пароль: минимальная длина — 8" }] }
```

В `development` к ошибкам добавляется поле `dev` с техническим текстом.


