package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"myorg/apps/api/internal/models"
)

func TestRequirePermission_AdminBypass(t *testing.T) {
	gin.SetMode(gin.TestMode)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("user", models.User{Role: models.RoleAdmin})

	handler := RequirePermission(nil, "events.view")
	handler(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, w.Code)
	}
	if c.IsAborted() {
		t.Fatal("expected request not to be aborted for admin")
	}
}
