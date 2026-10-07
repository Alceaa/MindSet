import api from "./api";

class UserService {
    getProfile(login) {
        return api
            .get(`/public/users/${encodeURIComponent(login)}`, { skipAuthRefresh: true })
            .then((response) => response.data);
    }

    getProfileSets(login, params = {}) {
        return api
            .get(`/public/users/${encodeURIComponent(login)}/sets`, { params, skipAuthRefresh: true })
            .then((response) => response.data);
    }

    follow(id) {
        return api.post(`/users/${id}/follow`).then((response) => response.data);
    }

    unfollow(id) {
        return api.delete(`/users/${id}/follow`).then((response) => response.data);
    }

    updateMe(payload) {
        return api.put("/users/me", payload).then((response) => response.data);
    }

    uploadAvatar(file) {
        const formData = new FormData();
        formData.append("avatar", file);
        return api
            .post("/users/me/avatar", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            })
            .then((response) => response.data);
    }
}

const userService = new UserService();

export default userService;
