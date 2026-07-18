package services

import (
	"fmt"
	"strings"
	"time"

	"myorg/apps/api/internal/models"
)

// FinanceSummary holds aggregate income and expense totals.
type FinanceSummary struct {
	TotalIncome  float64 `json:"total_income"`
	TotalExpense float64 `json:"total_expense"`
	Balance      float64 `json:"balance"`
}

// CreateFinanceTransaction validates and stores a ledger entry.
func (s *FinanceTransactionService) CreateFinanceTransaction(item *models.FinanceTransaction) error {
	item.Type = strings.TrimSpace(strings.ToLower(item.Type))
	if item.Type != "income" && item.Type != "expense" {
		return fmt.Errorf("type must be income (pemasukan) or expense (pengeluaran)")
	}
	if item.Amount <= 0 {
		return fmt.Errorf("amount must be greater than zero")
	}
	if strings.TrimSpace(item.CategoryID) == "" {
		return fmt.Errorf("category is required")
	}

	var cat models.FinanceCategory
	if err := s.DB.First(&cat, "id = ?", item.CategoryID).Error; err != nil {
		return fmt.Errorf("category not found")
	}
	if cat.Type != item.Type {
		return fmt.Errorf("kategori tidak sesuai jenis transaksi (pemasukan/pengeluaran)")
	}

	if item.TransactionDate == nil {
		now := time.Now()
		item.TransactionDate = &now
	}

	if err := s.DB.Create(item).Error; err != nil {
		return fmt.Errorf("creating finance transaction: %w", err)
	}
	return nil
}

// UpdateFinanceTransaction applies partial updates with validation when type/category changes.
func (s *FinanceTransactionService) UpdateFinanceTransaction(id string, updates map[string]interface{}) (*models.FinanceTransaction, error) {
	var item models.FinanceTransaction
	if err := s.DB.Preload("Category").First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("finance transaction not found: %w", err)
	}

	nextType := item.Type
	if v, ok := updates["type"].(string); ok {
		nextType = strings.TrimSpace(strings.ToLower(v))
		if nextType != "income" && nextType != "expense" {
			return nil, fmt.Errorf("type must be income or expense")
		}
		updates["type"] = nextType
	}

	nextCategoryID := item.CategoryID
	if v, ok := updates["category_id"].(string); ok && strings.TrimSpace(v) != "" {
		nextCategoryID = v
	}

	var cat models.FinanceCategory
	if err := s.DB.First(&cat, "id = ?", nextCategoryID).Error; err != nil {
		return nil, fmt.Errorf("category not found")
	}
	if cat.Type != nextType {
		return nil, fmt.Errorf("kategori tidak sesuai jenis transaksi")
	}

	if amount, ok := updates["amount"].(float64); ok && amount <= 0 {
		return nil, fmt.Errorf("amount must be greater than zero")
	}

	if err := s.DB.Model(&item).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("updating finance transaction: %w", err)
	}

	var out models.FinanceTransaction
	if err := s.DB.Preload("Category").Preload("RecordedBy").First(&out, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("finance transaction not found: %w", err)
	}
	return &out, nil
}

// Summary returns total income, expense, and balance.
func (s *FinanceTransactionService) Summary() (*FinanceSummary, error) {
	type row struct {
		Type  string
		Total float64
	}
	var rows []row
	if err := s.DB.Model(&models.FinanceTransaction{}).
		Select("type, COALESCE(SUM(amount), 0) as total").
		Group("type").
		Scan(&rows).Error; err != nil {
		return nil, fmt.Errorf("finance summary: %w", err)
	}

	out := &FinanceSummary{}
	for _, r := range rows {
		switch r.Type {
		case "income":
			out.TotalIncome = r.Total
		case "expense":
			out.TotalExpense = r.Total
		}
	}
	out.Balance = out.TotalIncome - out.TotalExpense
	return out, nil
}

// GetByIDWithRelations returns a transaction with category and recorder preloaded.
func (s *FinanceTransactionService) GetByIDWithRelations(id string) (*models.FinanceTransaction, error) {
	var item models.FinanceTransaction
	if err := s.DB.Preload("Category").Preload("RecordedBy").First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("finance transaction not found: %w", err)
	}
	return &item, nil
}
