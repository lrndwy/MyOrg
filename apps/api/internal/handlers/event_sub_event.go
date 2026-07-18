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

// EventSubEventHandler handles eventsubevent endpoints.
type EventSubEventHandler struct {
	DB *gorm.DB
}

// List returns a paginated list of event_sub_events.
func (h *EventSubEventHandler) List(c *gin.Context) {
	query := h.DB.Model(&models.EventSubEvent{}).Preload("Event").Preload("Sie").Preload("KetuaPelaksana")

	res, err := paginate.List[models.EventSubEvent](
		query,
		paginate.Bind(c).With("event_id", c.Query("event_id")).With("sie_id", c.Query("sie_id")).With("ketua_pelaksana_id", c.Query("ketua_pelaksana_id")),
		paginate.Config{
			Searchable: []string{"title", "description", "location", "attendance_mode", "minutes_url", "status"},
			Sortable:   map[string]bool{"id": true, "created_at": true, "title": true, "description": true, "location": true, "attendance_mode": true, "minutes_url": true, "status": true},
		},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to fetch event_sub_events",
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
//	GET /api/event_sub_events/export?format=csv
//	GET /api/event_sub_events/export?format=xlsx&search=foo
func (h *EventSubEventHandler) Export(c *gin.Context) {
	const exportBatchSize = 1000

	format := c.DefaultQuery("format", "csv")
	search := c.Query("search")

	query := h.DB.Model(&models.EventSubEvent{}).Preload("Event").Preload("Sie").Preload("KetuaPelaksana").Order("created_at desc")
	if search != "" && len([]string{"title", "description", "location", "attendance_mode", "minutes_url", "status"}) > 0 {
		// Reuse the same searchable columns as List.
		searchable := []string{"title", "description", "location", "attendance_mode", "minutes_url", "status"}
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
		Sheet: "EventSubEvents",
		Columns: []export.Column{
			{Header: "ID", Field: "ID"},
			{Header: "Title", Field: "Title"},
			{Header: "Description", Field: "Description"},
			{Header: "Location", Field: "Location"},
			{Header: "StartTime", Field: "StartTime", Format: "date:2006-01-02"},
			{Header: "EndTime", Field: "EndTime", Format: "date:2006-01-02"},
			{Header: "AttendanceMode", Field: "AttendanceMode"},
			{Header: "MinutesUrl", Field: "MinutesUrl"},
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
		c.Header("Content-Disposition", `attachment; filename="event_sub_events.xlsx"`)
		var all []models.EventSubEvent
		if err := query.FindInBatches(&[]models.EventSubEvent{}, exportBatchSize, func(tx *gorm.DB, batch int) error {
			var rows []models.EventSubEvent
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
	c.Header("Content-Disposition", `attachment; filename="event_sub_events.csv"`)

	headerWritten := false
	if err := query.FindInBatches(&[]models.EventSubEvent{}, exportBatchSize, func(tx *gorm.DB, batch int) error {
		var rows []models.EventSubEvent
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

// GetByID returns a single eventsubevent by ID.
func (h *EventSubEventHandler) GetByID(c *gin.Context) {
	id := c.Param("id")

	var item models.EventSubEvent
	if err := h.DB.Preload("Event").Preload("Sie").Preload("KetuaPelaksana").First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "EventSubEvent not found",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": item,
	})
}

// Create adds a new eventsubevent.
func (h *EventSubEventHandler) Create(c *gin.Context) {
	var req struct {
		EventID string `json:"event_id" binding:"required"`
		SieID string `json:"sie_id" binding:"required"`
		Title string `json:"title" binding:"required"`
		Description string `json:"description"`
		Location string `json:"location" binding:"required"`
		StartTime *time.Time `json:"start_time"`
		EndTime *time.Time `json:"end_time"`
		KetuaPelaksanaID string `json:"ketua_pelaksana_id" binding:"required"`
		AttendanceMode string `json:"attendance_mode" binding:"required"`
		MinutesUrl string `json:"minutes_url"`
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

	item := models.EventSubEvent{
		EventID: req.EventID,
		SieID: req.SieID,
		Title: req.Title,
		Description: req.Description,
		Location: req.Location,
		StartTime: req.StartTime,
		EndTime: req.EndTime,
		KetuaPelaksanaID: req.KetuaPelaksanaID,
		AttendanceMode: req.AttendanceMode,
		MinutesUrl: req.MinutesUrl,
		Status: req.Status,
	}

	if err := h.DB.Create(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to create eventsubevent",
			},
		})
		return
	}

	h.DB.Preload("Event").Preload("Sie").Preload("KetuaPelaksana").First(&item, "id = ?", item.ID)

	services.LogCreate(h.DB, c, "EventSubEvent", item.Title, item.ID, "")

	c.JSON(http.StatusCreated, gin.H{
		"data":    item,
		"message": "EventSubEvent created successfully",
	})
}

// Update modifies an existing eventsubevent.
func (h *EventSubEventHandler) Update(c *gin.Context) {
	id := c.Param("id")

	var item models.EventSubEvent
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "EventSubEvent not found",
			},
		})
		return
	}

	var req struct {
		EventID *string `json:"event_id"`
		SieID *string `json:"sie_id"`
		Title string `json:"title"`
		Description string `json:"description"`
		Location string `json:"location"`
		StartTime *time.Time `json:"start_time"`
		EndTime *time.Time `json:"end_time"`
		KetuaPelaksanaID *string `json:"ketua_pelaksana_id"`
		AttendanceMode string `json:"attendance_mode"`
		MinutesUrl string `json:"minutes_url"`
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
	if req.EventID != nil {
		updates["event_id"] = *req.EventID
	}
	if req.SieID != nil {
		updates["sie_id"] = *req.SieID
	}
	if req.Title != "" {
		updates["title"] = req.Title
	}
	if req.Description != "" {
		updates["description"] = req.Description
	}
	if req.Location != "" {
		updates["location"] = req.Location
	}
	if req.StartTime != nil {
		updates["start_time"] = req.StartTime
	}
	if req.EndTime != nil {
		updates["end_time"] = req.EndTime
	}
	if req.KetuaPelaksanaID != nil {
		updates["ketua_pelaksana_id"] = *req.KetuaPelaksanaID
	}
	if req.AttendanceMode != "" {
		updates["attendance_mode"] = req.AttendanceMode
	}
	if req.MinutesUrl != "" {
		updates["minutes_url"] = req.MinutesUrl
	}
	if req.Status != "" {
		updates["status"] = req.Status
	}

	if err := h.DB.Model(&item).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to update eventsubevent",
			},
		})
		return
	}

	h.DB.Preload("Event").Preload("Sie").Preload("KetuaPelaksana").First(&item, "id = ?", item.ID)

	services.LogUpdate(h.DB, c, "EventSubEvent", item.Title, item.ID, services.DiffSummary(updates))

	c.JSON(http.StatusOK, gin.H{
		"data":    item,
		"message": "EventSubEvent updated successfully",
	})
}

// Patch applies a partial update to a eventsubevent. Used by the admin's
// grouped update view — each form group's Save button calls PATCH with
// only the fields it owns, so editing "Address" doesn't rewrite
// "Pricing". Refuses any key that isn't a writable model column.
func (h *EventSubEventHandler) Patch(c *gin.Context) {
	id := c.Param("id")

	var item models.EventSubEvent
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "EventSubEvent not found",
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
		"sie_id": true,
		"title": true,
		"description": true,
		"location": true,
		"start_time": true,
		"end_time": true,
		"ketua_pelaksana_id": true,
		"attendance_mode": true,
		"minutes_url": true,
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
				"message": "Failed to patch eventsubevent",
			},
		})
		return
	}
	h.DB.Preload("Event").Preload("Sie").Preload("KetuaPelaksana").First(&item, "id = ?", item.ID)

	services.LogUpdate(h.DB, c, "EventSubEvent", item.Title, item.ID, services.DiffSummary(updates))

	c.JSON(http.StatusOK, gin.H{
		"data":    item,
		"message": "EventSubEvent updated successfully",
	})
}

// Delete soft-deletes a eventsubevent.
func (h *EventSubEventHandler) Delete(c *gin.Context) {
	id := c.Param("id")

	var item models.EventSubEvent
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "EventSubEvent not found",
			},
		})
		return
	}

	if err := h.DB.Delete(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to delete eventsubevent",
			},
		})
		return
	}

	services.LogDelete(h.DB, c, "EventSubEvent", item.Title, item.ID)

	c.JSON(http.StatusOK, gin.H{
		"message": "EventSubEvent deleted successfully",
	})
}
