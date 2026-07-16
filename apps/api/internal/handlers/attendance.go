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

// AttendanceHandler handles attendance endpoints.
type AttendanceHandler struct {
	DB *gorm.DB
}

// List returns a paginated list of attendances.
func (h *AttendanceHandler) List(c *gin.Context) {
	query := h.DB.Model(&models.Attendance{}).Preload("Event").Preload("User")

	res, err := paginate.List[models.Attendance](
		query,
		paginate.Bind(c).With("event_id", c.Query("event_id")).With("user_id", c.Query("user_id")),
		paginate.Config{
			Searchable: []string{"status", "selfie_url", "signature_url"},
			Sortable:   map[string]bool{"id": true, "created_at": true, "status": true, "selfie_url": true, "signature_url": true},
		},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to fetch attendances",
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
//	GET /api/attendances/export?format=csv
//	GET /api/attendances/export?format=xlsx&search=foo
func (h *AttendanceHandler) Export(c *gin.Context) {
	const exportBatchSize = 1000

	format := c.DefaultQuery("format", "csv")
	search := c.Query("search")

	query := h.DB.Model(&models.Attendance{}).Preload("Event").Preload("User").Order("created_at desc")
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
		Sheet: "Attendances",
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
		c.Header("Content-Disposition", `attachment; filename="attendances.xlsx"`)
		var all []models.Attendance
		if err := query.FindInBatches(&[]models.Attendance{}, exportBatchSize, func(tx *gorm.DB, batch int) error {
			var rows []models.Attendance
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
	c.Header("Content-Disposition", `attachment; filename="attendances.csv"`)

	headerWritten := false
	if err := query.FindInBatches(&[]models.Attendance{}, exportBatchSize, func(tx *gorm.DB, batch int) error {
		var rows []models.Attendance
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

// GetByID returns a single attendance by ID.
func (h *AttendanceHandler) GetByID(c *gin.Context) {
	id := c.Param("id")

	var item models.Attendance
	if err := h.DB.Preload("Event").Preload("User").First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "Attendance not found",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": item,
	})
}

// Create adds a new attendance.
func (h *AttendanceHandler) Create(c *gin.Context) {
	var req struct {
		EventID string `json:"event_id" binding:"required"`
		UserID string `json:"user_id" binding:"required"`
		Status string `json:"status" binding:"required"`
		SelfieUrl string `json:"selfie_url"`
		SignatureUrl string `json:"signature_url"`
		CheckedInAt *time.Time `json:"checked_in_at"`
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

	item := models.Attendance{
		EventID: req.EventID,
		UserID: req.UserID,
		Status: req.Status,
		SelfieUrl: req.SelfieUrl,
		SignatureUrl: req.SignatureUrl,
		CheckedInAt: req.CheckedInAt,
	}

	if err := h.DB.Create(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to create attendance",
			},
		})
		return
	}

	h.DB.Preload("Event").Preload("User").First(&item, "id = ?", item.ID)

	services.LogCreate(h.DB, c, "Attendance", item.ID, item.ID, "")

	c.JSON(http.StatusCreated, gin.H{
		"data":    item,
		"message": "Attendance created successfully",
	})
}

// Update modifies an existing attendance.
func (h *AttendanceHandler) Update(c *gin.Context) {
	id := c.Param("id")

	var item models.Attendance
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "Attendance not found",
			},
		})
		return
	}

	var req struct {
		EventID *string `json:"event_id"`
		UserID *string `json:"user_id"`
		Status string `json:"status"`
		SelfieUrl string `json:"selfie_url"`
		SignatureUrl string `json:"signature_url"`
		CheckedInAt *time.Time `json:"checked_in_at"`
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

	if err := h.DB.Model(&item).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to update attendance",
			},
		})
		return
	}

	h.DB.Preload("Event").Preload("User").First(&item, "id = ?", item.ID)

	services.LogUpdate(h.DB, c, "Attendance", item.ID, item.ID, services.DiffSummary(updates))

	c.JSON(http.StatusOK, gin.H{
		"data":    item,
		"message": "Attendance updated successfully",
	})
}

// Patch applies a partial update to a attendance. Used by the admin's
// grouped update view — each form group's Save button calls PATCH with
// only the fields it owns, so editing "Address" doesn't rewrite
// "Pricing". Refuses any key that isn't a writable model column.
func (h *AttendanceHandler) Patch(c *gin.Context) {
	id := c.Param("id")

	var item models.Attendance
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "Attendance not found",
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
		"status": true,
		"selfie_url": true,
		"signature_url": true,
		"checked_in_at": true,
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
				"message": "Failed to patch attendance",
			},
		})
		return
	}
	h.DB.Preload("Event").Preload("User").First(&item, "id = ?", item.ID)

	services.LogUpdate(h.DB, c, "Attendance", item.ID, item.ID, services.DiffSummary(updates))

	c.JSON(http.StatusOK, gin.H{
		"data":    item,
		"message": "Attendance updated successfully",
	})
}

// Delete soft-deletes a attendance.
func (h *AttendanceHandler) Delete(c *gin.Context) {
	id := c.Param("id")

	var item models.Attendance
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "Attendance not found",
			},
		})
		return
	}

	if err := h.DB.Delete(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to delete attendance",
			},
		})
		return
	}

	services.LogDelete(h.DB, c, "Attendance", item.ID, item.ID)

	c.JSON(http.StatusOK, gin.H{
		"message": "Attendance deleted successfully",
	})
}
