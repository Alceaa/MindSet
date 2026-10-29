// Конфигурация браузерных проверок.
//
// Запуск: npm run test:e2e (нужен поднятый стенд: бэкенд на :8080 и dev-сервер на :3000,
// тестовый пользователь создаётся скриптом e2e/seed.sql).
//
// Адрес стенда можно переопределить: E2E_BASE_URL=http://localhost:3000 npm run test:e2e
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
    testDir: "./e2e",
    timeout: 60 * 1000,
    expect: { timeout: 10 * 1000 },
    // Проверки ходят по одному стенду и общим данным, поэтому запускаем их последовательно.
    fullyParallel: false,
    workers: 1,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
    use: {
        baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
});
