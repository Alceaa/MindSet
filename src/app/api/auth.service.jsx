import api from "./api";
import Token from "./token";

class AuthService{
    register(login, email, password, password_confirm){
        return api
            .post("/auth/register", {
                "login": login,
                "email": email,
                "password": password,
                "password_confirm": password_confirm
            });
    }

    login(login, password){
        return api
            .post("/auth/login", {
                "login": login,
                "password": password
            })
            .then(response => {
                if (response.data.access_token) {
                    Token.setClient(response.data)
                }
                return response.data;
            })
    }

    logout(){
        Token.removeClient();
    }

    getClient(){
        return Token.getClient();
    }
}

export default new AuthService();