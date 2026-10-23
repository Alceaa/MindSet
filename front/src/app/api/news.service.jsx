import api from "./api";

class NewsService {
    list({ limit = 10, offset = 0 } = {}) {
        return api
            .get("/news", { params: { limit: limit, offset: offset }, skipAuthRefresh: true })
            .then((response) => response.data);
    }
}

const newsService = new NewsService();

export default newsService;
