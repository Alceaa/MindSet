import api from "./api";

class SetService {
    getSets() {
        return api.get("/sets").then((response) => response.data.sets);
    }

    getSet(id) {
        return api.get(`/sets/${id}`).then((response) => response.data.set);
    }

    createSet(title, description) {
        return api
            .post("/sets", { title: title, description: description })
            .then((response) => response.data.set);
    }
}

const setService = new SetService();

export default setService;
