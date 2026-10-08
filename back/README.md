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
| `S3_ENDPOINT` | Адрес S3-хранилища (Timeweb Cloud: `https://s3.twcstorage.ru`) |
| `S3_REGION` | Регион хранилища (Timeweb Cloud: `ru-1`; Cloudflare R2: `auto`) |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Ключи доступа к бакету |
| `S3_BUCKET` | Бакет для изображений сетов (для Timeweb Cloud — публичный) |
| `S3_PUBLIC_BASE_URL` | Публичный адрес объектов без слэша на конце (`https://s3.twcstorage.ru/<bucket>`) |
| `APP_BASE_URL` | Публичный адрес фронтенда — на него ведут ссылки из писем. Пусто = берётся первый origin из `ALLOWED_ORIGINS` |
| `REQUIRE_EMAIL_VERIFICATION` | Дополнительная проверка на входе: `true` = вход запрещён, пока почта не подтверждена (по умолчанию `false`). Регистрация в любом случае требует подтверждения — аккаунт создаётся только по ссылке из письма |
| `SMTP_HOST` / `SMTP_PORT` | SMTP провайдера и порт (`587` для STARTTLS, `465` для implicit TLS) |
| `SMTP_USER` / `SMTP_PASSWORD` | Учётные данные ящика для отправки |
| `SMTP_FROM` | Отправитель, например `MindSet <no-reply@example.com>` |
| `SMTP_TLS` | `starttls` (по умолчанию), `implicit` или `none` |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Бот и чат для уведомлений (баг-репорты, ошибки 5xx, мониторинг). Пусто = сообщения в лог |
| `HEALTH_CHECK_INTERVAL` | Как часто монитор проверяет `/health` (по умолчанию `2h`) |
| `RATE_LIMIT_ENABLED` | Включены ли ограничения частоты (по умолчанию `true`) |
| `RATE_LIMIT_GLOBAL_PER_MINUTE` | Общий лимит запросов с одного IP в минуту (по умолчанию `240`) |
| `RATE_LIMIT_AUTH_PER_15MIN` | Неудачные попытки входа/подтверждения кода/сброса с одного IP на логин за 15 минут (по умолчанию `10`) |
| `RATE_LIMIT_EMAIL_PER_HOUR` | Регистрации и запросы писем с одного IP в час (по умолчанию `5`) |
| `RATE_LIMIT_REPORT_PER_HOUR` | Баг-репорты с одного IP в час (по умолчанию `5`) |
| `TRUST_PROXY_HEADER` | Заголовок с реальным IP клиента за прокси (по умолчанию `X-Forwarded-For`; пусто = брать IP соединения) |
| `ADMIN_TOKEN` | Токен управления приглашениями (`/admin/invites`). Пусто = админ-маршруты выключены |
| `REGISTRATION_INVITE_ONLY` | `true` = регистрация только по одноразовым ссылкам-приглашениям (по умолчанию `false`) |
| `INVITE_TTL_DAYS` | Срок жизни приглашения по умолчанию (7 дней) |
| `HEARTBEAT_URL` | Внешний адрес «пульса» (Healthchecks.io и подобные). Пусто = выключено |
| `HEARTBEAT_INTERVAL` | Как часто отправлять сигнал внешнему сервису (по умолчанию `5m`) |

Все `S3_*` пусты = вставка изображений выключена (аватары работают локально). Старые имена `R2_*` по-прежнему принимаются как алиасы.

Почта: если `SMTP_HOST` и `SMTP_FROM` пусты, письма не отправляются, а целиком печатаются
в лог сервера — в dev ссылку подтверждения и ссылку сброса пароля можно взять прямо из консоли.

Telegram: если `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID` пусты, уведомления (баг-репорты,
ошибки 5xx, алерты монитора) тоже печатаются в лог. Монитор проверяет живость БД каждые
`HEALTH_CHECK_INTERVAL` и пишет в бота при падении и при восстановлении.

## Закрытая регистрация (приглашения)

При `REGISTRATION_INVITE_ONLY=true` без приглашения зарегистрироваться нельзя: сервер отвечает
`403`, а страница регистрации показывает «регистрация по приглашению». Приглашение — одноразовая
ссылка вида `https://<APP_BASE_URL>/signup?invite=<токен>`, живёт `INVITE_TTL_DAYS` дней.

Выдать приглашение (нужен `ADMIN_TOKEN`):

```bash
curl -s -X POST http://127.0.0.1:8080/admin/invites \
  -H "X-Admin-Token: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"note":"для Ани","days":7}'
# -> {"invite":{"id":1,"note":"для Ани","used":false,...},"url":"http://localhost:3000/signup?invite=..."}

curl -s http://127.0.0.1:8080/admin/invites -H "X-Admin-Token: $ADMIN_TOKEN"   # список и статусы
```

Приглашение сгорает в момент создания заявки на регистрацию (в одной транзакции с заявкой), поэтому
повторно ссылку использовать нельзя. Ошибка валидации формы приглашение не расходует. После
подтверждения почты в `users.invited_by` и `invites.used_by` пишется, кто кого пригласил.

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
* `email_tokens` — одноразовые токены писем (`verify_email`, `reset_password`, `login_code`): хранится
  только sha256-хэш токена, рядом срок жизни `expires_at`, отметка `used_at` и счётчик неудачных
  попыток `attempts` (код входа гасится после 5 ошибок);
* `pending_registrations` — заявки на регистрацию: логин, почта, хэш пароля и токен подтверждения.
  Строка живёт до перехода по ссылке (24 часа), только тогда появляется запись в `users`;
* `users.email_verified` — подтверждён ли адрес, `users.two_factor_email` — включён ли вход по коду;
  какие токены ещё действительны, определяет `token_epoch`;
* даты (`date_created`, `last_activity`, `date_joined`) имеют `DEFAULT CURRENT_DATE`.

Схема применяется командой (её достаточно запустить один раз после `git pull`):

```bash
cd back/src
go run ./cmd/migrate
```

## Проверка внешних сервисов

SMTP можно проверить, не задевая приложение:

```bash
cd back/src
go run ./cmd/mailcheck                  # письмо на delivered@resend.dev (тестовый ящик Resend)
go run ./cmd/mailcheck you@example.com  # письмо на свой адрес
```

Скрипт берёт настройки из `.env`, подключается к SMTP и печатает текст ошибки, если провайдер отказал
(например, «domain is not verified»).

## Маршруты

| Метод | Путь | Доступ | Описание |
|---|---|---|---|
| GET | `/health` | публичный | Проверка сервера и БД |
| POST | `/auth/register` | публичный | Заявка на регистрацию (`202`): письмо со ссылкой подтверждения. Аккаунт появится только после перехода по ссылке (409, если логин или почта заняты) |
| POST | `/auth/login` | публичный | Вход, ставит HttpOnly cookie с токенами. Если включён вход по коду — `202` с `two_factor_required` и письмом с кодом |
| POST | `/auth/login/confirm` | публичный | Второй шаг входа (`{login, password, code}`): код из письма, действует 10 минут, гасится после 5 ошибок |
| POST | `/auth/refresh` | по refresh-токену | Продление сессии |
| POST | `/auth/logout` | публичный | Удаление cookie с токенами |
| GET | `/auth/me` | по access-токену | Текущий пользователь |
| POST | `/auth/verify-email` | публичный | Подтверждение почты по токену из письма: создаёт аккаунт из заявки и сразу открывает сессию (400 для недействительной ссылки) |
| POST | `/auth/verify-email/request` | публичный | Повторная отправка письма подтверждения (`{email}`); для авторизованного владельца адреса ответ конкретный, для остальных — нейтральный |
| POST | `/auth/forgot` | публичный | Запрос ссылки на сброс пароля (`{email}`); ответ не выдаёт, зарегистрирован адрес или нет |
| POST | `/auth/reset` | публичный | Новый пароль по токену из письма (`{token, password, password_confirm}`); сбрасывает все сессии |
| PUT | `/users/me/2fa` | по access-токену | Включение/выключение входа по коду (`{enabled, password}`), по умолчанию выключено |
| POST | `/reports` | публичный | Баг-репорт (`{topic, message, page}`) → уходит в Telegram, для вошедших приложен логин |
| GET | `/auth/config` | публичный | Настройки для фронтенда: `invite_only`, `registration_open` |
| POST | `/admin/invites` | по `ADMIN_TOKEN` или роли `admin` | Выдать одноразовое приглашение (`{note, days}`) → `{invite, url}` |
| GET | `/admin/invites` | по `ADMIN_TOKEN` или роли `admin` | Последние приглашения и их статус |
| DELETE | `/admin/invites/:id` | по `ADMIN_TOKEN` или роли `admin` | Отозвать неиспользованное приглашение |
| GET | `/news` | публичный | Новости для ленты «Обзор»: закреплённые первыми, затем по дате |
| GET | `/news/:id` | публичный | Новость; черновик виден только администратору |
| GET | `/admin/users` | роль `admin` | Пользователи: `q`, `blocked`, `limit`, `offset` |
| POST | `/admin/users/:id/block` | роль `admin` | Блокировка (`{reason}`), гасит все сессии |
| POST | `/admin/users/:id/unblock` | роль `admin` | Разблокировка |
| PUT | `/admin/users/:id/role` | роль `admin` | Смена роли (`{role: "user" \| "admin"}`) |
| GET | `/admin/sets` | роль `admin` | Сеты всех авторов (`q`, `limit`, `offset`) |
| DELETE | `/admin/sets/:id` | роль `admin` | Удаление любого сета (`?forbid_copies=true` — вместе с копиями) |
| GET | `/admin/news` | роль `admin` | Все новости, включая черновики |
| POST | `/admin/news` | роль `admin` | Создать новость (`{title, body, is_published}`) |
| PUT | `/admin/news/:id` | роль `admin` | Изменить новость |
| DELETE | `/admin/news/:id` | роль `admin` | Удалить новость |
| GET | `/admin/reports` | роль `admin` | Баг-репорты (`status`, `limit`) |
| PUT | `/admin/reports/:id/status` | роль `admin` | Статус репорта (`new`, `in_progress`, `done`, `rejected`) |
| GET | `/admin/actions` | роль `admin` | Журнал действий администраторов |

## Админка

Роль лежит в `users.role` (`user` / `admin`), панель — на `/admin` и существует только для админов:
в меню она видна лишь им, а всем остальным и API, и страница отвечают `404` (чтобы не подсказывать
о существовании раздела). Первого админа назначают из CLI:

```bash
cd back/src
go run ./cmd/admin list              # кто есть и у кого какая роль
go run ./cmd/admin promote Alcea     # выдать роль
go run ./cmd/admin demote Alcea      # снять роль
go run ./cmd/admin block Alcea       # мягкая блокировка (без удаления данных)
go run ./cmd/admin unblock Alcea
```

Что умеет панель:

- **Новости** — создание, правка, черновики и закрепление; показываются в ленте «Обзор» (закреплённые
  идут первыми), отдельной страницы нет.
- **Пользователи** — поиск по логину/почте, фильтр «только заблокированные», блокировка с причиной,
  разблокировка, выдача и снятие роли администратора.
- **Сеты** — поиск по названию и автору, удаление любого сета (с опцией очистить и копии).
- **Приглашения** — выдача одноразовой ссылки с копированием в буфер, список и отзыв.
- **Репорты** — все баг-репорты (они же уходят в Telegram) со статусами.
- **Журнал** — кто из админов что сделал (`admin_actions`).

Как работает блокировка: вход по паролю отвечает `403` с причиной, при блокировке инкрементится
`users.token_epoch` — все выданные ранее токены становятся недействительными, поэтому чужие сессии
гаснут сразу. Профиль и публичные сеты заблокированного исчезают из каталога и ленты, письма
восстановления пароля ему не отправляются. Защита от ошибок: нельзя заблокировать себя, снять роль
с себя и остаться без администраторов — сервер вернёт `400`/`409`.
| POST | `/uploads/presign` | по access-токену | Presigned-ссылка для прямой загрузки изображения в S3 (`{"content_type":"image/png"}`, 503 если хранилище не настроено) |
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


