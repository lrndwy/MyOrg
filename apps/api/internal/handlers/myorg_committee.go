package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"myorg/apps/api/internal/models"
	"myorg/apps/api/internal/services"
)

type submitSubEventAttendanceRequest struct {
	SelfieUrl    string `json:"selfie_url"`
	SignatureUrl string `json:"signature_url"`
}

type markSubEventAttendanceRequest struct {
	Status string `json:"status" binding:"required"`
}

type uploadSubEventMinutesRequest struct {
	MinutesUrl string `json:"minutes_url" binding:"required"`
}

func (h *MyOrgHandler) actorHasPermission(c *gin.Context, code string) bool {
	user, ok := c.Get("user")
	if !ok {
		return false
	}
	u, ok := user.(models.User)
	if !ok {
		if ptr, ok2 := user.(*models.User); ok2 && ptr != nil {
			u = *ptr
		} else {
			return false
		}
	}
	if u.Role == models.RoleAdmin {
		return true
	}
	if u.AppRoleID == nil || *u.AppRoleID == "" || h.Permissions == nil {
		return false
	}
	hasPerm, _ := h.Permissions.UserHasPermission(u.AppRoleID, code)
	return hasPerm
}

// GetEventCommitteeOverview returns committee structure for a kepanitiaan event.
func (h *MyOrgHandler) GetEventCommitteeOverview(c *gin.Context) {
	svc := &services.EventCommitteeService{DB: h.DB}
	data, err := svc.GetOverview(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": data})
}

// ListEventSubEvents lists sub-events for a committee event.
func (h *MyOrgHandler) ListEventSubEvents(c *gin.Context) {
	svc := &services.EventCommitteeService{DB: h.DB}
	items, err := svc.ListSubEventsForEvent(c.Param("id"), c.Query("sie_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

// ListMyEventSubEvents lists sub-events visible to the current user.
func (h *MyOrgHandler) ListMyEventSubEvents(c *gin.Context) {
	userID, _ := c.Get("user_id")
	svc := &services.EventCommitteeService{DB: h.DB}
	items, err := svc.ListSubEventsForUser(c.Param("id"), userID.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

// GetSubEventRecap returns attendance recap for a sub-event.
func (h *MyOrgHandler) GetSubEventRecap(c *gin.Context) {
	svc := &services.EventCommitteeService{DB: h.DB}
	data, err := svc.GetSubEventRecap(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"code": "NOT_FOUND", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": data})
}

// SubmitSubEventAttendance records selfie attendance for a sub-event.
func (h *MyOrgHandler) SubmitSubEventAttendance(c *gin.Context) {
	userID, _ := c.Get("user_id")
	var req submitSubEventAttendanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}
	svc := &services.EventCommitteeService{DB: h.DB}
	item, err := svc.SubmitSubEventAttendance(c.Param("id"), userID.(string), req.SelfieUrl, req.SignatureUrl)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": item, "message": "Attendance recorded"})
}

// MarkSubEventAttendance manually marks attendance for a user.
func (h *MyOrgHandler) MarkSubEventAttendance(c *gin.Context) {
	actorID, _ := c.Get("user_id")
	var req markSubEventAttendanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}
	svc := &services.EventCommitteeService{DB: h.DB}
	hasPerm := h.actorHasPermission(c, "sub_events.attendance.manage")
	item, err := svc.MarkSubEventAttendance(c.Param("id"), c.Param("userId"), actorID.(string), req.Status, hasPerm)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": item, "message": "Attendance updated"})
}

// UploadSubEventMinutes sets the minutes file URL for a sub-event.
func (h *MyOrgHandler) UploadSubEventMinutes(c *gin.Context) {
	actorID, _ := c.Get("user_id")
	var req uploadSubEventMinutesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}
	svc := &services.EventCommitteeService{DB: h.DB}
	hasPerm := h.actorHasPermission(c, "events.sub_events.manage")
	item, err := svc.UploadSubEventMinutes(c.Param("id"), actorID.(string), req.MinutesUrl, hasPerm)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": item, "message": "Minutes uploaded"})
}

// GetMySubEventAttendance returns current user's attendance for a sub-event.
func (h *MyOrgHandler) GetMySubEventAttendance(c *gin.Context) {
	userID, _ := c.Get("user_id")
	var item models.SubEventAttendance
	if err := h.DB.Where("sub_event_id = ? AND user_id = ?", c.Param("id"), userID).First(&item).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"code": "NOT_FOUND", "message": "No attendance record for this sub event"}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": item})
}
