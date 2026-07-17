package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"myorg/apps/api/internal/services"
)

// PushHandler manages Web Push subscription endpoints.
type PushHandler struct {
	DB   *gorm.DB
	Push *services.PushService
}

// VapidPublicKey returns the public VAPID key for PushManager.subscribe.
// Auth optional — key is public by design — but we keep it behind auth so
// only logged-in members subscribe.
func (h *PushHandler) VapidPublicKey(c *gin.Context) {
	if h.Push == nil || h.Push.VAPIDPublicKey == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": gin.H{
				"code":    "PUSH_NOT_CONFIGURED",
				"message": "Web Push is not configured (missing VAPID keys)",
			},
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"public_key": h.Push.VAPIDPublicKey,
		},
	})
}

// Subscribe upserts the browser's PushSubscription for the current user.
func (h *PushHandler) Subscribe(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid, _ := userID.(string)
	if uid == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": gin.H{"code": "UNAUTHORIZED", "message": "Authentication required"},
		})
		return
	}

	var req services.PushSubscribeInput
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()},
		})
		return
	}

	if h.Push == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": gin.H{"code": "PUSH_NOT_CONFIGURED", "message": "Web Push is not configured"},
		})
		return
	}

	if err := h.Push.UpsertSubscription(uid, req, c.Request.UserAgent()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "INTERNAL_ERROR", "message": err.Error()},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Subscribed to push notifications"})
}

// Unsubscribe removes a subscription by endpoint.
func (h *PushHandler) Unsubscribe(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid, _ := userID.(string)
	if uid == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": gin.H{"code": "UNAUTHORIZED", "message": "Authentication required"},
		})
		return
	}

	var req struct {
		Endpoint string `json:"endpoint" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()},
		})
		return
	}

	if h.Push == nil {
		c.JSON(http.StatusOK, gin.H{"message": "Unsubscribed"})
		return
	}

	_ = h.Push.DeleteSubscription(uid, req.Endpoint)
	c.JSON(http.StatusOK, gin.H{"message": "Unsubscribed"})
}
