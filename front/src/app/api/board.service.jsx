import api from "./api";

// Доски: список отдаёт их без сцены, сцена приезжает отдельно — она тяжёлая.
class BoardService {
    list() {
        return api.get("/boards").then((response) => response.data.boards);
    }

    get(id) {
        return api.get(`/boards/${id}`).then((response) => response.data.board);
    }

    create(payload) {
        return api.post("/boards", payload).then((response) => response.data.board);
    }

    update(id, payload) {
        return api.put(`/boards/${id}`, payload).then((response) => response.data.board);
    }

    // Автосохранение сцены: отдельный запрос, чтобы не задевать название.
    saveDoc(id, doc) {
        return api.put(`/boards/${id}/doc`, { doc }).then((response) => response.data);
    }

    remove(id) {
        return api.delete(`/boards/${id}`).then((response) => response.data);
    }
}

const boardService = new BoardService();

export default boardService;
