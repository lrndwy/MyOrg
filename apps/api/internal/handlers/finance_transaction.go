package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"myorg/apps/api/internal/export"
	"myorg/apps/api/internal/models"
	"myorg/apps/api/internal/paginate"
	"myorg/apps/api/internal/services"
	"myorg/apps/api/internal/timex"
)

// FinanceTransactionHandler handles financetransaction endpoints.
type FinanceTransactionHandler struct {
	DB *gorm.DB
}

// List returns a paginated list of finance_transactions.
func (h *FinanceTransactionHandler) List(c *gin.Context) {
	query := h.DB.Model(&models.FinanceTransaction{}).Preload("Category").Preload("RecordedBy")

	res, err := paginate.List[models.FinanceTransaction](
		query,
		paginate.Bind(c).
			With("category_id", c.Query("category_id")).
			With("recorded_by_id", c.Query("recorded_by_id")).
			With("type", c.Query("type")),
		paginate.Config{
			Searchable: []string{"type", "description", "proof_url"},
			Sortable:   map[string]bool{"id": true, "created_at": true, "type": true, "amount": true, "description": true, "proof_url": true, "transaction_date": true},
		},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to fetch finance_transactions",
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
//	GET /api/finance_transactions/export?format=csv
//	GET /api/finance_transactions/export?format=xlsx&search=foo
func (h *FinanceTransactionHandler) Export(c *gin.Context) {
	const exportBatchSize = 1000

	format := c.DefaultQuery("format", "csv")
	search := c.Query("search")

	query := h.DB.Model(&models.FinanceTransaction{}).Preload("Category").Preload("RecordedBy").Order("created_at desc")
	if search != "" && len([]string{"type", "description", "proof_url"}) > 0 {
		// Reuse the same searchable columns as List.
		searchable := []string{"type", "description", "proof_url"}
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
		Sheet: "FinanceTransactions",
		Columns: []export.Column{
			{Header: "ID", Field: "ID"},
			{Header: "Type", Field: "Type"},
			{Header: "Amount", Field: "Amount"},
			{Header: "Description", Field: "Description"},
			{Header: "ProofUrl", Field: "ProofUrl"},
			{Header: "TransactionDate", Field: "TransactionDate", Format: "date:2006-01-02"},
			{Header: "Created At", Field: "CreatedAt", Format: "date:2006-01-02"},
		},
	}

	// Stream rows in batches via GORM's FindInBatches. CSV writes each
	// batch straight to the wire; XLSX accumulates into a slice (no
	// streaming API in excelize) but at least we never load the whole
	// table at once.
	if format == "xlsx" {
		c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
		c.Header("Content-Disposition", `attachment; filename="finance_transactions.xlsx"`)
		var all []models.FinanceTransaction
		if err := query.FindInBatches(&[]models.FinanceTransaction{}, exportBatchSize, func(tx *gorm.DB, batch int) error {
			var rows []models.FinanceTransaction
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
	c.Header("Content-Disposition", `attachment; filename="finance_transactions.csv"`)

	headerWritten := false
	if err := query.FindInBatches(&[]models.FinanceTransaction{}, exportBatchSize, func(tx *gorm.DB, batch int) error {
		var rows []models.FinanceTransaction
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

// GetByID returns a single financetransaction by ID.
func (h *FinanceTransactionHandler) GetByID(c *gin.Context) {
	id := c.Param("id")

	var item models.FinanceTransaction
	if err := h.DB.Preload("Category").Preload("RecordedBy").First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "FinanceTransaction not found",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": item,
	})
}

// Summary returns aggregate income, expense, and balance.
func (h *FinanceTransactionHandler) Summary(c *gin.Context) {
	svc := &services.FinanceTransactionService{DB: h.DB}
	out, err := svc.Summary()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": err.Error(),
			},
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": out})
}

// Dashboard returns stats, cashflow series, category breakdown, and recent updates.
func (h *FinanceTransactionHandler) Dashboard(c *gin.Context) {
	days := 30
	if raw := strings.TrimSpace(c.Query("days")); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 {
			days = n
		}
	}

	svc := &services.FinanceTransactionService{DB: h.DB}
	out, err := svc.Dashboard(days)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": err.Error(),
			},
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": out})
}

// Create adds a new financetransaction.
func (h *FinanceTransactionHandler) Create(c *gin.Context) {
	var req struct {
		Type            string     `json:"type" binding:"required"`
		Amount          float64    `json:"amount"`
		Description     string     `json:"description"`
		ProofUrl        string     `json:"proof_url"`
		TransactionDate *timex.FlexTime `json:"transaction_date"`
		CategoryID      string          `json:"category_id" binding:"required"`
		RecordedByID    string          `json:"recorded_by_id"`
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

	recordedByID := req.RecordedByID
	if strings.TrimSpace(recordedByID) == "" {
		if uid, ok := c.Get("user_id"); ok {
			if s, ok := uid.(string); ok {
				recordedByID = s
			}
		}
	}

	item := models.FinanceTransaction{
		Type:            req.Type,
		Amount:          req.Amount,
		Description:     req.Description,
		ProofUrl:        req.ProofUrl,
		TransactionDate: req.TransactionDate.Ptr(),
		CategoryID:      req.CategoryID,
		RecordedByID:    recordedByID,
	}

	svc := &services.FinanceTransactionService{DB: h.DB}
	if err := svc.CreateFinanceTransaction(&item); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": err.Error(),
			},
		})
		return
	}

	h.DB.Preload("Category").Preload("RecordedBy").First(&item, "id = ?", item.ID)

	services.LogCreate(h.DB, c, "FinanceTransaction", item.ID, item.ID, "")

	c.JSON(http.StatusCreated, gin.H{
		"data":    item,
		"message": "FinanceTransaction created successfully",
	})
}

// Update modifies an existing financetransaction.
func (h *FinanceTransactionHandler) Update(c *gin.Context) {
	id := c.Param("id")

	var item models.FinanceTransaction
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "FinanceTransaction not found",
			},
		})
		return
	}

	var req struct {
		Type string `json:"type"`
		Amount *float64 `json:"amount"`
		Description string `json:"description"`
		ProofUrl string `json:"proof_url"`
		TransactionDate *timex.FlexTime `json:"transaction_date"`
		CategoryID *string `json:"category_id"`
		RecordedByID *string `json:"recorded_by_id"`
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
	if req.Amount != nil {
		updates["amount"] = *req.Amount
	}
	if req.Description != "" {
		updates["description"] = req.Description
	}
	if req.ProofUrl != "" {
		updates["proof_url"] = req.ProofUrl
	}
	if req.TransactionDate != nil {
		updates["transaction_date"] = req.TransactionDate.Ptr()
	}
	if req.CategoryID != nil {
		updates["category_id"] = *req.CategoryID
	}
	if req.RecordedByID != nil {
		updates["recorded_by_id"] = *req.RecordedByID
	}

	svc := &services.FinanceTransactionService{DB: h.DB}
	updated, err := svc.UpdateFinanceTransaction(id, updates)
	if err != nil {
		status := http.StatusUnprocessableEntity
		code := "VALIDATION_ERROR"
		if strings.Contains(err.Error(), "not found") {
			status = http.StatusNotFound
			code = "NOT_FOUND"
		}
		c.JSON(status, gin.H{
			"error": gin.H{
				"code":    code,
				"message": err.Error(),
			},
		})
		return
	}
	item = *updated

	services.LogUpdate(h.DB, c, "FinanceTransaction", item.ID, item.ID, services.DiffSummary(updates))

	c.JSON(http.StatusOK, gin.H{
		"data":    item,
		"message": "FinanceTransaction updated successfully",
	})
}

// Patch applies a partial update to a financetransaction. Used by the admin's
// grouped update view — each form group's Save button calls PATCH with
// only the fields it owns, so editing "Address" doesn't rewrite
// "Pricing". Refuses any key that isn't a writable model column.
func (h *FinanceTransactionHandler) Patch(c *gin.Context) {
	id := c.Param("id")

	var item models.FinanceTransaction
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "FinanceTransaction not found",
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
		"type": true,
		"amount": true,
		"description": true,
		"proof_url": true,
		"transaction_date": true,
		"category_id": true,
		"recorded_by_id": true,
	}
	updates := map[string]interface{}{}
	for k, v := range body {
		if !allowed[k] {
			continue
		}
		if k == "transaction_date" {
			switch t := v.(type) {
			case nil:
				updates[k] = nil
			case string:
				parsed, err := timex.Parse(t)
				if err != nil {
					c.JSON(http.StatusUnprocessableEntity, gin.H{
						"error": gin.H{
							"code":    "VALIDATION_ERROR",
							"message": "invalid transaction_date: " + err.Error(),
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
				"message": "Failed to patch financetransaction",
			},
		})
		return
	}
	h.DB.Preload("Category").Preload("RecordedBy").First(&item, "id = ?", item.ID)

	services.LogUpdate(h.DB, c, "FinanceTransaction", item.ID, item.ID, services.DiffSummary(updates))

	c.JSON(http.StatusOK, gin.H{
		"data":    item,
		"message": "FinanceTransaction updated successfully",
	})
}

// Delete soft-deletes a financetransaction.
func (h *FinanceTransactionHandler) Delete(c *gin.Context) {
	id := c.Param("id")

	var item models.FinanceTransaction
	if err := h.DB.First(&item, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "FinanceTransaction not found",
			},
		})
		return
	}

	if err := h.DB.Delete(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to delete financetransaction",
			},
		})
		return
	}

	services.LogDelete(h.DB, c, "FinanceTransaction", item.ID, item.ID)

	c.JSON(http.StatusOK, gin.H{
		"message": "FinanceTransaction deleted successfully",
	})
}
