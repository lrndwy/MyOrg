package services_test

import (
	"testing"

	"myorg/apps/api/internal/services"
)

func TestPermissionCheckerNilRole(t *testing.T) {
	c := services.NewPermissionChecker(nil)
	ok, err := c.UserHasPermission(nil, "events.view")
	if err == nil {
		t.Fatal("expected error when DB is nil")
	}
	if ok {
		t.Fatal("expected false")
	}
}
