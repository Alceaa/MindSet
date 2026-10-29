-- Пользователь для браузерных проверок (npm run test:e2e).
-- Логин: verifyuser, пароль: verify-password-123.
--
-- Применяется к тестовой базе, например:
--   PGPASSWORD=mindset psql -h 127.0.0.1 -U mindset -d mindset -f front/e2e/seed.sql
--
-- Проверки на мобильных разрешениях требуют, чтобы у пользователя не было
-- подтверждения почты (в CI стенд поднимается с REQUIRE_EMAIL_VERIFICATION=false).
INSERT INTO users (login, email, password)
VALUES (
    'verifyuser',
    'verifyuser@example.com',
    '$2a$12$C/ZgfUgdq7/c8UCqgRC7X.j/InBCy/BdX2haSbsgMQMRZD6IEJxli'
)
ON CONFLICT DO NOTHING;
