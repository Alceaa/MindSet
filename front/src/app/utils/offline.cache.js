/**
 * Чистит кэш данных, который service worker держит для офлайн-чтения.
 * Вызывается при выходе из аккаунта: на общем устройстве чужие заметки оставаться не должны.
 */
export const clearOfflineData = async () => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
        return;
    }

    try {
        const registration = await navigator.serviceWorker.getRegistration();
        registration?.active?.postMessage({ type: "clear-data" });
    } catch {
        // Без кэша приложение работает как обычно, так что молча продолжаем.
    }
};

export default clearOfflineData;
