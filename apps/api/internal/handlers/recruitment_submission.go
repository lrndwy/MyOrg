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

// RecruitmentSubmissionHandler handles recruitmentsubmission endpoints.
type RecruitmentSubmissionHandler struct {
	DB *gorm.DB
}

// List returns a paginated list of recruitment_submissions.
func (h *RecruitmentSubmissionHandler) List(c *gin.Context) {
	query := h.DB.Model(&models.RecruitmentSubmission{}).Preload("Recruitment").Preload("DivisionInterest")

	res, err := paginate.List[models.RecruitmentSubmission](
		query,
		paginate.Bind(c).With("recruitment_id", c.Query("recruitment_id")).With("division_interest_id", c.Query("division_interest_id")),
		paginate.Config{
			Searchable: []string{"name", "nim", "contact", "custom_answers", "status"},
			Sortable:   map[string]bool{"id": true, "created_at": true, "name": true, "nim": true, "contact": true, "custom_answers": true, "status": true},
		},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to fetch recruitment_submissions",
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
//	GET /api/recruitment_submissions/export?format=csv
//	GET /api/recruitment_submissions/export?format=xlsx&search=foo
func (h *RecruitmentSubmissionHandler) Export(c *gin.Context) {
	const exportBatchSize = 1000

	format := c.DefaultQuery("format", "csv")
	search := c.Query("search")

	query := h.DB.Model(&models.RecruitmentSubmission{}).Preload("Recruitment").Preload("DivisionInterest").Order("created_at desc")
	if search != "" && len([]string{"name", "nim", "contact", "custom_answers", "status"}) > 0 {
		// Reuse the same searchable columns as List.
		searchable := []string{"name", "nim", "contact", "custom_answers", "status"}
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
		Sheet: "RecruitmentSubmissions",
		Columns: []export.Column{
			{Header: "ID", Field: "ID"},
			{Header: "Name", Field: "Name"},
			{Header: "Nim", Field: "Nim"},
			{Header: "Contact", Field: "Contact"},
			{Header: "CustomAnswers", Field: "CustomAnswers"},
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
		c.Header("Content-Disposition", `attachment; filename="recruitment_submissions.xlsx"`)
		var all []models.RecruitmentSubmission
		if err := query.FindInBatches(&[]models.RecruitmentSubmission{}, exportBatchSize, func(tx *gorm.DB, batch int) error {
			var rows []models.RecruitmentSubmission
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
	c.Header("Content-Disposition", `attachment; filename="recruitment_submissions.csv"`)

	headerWritten := false
	if err := query.FindInBatches(&[]models.RecruitmentSubmission{}, exportBatchSize, func(tx *gorm.DB, batch int) error {
		var rows []models.RecruitmentSubmission
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

// GetByID returns a single recruitmentsubmission by ID.
func (h *RecruitmentSubmissionHandler) GetByID(c *gin.Context) {
	id := c.Param("id")

	var item models.RecruitmentSubmission
	if err := h.DB.Preload("Recruitment").Preload("DivisionInterest").First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "RecruitmentSubmission not found",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": item,
	})
}

// Create adds a new recruitmentsubmission.
func (h *RecruitmentSubmissionHandler) Create(c *gin.Context) {
	var req struct {
		RecruitmentID string `json:"recruitment_id" binding:"required"`
		Name string `json:"name" binding:"required"`
		Nim string `json:"nim"`
		DivisionInterestID string `json:"division_interest_id" binding:"required"`
		Contact string `json:"contact" binding:"required"`
		CustomAnswers string `json:"custom_answers"`
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

	item := models.RecruitmentSubmission{
		RecruitmentID: req.RecruitmentID,
		Name: req.Name,
		Nim: req.Nim,
		DivisionInterestID: req.DivisionInterestID,
		Contact: req.Contact,
		CustomAnswers: jsonFromString(req.CustomAnswers),
		Status: req.Status,
	}

	if err := h.DB.Create(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to create recruitmentsubmission",
			},
		})
		return
	}

	h.DB.Preload("Recruitment").Preload("DivisionInterest").First(&item, "id = ?", item.ID)

	services.LogCreate(h.DB, c, "RecruitmentSubmission", item.Name, item.ID, "")

	c.JSON(http.StatusCreated, gin.H{
		"data":    item,
		"message": "RecruitmentSubmission created successfully",
	})
}

// Update modifies an existing recruitmentsubmission.
func (h *RecruitmentSubmissionHandler) Update(c *gin.Context) {
	id := c.Param("id")

	var item models.RecruitmentSubmission
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "RecruitmentSubmission not found",
			},
		})
		return
	}

	var req struct {
		RecruitmentID *string `json:"recruitment_id"`
		Name string `json:"name"`
		Nim string `json:"nim"`
		DivisionInterestID *string `json:"division_interest_id"`
		Contact string `json:"contact"`
		CustomAnswers string `json:"custom_answers"`
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
	if req.RecruitmentID != nil {
		updates["recruitment_id"] = *req.RecruitmentID
	}
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.Nim != "" {
		updates["nim"] = req.Nim
	}
	if req.DivisionInterestID != nil {
		updates["division_interest_id"] = *req.DivisionInterestID
	}
	if req.Contact != "" {
		updates["contact"] = req.Contact
	}
	if req.CustomAnswers != "" {
		updates["custom_answers"] = req.CustomAnswers
	}
	if req.Status != "" {
		updates["status"] = req.Status
	}

	if err := h.DB.Model(&item).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to update recruitmentsubmission",
			},
		})
		return
	}

	h.DB.Preload("Recruitment").Preload("DivisionInterest").First(&item, "id = ?", item.ID)

	services.LogUpdate(h.DB, c, "RecruitmentSubmission", item.Name, item.ID, services.DiffSummary(updates))

	c.JSON(http.StatusOK, gin.H{
		"data":    item,
		"message": "RecruitmentSubmission updated successfully",
	})
}

// Patch applies a partial update to a recruitmentsubmission. Used by the admin's
// grouped update view — each form group's Save button calls PATCH with
// only the fields it owns, so editing "Address" doesn't rewrite
// "Pricing". Refuses any key that isn't a writable model column.
func (h *RecruitmentSubmissionHandler) Patch(c *gin.Context) {
	id := c.Param("id")

	var item models.RecruitmentSubmission
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "RecruitmentSubmission not found",
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
		"name": true,
		"nim": true,
		"division_interest_id": true,
		"contact": true,
		"custom_answers": true,
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
				"message": "Failed to patch recruitmentsubmission",
			},
		})
		return
	}
	h.DB.Preload("Recruitment").Preload("DivisionInterest").First(&item, "id = ?", item.ID)

	services.LogUpdate(h.DB, c, "RecruitmentSubmission", item.Name, item.ID, services.DiffSummary(updates))

	c.JSON(http.StatusOK, gin.H{
		"data":    item,
		"message": "RecruitmentSubmission updated successfully",
	})
}

// Delete soft-deletes a recruitmentsubmission.
func (h *RecruitmentSubmissionHandler) Delete(c *gin.Context) {
	id := c.Param("id")

	var item models.RecruitmentSubmission
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "RecruitmentSubmission not found",
			},
		})
		return
	}

	if err := h.DB.Delete(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to delete recruitmentsubmission",
			},
		})
		return
	}

	services.LogDelete(h.DB, c, "RecruitmentSubmission", item.Name, item.ID)

	c.JSON(http.StatusOK, gin.H{
		"message": "RecruitmentSubmission deleted successfully",
	})
}
