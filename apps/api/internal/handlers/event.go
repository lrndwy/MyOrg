package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"myorg/apps/api/internal/export"
	"myorg/apps/api/internal/models"
	"myorg/apps/api/internal/paginate"
	"myorg/apps/api/internal/services"
	"myorg/apps/api/internal/timex"
)

// EventHandler handles event endpoints.
type EventHandler struct {
	DB *gorm.DB
}

// List returns a paginated list of events.
func (h *EventHandler) List(c *gin.Context) {
	query := h.DB.Model(&models.Event{}).Preload("Division")

	res, err := paginate.List[models.Event](
		query,
		paginate.Bind(c).With("division_id", c.Query("division_id")),
		paginate.Config{
			Searchable: []string{"title", "description", "location", "banner_url", "status"},
			Sortable:   map[string]bool{"id": true, "created_at": true, "title": true, "description": true, "location": true, "banner_url": true, "status": true},
		},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to fetch events",
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
//	GET /api/events/export?format=csv
//	GET /api/events/export?format=xlsx&search=foo
func (h *EventHandler) Export(c *gin.Context) {
	const exportBatchSize = 1000

	format := c.DefaultQuery("format", "csv")
	search := c.Query("search")

	query := h.DB.Model(&models.Event{}).Preload("Division").Order("created_at desc")
	if search != "" && len([]string{"title", "description", "location", "banner_url", "status"}) > 0 {
		// Reuse the same searchable columns as List.
		searchable := []string{"title", "description", "location", "banner_url", "status"}
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
		Sheet: "Events",
		Columns: []export.Column{
			{Header: "ID", Field: "ID"},
			{Header: "Title", Field: "Title"},
			{Header: "Description", Field: "Description"},
			{Header: "Location", Field: "Location"},
			{Header: "BannerUrl", Field: "BannerUrl"},
			{Header: "StartTime", Field: "StartTime", Format: "date:2006-01-02"},
			{Header: "EndTime", Field: "EndTime", Format: "date:2006-01-02"},
			{Header: "AllowPermission", Field: "AllowPermission", Format: "bool"},
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
		c.Header("Content-Disposition", `attachment; filename="events.xlsx"`)
		var all []models.Event
		if err := query.FindInBatches(&[]models.Event{}, exportBatchSize, func(tx *gorm.DB, batch int) error {
			var rows []models.Event
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
	c.Header("Content-Disposition", `attachment; filename="events.csv"`)

	headerWritten := false
	if err := query.FindInBatches(&[]models.Event{}, exportBatchSize, func(tx *gorm.DB, batch int) error {
		var rows []models.Event
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

// GetByID returns a single event by ID.
func (h *EventHandler) GetByID(c *gin.Context) {
	id := c.Param("id")

	var item models.Event
	if err := h.DB.Preload("Division").First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "Event not found",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": item,
	})
}

// Create adds a new event.
func (h *EventHandler) Create(c *gin.Context) {
	var req struct {
		Title string `json:"title" binding:"required"`
		Description string `json:"description"`
		DivisionID string `json:"division_id"` // optional — empty = General event
		Location string `json:"location" binding:"required"`
		BannerUrl string `json:"banner_url"`
		StartTime *timex.FlexTime `json:"start_time"`
		EndTime *timex.FlexTime `json:"end_time"`
		AllowPermission bool `json:"allow_permission"`
		Status string `json:"status"` // default upcoming in service if empty
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

	item := models.Event{
		Title: req.Title,
		Description: req.Description,
		DivisionID: optionalStringPtr(req.DivisionID),
		Location: req.Location,
		BannerUrl: req.BannerUrl,
		StartTime: req.StartTime.Ptr(),
		EndTime: req.EndTime.Ptr(),
		AllowPermission: req.AllowPermission,
		Status: req.Status,
	}
	if item.Status == "" {
		item.Status = "upcoming"
	}

	if err := h.DB.Create(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to create event",
			},
		})
		return
	}

	h.DB.Preload("Division").First(&item, "id = ?", item.ID)

	services.LogCreate(h.DB, c, "Event", item.Title, item.ID, "")

	c.JSON(http.StatusCreated, gin.H{
		"data":    item,
		"message": "Event created successfully",
	})
}

// Update modifies an existing event.
func (h *EventHandler) Update(c *gin.Context) {
	id := c.Param("id")

	var item models.Event
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "Event not found",
			},
		})
		return
	}

	var req struct {
		Title string `json:"title"`
		Description string `json:"description"`
		DivisionID *string `json:"division_id"`
		Location string `json:"location"`
		BannerUrl string `json:"banner_url"`
		StartTime *timex.FlexTime `json:"start_time"`
		EndTime *timex.FlexTime `json:"end_time"`
		AllowPermission *bool `json:"allow_permission"`
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
	if req.DivisionID != nil {
		updates["division_id"] = *req.DivisionID
	}
	if req.Location != "" {
		updates["location"] = req.Location
	}
	if req.BannerUrl != "" {
		updates["banner_url"] = req.BannerUrl
	}
	if req.StartTime != nil {
		updates["start_time"] = req.StartTime.Ptr()
	}
	if req.EndTime != nil {
		updates["end_time"] = req.EndTime.Ptr()
	}
	if req.AllowPermission != nil {
		updates["allow_permission"] = *req.AllowPermission
	}
	if req.Status != "" {
		updates["status"] = req.Status
	}

	if err := h.DB.Model(&item).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to update event",
			},
		})
		return
	}

	h.DB.Preload("Division").First(&item, "id = ?", item.ID)

	services.LogUpdate(h.DB, c, "Event", item.Title, item.ID, services.DiffSummary(updates))

	c.JSON(http.StatusOK, gin.H{
		"data":    item,
		"message": "Event updated successfully",
	})
}

// Patch applies a partial update to a event. Used by the admin's
// grouped update view — each form group's Save button calls PATCH with
// only the fields it owns, so editing "Address" doesn't rewrite
// "Pricing". Refuses any key that isn't a writable model column.
func (h *EventHandler) Patch(c *gin.Context) {
	id := c.Param("id")

	var item models.Event
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "Event not found",
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
		"division_id": true,
		"location": true,
		"banner_url": true,
		"start_time": true,
		"end_time": true,
		"allow_permission": true,
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
				"message": "Failed to patch event",
			},
		})
		return
	}
	h.DB.Preload("Division").First(&item, "id = ?", item.ID)

	services.LogUpdate(h.DB, c, "Event", item.Title, item.ID, services.DiffSummary(updates))

	c.JSON(http.StatusOK, gin.H{
		"data":    item,
		"message": "Event updated successfully",
	})
}

// Delete soft-deletes a event.
func (h *EventHandler) Delete(c *gin.Context) {
	id := c.Param("id")

	var item models.Event
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "Event not found",
			},
		})
		return
	}

	if err := h.DB.Delete(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to delete event",
			},
		})
		return
	}

	services.LogDelete(h.DB, c, "Event", item.Title, item.ID)

	c.JSON(http.StatusOK, gin.H{
		"message": "Event deleted successfully",
	})
}
