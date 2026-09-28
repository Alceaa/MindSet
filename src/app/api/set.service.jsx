import api from "./api";

class SetService {
    getSets() {
        return api.get("/sets").then((response) => response.data.sets);
    }

    getSet(id) {
        return api.get(`/sets/${id}`).then((response) => response.data.set);
    }

    createSet(payload) {
        return api.post("/sets", payload).then((response) => response.data.set);
    }

    updateSet(id, payload) {
        return api.put(`/sets/${id}`, payload).then((response) => response.data.set);
    }

    deleteSet(id) {
        return api.delete(`/sets/${id}`).then((response) => response.data);
    }
}

const setService = new SetService();

export default setService;
