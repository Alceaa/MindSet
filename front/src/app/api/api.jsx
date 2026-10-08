import axios from "axios";

export const AUTH_EVENTS = {
    unauthorized: "mindset:unauthorized",
};

const instance = axios.create({
    baseURL: process.env.REACT_APP_BASE_API_URL || "",
    withCredentials: true,
    headers: {
        "Content-Type": "application/json",
    },
});

let refreshPromise = null;

const refreshSession = () => {
    if (!refreshPromise) {
        refreshPromise = instance
            .post("/auth/refresh", null, { skipAuthRefresh: true })
            .finally(() => {
                refreshPromise = null;
            });
    }
    return refreshPromise;
};

instance.interceptors.response.use(
    (response) => response,
    async (error) => {
        const config = error.config || {};
        const status = error.response?.status;

        const canRetry = status === 401 && !config.skipAuthRefresh && !config._retried;

        if (canRetry) {
            config._retried = true;
            try {
                await refreshSession();
                return instance.request(config);
            } catch (refreshError) {
                window.dispatchEvent(new Event(AUTH_EVENTS.unauthorized));
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

export default instance;
