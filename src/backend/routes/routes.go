package routes

import (
	"github.com/gorilla/mux"
)

func SetupRoutes() *mux.Router {
	r := mux.NewRouter()
	//r.HandleFunc("/api/user", handlers.GetUser).Methods("POST")
	return r
}
