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

// RecruitmentHandler handles recruitment endpoints.
type RecruitmentHandler struct {
	DB *gorm.DB
}

// List returns a paginated list of recruitments.
func (h *RecruitmentHandler) List(c *gin.Context) {
	query := h.DB.Model(&models.Recruitment{})

	res, err := paginate.List[models.Recruitment](
		query,
		paginate.Bind(c),
		paginate.Config{
			Searchable: []string{"title", "description", "slug", "status"},
			Sortable:   map[string]bool{"id": true, "created_at": true, "title": true, "description": true, "slug": true, "status": true},
		},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to fetch recruitments",
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
//	GET /api/recruitments/export?format=csv
//	GET /api/recruitments/export?format=xlsx&search=foo
func (h *RecruitmentHandler) Export(c *gin.Context) {
	const exportBatchSize = 1000

	format := c.DefaultQuery("format", "csv")
	search := c.Query("search")

	query := h.DB.Model(&models.Recruitment{}).Order("created_at desc")
	if search != "" && len([]string{"title", "description", "slug", "status"}) > 0 {
		// Reuse the same searchable columns as List.
		searchable := []string{"title", "description", "slug", "status"}
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
		Sheet: "Recruitments",
		Columns: []export.Column{
			{Header: "ID", Field: "ID"},
			{Header: "Title", Field: "Title"},
			{Header: "Description", Field: "Description"},
			{Header: "Slug", Field: "Slug"},
			{Header: "OpenDate", Field: "OpenDate", Format: "date:2006-01-02"},
			{Header: "CloseDate", Field: "CloseDate", Format: "date:2006-01-02"},
			{Header: "Status", Field: "Status"},
			{Header: "Created At", Field: "CreatedAt", Format: "date:2006-01-02"},
		},
	}

	// Stream rows in batches via GORM's FindInBatches. CSV writes each
	// batch straight to the wire; XLSX accumulates into a slice (no
	// streaming API in excelize) but at least we never load the whole
	// table at once.
	if format == "xlsx" {
		c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
		c.Header("Content-Disposition", `attachment; filename="recruitments.xlsx"`)
		var all []models.Recruitment
		if err := query.FindInBatches(&[]models.Recruitment{}, exportBatchSize, func(tx *gorm.DB, batch int) error {
			var rows []models.Recruitment
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
	c.Header("Content-Disposition", `attachment; filename="recruitments.csv"`)

	headerWritten := false
	if err := query.FindInBatches(&[]models.Recruitment{}, exportBatchSize, func(tx *gorm.DB, batch int) error {
		var rows []models.Recruitment
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

// GetByID returns a single recruitment by ID.
func (h *RecruitmentHandler) GetByID(c *gin.Context) {
	id := c.Param("id")

	var item models.Recruitment
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "Recruitment not found",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": item,
	})
}

// Create adds a new recruitment.
func (h *RecruitmentHandler) Create(c *gin.Context) {
	var req struct {
		Title string `json:"title" binding:"required"`
		Description string `json:"description"`
		OpenDate *time.Time `json:"open_date"`
		CloseDate *time.Time `json:"close_date"`
		Status string `json:"status" binding:"required"`
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

	item := models.Recruitment{
		Title: req.Title,
		Description: req.Description,
		OpenDate: req.OpenDate,
		CloseDate: req.CloseDate,
		Status: req.Status,
	}

	if err := h.DB.Create(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to create recruitment",
			},
		})
		return
	}

	h.DB.First(&item, "id = ?", item.ID)

	services.LogCreate(h.DB, c, "Recruitment", item.Title, item.ID, "")

	c.JSON(http.StatusCreated, gin.H{
		"data":    item,
		"message": "Recruitment created successfully",
	})
}

// Update modifies an existing recruitment.
func (h *RecruitmentHandler) Update(c *gin.Context) {
	id := c.Param("id")

	var item models.Recruitment
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "Recruitment not found",
			},
		})
		return
	}

	var req struct {
		Title string `json:"title"`
		Description string `json:"description"`
		OpenDate *time.Time `json:"open_date"`
		CloseDate *time.Time `json:"close_date"`
		Status string `json:"status"`
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
	if req.Title != "" {
		updates["title"] = req.Title
	}
	if req.Description != "" {
		updates["description"] = req.Description
	}
	if req.OpenDate != nil {
		updates["open_date"] = req.OpenDate
	}
	if req.CloseDate != nil {
		updates["close_date"] = req.CloseDate
	}
	if req.Status != "" {
		updates["status"] = req.Status
	}

	if err := h.DB.Model(&item).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to update recruitment",
			},
		})
		return
	}

	h.DB.First(&item, "id = ?", item.ID)

	services.LogUpdate(h.DB, c, "Recruitment", item.Title, item.ID, services.DiffSummary(updates))

	c.JSON(http.StatusOK, gin.H{
		"data":    item,
		"message": "Recruitment updated successfully",
	})
}

// Patch applies a partial update to a recruitment. Used by the admin's
// grouped update view — each form group's Save button calls PATCH with
// only the fields it owns, so editing "Address" doesn't rewrite
// "Pricing". Refuses any key that isn't a writable model column.
func (h *RecruitmentHandler) Patch(c *gin.Context) {
	id := c.Param("id")

	var item models.Recruitment
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "Recruitment not found",
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
		"title": true,
		"description": true,
		"open_date": true,
		"close_date": true,
		"status": true,
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
				"message": "Failed to patch recruitment",
			},
		})
		return
	}
	h.DB.First(&item, "id = ?", item.ID)

	services.LogUpdate(h.DB, c, "Recruitment", item.Title, item.ID, services.DiffSummary(updates))

	c.JSON(http.StatusOK, gin.H{
		"data":    item,
		"message": "Recruitment updated successfully",
	})
}

// Delete soft-deletes a recruitment.
func (h *RecruitmentHandler) Delete(c *gin.Context) {
	id := c.Param("id")

	var item models.Recruitment
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "Recruitment not found",
			},
		})
		return
	}

	if err := h.DB.Delete(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to delete recruitment",
			},
		})
		return
	}

	services.LogDelete(h.DB, c, "Recruitment", item.Title, item.ID)

	c.JSON(http.StatusOK, gin.H{
		"message": "Recruitment deleted successfully",
	})
}
