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
}

const themeService = new ThemeService();

export default themeService;
