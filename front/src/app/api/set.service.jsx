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

    deleteSet(id, payload = {}) {
        return api.delete(`/sets/${id}`, { data: payload }).then((response) => response.data);
    }

    getSetCopyStats(id) {
        return api.get(`/sets/${id}/copy-stats`).then((response) => response.data);
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

    getSavedSets() {
        return api.get("/saved-sets").then((response) => response.data);
    }

    getSavedSet(id) {
        return api.get(`/saved-sets/${id}`).then((response) => response.data);
    }

    saveExternalSet(slug) {
        return api.post("/saved-sets", { slug }).then((response) => response.data);
    }

    refreshSavedSet(id) {
        return api.post(`/saved-sets/${id}/refresh`).then((response) => response.data);
    }

    freezeSavedSet(id, frozen) {
        return api
            .post(`/saved-sets/${id}/freeze`, { frozen })
            .then((response) => response.data);
    }

    deleteSavedSet(id) {
        return api.delete(`/saved-sets/${id}`).then((response) => response.data);
    }

    getSetTombstones() {
        return api.get("/set-tombstones").then((response) => response.data.tombstones);
    }

    forbidSetTombstone(id) {
        return api
            .post(`/set-tombstones/${id}/forbid-copies`)
            .then((response) => response.data);
    }

    getPublicSnapshot(id) {
        return api
            .get(`/public/snapshots/${id}`, { skipAuthRefresh: true })
            .then((response) => response.data);
    }
}

const setService = new SetService();

export default setService;
