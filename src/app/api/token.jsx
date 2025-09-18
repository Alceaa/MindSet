class Token {
    getClient(){
        return JSON.parse(localStorage.getItem("client"));
    }
    setClient(client){
        localStorage.setItem("client", JSON.stringify(client))
    }
    removeClient(){
        localStorage.removeItem("client");
    }


    getAccessToken(){
        const client = this.getClient();
        return client?.accessToken;
    }
    
    getRefreshToken(){
        const client = this.getClient();
        return client?.refreshToken;
    }

    updateAccessToken(token){
        let client = this.getClient();
        client.accessToken = token;
        this.setClient(client);
    }
}

export default new Token();