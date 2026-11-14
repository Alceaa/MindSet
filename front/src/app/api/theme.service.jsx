import api from "./api";

class ThemeService {
    published() {
        return api.get("/themes", { skipAuthRefresh: true }).then((response) => response.data);
    }

    own() {
        return api.get("/theme-packages").then((response) => response.data);
    }

    create(payload) {
        return api.post("/theme-packages", payload).then((response) => response.data);
    }

    update(id, payload) {
        return api.put(`/theme-packages/${id}`, payload).then((response) => response.data);
    }

    remove(id) {
        return api.delete(`/theme-packages/${id}`).then((response) => response.data);
    }

    submit(id) {
        return api.post(`/theme-packages/${id}/submit`).then((response) => response.data);
    }

    // Снять опубликованную тему с публикации автор может сам, без админа.
    withdraw(id) {
        return api.post(`/theme-packages/${id}/withdraw`).then((response) => response.data);
    }

    // Своя тема в профиле: живёт без модерации и переезжает между устройствами.
    profileTheme() {
        return api
            .get("/users/me/theme", { skipAuthRefresh: true })
            .then((response) => response.data);
    }

    saveProfileTheme(payload) {
        return api.put("/users/me/theme", payload).then((response) => response.data);
    }

    clearProfileTheme() {
        return api.delete("/users/me/theme").then((response) => response.data);
    }
}

const themeService = new ThemeService();

export default themeService;
