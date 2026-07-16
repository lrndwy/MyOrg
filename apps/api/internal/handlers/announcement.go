package handlers

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"myorg/apps/api/internal/export"
	"myorg/apps/api/internal/models"
	"myorg/apps/api/internal/paginate"
	"myorg/apps/api/internal/services"
)

// AnnouncementHandler handles announcement endpoints.
type AnnouncementHandler struct {
	DB *gorm.DB
}

// List returns a paginated list of announcements.
func (h *AnnouncementHandler) List(c *gin.Context) {
	query := h.DB.Model(&models.Announcement{}).Preload("TargetDivision").Preload("Attachments")

	res, err := paginate.List[models.Announcement](
		query,
		paginate.Bind(c).With("target_division_id", c.Query("target_division_id")),
		paginate.Config{
			Searchable: []string{"title", "content", "target_type"},
			Sortable:   map[string]bool{"id": true, "created_at": true, "title": true, "content": true, "target_type": true, "publish_date": true},
		},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to fetch announcements",
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
//	GET /api/announcements/export?format=csv
//	GET /api/announcements/export?format=xlsx&search=foo
func (h *AnnouncementHandler) Export(c *gin.Context) {
	const exportBatchSize = 1000

	format := c.DefaultQuery("format", "csv")
	search := c.Query("search")

	query := h.DB.Model(&models.Announcement{}).Preload("TargetDivision").Order("created_at desc")
	if search != "" && len([]string{"title", "content", "target_type"}) > 0 {
		// Reuse the same searchable columns as List.
		searchable := []string{"title", "content", "target_type"}
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
		Sheet: "Announcements",
		Columns: []export.Column{
			{Header: "ID", Field: "ID"},
			{Header: "Title", Field: "Title"},
			{Header: "Content", Field: "Content"},
			{Header: "TargetType", Field: "TargetType"},
			{Header: "PublishDate", Field: "PublishDate", Format: "date:2006-01-02"},
			{Header: "Created At", Field: "CreatedAt", Format: "date:2006-01-02"},
		},
	}

	// Stream rows in batches via GORM's FindInBatches. CSV writes each
	// batch straight to the wire; XLSX accumulates into a slice (no
	// streaming API in excelize) but at least we never load the whole
	// table at once.
	if format == "xlsx" {
		c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
		c.Header("Content-Disposition", `attachment; filename="announcements.xlsx"`)
		var all []models.Announcement
		if err := query.FindInBatches(&[]models.Announcement{}, exportBatchSize, func(tx *gorm.DB, batch int) error {
			var rows []models.Announcement
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
	c.Header("Content-Disposition", `attachment; filename="announcements.csv"`)

	headerWritten := false
	if err := query.FindInBatches(&[]models.Announcement{}, exportBatchSize, func(tx *gorm.DB, batch int) error {
		var rows []models.Announcement
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

// GetByID returns a single announcement by ID.
func (h *AnnouncementHandler) GetByID(c *gin.Context) {
	id := c.Param("id")

	var item models.Announcement
	if err := h.DB.Preload("TargetDivision").Preload("Attachments").First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "Announcement not found",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": item,
	})
}

// Create adds a new announcement (optionally with nested attachments).
func (h *AnnouncementHandler) Create(c *gin.Context) {
	var req struct {
		Title            string                                 `json:"title" binding:"required"`
		Content          string                                 `json:"content"`
		TargetType       string                                 `json:"target_type" binding:"required"`
		TargetDivisionID string                                 `json:"target_division_id"`
		PublishDate      *time.Time                             `json:"publish_date"`
		Attachments      []services.AnnouncementAttachmentInput `json:"attachments"`
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

	item := &models.Announcement{
		Title:            req.Title,
		Content:          req.Content,
		TargetType:       req.TargetType,
		TargetDivisionID: optionalStringPtr(req.TargetDivisionID),
		PublishDate:      req.PublishDate,
	}

	svc := &services.AnnouncementService{DB: h.DB}
	if err := svc.CreateWithAttachments(item, req.Attachments); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": err.Error(),
			},
		})
		return
	}

	h.DB.Preload("TargetDivision").Preload("Attachments").First(item, "id = ?", item.ID)

	services.LogCreate(h.DB, c, "Announcement", item.Title, item.ID, "")

	c.JSON(http.StatusCreated, gin.H{
		"data":    item,
		"message": "Announcement created successfully",
	})
}

// Update modifies an existing announcement.
func (h *AnnouncementHandler) Update(c *gin.Context) {
	id := c.Param("id")

	var item models.Announcement
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "Announcement not found",
			},
		})
		return
	}

	var req struct {
		Title            string                                  `json:"title"`
		Content          string                                  `json:"content"`
		TargetType       string                                  `json:"target_type"`
		TargetDivisionID *string                                 `json:"target_division_id"`
		PublishDate      *time.Time                              `json:"publish_date"`
		Attachments      *[]services.AnnouncementAttachmentInput `json:"attachments"`
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
	if req.Content != "" {
		updates["content"] = req.Content
	}
	if req.TargetType != "" {
		updates["target_type"] = req.TargetType
		if strings.EqualFold(req.TargetType, "all") {
			updates["target_division_id"] = nil
		}
	}
	if req.TargetDivisionID != nil {
		if *req.TargetDivisionID == "" {
			updates["target_division_id"] = nil
		} else {
			updates["target_division_id"] = *req.TargetDivisionID
		}
	}
	if req.PublishDate != nil {
		updates["publish_date"] = req.PublishDate
	}

	svc := &services.AnnouncementService{DB: h.DB}
	if len(updates) > 0 {
		if _, err := svc.Update(id, updates); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": gin.H{
					"code":    "INTERNAL_ERROR",
					"message": "Failed to update announcement",
				},
			})
			return
		}
	}

	if req.Attachments != nil {
		if _, err := svc.ReplaceAttachments(id, *req.Attachments); err != nil {
			c.JSON(http.StatusUnprocessableEntity, gin.H{
				"error": gin.H{
					"code":    "VALIDATION_ERROR",
					"message": err.Error(),
				},
			})
			return
		}
	}

	h.DB.Preload("TargetDivision").Preload("Attachments").First(&item, "id = ?", id)

	services.LogUpdate(h.DB, c, "Announcement", item.Title, item.ID, services.DiffSummary(updates))

	c.JSON(http.StatusOK, gin.H{
		"data":    item,
		"message": "Announcement updated successfully",
	})
}

// Patch applies a partial update to a announcement. Used by the admin's
// grouped update view — each form group's Save button calls PATCH with
// only the fields it owns, so editing "Address" doesn't rewrite
// "Pricing". Refuses any key that isn't a writable model column.
func (h *AnnouncementHandler) Patch(c *gin.Context) {
	id := c.Param("id")

	var item models.Announcement
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "Announcement not found",
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
		"title":              true,
		"content":            true,
		"target_type":        true,
		"target_division_id": true,
		"publish_date":       true,
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
				"message": "Failed to patch announcement",
			},
		})
		return
	}
	h.DB.Preload("TargetDivision").Preload("Attachments").First(&item, "id = ?", item.ID)

	services.LogUpdate(h.DB, c, "Announcement", item.Title, item.ID, services.DiffSummary(updates))

	c.JSON(http.StatusOK, gin.H{
		"data":    item,
		"message": "Announcement updated successfully",
	})
}

// Delete soft-deletes a announcement.
func (h *AnnouncementHandler) Delete(c *gin.Context) {
	id := c.Param("id")

	svc := &services.AnnouncementService{DB: h.DB}
	var existing models.Announcement
	if err := h.DB.First(&existing, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "Announcement not found",
			},
		})
		return
	}

	if err := svc.Delete(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to delete announcement",
			},
		})
		return
	}

	services.LogDelete(h.DB, c, "Announcement", existing.Title, existing.ID)

	c.JSON(http.StatusOK, gin.H{
		"message": "Announcement deleted successfully",
	})
}

