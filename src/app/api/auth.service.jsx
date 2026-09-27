import api from "./api";
class AuthService {
    register(login, email, password, passwordConfirm) {
        return api
            .post("/auth/register", {
                login: login,
                email: email,
                password: password,
                password_confirm: passwordConfirm,
            })
            .then((response) => response.data);
    }

    login(login, password) {
        return api
            .post("/auth/login", { login: login, password: password }, { skipAuthRefresh: true })
            .then((response) => response.data);
    }

    logout() {
        return api
            .post("/auth/logout", null, { skipAuthRefresh: true })
            .then((response) => response.data);
    }

    me() {
        return api.get("/auth/me").then((response) => response.data);
    }

    refresh() {
        return api
            .post("/auth/refresh", null, { skipAuthRefresh: true })
            .then((response) => response.data);
    }
}

const authService = new AuthService();

export default authService;
