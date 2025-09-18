import axios from "axios";
import Token from "./token";

const instance = axios.create({
    baseURL: process.env.REACT_APP_BASE_API_URL,
    withCredentials: true,
    headers: {
    "Content-Type": "application/json",
  },
})

instance.interceptors.request.use(
    (config) => {
        const token = Token.getAccessToken();
        if (token){
            config.headers["Authorization"] = 'Bearer ' + token;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
)

instance.interceptors.response.use(
    (res) => {
        return res;
    },
    async (err) => {
        if(err.config.url !== "auth/login" && err.response){
            if(err.response.status === 401 && !err.config._retry){
                err.config._retry = true;
                try{
                    await instance.post("/auth/refresh");
                    return instance(err.config);
                } catch (_error){
                    return Promise.reject(_error)
                }
            }
        }
        return Promise.reject(err);
    }
)

export default instance;