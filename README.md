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
| GET | `/sets/:id` | по access-токену | Сет с содержимым (чужие сеты → 404) |
| PUT | `/sets/:id` | по access-токену | Обновление сета, `last_activity = CURRENT_DATE` |
| DELETE | `/sets/:id` | по access-токену | Удаление сета |

Формат ответов:

```json
{ "status": "success", "user": { "id": 1, "login": "octocat", "email": "o@example.com" } }
{ "status": "fail", "message": "Неверный пароль" }
{ "status": "fail", "message": "Проверьте правильность заполнения полей",
  "errors": [{ "field": "password", "tag": "min", "message": "Пароль: минимальная длина — 8" }] }
```

В `development` к ошибкам добавляется поле `dev` с техническим текстом.


