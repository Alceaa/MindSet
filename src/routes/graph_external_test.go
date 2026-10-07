package routes

import (
	"fmt"
	"testing"
	"time"

	"mindset/utils"

	"github.com/gofiber/fiber/v2"
)

func TestGraphIncludesExternalSets(t *testing.T) {
	app := setupApp(t)
	cfg := utils.Config()

	suffix := time.Now().UnixNano()
	authorLogin := fmt.Sprintf("gea_%d", suffix)
	viewerLogin := fmt.Sprintf("gev_%d", suffix)
	const password = "sup3r-secret-password"

	t.Cleanup(func() {
		deleteUsers(t, cfg.DBUrl, []string{authorLogin, viewerLogin})
	})

	authorCookies := registerSnapshotUser(t, app, authorLogin, password)
	viewerCookies := registerSnapshotUser(t, app, viewerLogin, password)

	external := createPublicSet(t, app, authorCookies, "Внешний сет", "тело внешнего сета", false)

	_, emptyGraph, raw := call(t, app, callOptions{Method: fiber.MethodGet, Path: "/graph", Cookies: viewerCookies})
	if len(emptyGraph.Nodes) != 0 || len(emptyGraph.Edges) != 0 {
		t.Fatalf("чужой публичный сет попал в граф без ссылки: %s", raw)
	}

	ref := fmt.Sprintf("@%s/%s", authorLogin, external.Slug)
	resp, body, raw := call(t, app, callOptions{
		Method:  fiber.MethodPost,
		Path:    "/sets",
		Cookies: viewerCookies,
		Body: map[string]string{
			"title":   "Мой сет",
			"content": fmt.Sprintf("Ссылка на [[%s|Внешний сет]]\n", ref),
		},
	})
	if resp.StatusCode != fiber.StatusCreated || body.Set == nil {
		t.Fatalf("создание сета с внешней ссылкой = %d (%s)", resp.StatusCode, raw)
	}
	ownID := body.Set.ID

	link := findLink(body.Links, ref)
	if link == nil || link.TargetID != external.ID || link.Own || link.Broken {
		t.Fatalf("внешняя ссылка разобрана неверно: %+v", body.Links)
	}

	_, graphBody, raw := call(t, app, callOptions{Method: fiber.MethodGet, Path: "/graph", Cookies: viewerCookies})
	if len(graphBody.Nodes) != 2 {
		t.Fatalf("ожидались свой и внешний сет в графе, получено %d: %s", len(graphBody.Nodes), raw)
	}

	externalNode := findNode(graphBody.Nodes, external.ID)
	if externalNode == nil || externalNode.Own {
		t.Fatalf("внешний сет не отмечен как внешний: %+v", graphBody.Nodes)
	}
	if externalNode.Title != "Внешний сет" || externalNode.Slug != external.Slug || externalNode.Login != authorLogin {
		t.Fatalf("внешний узел графа размечен неверно: %+v", externalNode)
	}

	ownNode := findNode(graphBody.Nodes, ownID)
	if ownNode == nil || !ownNode.Own {
		t.Fatalf("свой сет должен быть помечен как свой: %+v", graphBody.Nodes)
	}

	if edge := findEdge(graphBody.Edges, ownID, external.ID); edge == nil || !edge.OneSided {
		t.Fatalf("нет одностороннего ребра на внешний сет: %+v", graphBody.Edges)
	}

	resp, _, raw = call(t, app, callOptions{
		Method:  fiber.MethodPut,
		Path:    fmt.Sprintf("/sets/%d", external.ID),
		Cookies: authorCookies,
		Body: map[string]any{
			"title":      "Внешний сет",
			"visibility": "private",
			"content":    "тело внешнего сета",
		},
	})
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("смена видимости внешнего сета = %d (%s)", resp.StatusCode, raw)
	}

	_, privateGraph, raw := call(t, app, callOptions{Method: fiber.MethodGet, Path: "/graph", Cookies: viewerCookies})
	if len(privateGraph.Nodes) != 1 || findNode(privateGraph.Nodes, external.ID) != nil {
		t.Fatalf("приватный чужой сет не должен попадать в граф: %s", raw)
	}
	if len(privateGraph.Edges) != 0 {
		t.Fatalf("ребро на приватный чужой сет не должно рисоваться: %+v", privateGraph.Edges)
	}
}
