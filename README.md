# MindSet

Заметки-«сеты»: заметки со связями между мыслями, граф знаний, публикация сетов и лента сообщества.
Текущая версия — 1.0.0.

## Возможности

- **Сеты заметок**: создание, редактирование, удаление, теги, статусы изучения, связи между мыслями.
- **Граф связей**: визуальная карта заметок сета.
- **Снимки**: сохранение и восстановление состояния сета.
- **Публикация и каталог**: публичные сеты, поиск, сортировка, копирование чужого сета себе.
- **Новости проекта**: раздел в ленте, закреплённые новости показываются первыми.
- **Аккаунт**: регистрация с подтверждением почты, восстановление пароля, вход по коду из письма, приглашения.
- **Админ-панель** на `/admin`: пользователи, сеты, новости, жалобы, журнал действий.

## Стек

| Часть | Технологии |
|---|---|
| `back/` | Go 1.24, Fiber v2, PostgreSQL 16, JWT, AWS SDK v2 (S3), validator |
| `front/` | React 18 (Create React App), MUI 7, SCSS, react-router 6, axios, react-markdown, MDXEditor |
| Прод | Docker Compose: PostgreSQL, backend, nginx со статикой, Caddy с автоматическим HTTPS |

## Структура

```
back/                     API на Go: src/ — код, Dockerfile, README с описанием API и переменных окружения
front/                    SPA на React: src/app — код, Dockerfile
docker-compose.yml        прод-сборка: db + backend + frontend + caddy
Caddyfile                 конфигурация Caddy (HTTPS, раздача под /mindset)
CHANGELOG.md              история версий (Keep a Changelog + SemVer)
.env.production.example   шаблон окружения для docker compose
```

## Локальный запуск

Нужны Go 1.24+, Node 20+ и PostgreSQL 16.

Бэкенд:

```bash
cd back/src
cp .env.example .env
go run .
```

Сервер поднимается на порту из `PORT` (по умолчанию `8080`), версия видна в `GET /health`.
Письма при пустом SMTP не отправляются, а печатаются в лог, поэтому в dev ссылку подтверждения
и ссылку сброса пароля видно прямо в консоли.

Фронтенд:

```bash
cd front
npm install
npm start
```

Стартует на `http://localhost:3000`, запросы к `/api` уходят на `127.0.0.1:8080`.

## Схема БД

`back/src/db/schema.sql` применяется идемпотентно:

```bash
cd back/src
go run ./cmd/migrate
```

## Тесты

```bash
cd back/src && go test ./...
cd front && CI=true npm test
```

## Прод

```bash
cp .env.production.example .env
docker compose up -d --build
```

В `.env` заполняются `DATABASE_*`, `JWT_*`, `S3_*`, `SMTP_*`, `TELEGRAM_*`, `DOMAIN`, `ADMIN_TOKEN`.
Приложение разворачивается под подпутём `/mindset`, API — `/mindset/api`, медиа — `/media`.
В проде значения-заглушки секретов не принимаются: с `change-me*` и примерными паролями приложение не стартует.

Утилиты в `back/src/cmd`: `migrate` (схема БД), `admin` (роли, блокировки), `mailcheck` (проверка SMTP).

Образы для прода собираются в GitHub Actions: по тегу `v*` они публикуются в GHCR
(`ghcr.io/alceaa/mindset-backend:<тег>`, `ghcr.io/alceaa/mindset-frontend:<тег>`). Чтобы обновляться
готовыми образами, укажите `MINDSET_TAG` в `.env` и запускайте compose с `docker-compose.images.yml`.

## Версии

Номер версии задаётся константой `utils.Version` в бэкенде, виден в `GET /health` и в логе при старте.
История изменений — [CHANGELOG.md](CHANGELOG.md).
