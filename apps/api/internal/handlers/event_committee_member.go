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

// EventCommitteeMemberHandler handles eventcommitteemember endpoints.
type EventCommitteeMemberHandler struct {
	DB *gorm.DB
}

// List returns a paginated list of event_committee_members.
func (h *EventCommitteeMemberHandler) List(c *gin.Context) {
	query := h.DB.Model(&models.EventCommitteeMember{}).Preload("Sie").Preload("User")

	res, err := paginate.List[models.EventCommitteeMember](
		query,
		paginate.Bind(c).With("sie_id", c.Query("sie_id")).With("user_id", c.Query("user_id")),
		paginate.Config{
			Searchable: []string{"role"},
			Sortable:   map[string]bool{"id": true, "created_at": true, "role": true},
		},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to fetch event_committee_members",
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
//	GET /api/event_committee_members/export?format=csv
//	GET /api/event_committee_members/export?format=xlsx&search=foo
func (h *EventCommitteeMemberHandler) Export(c *gin.Context) {
	const exportBatchSize = 1000

	format := c.DefaultQuery("format", "csv")
	search := c.Query("search")

	query := h.DB.Model(&models.EventCommitteeMember{}).Preload("Sie").Preload("User").Order("created_at desc")
	if search != "" && len([]string{"role"}) > 0 {
		// Reuse the same searchable columns as List.
		searchable := []string{"role"}
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
		Sheet: "EventCommitteeMembers",
		Columns: []export.Column{
			{Header: "ID", Field: "ID"},
			{Header: "Role", Field: "Role"},
			{Header: "Created At", Field: "CreatedAt", Format: "date:2006-01-02"},
		},
	}

	// Stream rows in batches via GORM's FindInBatches. CSV writes each
	// batch straight to the wire; XLSX accumulates into a slice (no
	// streaming API in excelize) but at least we never load the whole
	// table at once.
	if format == "xlsx" {
		c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
		c.Header("Content-Disposition", `attachment; filename="event_committee_members.xlsx"`)
		var all []models.EventCommitteeMember
		if err := query.FindInBatches(&[]models.EventCommitteeMember{}, exportBatchSize, func(tx *gorm.DB, batch int) error {
			var rows []models.EventCommitteeMember
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
	c.Header("Content-Disposition", `attachment; filename="event_committee_members.csv"`)

	headerWritten := false
	if err := query.FindInBatches(&[]models.EventCommitteeMember{}, exportBatchSize, func(tx *gorm.DB, batch int) error {
		var rows []models.EventCommitteeMember
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

// GetByID returns a single eventcommitteemember by ID.
func (h *EventCommitteeMemberHandler) GetByID(c *gin.Context) {
	id := c.Param("id")

	var item models.EventCommitteeMember
	if err := h.DB.Preload("Sie").Preload("User").First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "EventCommitteeMember not found",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": item,
	})
}

// Create adds a new eventcommitteemember.
func (h *EventCommitteeMemberHandler) Create(c *gin.Context) {
	var req struct {
		SieID string `json:"sie_id" binding:"required"`
		UserID string `json:"user_id" binding:"required"`
		Role string `json:"role" binding:"required"`
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

	item := models.EventCommitteeMember{
		SieID: req.SieID,
		UserID: req.UserID,
		Role: req.Role,
	}

	if err := h.DB.Create(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to create eventcommitteemember",
			},
		})
		return
	}

	h.DB.Preload("Sie").Preload("User").First(&item, "id = ?", item.ID)

	services.LogCreate(h.DB, c, "EventCommitteeMember", item.ID, item.ID, "")

	c.JSON(http.StatusCreated, gin.H{
		"data":    item,
		"message": "EventCommitteeMember created successfully",
	})
}

// Update modifies an existing eventcommitteemember.
func (h *EventCommitteeMemberHandler) Update(c *gin.Context) {
	id := c.Param("id")

	var item models.EventCommitteeMember
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "EventCommitteeMember not found",
			},
		})
		return
	}

	var req struct {
		SieID *string `json:"sie_id"`
		UserID *string `json:"user_id"`
		Role string `json:"role"`
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
	if req.SieID != nil {
		updates["sie_id"] = *req.SieID
	}
	if req.UserID != nil {
		updates["user_id"] = *req.UserID
	}
	if req.Role != "" {
		updates["role"] = req.Role
	}

	if err := h.DB.Model(&item).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to update eventcommitteemember",
			},
		})
		return
	}

	h.DB.Preload("Sie").Preload("User").First(&item, "id = ?", item.ID)

	services.LogUpdate(h.DB, c, "EventCommitteeMember", item.ID, item.ID, services.DiffSummary(updates))

	c.JSON(http.StatusOK, gin.H{
		"data":    item,
		"message": "EventCommitteeMember updated successfully",
	})
}

// Patch applies a partial update to a eventcommitteemember. Used by the admin's
// grouped update view — each form group's Save button calls PATCH with
// only the fields it owns, so editing "Address" doesn't rewrite
// "Pricing". Refuses any key that isn't a writable model column.
func (h *EventCommitteeMemberHandler) Patch(c *gin.Context) {
	id := c.Param("id")

	var item models.EventCommitteeMember
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "EventCommitteeMember not found",
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
		"sie_id": true,
		"user_id": true,
		"role": true,
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
				"message": "Failed to patch eventcommitteemember",
			},
		})
		return
	}
	h.DB.Preload("Sie").Preload("User").First(&item, "id = ?", item.ID)

	services.LogUpdate(h.DB, c, "EventCommitteeMember", item.ID, item.ID, services.DiffSummary(updates))

	c.JSON(http.StatusOK, gin.H{
		"data":    item,
		"message": "EventCommitteeMember updated successfully",
	})
}

// Delete soft-deletes a eventcommitteemember.
func (h *EventCommitteeMemberHandler) Delete(c *gin.Context) {
	id := c.Param("id")

	var item models.EventCommitteeMember
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "EventCommitteeMember not found",
			},
		})
		return
	}

	if err := h.DB.Delete(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to delete eventcommitteemember",
			},
		})
		return
	}

	services.LogDelete(h.DB, c, "EventCommitteeMember", item.ID, item.ID)

	c.JSON(http.StatusOK, gin.H{
		"message": "EventCommitteeMember deleted successfully",
	})
}
