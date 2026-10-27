import api from "./api";

class NotificationsService {
    list({ limit = 20, offset = 0 } = {}) {
        return api
            .get("/notifications", { params: { limit: limit, offset: offset } })
            .then((response) => response.data);
    }

    unread() {
        return api.get("/notifications/unread").then((response) => response.data);
    }

    markRead(id) {
        return api.post(`/notifications/${id}/read`).then((response) => response.data);
    }

    markAllRead() {
        return api.post("/notifications/read-all").then((response) => response.data);
    }

    getPrefs() {
        return api.get("/users/me/notification-prefs").then((response) => response.data);
    }

    setPref(kind, enabled) {
        return api
            .put("/users/me/notification-prefs", { kind: kind, enabled: enabled })
            .then((response) => response.data);
    }
}

const notificationsService = new NotificationsService();

export default notificationsService;
