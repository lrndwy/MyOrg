package services

import (
	"fmt"
	"math"

	"gorm.io/gorm"

	"myorg/apps/api/internal/models"
)

// FinanceTransactionService handles business logic for finance_transactions.
type FinanceTransactionService struct {
	DB *gorm.DB
}

// FinanceTransactionListParams holds pagination and filter parameters.
type FinanceTransactionListParams struct {
	Page      int
	PageSize  int
	Search    string
	SortBy    string
	SortOrder string
}

// List returns a paginated list of finance_transactions.
func (s *FinanceTransactionService) List(params FinanceTransactionListParams) ([]models.FinanceTransaction, int64, int, error) {
	if params.Page < 1 {
		params.Page = 1
	}
	if params.PageSize < 1 || params.PageSize > 100 {
		params.PageSize = 20
	}
	if params.SortOrder != "asc" && params.SortOrder != "desc" {
		params.SortOrder = "desc"
	}
	// SortBy is interpolated into ORDER BY below, so it MUST be whitelisted
	// against real columns — never trust a client-supplied sort column.
	sortableFinanceTransaction := map[string]bool{"id": true, "created_at": true, "updated_at": true, "type": true, "amount": true, "description": true, "proof_url": true, "transaction_date": true, "category_id": true, "recorded_by_id": true}
	if !sortableFinanceTransaction[params.SortBy] {
		params.SortBy = "created_at"
	}

	query := s.DB.Model(&models.FinanceTransaction{})

	if params.Search != "" {
		query = query.Where("type ILIKE ? OR description ILIKE ? OR proof_url ILIKE ? OR category ILIKE ? OR recorded_by ILIKE ?", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%")
	}

	var total int64
	query.Count(&total)

	var items []models.FinanceTransaction
	offset := (params.Page - 1) * params.PageSize
	if err := query.Order(params.SortBy + " " + params.SortOrder).Offset(offset).Limit(params.PageSize).Find(&items).Error; err != nil {
		return nil, 0, 0, fmt.Errorf("fetching finance_transactions: %w", err)
	}

	pages := int(math.Ceil(float64(total) / float64(params.PageSize)))
	return items, total, pages, nil
}

// GetByID returns a single financetransaction by ID.
func (s *FinanceTransactionService) GetByID(id string) (*models.FinanceTransaction, error) {
	var item models.FinanceTransaction
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("financetransaction not found: %w", err)
	}
	return &item, nil
}

// Create creates a new financetransaction.
func (s *FinanceTransactionService) Create(item *models.FinanceTransaction) error {
	if err := s.DB.Create(item).Error; err != nil {
		return fmt.Errorf("creating financetransaction: %w", err)
	}
	return nil
}

// Update modifies an existing financetransaction. Two queries: First() loads
// the row + verifies existence; Updates() persists the diff. The
// loaded struct is mutated by Updates() so we can return it directly
// without a third refetch.
func (s *FinanceTransactionService) Update(id string, updates map[string]interface{}) (*models.FinanceTransaction, error) {
	var item models.FinanceTransaction
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("financetransaction not found: %w", err)
	}

	if err := s.DB.Model(&item).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("updating financetransaction: %w", err)
	}

	return &item, nil
}

// Delete soft-deletes a financetransaction. One query — we don't need to load
// the row first; GORM's Delete is atomic and rows-affected tells us
// whether it existed.
func (s *FinanceTransactionService) Delete(id string) error {
	res := s.DB.Where("id = ?", id).Delete(&models.FinanceTransaction{})
	if res.Error != nil {
		return fmt.Errorf("deleting financetransaction: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return fmt.Errorf("financetransaction not found")
	}
	return nil
}
