package handlers

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/datatypes"
	"gorm.io/gorm"

	"myorg/apps/api/internal/models"
	"myorg/apps/api/internal/services"
)

// MyOrgHandler holds custom MyOrg endpoints beyond generated CRUD.
type MyOrgHandler struct {
	DB                   *gorm.DB
	OrgSettings          *services.OrganizationSettingService
	Events               *services.EventService
	Attendances          *services.AttendanceService
	PermissionRequests   *services.PermissionRequestService
	Recruitments         *services.RecruitmentService
	RecruitmentFields    *services.RecruitmentCustomFieldService
	RecruitmentSubmitSvc *services.RecruitmentSubmissionService
	Permissions          *services.PermissionChecker
	Uploads              *UploadHandler
}

// GetPublicSettings returns branding subset for login pages (public).
func (h *MyOrgHandler) GetPublicSettings(c *gin.Context) {
	s, err := h.OrgSettings.GetSingleton()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"data": gin.H{
				"web_name": "MyOrg System",
				"logo_url": "",
				"icon_url": "",
				"theme":    "default",
				"allow_self_register": false,
			},
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"web_name":            s.WebName,
			"logo_url":            s.LogoUrl,
			"icon_url":            s.IconUrl,
			"theme":               s.Theme,
			"allow_self_register": s.AllowSelfRegister,
		},
	})
}

// GetMe returns the authenticated user with MyOrg relations.
func (h *MyOrgHandler) GetMe(c *gin.Context) {
	userID, _ := c.Get("user_id")
	var user models.User
	if err := h.DB.Preload("Division").Preload("AppRole").Where("id = ?", userID).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"code": "NOT_FOUND", "message": "User not found"}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": user})
}

// ListMyPermissions returns permission codes for the current user's AppRole.
// Grit ADMIN base role receives all known permission codes.
func (h *MyOrgHandler) ListMyPermissions(c *gin.Context) {
	raw, _ := c.Get("user")
	user, ok := raw.(models.User)
	if !ok {
		if ptr, ok2 := raw.(*models.User); ok2 && ptr != nil {
			user = *ptr
		}
	}

	if user.Role == models.RoleAdmin {
		var codes []string
		h.DB.Model(&models.Permission{}).Order("code asc").Pluck("code", &codes)
		if codes == nil {
			codes = []string{}
		}
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"codes": codes, "is_grit_admin": true}})
		return
	}

	codes, err := h.Permissions.ListCodesForRole(user.AppRoleID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"code": "INTERNAL_ERROR", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"codes": codes, "is_grit_admin": false}})
}

type updateMeRequest struct {
	FullName  string  `json:"full_name"`
	Hometown  string  `json:"hometown"`
	Phone     string  `json:"phone"`
	Avatar    string  `json:"avatar"`
	BirthDate *string `json:"birth_date"`
}

// UpdateMe updates profile fields for the current user.
func (h *MyOrgHandler) UpdateMe(c *gin.Context) {
	userID, _ := c.Get("user_id")
	var req updateMeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}
	updates := map[string]interface{}{
		"full_name": req.FullName,
		"hometown":  req.Hometown,
		"phone":     req.Phone,
	}
	if req.Avatar != "" {
		updates["avatar"] = req.Avatar
	}
	if req.BirthDate != nil && *req.BirthDate != "" {
		if t, err := time.Parse("2006-01-02", *req.BirthDate); err == nil {
			updates["birth_date"] = t
		}
	}
	if err := h.DB.Model(&models.User{}).Where("id = ?", userID).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"code": "INTERNAL_ERROR", "message": "Failed to update profile"}})
		return
	}
	h.GetMe(c)
}

type changePasswordRequest struct {
	OldPassword string `json:"old_password" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=8"`
}

// ChangeMyPassword updates the current user's password.
func (h *MyOrgHandler) ChangeMyPassword(c *gin.Context) {
	userID, _ := c.Get("user_id")
	var req changePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}
	var user models.User
	if err := h.DB.Where("id = ?", userID).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"code": "NOT_FOUND", "message": "User not found"}})
		return
	}
	if !user.CheckPassword(req.OldPassword) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": gin.H{"code": "INVALID_CREDENTIALS", "message": "Password lama salah"}})
		return
	}
	user.Password = req.NewPassword
	if err := h.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"code": "INTERNAL_ERROR", "message": "Failed to update password"}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Password updated"})
}

// EventRecap returns attendance aggregation for an event.
func (h *MyOrgHandler) EventRecap(c *gin.Context) {
	eventID := c.Param("id")
	var event models.Event
	if err := h.DB.First(&event, "id = ?", eventID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"code": "NOT_FOUND", "message": "Event not found"}})
		return
	}
	var attendances []models.Attendance
	h.DB.Preload("User").Where("event_id = ?", eventID).Find(&attendances)

	summary := gin.H{"present": 0, "permitted": 0, "absent": 0, "other": 0}
	for _, a := range attendances {
		switch a.Status {
		case "present":
			summary["present"] = summary["present"].(int) + 1
		case "permitted":
			summary["permitted"] = summary["permitted"].(int) + 1
		case "absent":
			summary["absent"] = summary["absent"].(int) + 1
		default:
			summary["other"] = summary["other"].(int) + 1
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"event":       event,
			"summary":     summary,
			"attendances": attendances,
		},
	})
}

type submitAttendanceRequest struct {
	SelfieUrl    string `json:"selfie_url"`
	SignatureUrl string `json:"signature_url"`
}

// SubmitAttendance records attendance for the current user on an ongoing event.
func (h *MyOrgHandler) SubmitAttendance(c *gin.Context) {
	eventID := c.Param("id")
	userID, _ := c.Get("user_id")
	var req submitAttendanceRequest
	_ = c.ShouldBindJSON(&req)

	item := &models.Attendance{
		EventID:      eventID,
		UserID:       userID.(string),
		Status:       "present",
		SelfieUrl:    req.SelfieUrl,
		SignatureUrl: req.SignatureUrl,
	}
	if err := h.Attendances.Create(item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": item, "message": "Attendance recorded"})
}

// GetMyAttendance returns the current user's attendance for an event, if any.
func (h *MyOrgHandler) GetMyAttendance(c *gin.Context) {
	eventID := c.Param("id")
	userID, _ := c.Get("user_id")
	var item models.Attendance
	if err := h.DB.Where("event_id = ? AND user_id = ?", eventID, userID).First(&item).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{"code": "NOT_FOUND", "message": "No attendance record for this event"},
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": item})
}

type reviewPermissionRequest struct {
	Action string `json:"action" binding:"required"` // approve | reject
	Note   string `json:"note"`
}

// ReviewPermissionRequest approves or rejects a permission request.
func (h *MyOrgHandler) ReviewPermissionRequest(c *gin.Context) {
	id := c.Param("id")
	userID, _ := c.Get("user_id")
	var req reviewPermissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}
	item, err := h.PermissionRequests.Review(id, req.Action, userID.(string), req.Note)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": item, "message": "Permission request reviewed"})
}

type createPermissionBody struct {
	EventID  string `json:"event_id" binding:"required"`
	Reason   string `json:"reason" binding:"required"`
	ProofUrl string `json:"proof_url" binding:"required"`
}

// CreateMyPermissionRequest lets the current user submit a leave request.
func (h *MyOrgHandler) CreateMyPermissionRequest(c *gin.Context) {
	userID, _ := c.Get("user_id")
	var req createPermissionBody
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}
	item := &models.PermissionRequest{
		EventID:  req.EventID,
		UserID:   userID.(string),
		Reason:   req.Reason,
		ProofUrl: req.ProofUrl,
		Status:   "pending",
	}
	if err := h.PermissionRequests.Create(item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": item})
}

// ListMyPermissionRequests returns the current user's permission history.
func (h *MyOrgHandler) ListMyPermissionRequests(c *gin.Context) {
	userID, _ := c.Get("user_id")
	var items []models.PermissionRequest
	h.DB.Preload("Event").Where("user_id = ?", userID).Order("created_at desc").Find(&items)
	c.JSON(http.StatusOK, gin.H{"data": items})
}

// GetPublicRecruitment returns an open recruitment form by slug (public).
func (h *MyOrgHandler) GetPublicRecruitment(c *gin.Context) {
	slug := c.Param("slug")
	var rec models.Recruitment
	if err := h.DB.Where("slug = ? AND status = ?", slug, "open").First(&rec).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"code": "NOT_FOUND", "message": "Recruitment not found or closed"}})
		return
	}
	var fields []models.RecruitmentCustomField
	h.DB.Where("recruitment_id = ?", rec.ID).Order("order_index asc").Find(&fields)
	var targets []models.RecruitmentTargetDivision
	h.DB.Preload("Division").Where("recruitment_id = ?", rec.ID).Find(&targets)
	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"recruitment": rec,
			"fields":      fields,
			"targets":     targets,
		},
	})
}

type publicSubmitBody struct {
	Name               string                 `json:"name" binding:"required"`
	Nim                string                 `json:"nim"`
	DivisionInterestID string                 `json:"division_interest_id" binding:"required"`
	Contact            string                 `json:"contact" binding:"required"`
	CustomAnswers      map[string]interface{} `json:"custom_answers"`
}

// SubmitPublicRecruitment accepts a public recruitment application.
func (h *MyOrgHandler) SubmitPublicRecruitment(c *gin.Context) {
	slug := c.Param("slug")
	var rec models.Recruitment
	if err := h.DB.Where("slug = ? AND status = ?", slug, "open").First(&rec).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"code": "NOT_FOUND", "message": "Recruitment not found or closed"}})
		return
	}
	var req publicSubmitBody
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}
	raw, _ := json.Marshal(req.CustomAnswers)
	item := &models.RecruitmentSubmission{
		RecruitmentID:      rec.ID,
		Name:               req.Name,
		Nim:                req.Nim,
		DivisionInterestID: req.DivisionInterestID,
		Contact:            req.Contact,
		CustomAnswers:      datatypes.JSON(raw),
		Status:             "pending",
	}
	if err := h.RecruitmentSubmitSvc.Create(item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": item, "message": "Submission received"})
}

// UploadPublicRecruitmentFile stores a file for an open recruitment form (no auth).
// Query: field_id (optional) — must reference a file-type custom field on this recruitment.
func (h *MyOrgHandler) UploadPublicRecruitmentFile(c *gin.Context) {
	if h.Uploads == nil || h.Uploads.Storage == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": gin.H{"code": "STORAGE_UNAVAILABLE", "message": "File storage is not configured"},
		})
		return
	}

	slug := c.Param("slug")
	var rec models.Recruitment
	if err := h.DB.Where("slug = ? AND status = ?", slug, "open").First(&rec).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{"code": "NOT_FOUND", "message": "Recruitment not found or closed"},
		})
		return
	}

	fieldID := c.Query("field_id")
	if fieldID != "" {
		var field models.RecruitmentCustomField
		if err := h.DB.Where("id = ? AND recruitment_id = ?", fieldID, rec.ID).First(&field).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": gin.H{"code": "INVALID_FIELD", "message": "Custom field not found for this recruitment"},
			})
			return
		}
		if field.FieldType != "file" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": gin.H{"code": "INVALID_FIELD", "message": "Field is not a file upload"},
			})
			return
		}
		if accept := fileAcceptsFromOptions(field.FieldOptions); accept != "" {
			q := c.Request.URL.Query()
			q.Set("accepts", accept)
			c.Request.URL.RawQuery = q.Encode()
		}
	} else if c.Query("accepts") == "" {
		q := c.Request.URL.Query()
		q.Set("accepts", "image,pdf,doc")
		c.Request.URL.RawQuery = q.Encode()
	}

	var uploaderID string
	if err := h.DB.Model(&models.User{}).Order("created_at ASC").Limit(1).Pluck("id", &uploaderID).Error; err != nil || uploaderID == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": gin.H{"code": "UPLOAD_FAILED", "message": "No system user available for public uploads"},
		})
		return
	}
	c.Set("user_id", uploaderID)
	h.Uploads.Create(c)
}

func fileAcceptsFromOptions(opts datatypes.JSONSlice[string]) string {
	if len(opts) == 0 {
		return ""
	}
	allowed := map[string]bool{
		"image": true, "video": true, "pdf": true, "doc": true,
		"excel": true, "csv": true, "zip": true, "archive": true, "all": true,
	}
	var parts []string
	for _, raw := range opts {
		for _, piece := range strings.Split(raw, ",") {
			piece = strings.TrimSpace(strings.ToLower(piece))
			if allowed[piece] {
				parts = append(parts, piece)
			}
		}
	}
	return strings.Join(parts, ",")
}
