# MindSet — frontend

SPA на React (Create React App) + MUI + SCSS.

## Запуск

```bash
cd front
npm install
npm start
```

Приложение откроется на <http://localhost:3000>, а запросы к API уйдут на бэкенд
через dev-прокси (`"proxy": "http://127.0.0.1:8080"` в `package.json`).

> ⚠️ Поле `proxy` читается только при старте, поэтому после его изменения
> `npm start` нужно перезапустить. Изменения в `.env` тоже требуют перезапуска.

## Структура

```
src/
  index.js                    точка входа: базовые стили + монтирование
  app/
    app.jsx                   роутер и провайдеры
    theme.js                  тема MUI в палитре GitHub dark
    api/                      axios-инстанс и сервисы
    context/auth.context.jsx  состояние авторизации (через GET /auth/me)
    components/
      routing/                RequireAuth, RedirectIfAuthed, RootRedirect, 404
      auth/                   вход, регистрация, выход
      dashboard/              дашборд, домашняя, сеты, создание сета
      common/                 экран загрузки
    layouts/                  оболочки: с шапкой и без
    css/                      base.scss (токены и примитивы), layout/, auth/, dashboard/
```


## Маршруты

| Путь | Доступ | Страница |
|---|---|---|
| `/` | любой | Редирект: на `/dashboard` или `/signin` |
| `/signin` | только аноним | Вход |
| `/signup` | только аноним | Регистрация |
| `/dashboard` | только авторизованный | Дашборд, вкладка через `?tab=sets` |
| `/sets/new` | только авторизованный | Создание сета |
| `/logout` | только авторизованный | Подтверждение выхода |
| `*` | любой | 404 |

## Стили

Дизайн-токены (цвета, радиусы, отступы) объявлены как CSS-переменные в
`src/app/css/base.scss` и продублированы в `src/app/theme.js` для MUI-компонентов.
Палитра: холст `#0d1117`, поверхности `#161b22` / `#21262d`, границы `#30363d`,
акцент `#2f81f7`, ошибка `#f85149`, успех `#3fb950`.

Порядок подключения: `base.scss` (глобально, из `index.js`) → `layout/layout.scss`
(оболочка с шапкой) → `auth/auth.scss` и `dashboard/dashboard.scss` на своих страницах.
