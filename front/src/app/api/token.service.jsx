import api from "./api";

class TokenService {
    list() {
        return api.get("/api-tokens").then((response) => response.data);
    }

    create(payload) {
        return api.post("/api-tokens", payload).then((response) => response.data);
    }

    revoke(id) {
        return api.delete(`/api-tokens/${id}`).then((response) => response.data);
    }
}

const tokenService = new TokenService();

export default tokenService;
