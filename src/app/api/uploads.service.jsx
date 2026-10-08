import api from "./api";

class UploadsService {
    presign(contentType) {
        return api
            .post("/uploads/presign", { content_type: contentType })
            .then((response) => response.data);
    }
}

const uploadsService = new UploadsService();

export default uploadsService;
