import api from "./api";

class SetService {
    getSets() {
        return api.get("/sets").then((response) => response.data.sets);
    }

    getSet(id) {
        return api.get(`/sets/${id}`).then((response) => response.data);
    }

    getGraph() {
        return api.get("/graph").then((response) => response.data);
    }

    createSet(payload) {
        return api.post("/sets", payload).then((response) => response.data);
    }

    updateSet(id, payload) {
        return api.put(`/sets/${id}`, payload).then((response) => response.data);
    }

    deleteSet(id) {
        return api.delete(`/sets/${id}`).then((response) => response.data);
    }

    getPublicSet(slug) {
        return api
            .get(`/public/sets/${encodeURIComponent(slug)}`, { skipAuthRefresh: true })
            .then((response) => response.data);
    }

    getPublicSets(params = {}) {
        return api
            .get("/public/sets", { params, skipAuthRefresh: true })
            .then((response) => response.data);
    }
}

const setService = new SetService();

export default setService;
