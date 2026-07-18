package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"myorg/apps/api/internal/models"
	"myorg/apps/api/internal/services"
)

// RequirePermission returns gin middleware that requires the given permission code.
// Grit base Role ADMIN bypasses the check. Uses AppRoleID for custom RBAC.
func RequirePermission(checker *services.PermissionChecker, code string) gin.HandlerFunc {
	return func(c *gin.Context) {
		raw, exists := c.Get("user")
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": gin.H{"code": "UNAUTHORIZED", "message": "Authentication required"},
			})
			return
		}

		var user models.User
		switch v := raw.(type) {
		case models.User:
			user = v
		case *models.User:
			if v == nil {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
					"error": gin.H{"code": "UNAUTHORIZED", "message": "Invalid user context"},
				})
				return
			}
			user = *v
		default:
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": gin.H{"code": "UNAUTHORIZED", "message": "Invalid user context"},
			})
			return
		}

		if user.Role == models.RoleAdmin {
			c.Next()
			return
		}

		if checker == nil || checker.DB == nil {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": gin.H{"code": "FORBIDDEN", "message": "Tidak memiliki akses"},
			})
			return
		}

		ok, err := checker.UserHasPermission(user.AppRoleID, code)
		if err != nil || !ok {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": gin.H{"code": "FORBIDDEN", "message": "Tidak memiliki akses"},
			})
			return
		}
		c.Next()
	}
}

// RequireAnyPermission returns middleware that passes when the user has any listed permission code.
func RequireAnyPermission(checker *services.PermissionChecker, codes ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		raw, exists := c.Get("user")
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": gin.H{"code": "UNAUTHORIZED", "message": "Authentication required"},
			})
			return
		}

		var user models.User
		switch v := raw.(type) {
		case models.User:
			user = v
		case *models.User:
			if v == nil {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
					"error": gin.H{"code": "UNAUTHORIZED", "message": "Invalid user context"},
				})
				return
			}
			user = *v
		default:
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": gin.H{"code": "UNAUTHORIZED", "message": "Invalid user context"},
			})
			return
		}

		if user.Role == models.RoleAdmin {
			c.Next()
			return
		}

		if checker == nil || checker.DB == nil {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": gin.H{"code": "FORBIDDEN", "message": "Tidak memiliki akses"},
			})
			return
		}

		ok, err := checker.UserHasAnyPermission(user.AppRoleID, codes...)
		if err != nil || !ok {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": gin.H{"code": "FORBIDDEN", "message": "Tidak memiliki akses"},
			})
			return
		}
		c.Next()
	}
}
