package models

type AdminUser struct {
	ID             int    `json:"id"`
	Login          string `json:"login"`
	Email          string `json:"email"`
	Role           string `json:"role"`
	EmailVerified  bool   `json:"email_verified"`
	TwoFactorEmail bool   `json:"two_factor_email"`
	Blocked        bool   `json:"blocked"`
	BlockedAt      string `json:"blocked_at"`
	BlockedReason  string `json:"blocked_reason"`
	DateJoined     string `json:"date_joined"`
	SetCount       int    `json:"set_count"`
	LastActivity   string `json:"last_activity"`
}

type AdminAction struct {
	ID         int    `json:"id"`
	AdminLogin string `json:"admin_login"`
	Action     string `json:"action"`
	TargetType string `json:"target_type"`
	TargetID   int    `json:"target_id"`
	Details    string `json:"details"`
	CreatedAt  string `json:"created_at"`
}

type News struct {
	ID          int    `json:"id"`
	Title       string `json:"title"`
	Body        string `json:"body"`
	IsPublished bool   `json:"is_published"`
	IsPinned    bool   `json:"is_pinned"`
	AuthorLogin string `json:"author_login"`
	PublishedAt string `json:"published_at"`
	UpdatedAt   string `json:"updated_at"`
}

type BugReport struct {
	ID        int    `json:"id"`
	Login     string `json:"login"`
	Page      string `json:"page"`
	Topic     string `json:"topic"`
	Message   string `json:"message"`
	Status    string `json:"status"`
	CreatedAt string `json:"created_at"`
}

type BlockUserPayload struct {
	Reason string `json:"reason" validate:"max=300"`
}

type RolePayload struct {
	Role string `json:"role" validate:"required,oneof=user admin"`
}

type NewsPayload struct {
	Title       string `json:"title" validate:"required,min=3,max=200"`
	Body        string `json:"body" validate:"max=20000"`
	IsPublished bool   `json:"is_published"`
	IsPinned    bool   `json:"is_pinned"`
}

type ReportStatusPayload struct {
	Status string `json:"status" validate:"required,oneof=new in_progress done rejected"`
}

type AdminSet struct {
	ID            int    `json:"id"`
	UserID        int    `json:"user_id"`
	Title         string `json:"title"`
	Slug          string `json:"slug"`
	Visibility    string `json:"visibility"`
	ForbidCopies  bool   `json:"forbid_copies"`
	AuthorLogin   string `json:"author_login"`
	LastActivity  string `json:"last_activity"`
	ContentLength int    `json:"content_length"`
}
