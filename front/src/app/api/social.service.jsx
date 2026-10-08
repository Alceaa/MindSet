import api from "./api";

class SocialService {
    getFeed() {
        return api.get("/feed", { skipAuthRefresh: true }).then((response) => response.data);
    }

    likeSet(slug) {
        return api
            .post(`/public/sets/${encodeURIComponent(slug)}/like`)
            .then((response) => response.data);
    }

    unlikeSet(slug) {
        return api
            .delete(`/public/sets/${encodeURIComponent(slug)}/like`)
            .then((response) => response.data);
    }

    getLikes(slug) {
        return api
            .get(`/public/sets/${encodeURIComponent(slug)}/likes`, { skipAuthRefresh: true })
            .then((response) => response.data);
    }

    getComments(slug) {
        return api
            .get(`/public/sets/${encodeURIComponent(slug)}/comments`, { skipAuthRefresh: true })
            .then((response) => response.data);
    }

    createComment(slug, body) {
        return api
            .post(`/public/sets/${encodeURIComponent(slug)}/comments`, { body })
            .then((response) => response.data);
    }

    deleteComment(id) {
        return api.delete(`/comments/${id}`).then((response) => response.data);
    }
}

const socialService = new SocialService();

export default socialService;
