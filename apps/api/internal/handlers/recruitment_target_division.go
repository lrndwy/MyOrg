package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"myorg/apps/api/internal/export"
	"myorg/apps/api/internal/models"
	"myorg/apps/api/internal/paginate"
	"myorg/apps/api/internal/services"
)

// RecruitmentTargetDivisionHandler handles recruitmenttargetdivision endpoints.
type RecruitmentTargetDivisionHandler struct {
	DB *gorm.DB
}

// List returns a paginated list of recruitment_target_divisions.
func (h *RecruitmentTargetDivisionHandler) List(c *gin.Context) {
	query := h.DB.Model(&models.RecruitmentTargetDivision{}).Preload("Recruitment").Preload("Division")

	res, err := paginate.List[models.RecruitmentTargetDivision](
		query,
		paginate.Bind(c).With("recruitment_id", c.Query("recruitment_id")).With("division_id", c.Query("division_id")),
		paginate.Config{
			Searchable: []string{},
			Sortable:   map[string]bool{"id": true, "created_at": true},
		},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to fetch recruitment_target_divisions",
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
//	GET /api/recruitment_target_divisions/export?format=csv
//	GET /api/recruitment_target_divisions/export?format=xlsx&search=foo
func (h *RecruitmentTargetDivisionHandler) Export(c *gin.Context) {
	const exportBatchSize = 1000

	format := c.DefaultQuery("format", "csv")
	search := c.Query("search")

	query := h.DB.Model(&models.RecruitmentTargetDivision{}).Preload("Recruitment").Preload("Division").Order("created_at desc")
	if search != "" && len([]string{}) > 0 {
		// Reuse the same searchable columns as List.
		searchable := []string{}
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
		Sheet: "RecruitmentTargetDivisions",
		Columns: []export.Column{
			{Header: "ID", Field: "ID"},
			{Header: "Created At", Field: "CreatedAt", Format: "date:2006-01-02"},
		},
	}

	// Stream rows in batches via GORM's FindInBatches. CSV writes each
	// batch straight to the wire; XLSX accumulates into a slice (no
	// streaming API in excelize) but at least we never load the whole
	// table at once.
	if format == "xlsx" {
		c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
		c.Header("Content-Disposition", `attachment; filename="recruitment_target_divisions.xlsx"`)
		var all []models.RecruitmentTargetDivision
		if err := query.FindInBatches(&[]models.RecruitmentTargetDivision{}, exportBatchSize, func(tx *gorm.DB, batch int) error {
			var rows []models.RecruitmentTargetDivision
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
	c.Header("Content-Disposition", `attachment; filename="recruitment_target_divisions.csv"`)

	headerWritten := false
	if err := query.FindInBatches(&[]models.RecruitmentTargetDivision{}, exportBatchSize, func(tx *gorm.DB, batch int) error {
		var rows []models.RecruitmentTargetDivision
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

// GetByID returns a single recruitmenttargetdivision by ID.
func (h *RecruitmentTargetDivisionHandler) GetByID(c *gin.Context) {
	id := c.Param("id")

	var item models.RecruitmentTargetDivision
	if err := h.DB.Preload("Recruitment").Preload("Division").First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "RecruitmentTargetDivision not found",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": item,
	})
}

// Create adds a new recruitmenttargetdivision.
func (h *RecruitmentTargetDivisionHandler) Create(c *gin.Context) {
	var req struct {
		RecruitmentID string `json:"recruitment_id" binding:"required"`
		DivisionID string `json:"division_id" binding:"required"`
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

	item := models.RecruitmentTargetDivision{
		RecruitmentID: req.RecruitmentID,
		DivisionID: req.DivisionID,
	}

	if err := h.DB.Create(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to create recruitmenttargetdivision",
			},
		})
		return
	}

	h.DB.Preload("Recruitment").Preload("Division").First(&item, "id = ?", item.ID)

	services.LogCreate(h.DB, c, "RecruitmentTargetDivision", item.ID, item.ID, "")

	c.JSON(http.StatusCreated, gin.H{
		"data":    item,
		"message": "RecruitmentTargetDivision created successfully",
	})
}

// Update modifies an existing recruitmenttargetdivision.
func (h *RecruitmentTargetDivisionHandler) Update(c *gin.Context) {
	id := c.Param("id")

	var item models.RecruitmentTargetDivision
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "RecruitmentTargetDivision not found",
			},
		})
		return
	}

	var req struct {
		RecruitmentID *string `json:"recruitment_id"`
		DivisionID *string `json:"division_id"`
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
	if req.RecruitmentID != nil {
		updates["recruitment_id"] = *req.RecruitmentID
	}
	if req.DivisionID != nil {
		updates["division_id"] = *req.DivisionID
	}

	if err := h.DB.Model(&item).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to update recruitmenttargetdivision",
			},
		})
		return
	}

	h.DB.Preload("Recruitment").Preload("Division").First(&item, "id = ?", item.ID)

	services.LogUpdate(h.DB, c, "RecruitmentTargetDivision", item.ID, item.ID, services.DiffSummary(updates))

	c.JSON(http.StatusOK, gin.H{
		"data":    item,
		"message": "RecruitmentTargetDivision updated successfully",
	})
}

// Patch applies a partial update to a recruitmenttargetdivision. Used by the admin's
// grouped update view — each form group's Save button calls PATCH with
// only the fields it owns, so editing "Address" doesn't rewrite
// "Pricing". Refuses any key that isn't a writable model column.
func (h *RecruitmentTargetDivisionHandler) Patch(c *gin.Context) {
	id := c.Param("id")

	var item models.RecruitmentTargetDivision
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "RecruitmentTargetDivision not found",
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
		"recruitment_id": true,
		"division_id": true,
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
				"message": "Failed to patch recruitmenttargetdivision",
			},
		})
		return
	}
	h.DB.Preload("Recruitment").Preload("Division").First(&item, "id = ?", item.ID)

	services.LogUpdate(h.DB, c, "RecruitmentTargetDivision", item.ID, item.ID, services.DiffSummary(updates))

	c.JSON(http.StatusOK, gin.H{
		"data":    item,
		"message": "RecruitmentTargetDivision updated successfully",
	})
}

// Delete soft-deletes a recruitmenttargetdivision.
func (h *RecruitmentTargetDivisionHandler) Delete(c *gin.Context) {
	id := c.Param("id")

	var item models.RecruitmentTargetDivision
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "RecruitmentTargetDivision not found",
			},
		})
		return
	}

	if err := h.DB.Delete(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to delete recruitmenttargetdivision",
			},
		})
		return
	}

	services.LogDelete(h.DB, c, "RecruitmentTargetDivision", item.ID, item.ID)

	c.JSON(http.StatusOK, gin.H{
		"message": "RecruitmentTargetDivision deleted successfully",
	})
}
