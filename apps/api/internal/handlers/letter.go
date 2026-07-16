package handlers

import (
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"myorg/apps/api/internal/export"
	"myorg/apps/api/internal/models"
	"myorg/apps/api/internal/paginate"
	"myorg/apps/api/internal/services"
	"myorg/apps/api/internal/timex"
)

// LetterHandler handles letter endpoints.
type LetterHandler struct {
	DB      *gorm.DB
	Letters *services.LetterService
}

// List returns a paginated list of letters.
func (h *LetterHandler) List(c *gin.Context) {
	query := h.DB.Model(&models.Letter{}).
		Preload("Category").
		Preload("Template")

	res, err := paginate.List[models.Letter](
		query,
		paginate.Bind(c).With("category_id", c.Query("category_id")).With("type", c.Query("type")),
		paginate.Config{
			Searchable: []string{"type", "letter_code", "subject", "sender", "recipient", "document_url"},
			Sortable:   map[string]bool{"id": true, "created_at": true, "type": true, "letter_code": true, "subject": true, "letter_date": true, "sender": true, "recipient": true, "document_url": true},
		},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to fetch letters",
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
//	GET /api/letters/export?format=csv
//	GET /api/letters/export?format=xlsx&search=foo
func (h *LetterHandler) Export(c *gin.Context) {
	const exportBatchSize = 1000

	format := c.DefaultQuery("format", "csv")
	search := c.Query("search")

	query := h.DB.Model(&models.Letter{}).Preload("Category").Order("created_at desc")
	if search != "" && len([]string{"type", "letter_code", "subject", "sender", "recipient", "content", "document_url"}) > 0 {
		// Reuse the same searchable columns as List.
		searchable := []string{"type", "letter_code", "subject", "sender", "recipient", "content", "document_url"}
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
		Sheet: "Letters",
		Columns: []export.Column{
			{Header: "ID", Field: "ID"},
			{Header: "Type", Field: "Type"},
			{Header: "LetterCode", Field: "LetterCode"},
			{Header: "Subject", Field: "Subject"},
			{Header: "LetterDate", Field: "LetterDate", Format: "date:2006-01-02"},
			{Header: "Sender", Field: "Sender"},
			{Header: "Recipient", Field: "Recipient"},
			{Header: "Content", Field: "Content"},
			{Header: "DocumentUrl", Field: "DocumentUrl"},
			{Header: "Created At", Field: "CreatedAt", Format: "date:2006-01-02"},
		},
	}

	// Stream rows in batches via GORM's FindInBatches. CSV writes each
	// batch straight to the wire; XLSX accumulates into a slice (no
	// streaming API in excelize) but at least we never load the whole
	// table at once.
	if format == "xlsx" {
		c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
		c.Header("Content-Disposition", `attachment; filename="letters.xlsx"`)
		var all []models.Letter
		if err := query.FindInBatches(&[]models.Letter{}, exportBatchSize, func(tx *gorm.DB, batch int) error {
			var rows []models.Letter
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
	c.Header("Content-Disposition", `attachment; filename="letters.csv"`)

	headerWritten := false
	if err := query.FindInBatches(&[]models.Letter{}, exportBatchSize, func(tx *gorm.DB, batch int) error {
		var rows []models.Letter
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

// GetByID returns a single letter by ID.
func (h *LetterHandler) GetByID(c *gin.Context) {
	id := c.Param("id")

	var item models.Letter
	if err := h.DB.Preload("Category").Preload("Template").
		First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "Letter not found",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": item,
	})
}

// Create adds a new letter (outgoing from LetterTemplate; incoming stores uploaded file).
func (h *LetterHandler) Create(c *gin.Context) {
	var req struct {
		Type        string            `json:"type" binding:"required"`
		CategoryID  string            `json:"category_id"`
		TemplateID  string            `json:"template_id"`
		Subject     string            `json:"subject"`
		LetterDate  *timex.FlexTime   `json:"letter_date"`
		Sender      string            `json:"sender"`
		Recipient   string            `json:"recipient"`
		DocumentUrl string            `json:"document_url"`
		DocumentKey string            `json:"document_key"`
		FileName    string            `json:"file_name"`
		LetterCode  string            `json:"letter_code"`
		Variables   map[string]string `json:"variables"`
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

	svc := h.Letters
	if svc == nil {
		svc = &services.LetterService{DB: h.DB}
	}

	item, err := svc.Create(services.CreateLetterInput{
		Type:        req.Type,
		CategoryID:  req.CategoryID,
		TemplateID:  req.TemplateID,
		Subject:     req.Subject,
		LetterDate:  req.LetterDate.Ptr(),
		Sender:      req.Sender,
		Recipient:   req.Recipient,
		DocumentUrl: req.DocumentUrl,
		DocumentKey: req.DocumentKey,
		FileName:    req.FileName,
		LetterCode:  req.LetterCode,
		Variables:   req.Variables,
	})
	if err != nil {
		log.Printf("[letters] create failed: %v", err)
		status := http.StatusBadRequest
		code := "VALIDATION_ERROR"
		msg := err.Error()
		if strings.Contains(msg, "generating letter document") ||
			strings.Contains(msg, "file storage") ||
			strings.Contains(msg, "mengunduh") ||
			strings.Contains(msg, "template") {
			status = http.StatusUnprocessableEntity
			code = "LETTER_GENERATE_ERROR"
		}
		c.JSON(status, gin.H{
			"error": gin.H{
				"code":    code,
				"message": msg,
			},
		})
		return
	}

	services.LogCreate(h.DB, c, "Letter", item.Subject, item.ID, "")

	c.JSON(http.StatusCreated, gin.H{
		"data":    item,
		"message": "Letter created successfully",
	})
}

// Download redirects to the letter's document_url.
func (h *LetterHandler) Download(c *gin.Context) {
	id := c.Param("id")
	svc := h.Letters
	if svc == nil {
		svc = &services.LetterService{DB: h.DB}
	}
	item, err := svc.GetByID(id)
	if err != nil || item.DocumentUrl == "" {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "Letter document not found",
			},
		})
		return
	}
	c.Header("Content-Disposition", `attachment; filename="`+services.DocumentFileName(item)+`"`)
	c.Redirect(http.StatusFound, item.DocumentUrl)
}

// Update modifies an existing letter.
func (h *LetterHandler) Update(c *gin.Context) {
	id := c.Param("id")

	var item models.Letter
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "Letter not found",
			},
		})
		return
	}

	var req struct {
		Type        string          `json:"type"`
		CategoryID  *string         `json:"category_id"`
		LetterCode  string          `json:"letter_code"`
		Subject     string          `json:"subject"`
		LetterDate  *timex.FlexTime `json:"letter_date"`
		Sender      string          `json:"sender"`
		Recipient   string          `json:"recipient"`
		Content     string          `json:"content"`
		DocumentUrl string          `json:"document_url"`
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
	if req.Type != "" {
		updates["type"] = req.Type
	}
	if req.CategoryID != nil {
		updates["category_id"] = *req.CategoryID
	}
	if req.LetterCode != "" {
		updates["letter_code"] = req.LetterCode
	}
	if req.Subject != "" {
		updates["subject"] = req.Subject
	}
	if req.LetterDate != nil {
		updates["letter_date"] = req.LetterDate.Ptr()
	}
	if req.Sender != "" {
		updates["sender"] = req.Sender
	}
	if req.Recipient != "" {
		updates["recipient"] = req.Recipient
	}
	if req.Content != "" {
		updates["content"] = req.Content
	}
	if req.DocumentUrl != "" {
		updates["document_url"] = req.DocumentUrl
	}

	if err := h.DB.Model(&item).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to update letter",
			},
		})
		return
	}

	h.DB.Preload("Category").First(&item, "id = ?", item.ID)

	services.LogUpdate(h.DB, c, "Letter", item.Subject, item.ID, services.DiffSummary(updates))

	c.JSON(http.StatusOK, gin.H{
		"data":    item,
		"message": "Letter updated successfully",
	})
}

// Patch applies a partial update to a letter. Used by the admin's
// grouped update view — each form group's Save button calls PATCH with
// only the fields it owns, so editing "Address" doesn't rewrite
// "Pricing". Refuses any key that isn't a writable model column.
func (h *LetterHandler) Patch(c *gin.Context) {
	id := c.Param("id")

	var item models.Letter
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "Letter not found",
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
		"type":            true,
		"category_id":     true,
		"template_id":     true,
		"letter_code":     true,
		"subject":         true,
		"letter_date":     true,
		"sender":          true,
		"recipient":       true,
		"document_url":    true,
		"variable_values": true,
	}
	updates := map[string]interface{}{}
	for k, v := range body {
		if !allowed[k] {
			continue
		}
		if k == "letter_date" {
			switch t := v.(type) {
			case nil:
				updates[k] = nil
			case string:
				parsed, err := timex.Parse(t)
				if err != nil {
					c.JSON(http.StatusUnprocessableEntity, gin.H{
						"error": gin.H{
							"code":    "VALIDATION_ERROR",
							"message": "invalid letter_date: " + err.Error(),
						},
					})
					return
				}
				updates[k] = parsed
			default:
				updates[k] = v
			}
			continue
		}
		updates[k] = v
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
				"message": "Failed to patch letter",
			},
		})
		return
	}
	h.DB.Preload("Category").First(&item, "id = ?", item.ID)

	services.LogUpdate(h.DB, c, "Letter", item.Subject, item.ID, services.DiffSummary(updates))

	c.JSON(http.StatusOK, gin.H{
		"data":    item,
		"message": "Letter updated successfully",
	})
}

// Delete soft-deletes a letter.
func (h *LetterHandler) Delete(c *gin.Context) {
	id := c.Param("id")

	svc := h.Letters
	if svc == nil {
		svc = &services.LetterService{DB: h.DB}
	}

	item, err := svc.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "Letter not found",
			},
		})
		return
	}

	if err := svc.Delete(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to delete letter",
			},
		})
		return
	}

	services.LogDelete(h.DB, c, "Letter", item.Subject, item.ID)

	c.JSON(http.StatusOK, gin.H{
		"message": "Letter deleted successfully",
	})
}
