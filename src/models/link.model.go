package models

type SetLink struct {
	Label       string `json:"label"`
	Alias       string `json:"alias,omitempty"`
	TargetID    int    `json:"target_id"`
	TargetTitle string `json:"target_title"`
	OneSided    bool   `json:"one_sided"`
}

type Backlink struct {
	ID       int    `json:"id"`
	Title    string `json:"title"`
	OneSided bool   `json:"one_sided"`
}

type GraphNode struct {
	ID        int    `json:"id"`
	Title     string `json:"title"`
	Links     int    `json:"links"`
	Backlinks int    `json:"backlinks"`
	Updated   string `json:"updated"`
}

type GraphEdge struct {
	From     int  `json:"from"`
	To       int  `json:"to"`
	OneSided bool `json:"one_sided"`
}

type Graph struct {
	Nodes []GraphNode `json:"nodes"`
	Edges []GraphEdge `json:"edges"`
}
