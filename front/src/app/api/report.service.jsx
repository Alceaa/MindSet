import api from "./api";

class ReportService {
    send(payload) {
        return api.post("/reports", payload, { skipAuthRefresh: true }).then((response) => response.data);
    }
}

const reportService = new ReportService();

export default reportService;
