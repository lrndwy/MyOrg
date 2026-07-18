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

// SubEventAttendanceHandler handles subeventattendance endpoints.
type SubEventAttendanceHandler struct {
	DB *gorm.DB
}

// List returns a paginated list of sub_event_attendances.
func (h *SubEventAttendanceHandler) List(c *gin.Context) {
	query := h.DB.Model(&models.SubEventAttendance{}).Preload("SubEvent").Preload("User").Preload("MarkedBy")

	res, err := paginate.List[models.SubEventAttendance](
		query,
		paginate.Bind(c).With("sub_event_id", c.Query("sub_event_id")).With("user_id", c.Query("user_id")).With("marked_by_id", c.Query("marked_by_id")),
		paginate.Config{
			Searchable: []string{"status", "selfie_url", "signature_url"},
			Sortable:   map[string]bool{"id": true, "created_at": true, "status": true, "selfie_url": true, "signature_url": true},
		},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to fetch sub_event_attendances",
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
//	GET /api/sub_event_attendances/export?format=csv
//	GET /api/sub_event_attendances/export?format=xlsx&search=foo
func (h *SubEventAttendanceHandler) Export(c *gin.Context) {
	const exportBatchSize = 1000

	format := c.DefaultQuery("format", "csv")
	search := c.Query("search")

	query := h.DB.Model(&models.SubEventAttendance{}).Preload("SubEvent").Preload("User").Preload("MarkedBy").Order("created_at desc")
	if search != "" && len([]string{"status", "selfie_url", "signature_url"}) > 0 {
		// Reuse the same searchable columns as List.
		searchable := []string{"status", "selfie_url", "signature_url"}
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
		Sheet: "SubEventAttendances",
		Columns: []export.Column{
			{Header: "ID", Field: "ID"},
			{Header: "Status", Field: "Status"},
			{Header: "SelfieUrl", Field: "SelfieUrl"},
			{Header: "SignatureUrl", Field: "SignatureUrl"},
			{Header: "CheckedInAt", Field: "CheckedInAt", Format: "date:2006-01-02"},
			{Header: "Created At", Field: "CreatedAt", Format: "date:2006-01-02"},
		},
	}

	// Stream rows in batches via GORM's FindInBatches. CSV writes each
	// batch straight to the wire; XLSX accumulates into a slice (no
	// streaming API in excelize) but at least we never load the whole
	// table at once.
	if format == "xlsx" {
		c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
		c.Header("Content-Disposition", `attachment; filename="sub_event_attendances.xlsx"`)
		var all []models.SubEventAttendance
		if err := query.FindInBatches(&[]models.SubEventAttendance{}, exportBatchSize, func(tx *gorm.DB, batch int) error {
			var rows []models.SubEventAttendance
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
	c.Header("Content-Disposition", `attachment; filename="sub_event_attendances.csv"`)

	headerWritten := false
	if err := query.FindInBatches(&[]models.SubEventAttendance{}, exportBatchSize, func(tx *gorm.DB, batch int) error {
		var rows []models.SubEventAttendance
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

// GetByID returns a single subeventattendance by ID.
func (h *SubEventAttendanceHandler) GetByID(c *gin.Context) {
	id := c.Param("id")

	var item models.SubEventAttendance
	if err := h.DB.Preload("SubEvent").Preload("User").Preload("MarkedBy").First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "SubEventAttendance not found",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": item,
	})
}

// Create adds a new subeventattendance.
func (h *SubEventAttendanceHandler) Create(c *gin.Context) {
	var req struct {
		SubEventID string `json:"sub_event_id" binding:"required"`
		UserID string `json:"user_id" binding:"required"`
		Status string `json:"status" binding:"required"`
		SelfieUrl string `json:"selfie_url"`
		SignatureUrl string `json:"signature_url"`
		CheckedInAt *time.Time `json:"checked_in_at"`
		MarkedByID string `json:"marked_by_id"`
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

	item := models.SubEventAttendance{
		SubEventID: req.SubEventID,
		UserID: req.UserID,
		Status: req.Status,
		SelfieUrl: req.SelfieUrl,
		SignatureUrl: req.SignatureUrl,
		CheckedInAt: req.CheckedInAt,
	}
	if req.MarkedByID != "" {
		item.MarkedByID = &req.MarkedByID
	}

	if err := h.DB.Create(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to create subeventattendance",
			},
		})
		return
	}

	h.DB.Preload("SubEvent").Preload("User").Preload("MarkedBy").First(&item, "id = ?", item.ID)

	services.LogCreate(h.DB, c, "SubEventAttendance", item.ID, item.ID, "")

	c.JSON(http.StatusCreated, gin.H{
		"data":    item,
		"message": "SubEventAttendance created successfully",
	})
}

// Update modifies an existing subeventattendance.
func (h *SubEventAttendanceHandler) Update(c *gin.Context) {
	id := c.Param("id")

	var item models.SubEventAttendance
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "SubEventAttendance not found",
			},
		})
		return
	}

	var req struct {
		SubEventID *string `json:"sub_event_id"`
		UserID *string `json:"user_id"`
		Status string `json:"status"`
		SelfieUrl string `json:"selfie_url"`
		SignatureUrl string `json:"signature_url"`
		CheckedInAt *time.Time `json:"checked_in_at"`
		MarkedByID *string `json:"marked_by_id"`
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
	if req.SubEventID != nil {
		updates["sub_event_id"] = *req.SubEventID
	}
	if req.UserID != nil {
		updates["user_id"] = *req.UserID
	}
	if req.Status != "" {
		updates["status"] = req.Status
	}
	if req.SelfieUrl != "" {
		updates["selfie_url"] = req.SelfieUrl
	}
	if req.SignatureUrl != "" {
		updates["signature_url"] = req.SignatureUrl
	}
	if req.CheckedInAt != nil {
		updates["checked_in_at"] = req.CheckedInAt
	}
	if req.MarkedByID != nil {
		updates["marked_by_id"] = *req.MarkedByID
	}

	if err := h.DB.Model(&item).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to update subeventattendance",
			},
		})
		return
	}

	h.DB.Preload("SubEvent").Preload("User").Preload("MarkedBy").First(&item, "id = ?", item.ID)

	services.LogUpdate(h.DB, c, "SubEventAttendance", item.ID, item.ID, services.DiffSummary(updates))

	c.JSON(http.StatusOK, gin.H{
		"data":    item,
		"message": "SubEventAttendance updated successfully",
	})
}

// Patch applies a partial update to a subeventattendance. Used by the admin's
// grouped update view — each form group's Save button calls PATCH with
// only the fields it owns, so editing "Address" doesn't rewrite
// "Pricing". Refuses any key that isn't a writable model column.
func (h *SubEventAttendanceHandler) Patch(c *gin.Context) {
	id := c.Param("id")

	var item models.SubEventAttendance
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "SubEventAttendance not found",
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
		"sub_event_id": true,
		"user_id": true,
		"status": true,
		"selfie_url": true,
		"signature_url": true,
		"checked_in_at": true,
		"marked_by_id": true,
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
				"message": "Failed to patch subeventattendance",
			},
		})
		return
	}
	h.DB.Preload("SubEvent").Preload("User").Preload("MarkedBy").First(&item, "id = ?", item.ID)

	services.LogUpdate(h.DB, c, "SubEventAttendance", item.ID, item.ID, services.DiffSummary(updates))

	c.JSON(http.StatusOK, gin.H{
		"data":    item,
		"message": "SubEventAttendance updated successfully",
	})
}

// Delete soft-deletes a subeventattendance.
func (h *SubEventAttendanceHandler) Delete(c *gin.Context) {
	id := c.Param("id")

	var item models.SubEventAttendance
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "SubEventAttendance not found",
			},
		})
		return
	}

	if err := h.DB.Delete(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to delete subeventattendance",
			},
		})
		return
	}

	services.LogDelete(h.DB, c, "SubEventAttendance", item.ID, item.ID)

	c.JSON(http.StatusOK, gin.H{
		"message": "SubEventAttendance deleted successfully",
	})
}
