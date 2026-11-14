import api from "./api";

// Библиотека тем: пользователь сохраняет несколько оформлений и правит их сам.
// Каталога и модерации нет — обмен идёт файлом или текстом, без сервера посередине.
class ThemeService {
    list() {
        return api.get("/themes").then((response) => response.data);
    }

    create(payload) {
        return api.post("/themes", payload).then((response) => response.data);
    }

    update(id, payload) {
        return api.put(`/themes/${id}`, payload).then((response) => response.data);
    }

    remove(id) {
        return api.delete(`/themes/${id}`).then((response) => response.data);
    }
}

const themeService = new ThemeService();

export default themeService;
