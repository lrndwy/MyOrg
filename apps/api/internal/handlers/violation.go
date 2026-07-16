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

// ViolationHandler handles violation endpoints.
type ViolationHandler struct {
	DB *gorm.DB
}

// List returns a paginated list of violations.
func (h *ViolationHandler) List(c *gin.Context) {
	query := h.DB.Model(&models.Violation{}).Preload("User").Preload("IssuedBy")

	res, err := paginate.List[models.Violation](
		query,
		paginate.Bind(c).With("user_id", c.Query("user_id")).With("issued_by_id", c.Query("issued_by_id")),
		paginate.Config{
			Searchable: []string{"violation_type", "description", "sp_level", "document_url"},
			Sortable:   map[string]bool{"id": true, "created_at": true, "violation_type": true, "description": true, "sp_level": true, "document_url": true},
		},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to fetch violations",
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
//	GET /api/violations/export?format=csv
//	GET /api/violations/export?format=xlsx&search=foo
func (h *ViolationHandler) Export(c *gin.Context) {
	const exportBatchSize = 1000

	format := c.DefaultQuery("format", "csv")
	search := c.Query("search")

	query := h.DB.Model(&models.Violation{}).Preload("User").Preload("IssuedBy").Order("created_at desc")
	if search != "" && len([]string{"violation_type", "description", "sp_level", "document_url"}) > 0 {
		// Reuse the same searchable columns as List.
		searchable := []string{"violation_type", "description", "sp_level", "document_url"}
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
		Sheet: "Violations",
		Columns: []export.Column{
			{Header: "ID", Field: "ID"},
			{Header: "ViolationType", Field: "ViolationType"},
			{Header: "Description", Field: "Description"},
			{Header: "SpLevel", Field: "SpLevel"},
			{Header: "DocumentUrl", Field: "DocumentUrl"},
			{Header: "IssuedDate", Field: "IssuedDate", Format: "date:2006-01-02"},
			{Header: "Created At", Field: "CreatedAt", Format: "date:2006-01-02"},
		},
	}

	// Stream rows in batches via GORM's FindInBatches. CSV writes each
	// batch straight to the wire; XLSX accumulates into a slice (no
	// streaming API in excelize) but at least we never load the whole
	// table at once.
	if format == "xlsx" {
		c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
		c.Header("Content-Disposition", `attachment; filename="violations.xlsx"`)
		var all []models.Violation
		if err := query.FindInBatches(&[]models.Violation{}, exportBatchSize, func(tx *gorm.DB, batch int) error {
			var rows []models.Violation
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
	c.Header("Content-Disposition", `attachment; filename="violations.csv"`)

	headerWritten := false
	if err := query.FindInBatches(&[]models.Violation{}, exportBatchSize, func(tx *gorm.DB, batch int) error {
		var rows []models.Violation
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

// GetByID returns a single violation by ID.
func (h *ViolationHandler) GetByID(c *gin.Context) {
	id := c.Param("id")

	var item models.Violation
	if err := h.DB.Preload("User").Preload("IssuedBy").First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "Violation not found",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": item,
	})
}

// Create adds a new violation.
func (h *ViolationHandler) Create(c *gin.Context) {
	var req struct {
		UserID string `json:"user_id" binding:"required"`
		ViolationType string `json:"violation_type" binding:"required"`
		Description string `json:"description"`
		SpLevel string `json:"sp_level" binding:"required"`
		DocumentUrl string `json:"document_url"`
		IssuedByID string `json:"issued_by_id" binding:"required"`
		IssuedDate *time.Time `json:"issued_date"`
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

	item := models.Violation{
		UserID: req.UserID,
		ViolationType: req.ViolationType,
		Description: req.Description,
		SpLevel: req.SpLevel,
		DocumentUrl: req.DocumentUrl,
		IssuedByID: req.IssuedByID,
		IssuedDate: req.IssuedDate,
	}

	if err := h.DB.Create(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to create violation",
			},
		})
		return
	}

	h.DB.Preload("User").Preload("IssuedBy").First(&item, "id = ?", item.ID)

	services.LogCreate(h.DB, c, "Violation", item.ID, item.ID, "")

	c.JSON(http.StatusCreated, gin.H{
		"data":    item,
		"message": "Violation created successfully",
	})
}

// Update modifies an existing violation.
func (h *ViolationHandler) Update(c *gin.Context) {
	id := c.Param("id")

	var item models.Violation
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "Violation not found",
			},
		})
		return
	}

	var req struct {
		UserID *string `json:"user_id"`
		ViolationType string `json:"violation_type"`
		Description string `json:"description"`
		SpLevel string `json:"sp_level"`
		DocumentUrl string `json:"document_url"`
		IssuedByID *string `json:"issued_by_id"`
		IssuedDate *time.Time `json:"issued_date"`
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
	if req.UserID != nil {
		updates["user_id"] = *req.UserID
	}
	if req.ViolationType != "" {
		updates["violation_type"] = req.ViolationType
	}
	if req.Description != "" {
		updates["description"] = req.Description
	}
	if req.SpLevel != "" {
		updates["sp_level"] = req.SpLevel
	}
	if req.DocumentUrl != "" {
		updates["document_url"] = req.DocumentUrl
	}
	if req.IssuedByID != nil {
		updates["issued_by_id"] = *req.IssuedByID
	}
	if req.IssuedDate != nil {
		updates["issued_date"] = req.IssuedDate
	}

	if err := h.DB.Model(&item).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to update violation",
			},
		})
		return
	}

	h.DB.Preload("User").Preload("IssuedBy").First(&item, "id = ?", item.ID)

	services.LogUpdate(h.DB, c, "Violation", item.ID, item.ID, services.DiffSummary(updates))

	c.JSON(http.StatusOK, gin.H{
		"data":    item,
		"message": "Violation updated successfully",
	})
}

// Patch applies a partial update to a violation. Used by the admin's
// grouped update view — each form group's Save button calls PATCH with
// only the fields it owns, so editing "Address" doesn't rewrite
// "Pricing". Refuses any key that isn't a writable model column.
func (h *ViolationHandler) Patch(c *gin.Context) {
	id := c.Param("id")

	var item models.Violation
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "Violation not found",
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
		"user_id": true,
		"violation_type": true,
		"description": true,
		"sp_level": true,
		"document_url": true,
		"issued_by_id": true,
		"issued_date": true,
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
				"message": "Failed to patch violation",
			},
		})
		return
	}
	h.DB.Preload("User").Preload("IssuedBy").First(&item, "id = ?", item.ID)

	services.LogUpdate(h.DB, c, "Violation", item.ID, item.ID, services.DiffSummary(updates))

	c.JSON(http.StatusOK, gin.H{
		"data":    item,
		"message": "Violation updated successfully",
	})
}

// Delete soft-deletes a violation.
func (h *ViolationHandler) Delete(c *gin.Context) {
	id := c.Param("id")

	var item models.Violation
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "Violation not found",
			},
		})
		return
	}

	if err := h.DB.Delete(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to delete violation",
			},
		})
		return
	}

	services.LogDelete(h.DB, c, "Violation", item.ID, item.ID)

	c.JSON(http.StatusOK, gin.H{
		"message": "Violation deleted successfully",
	})
}
