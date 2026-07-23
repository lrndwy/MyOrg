package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"myorg/apps/api/internal/models"
)

func userFromContext(c *gin.Context) (models.User, bool) {
	raw, ok := c.Get("user")
	if !ok {
		return models.User{}, false
	}
	switch v := raw.(type) {
	case models.User:
		return v, true
	case *models.User:
		if v == nil {
			return models.User{}, false
		}
		return *v, true
	default:
		return models.User{}, false
	}
}

func (h *UploadHandler) canManageStorage(c *gin.Context, user models.User) bool {
	if user.Role == models.RoleAdmin {
		return true
	}
	if h.Perms == nil || user.AppRoleID == nil {
		return false
	}
	ok, err := h.Perms.UserHasPermission(user.AppRoleID, "storage.manage")
	return err == nil && ok
}

func (h *UploadHandler) requireStorageView(c *gin.Context) (models.User, bool) {
	user, ok := userFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": gin.H{"code": "UNAUTHORIZED", "message": "Authentication required"},
		})
		return models.User{}, false
	}
	return user, true
}

func (h *UploadHandler) uploadVisibleTo(c *gin.Context, upload *models.Upload, user models.User) bool {
	if upload.UserID == user.ID {
		return true
	}
	return h.canManageStorage(c, user)
}
