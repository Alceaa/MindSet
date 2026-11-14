import api from "./api";

class AdminService {
    listUsers(params = {}) {
        return api.get("/admin/users", { params }).then((response) => response.data);
    }

    blockUser(id, reason) {
        return api.post(`/admin/users/${id}/block`, { reason: reason || "" }).then((response) => response.data);
    }

    unblockUser(id) {
        return api.post(`/admin/users/${id}/unblock`).then((response) => response.data);
    }

    setRole(id, role) {
        return api.put(`/admin/users/${id}/role`, { role: role }).then((response) => response.data);
    }

    listSets(params = {}) {
        return api.get("/admin/sets", { params }).then((response) => response.data);
    }

    deleteSet(id, forbidCopies) {
        return api
            .delete(`/admin/sets/${id}`, { params: { forbid_copies: Boolean(forbidCopies) } })
            .then((response) => response.data);
    }

    listNews(params = {}) {
        return api.get("/admin/news", { params }).then((response) => response.data);
    }

    createNews(payload) {
        return api.post("/admin/news", payload).then((response) => response.data);
    }

    updateNews(id, payload) {
        return api.put(`/admin/news/${id}`, payload).then((response) => response.data);
    }

    deleteNews(id) {
        return api.delete(`/admin/news/${id}`).then((response) => response.data);
    }

    listInvites(params = {}) {
        return api.get("/admin/invites", { params }).then((response) => response.data);
    }

    createInvite(payload) {
        return api.post("/admin/invites", payload).then((response) => response.data);
    }

    revokeInvite(id) {
        return api.delete(`/admin/invites/${id}`).then((response) => response.data);
    }

    listReports(params = {}) {
        return api.get("/admin/reports", { params }).then((response) => response.data);
    }

    setReportStatus(id, status) {
        return api.put(`/admin/reports/${id}/status`, { status: status }).then((response) => response.data);
    }

    listActions(params = {}) {
        return api.get("/admin/actions", { params }).then((response) => response.data);
    }
}

const adminService = new AdminService();

export default adminService;
