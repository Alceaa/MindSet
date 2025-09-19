import api from "./api";
class SetService{
    createSet(title, description){
        return api
            .post("create-set/", {
                "title": title,
                "description": description
            })
    }
}
export default new SetService();