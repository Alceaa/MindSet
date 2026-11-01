import api from "./api";

class CollectionService {
    list() {
        return api.get("/collections").then((response) => response.data.collections ?? []);
    }

    create(payload) {
        return api.post("/collections", payload).then((response) => response.data);
    }

    update(id, payload) {
        return api.put(`/collections/${id}`, payload).then((response) => response.data);
    }

    remove(id) {
        return api.delete(`/collections/${id}`).then((response) => response.data);
    }

    // Положить свой сет в коллекцию и убрать из неё.
    // Сет может лежать сразу в нескольких коллекциях.
    addSet(setId, collectionId) {
        return api
            .put(`/sets/${setId}/collections`, { collection_id: collectionId })
            .then((response) => response.data);
    }

    removeSet(setId, collectionId) {
        return api
            .delete(`/sets/${setId}/collections/${collectionId}`)
            .then((response) => response.data);
    }

    // То же для сохранённого снимка.
    addSavedSet(savedSetId, collectionId) {
        return api
            .put(`/saved-sets/${savedSetId}/collections`, { collection_id: collectionId })
            .then((response) => response.data);
    }

    removeSavedSet(savedSetId, collectionId) {
        return api
            .delete(`/saved-sets/${savedSetId}/collections/${collectionId}`)
            .then((response) => response.data);
    }
}

const collectionService = new CollectionService();

export default collectionService;
