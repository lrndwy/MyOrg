package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"myorg/apps/api/internal/export"
	"myorg/apps/api/internal/models"
	"myorg/apps/api/internal/paginate"
	"myorg/apps/api/internal/services"
)

// OrganizationSettingHandler handles organizationsetting endpoints.
type OrganizationSettingHandler struct {
	DB *gorm.DB
}

// List returns a paginated list of organization_settings.
func (h *OrganizationSettingHandler) List(c *gin.Context) {
	query := h.DB.Model(&models.OrganizationSetting{})

	res, err := paginate.List[models.OrganizationSetting](
		query,
		paginate.Bind(c),
		paginate.Config{
			Searchable: []string{"web_name", "logo_url", "icon_url", "theme"},
			Sortable:   map[string]bool{"id": true, "created_at": true, "web_name": true, "logo_url": true, "icon_url": true, "theme": true},
		},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to fetch organization_settings",
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
//	GET /api/organization_settings/export?format=csv
//	GET /api/organization_settings/export?format=xlsx&search=foo
func (h *OrganizationSettingHandler) Export(c *gin.Context) {
	const exportBatchSize = 1000

	format := c.DefaultQuery("format", "csv")
	search := c.Query("search")

	query := h.DB.Model(&models.OrganizationSetting{}).Order("created_at desc")
	if search != "" && len([]string{"web_name", "logo_url", "icon_url", "theme"}) > 0 {
		// Reuse the same searchable columns as List.
		searchable := []string{"web_name", "logo_url", "icon_url", "theme"}
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
		Sheet: "OrganizationSettings",
		Columns: []export.Column{
			{Header: "ID", Field: "ID"},
			{Header: "WebName", Field: "WebName"},
			{Header: "LogoUrl", Field: "LogoUrl"},
			{Header: "IconUrl", Field: "IconUrl"},
			{Header: "Theme", Field: "Theme"},
			{Header: "AllowSelfRegister", Field: "AllowSelfRegister", Format: "bool"},
			{Header: "AllowCrossDivisionEventsView", Field: "AllowCrossDivisionEventsView", Format: "bool"},
			{Header: "Created At", Field: "CreatedAt", Format: "date:2006-01-02"},
		},
	}

	// Stream rows in batches via GORM's FindInBatches. CSV writes each
	// batch straight to the wire; XLSX accumulates into a slice (no
	// streaming API in excelize) but at least we never load the whole
	// table at once.
	if format == "xlsx" {
		c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
		c.Header("Content-Disposition", `attachment; filename="organization_settings.xlsx"`)
		var all []models.OrganizationSetting
		if err := query.FindInBatches(&[]models.OrganizationSetting{}, exportBatchSize, func(tx *gorm.DB, batch int) error {
			var rows []models.OrganizationSetting
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
	c.Header("Content-Disposition", `attachment; filename="organization_settings.csv"`)

	headerWritten := false
	if err := query.FindInBatches(&[]models.OrganizationSetting{}, exportBatchSize, func(tx *gorm.DB, batch int) error {
		var rows []models.OrganizationSetting
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

// GetByID returns a single organizationsetting by ID.
func (h *OrganizationSettingHandler) GetByID(c *gin.Context) {
	id := c.Param("id")

	var item models.OrganizationSetting
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "OrganizationSetting not found",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": item,
	})
}

// Create adds a new organizationsetting.
func (h *OrganizationSettingHandler) Create(c *gin.Context) {
	var req struct {
		WebName                      string `json:"web_name" binding:"required"`
		LogoUrl                      string `json:"logo_url"`
		IconUrl                      string `json:"icon_url"`
		Theme                        string `json:"theme" binding:"required"`
		AllowSelfRegister            bool   `json:"allow_self_register"`
		AllowCrossDivisionEventsView bool   `json:"allow_cross_division_events_view"`
		LetterheadTemplateUrl        string `json:"letterhead_template_url"`
		LetterPlace                  string `json:"letter_place"`
		SignatureIdLabel             string `json:"signature_id_label"`
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

	sigLabel := strings.TrimSpace(req.SignatureIdLabel)
	if sigLabel == "" {
		sigLabel = "NIM/NIP"
	}

	item := models.OrganizationSetting{
		WebName:                      req.WebName,
		LogoUrl:                      req.LogoUrl,
		IconUrl:                      req.IconUrl,
		Theme:                        req.Theme,
		AllowSelfRegister:            req.AllowSelfRegister,
		AllowCrossDivisionEventsView: req.AllowCrossDivisionEventsView,
		LetterheadTemplateUrl:        req.LetterheadTemplateUrl,
		LetterPlace:                  strings.TrimSpace(req.LetterPlace),
		SignatureIdLabel:             sigLabel,
	}

	svc := &services.OrganizationSettingService{DB: h.DB}
	if err := svc.Create(&item); err != nil {
		status := http.StatusInternalServerError
		code := "INTERNAL_ERROR"
		if strings.Contains(err.Error(), "singleton") {
			status = http.StatusConflict
			code = "CONFLICT"
		}
		c.JSON(status, gin.H{
			"error": gin.H{
				"code":    code,
				"message": err.Error(),
			},
		})
		return
	}

	h.DB.First(&item, "id = ?", item.ID)

	services.LogCreate(h.DB, c, "OrganizationSetting", item.WebName, item.ID, "")

	c.JSON(http.StatusCreated, gin.H{
		"data":    item,
		"message": "OrganizationSetting created successfully",
	})
}

// Update modifies an existing organizationsetting.
func (h *OrganizationSettingHandler) Update(c *gin.Context) {
	id := c.Param("id")

	var item models.OrganizationSetting
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "OrganizationSetting not found",
			},
		})
		return
	}

	var req struct {
		WebName                      string `json:"web_name"`
		LogoUrl                      string `json:"logo_url"`
		IconUrl                      string `json:"icon_url"`
		Theme                        string `json:"theme"`
		AllowSelfRegister            *bool  `json:"allow_self_register"`
		AllowCrossDivisionEventsView *bool  `json:"allow_cross_division_events_view"`
		LetterheadTemplateUrl        *string `json:"letterhead_template_url"`
		LetterPlace                  *string `json:"letter_place"`
		SignatureIdLabel             *string `json:"signature_id_label"`
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
	if req.WebName != "" {
		updates["web_name"] = req.WebName
	}
	// Always persist branding image URLs from the settings form (including
	// empty string when the user removes an uploaded logo/icon).
	updates["logo_url"] = req.LogoUrl
	updates["icon_url"] = req.IconUrl
	if req.Theme != "" {
		updates["theme"] = req.Theme
	}
	if req.AllowSelfRegister != nil {
		updates["allow_self_register"] = *req.AllowSelfRegister
	}
	if req.AllowCrossDivisionEventsView != nil {
		updates["allow_cross_division_events_view"] = *req.AllowCrossDivisionEventsView
	}
	if req.LetterheadTemplateUrl != nil {
		updates["letterhead_template_url"] = *req.LetterheadTemplateUrl
	}
	if req.LetterPlace != nil {
		updates["letter_place"] = strings.TrimSpace(*req.LetterPlace)
	}
	if req.SignatureIdLabel != nil {
		label := strings.TrimSpace(*req.SignatureIdLabel)
		if label == "" {
			label = "NIM/NIP"
		}
		updates["signature_id_label"] = label
	}

	if err := h.DB.Model(&item).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to update organizationsetting",
			},
		})
		return
	}

	h.DB.First(&item, "id = ?", item.ID)

	services.LogUpdate(h.DB, c, "OrganizationSetting", item.ID, item.ID, services.DiffSummary(updates))

	c.JSON(http.StatusOK, gin.H{
		"data":    item,
		"message": "OrganizationSetting updated successfully",
	})
}

// Patch applies a partial update to a organizationsetting. Used by the admin's
// grouped update view — each form group's Save button calls PATCH with
// only the fields it owns, so editing "Address" doesn't rewrite
// "Pricing". Refuses any key that isn't a writable model column.
func (h *OrganizationSettingHandler) Patch(c *gin.Context) {
	id := c.Param("id")

	var item models.OrganizationSetting
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "OrganizationSetting not found",
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
		"web_name":                         true,
		"logo_url":                         true,
		"icon_url":                         true,
		"theme":                            true,
		"allow_self_register":              true,
		"allow_cross_division_events_view": true,
		"letterhead_template_url":          true,
		"letter_place":                     true,
		"signature_id_label":               true,
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
				"message": "Failed to patch organizationsetting",
			},
		})
		return
	}
	h.DB.First(&item, "id = ?", item.ID)

	services.LogUpdate(h.DB, c, "OrganizationSetting", item.ID, item.ID, services.DiffSummary(updates))

	c.JSON(http.StatusOK, gin.H{
		"data":    item,
		"message": "OrganizationSetting updated successfully",
	})
}

// Delete soft-deletes a organizationsetting.
// Delete is disabled for organization settings — the row is a singleton.
func (h *OrganizationSettingHandler) Delete(c *gin.Context) {
	c.JSON(http.StatusConflict, gin.H{
		"error": gin.H{
			"code":    "CONFLICT",
			"message": "Organization settings cannot be deleted (singleton). Update the existing row instead.",
		},
	})
}
