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

// LetterCategoryHandler handles lettercategory endpoints.
type LetterCategoryHandler struct {
	DB *gorm.DB
}

// List returns a paginated list of letter_categories.
func (h *LetterCategoryHandler) List(c *gin.Context) {
	query := h.DB.Model(&models.LetterCategory{})

	res, err := paginate.List[models.LetterCategory](
		query,
		paginate.Bind(c),
		paginate.Config{
			Searchable: []string{"name", "code", "number_format_template"},
			Sortable:   map[string]bool{"id": true, "created_at": true, "name": true, "code": true, "start_number": true, "current_number": true, "number_format_template": true},
		},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to fetch letter_categories",
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
//	GET /api/letter_categories/export?format=csv
//	GET /api/letter_categories/export?format=xlsx&search=foo
func (h *LetterCategoryHandler) Export(c *gin.Context) {
	const exportBatchSize = 1000

	format := c.DefaultQuery("format", "csv")
	search := c.Query("search")

	query := h.DB.Model(&models.LetterCategory{}).Order("created_at desc")
	if search != "" && len([]string{"name", "code", "number_format_template"}) > 0 {
		// Reuse the same searchable columns as List.
		searchable := []string{"name", "code", "number_format_template"}
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
		Sheet: "LetterCategories",
		Columns: []export.Column{
			{Header: "ID", Field: "ID"},
			{Header: "Name", Field: "Name"},
			{Header: "Code", Field: "Code"},
			{Header: "StartNumber", Field: "StartNumber"},
			{Header: "CurrentNumber", Field: "CurrentNumber"},
			{Header: "NumberFormatTemplate", Field: "NumberFormatTemplate"},
			{Header: "Created At", Field: "CreatedAt", Format: "date:2006-01-02"},
		},
	}

	// Stream rows in batches via GORM's FindInBatches. CSV writes each
	// batch straight to the wire; XLSX accumulates into a slice (no
	// streaming API in excelize) but at least we never load the whole
	// table at once.
	if format == "xlsx" {
		c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
		c.Header("Content-Disposition", `attachment; filename="letter_categories.xlsx"`)
		var all []models.LetterCategory
		if err := query.FindInBatches(&[]models.LetterCategory{}, exportBatchSize, func(tx *gorm.DB, batch int) error {
			var rows []models.LetterCategory
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
	c.Header("Content-Disposition", `attachment; filename="letter_categories.csv"`)

	headerWritten := false
	if err := query.FindInBatches(&[]models.LetterCategory{}, exportBatchSize, func(tx *gorm.DB, batch int) error {
		var rows []models.LetterCategory
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

// GetByID returns a single lettercategory by ID.
func (h *LetterCategoryHandler) GetByID(c *gin.Context) {
	id := c.Param("id")

	var item models.LetterCategory
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "LetterCategory not found",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": item,
	})
}

// Create adds a new lettercategory.
func (h *LetterCategoryHandler) Create(c *gin.Context) {
	var req struct {
		Name string `json:"name" binding:"required"`
		Code string `json:"code" binding:"required"`
		StartNumber int `json:"start_number"`
		CurrentNumber int `json:"current_number"`
		NumberFormatTemplate string `json:"number_format_template" binding:"required"`
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

	item := models.LetterCategory{
		Name: req.Name,
		Code: req.Code,
		StartNumber: req.StartNumber,
		CurrentNumber: req.CurrentNumber,
		NumberFormatTemplate: req.NumberFormatTemplate,
	}

	if err := h.DB.Create(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to create lettercategory",
			},
		})
		return
	}

	h.DB.First(&item, "id = ?", item.ID)

	services.LogCreate(h.DB, c, "LetterCategory", item.Name, item.ID, "")

	c.JSON(http.StatusCreated, gin.H{
		"data":    item,
		"message": "LetterCategory created successfully",
	})
}

// Update modifies an existing lettercategory.
func (h *LetterCategoryHandler) Update(c *gin.Context) {
	id := c.Param("id")

	var item models.LetterCategory
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "LetterCategory not found",
			},
		})
		return
	}

	var req struct {
		Name string `json:"name"`
		Code string `json:"code"`
		StartNumber *int `json:"start_number"`
		CurrentNumber *int `json:"current_number"`
		NumberFormatTemplate string `json:"number_format_template"`
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
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.Code != "" {
		updates["code"] = req.Code
	}
	if req.StartNumber != nil {
		updates["start_number"] = *req.StartNumber
	}
	if req.CurrentNumber != nil {
		updates["current_number"] = *req.CurrentNumber
	}
	if req.NumberFormatTemplate != "" {
		updates["number_format_template"] = req.NumberFormatTemplate
	}

	if err := h.DB.Model(&item).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to update lettercategory",
			},
		})
		return
	}

	h.DB.First(&item, "id = ?", item.ID)

	services.LogUpdate(h.DB, c, "LetterCategory", item.Name, item.ID, services.DiffSummary(updates))

	c.JSON(http.StatusOK, gin.H{
		"data":    item,
		"message": "LetterCategory updated successfully",
	})
}

// Patch applies a partial update to a lettercategory. Used by the admin's
// grouped update view — each form group's Save button calls PATCH with
// only the fields it owns, so editing "Address" doesn't rewrite
// "Pricing". Refuses any key that isn't a writable model column.
func (h *LetterCategoryHandler) Patch(c *gin.Context) {
	id := c.Param("id")

	var item models.LetterCategory
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "LetterCategory not found",
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
		"name": true,
		"code": true,
		"start_number": true,
		"current_number": true,
		"number_format_template": true,
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
				"message": "Failed to patch lettercategory",
			},
		})
		return
	}
	h.DB.First(&item, "id = ?", item.ID)

	services.LogUpdate(h.DB, c, "LetterCategory", item.Name, item.ID, services.DiffSummary(updates))

	c.JSON(http.StatusOK, gin.H{
		"data":    item,
		"message": "LetterCategory updated successfully",
	})
}

// Delete soft-deletes a lettercategory.
func (h *LetterCategoryHandler) Delete(c *gin.Context) {
	id := c.Param("id")

	var item models.LetterCategory
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "LetterCategory not found",
			},
		})
		return
	}

	if err := h.DB.Delete(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to delete lettercategory",
			},
		})
		return
	}

	services.LogDelete(h.DB, c, "LetterCategory", item.Name, item.ID)

	c.JSON(http.StatusOK, gin.H{
		"message": "LetterCategory deleted successfully",
	})
}
