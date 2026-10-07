package models

type SetLink struct {
	Label        string `json:"label"`
	Alias        string `json:"alias,omitempty"`
	TargetID     int    `json:"target_id"`
	TargetTitle  string `json:"target_title"`
	TargetSlug   string `json:"target_slug,omitempty"`
	TargetUserID int    `json:"target_user_id,omitempty"`
	Own          bool   `json:"own"`
	OneSided     bool   `json:"one_sided"`
	Broken       bool   `json:"broken"`
	ResolvedOnce bool   `json:"resolved_once"`

	SnapshotState  string `json:"snapshot_state,omitempty"`
	SnapshotID     int    `json:"snapshot_id,omitempty"`
	SnapshotTitle  string `json:"snapshot_title,omitempty"`
	LiveAvailable  bool   `json:"live_available"`
	TargetLogin    string `json:"target_login,omitempty"`
	TargetSlugKey  string `json:"target_slug_key,omitempty"`
	TargetActivity string `json:"target_last_activity,omitempty"`
}

type Backlink struct {
	ID       int    `json:"id"`
	Title    string `json:"title"`
	OneSided bool   `json:"one_sided"`
}

type GraphNode struct {
	ID         int    `json:"id"`
	Title      string `json:"title"`
	Links      int    `json:"links"`
	Backlinks  int    `json:"backlinks"`
	Updated    string `json:"updated"`
	Own        bool   `json:"own"`
	Slug       string `json:"slug"`
	Login      string `json:"login"`
	SnapshotID int    `json:"snapshot_id"`
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
