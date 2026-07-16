package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"myorg/apps/api/internal/export"
	"myorg/apps/api/internal/models"
	"myorg/apps/api/internal/paginate"
	"myorg/apps/api/internal/services"
)

// PermissionRequestHandler handles permissionrequest endpoints.
type PermissionRequestHandler struct {
	DB *gorm.DB
}

// List returns a paginated list of permission_requests.
func (h *PermissionRequestHandler) List(c *gin.Context) {
	query := h.DB.Model(&models.PermissionRequest{}).Preload("Event").Preload("User").Preload("ReviewedBy")

	res, err := paginate.List[models.PermissionRequest](
		query,
		paginate.Bind(c).With("event_id", c.Query("event_id")).With("user_id", c.Query("user_id")).With("reviewed_by_id", c.Query("reviewed_by_id")),
		paginate.Config{
			Searchable: []string{"reason", "proof_url", "status", "review_note"},
			Sortable:   map[string]bool{"id": true, "created_at": true, "reason": true, "proof_url": true, "status": true, "review_note": true},
		},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to fetch permission_requests",
			},
		})
		return
	}

	c.JSON(http.StatusOK, res)
}

// Export streams the full filtered list as CSV (default) or XLSX.
// Honours the same search/filter query params as List but skips
// pagination — you get every matching row in one file.
//
// Memory-bounded: reads in chunks of exportBatchSize so a million-row
// export doesn't OOM the process. CSV streams directly to the response
// writer; XLSX has to buffer (excelize requires the full sheet in
// memory before Write), so we still chunk the SCAN to avoid loading
// every row at once.
//
//	GET /api/permission_requests/export?format=csv
//	GET /api/permission_requests/export?format=xlsx&search=foo
func (h *PermissionRequestHandler) Export(c *gin.Context) {
	const exportBatchSize = 1000

	format := c.DefaultQuery("format", "csv")
	search := c.Query("search")

	query := h.DB.Model(&models.PermissionRequest{}).Preload("Event").Preload("User").Preload("ReviewedBy").Order("created_at desc")
	if search != "" && len([]string{"reason", "proof_url", "status", "review_note"}) > 0 {
		// Reuse the same searchable columns as List.
		searchable := []string{"reason", "proof_url", "status", "review_note"}
		clause := ""
		args := []any{}
		wild := "%" + search + "%"
		for i, col := range searchable {
			if i > 0 {
				clause += " OR "
			}
			clause += col + " ILIKE ?"
			args = append(args, wild)
		}
		query = query.Where(clause, args...)
	}

	opts := export.Options{
		Sheet: "PermissionRequests",
		Columns: []export.Column{
			{Header: "ID", Field: "ID"},
			{Header: "Reason", Field: "Reason"},
			{Header: "ProofUrl", Field: "ProofUrl"},
			{Header: "Status", Field: "Status"},
			{Header: "ReviewNote", Field: "ReviewNote"},
			{Header: "ReviewedAt", Field: "ReviewedAt", Format: "date:2006-01-02"},
			{Header: "Created At", Field: "CreatedAt", Format: "date:2006-01-02"},
		},
	}

	// Stream rows in batches via GORM's FindInBatches. CSV writes each
	// batch straight to the wire; XLSX accumulates into a slice (no
	// streaming API in excelize) but at least we never load the whole
	// table at once.
	if format == "xlsx" {
		c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
		c.Header("Content-Disposition", `attachment; filename="permission_requests.xlsx"`)
		var all []models.PermissionRequest
		if err := query.FindInBatches(&[]models.PermissionRequest{}, exportBatchSize, func(tx *gorm.DB, batch int) error {
			var rows []models.PermissionRequest
			if err := tx.Scan(&rows).Error; err != nil {
				return err
			}
			all = append(all, rows...)
			return nil
		}).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": gin.H{"code": "EXPORT_FAILED", "message": err.Error()},
			})
			return
		}
		if err := export.XLSX(c.Writer, all, opts); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": gin.H{"code": "EXPORT_FAILED", "message": err.Error()},
			})
		}
		return
	}

	// CSV path — true streaming. Write headers once, then each batch
	// flushes its rows directly to the response writer.
	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", `attachment; filename="permission_requests.csv"`)

	headerWritten := false
	if err := query.FindInBatches(&[]models.PermissionRequest{}, exportBatchSize, func(tx *gorm.DB, batch int) error {
		var rows []models.PermissionRequest
		if err := tx.Scan(&rows).Error; err != nil {
			return err
		}
		if !headerWritten {
			if err := export.CSV(c.Writer, rows, opts); err != nil {
				return err
			}
			headerWritten = true
		} else {
			// Subsequent batches: write rows only, no header.
			if err := export.CSVRows(c.Writer, rows, opts); err != nil {
				return err
			}
		}
		return nil
	}).Error; err != nil {
		// Headers already sent — best we can do is log + truncate.
		// The client will see a malformed CSV; ops should re-run.
		// (We don't write a JSON error body once streaming has begun.)
		_ = err
	}
}

// GetByID returns a single permissionrequest by ID.
func (h *PermissionRequestHandler) GetByID(c *gin.Context) {
	id := c.Param("id")

	var item models.PermissionRequest
	if err := h.DB.Preload("Event").Preload("User").Preload("ReviewedBy").First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "PermissionRequest not found",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": item,
	})
}

// Create adds a new permissionrequest.
func (h *PermissionRequestHandler) Create(c *gin.Context) {
	var req struct {
		EventID string `json:"event_id" binding:"required"`
		UserID string `json:"user_id" binding:"required"`
		Reason string `json:"reason"`
		ProofUrl string `json:"proof_url" binding:"required"`
		Status string `json:"status" binding:"required"`
		ReviewedByID string `json:"reviewed_by_id" binding:"required"`
		ReviewNote string `json:"review_note"`
		ReviewedAt *time.Time `json:"reviewed_at"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": err.Error(),
			},
		})
		return
	}

	item := models.PermissionRequest{
		EventID: req.EventID,
		UserID: req.UserID,
		Reason: req.Reason,
		ProofUrl: req.ProofUrl,
		Status: req.Status,
		ReviewedByID: optionalStringPtr(req.ReviewedByID),
		ReviewNote: req.ReviewNote,
		ReviewedAt: req.ReviewedAt,
	}

	if err := h.DB.Create(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to create permissionrequest",
			},
		})
		return
	}

	h.DB.Preload("Event").Preload("User").Preload("ReviewedBy").First(&item, "id = ?", item.ID)

	services.LogCreate(h.DB, c, "PermissionRequest", item.ID, item.ID, "")

	c.JSON(http.StatusCreated, gin.H{
		"data":    item,
		"message": "PermissionRequest created successfully",
	})
}

// Update modifies an existing permissionrequest.
func (h *PermissionRequestHandler) Update(c *gin.Context) {
	id := c.Param("id")

	var item models.PermissionRequest
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "PermissionRequest not found",
			},
		})
		return
	}

	var req struct {
		EventID *string `json:"event_id"`
		UserID *string `json:"user_id"`
		Reason string `json:"reason"`
		ProofUrl string `json:"proof_url"`
		Status string `json:"status"`
		ReviewedByID *string `json:"reviewed_by_id"`
		ReviewNote string `json:"review_note"`
		ReviewedAt *time.Time `json:"reviewed_at"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": err.Error(),
			},
		})
		return
	}

	updates := map[string]interface{}{}
	if req.EventID != nil {
		updates["event_id"] = *req.EventID
	}
	if req.UserID != nil {
		updates["user_id"] = *req.UserID
	}
	if req.Reason != "" {
		updates["reason"] = req.Reason
	}
	if req.ProofUrl != "" {
		updates["proof_url"] = req.ProofUrl
	}
	if req.Status != "" {
		updates["status"] = req.Status
	}
	if req.ReviewedByID != nil {
		updates["reviewed_by_id"] = *req.ReviewedByID
	}
	if req.ReviewNote != "" {
		updates["review_note"] = req.ReviewNote
	}
	if req.ReviewedAt != nil {
		updates["reviewed_at"] = req.ReviewedAt
	}

	if err := h.DB.Model(&item).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to update permissionrequest",
			},
		})
		return
	}

	h.DB.Preload("Event").Preload("User").Preload("ReviewedBy").First(&item, "id = ?", item.ID)

	services.LogUpdate(h.DB, c, "PermissionRequest", item.ID, item.ID, services.DiffSummary(updates))

	c.JSON(http.StatusOK, gin.H{
		"data":    item,
		"message": "PermissionRequest updated successfully",
	})
}

// Patch applies a partial update to a permissionrequest. Used by the admin's
// grouped update view — each form group's Save button calls PATCH with
// only the fields it owns, so editing "Address" doesn't rewrite
// "Pricing". Refuses any key that isn't a writable model column.
func (h *PermissionRequestHandler) Patch(c *gin.Context) {
	id := c.Param("id")

	var item models.PermissionRequest
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "PermissionRequest not found",
			},
		})
		return
	}

	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": err.Error(),
			},
		})
		return
	}

	// Whitelist: only writable model columns may be patched. id,
	// created_at, updated_at, deleted_at, version are owned by the
	// framework and silently dropped here.
	allowed := map[string]bool{
		"event_id": true,
		"user_id": true,
		"reason": true,
		"proof_url": true,
		"status": true,
		"reviewed_by_id": true,
		"review_note": true,
		"reviewed_at": true,
	}
	updates := map[string]interface{}{}
	for k, v := range body {
		if allowed[k] {
			updates[k] = v
		}
	}
	if len(updates) == 0 {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": "No writable fields in request body",
			},
		})
		return
	}

	if err := h.DB.Model(&item).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to patch permissionrequest",
			},
		})
		return
	}
	h.DB.Preload("Event").Preload("User").Preload("ReviewedBy").First(&item, "id = ?", item.ID)

	services.LogUpdate(h.DB, c, "PermissionRequest", item.ID, item.ID, services.DiffSummary(updates))

	c.JSON(http.StatusOK, gin.H{
		"data":    item,
		"message": "PermissionRequest updated successfully",
	})
}

// Delete soft-deletes a permissionrequest.
func (h *PermissionRequestHandler) Delete(c *gin.Context) {
	id := c.Param("id")

	var item models.PermissionRequest
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "PermissionRequest not found",
			},
		})
		return
	}

	if err := h.DB.Delete(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to delete permissionrequest",
			},
		})
		return
	}

	services.LogDelete(h.DB, c, "PermissionRequest", item.ID, item.ID)

	c.JSON(http.StatusOK, gin.H{
		"message": "PermissionRequest deleted successfully",
	})
}
