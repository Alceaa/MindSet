import api from "./api";
class AuthService {
    register(login, email, password, passwordConfirm, invite) {
        return api
            .post("/auth/register", {
                login: login,
                email: email,
                password: password,
                password_confirm: passwordConfirm,
                invite: invite || "",
            })
            .then((response) => response.data);
    }

    registrationConfig() {
        return api.get("/auth/config", { skipAuthRefresh: true }).then((response) => response.data);
    }

    login(login, password) {
        return api
            .post("/auth/login", { login: login, password: password }, { skipAuthRefresh: true })
            .then((response) => response.data);
    }

    confirmLogin(login, password, code) {
        return api
            .post(
                "/auth/login/confirm",
                { login: login, password: password, code: code },
                { skipAuthRefresh: true }
            )
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

    verifyEmail(token) {
        return api
            .post("/auth/verify-email", { token: token }, { skipAuthRefresh: true })
            .then((response) => response.data);
    }

    requestEmailVerification(email) {
        return api
            .post("/auth/verify-email/request", { email: email })
            .then((response) => response.data);
    }

    forgotPassword(email) {
        return api
            .post("/auth/forgot", { email: email }, { skipAuthRefresh: true })
            .then((response) => response.data);
    }

    resetPassword(token, password, passwordConfirm) {
        return api
            .post(
                "/auth/reset",
                { token: token, password: password, password_confirm: passwordConfirm },
                { skipAuthRefresh: true }
            )
            .then((response) => response.data);
    }
}

const authService = new AuthService();

export default authService;
