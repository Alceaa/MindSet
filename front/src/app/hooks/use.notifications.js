import { useCallback, useEffect, useRef, useState } from "react";
import notificationsService from "../api/notifications.service";

export const NOTIFICATIONS_POLL_INTERVAL = 45000;

/**
 * Счётчик непрочитанных уведомлений. WebSocket и SSE в проекте нет и для счётчика
 * они не нужны: опрашиваем сервер раз в 45 секунд и при возврате на вкладку.
 */
export const useNotifications = (enabled) => {
    const [unread, setUnread] = useState(0);
    const [loading, setLoading] = useState(false);
    const activeRef = useRef(false);

    const refresh = useCallback(async () => {
        if (!enabled) {
            return null;
        }

        try {
            const data = await notificationsService.unread();
            const next = data?.unread ?? 0;
            if (activeRef.current) {
                setUnread(next);
            }
            return next;
        } catch {
            // Сеть или истёкшая сессия: молча оставляем прежнее значение.
            return null;
        }
    }, [enabled]);

    useEffect(() => {
        if (!enabled) {
            activeRef.current = false;
            setUnread(0);
            return undefined;
        }

        activeRef.current = true;
        setLoading(true);
        refresh().finally(() => {
            if (activeRef.current) {
                setLoading(false);
            }
        });

        const timer = window.setInterval(refresh, NOTIFICATIONS_POLL_INTERVAL);
        const handleVisible = () => {
            if (document.visibilityState === "visible") {
                refresh();
            }
        };

        document.addEventListener("visibilitychange", handleVisible);
        window.addEventListener("focus", handleVisible);

        return () => {
            activeRef.current = false;
            window.clearInterval(timer);
            document.removeEventListener("visibilitychange", handleVisible);
            window.removeEventListener("focus", handleVisible);
        };
    }, [enabled, refresh]);

    return { unread, setUnread, refresh, loading };
};

export default useNotifications;
