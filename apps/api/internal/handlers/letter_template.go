package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"myorg/apps/api/internal/export"
	"myorg/apps/api/internal/letterdoc"
	"myorg/apps/api/internal/models"
	"myorg/apps/api/internal/paginate"
	"myorg/apps/api/internal/services"
)

// LetterTemplateHandler handles lettertemplate endpoints.
type LetterTemplateHandler struct {
	DB      *gorm.DB
	Letters *services.LetterService
}

// List returns a paginated list of letter_templates.
func (h *LetterTemplateHandler) List(c *gin.Context) {
	query := h.DB.Model(&models.LetterTemplate{}).Preload("Category")

	res, err := paginate.List[models.LetterTemplate](
		query,
		paginate.Bind(c).With("category_id", c.Query("category_id")),
		paginate.Config{
			Searchable: []string{"name", "template_url"},
			Sortable:   map[string]bool{"id": true, "created_at": true, "name": true, "template_url": true},
		},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to fetch letter_templates",
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
//	GET /api/letter_templates/export?format=csv
//	GET /api/letter_templates/export?format=xlsx&search=foo
func (h *LetterTemplateHandler) Export(c *gin.Context) {
	const exportBatchSize = 1000

	format := c.DefaultQuery("format", "csv")
	search := c.Query("search")

	query := h.DB.Model(&models.LetterTemplate{}).Preload("Category").Order("created_at desc")
	if search != "" && len([]string{"name", "template_url"}) > 0 {
		// Reuse the same searchable columns as List.
		searchable := []string{"name", "template_url"}
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
		Sheet: "LetterTemplates",
		Columns: []export.Column{
			{Header: "ID", Field: "ID"},
			{Header: "Name", Field: "Name"},
			{Header: "TemplateUrl", Field: "TemplateUrl"},
			{Header: "Created At", Field: "CreatedAt", Format: "date:2006-01-02"},
		},
	}

	// Stream rows in batches via GORM's FindInBatches. CSV writes each
	// batch straight to the wire; XLSX accumulates into a slice (no
	// streaming API in excelize) but at least we never load the whole
	// table at once.
	if format == "xlsx" {
		c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
		c.Header("Content-Disposition", `attachment; filename="letter_templates.xlsx"`)
		var all []models.LetterTemplate
		if err := query.FindInBatches(&[]models.LetterTemplate{}, exportBatchSize, func(tx *gorm.DB, batch int) error {
			var rows []models.LetterTemplate
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
	c.Header("Content-Disposition", `attachment; filename="letter_templates.csv"`)

	headerWritten := false
	if err := query.FindInBatches(&[]models.LetterTemplate{}, exportBatchSize, func(tx *gorm.DB, batch int) error {
		var rows []models.LetterTemplate
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

// GetByID returns a single lettertemplate by ID.
func (h *LetterTemplateHandler) GetByID(c *gin.Context) {
	id := c.Param("id")

	var item models.LetterTemplate
	if err := h.DB.Preload("Category").First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "LetterTemplate not found",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": item,
	})
}

// Create adds a new lettertemplate.
func (h *LetterTemplateHandler) Create(c *gin.Context) {
	var req struct {
		Name string `json:"name" binding:"required"`
		CategoryID string `json:"category_id" binding:"required"`
		TemplateUrl string `json:"template_url" binding:"required"`
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

	item := models.LetterTemplate{
		Name: req.Name,
		CategoryID: req.CategoryID,
		TemplateUrl: req.TemplateUrl,
	}

	if err := h.DB.Create(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to create lettertemplate",
			},
		})
		return
	}

	h.DB.Preload("Category").First(&item, "id = ?", item.ID)

	services.LogCreate(h.DB, c, "LetterTemplate", item.Name, item.ID, "")

	c.JSON(http.StatusCreated, gin.H{
		"data":    item,
		"message": "LetterTemplate created successfully",
	})
}

// Update modifies an existing lettertemplate.
func (h *LetterTemplateHandler) Update(c *gin.Context) {
	id := c.Param("id")

	var item models.LetterTemplate
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "LetterTemplate not found",
			},
		})
		return
	}

	var req struct {
		Name string `json:"name"`
		CategoryID *string `json:"category_id"`
		TemplateUrl string `json:"template_url"`
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
	if req.CategoryID != nil {
		updates["category_id"] = *req.CategoryID
	}
	if req.TemplateUrl != "" {
		updates["template_url"] = req.TemplateUrl
	}

	if err := h.DB.Model(&item).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to update lettertemplate",
			},
		})
		return
	}

	h.DB.Preload("Category").First(&item, "id = ?", item.ID)

	services.LogUpdate(h.DB, c, "LetterTemplate", item.Name, item.ID, services.DiffSummary(updates))

	c.JSON(http.StatusOK, gin.H{
		"data":    item,
		"message": "LetterTemplate updated successfully",
	})
}

// Patch applies a partial update to a lettertemplate. Used by the admin's
// grouped update view — each form group's Save button calls PATCH with
// only the fields it owns, so editing "Address" doesn't rewrite
// "Pricing". Refuses any key that isn't a writable model column.
func (h *LetterTemplateHandler) Patch(c *gin.Context) {
	id := c.Param("id")

	var item models.LetterTemplate
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "LetterTemplate not found",
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
		"category_id": true,
		"template_url": true,
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
				"message": "Failed to patch lettertemplate",
			},
		})
		return
	}
	h.DB.Preload("Category").First(&item, "id = ?", item.ID)

	services.LogUpdate(h.DB, c, "LetterTemplate", item.Name, item.ID, services.DiffSummary(updates))

	c.JSON(http.StatusOK, gin.H{
		"data":    item,
		"message": "LetterTemplate updated successfully",
	})
}

// Delete soft-deletes a lettertemplate.
func (h *LetterTemplateHandler) Delete(c *gin.Context) {
	id := c.Param("id")

	var item models.LetterTemplate
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "LetterTemplate not found",
			},
		})
		return
	}

	if err := h.DB.Delete(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to delete lettertemplate",
			},
		})
		return
	}

	services.LogDelete(h.DB, c, "LetterTemplate", item.Name, item.ID)

	c.JSON(http.StatusOK, gin.H{
		"message": "LetterTemplate deleted successfully",
	})
}

// Variables detects placeholders in the template .docx and suggests next NOMOR_SURAT.
func (h *LetterTemplateHandler) Variables(c *gin.Context) {
	id := c.Param("id")
	svc := h.Letters
	if svc == nil {
		svc = &services.LetterService{DB: h.DB}
	}
	vars, suggested, categoryID, err := svc.DetectTemplateVariables(id)
	if err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"error": gin.H{
				"code":    "TEMPLATE_VARIABLES_ERROR",
				"message": err.Error(),
			},
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"variables":              vars,
			"suggested_nomor_surat":  suggested,
			"category_id":            categoryID,
			"known_placeholders":    letterdoc.KnownPlaceholders,
		},
	})
}
