package services

import (
	"fmt"
	"math"

	"gorm.io/gorm"

	"myorg/apps/api/internal/models"
)

// FinanceCategoryService handles business logic for finance_categories.
type FinanceCategoryService struct {
	DB *gorm.DB
}

// FinanceCategoryListParams holds pagination and filter parameters.
type FinanceCategoryListParams struct {
	Page      int
	PageSize  int
	Search    string
	SortBy    string
	SortOrder string
}

// List returns a paginated list of finance_categories.
func (s *FinanceCategoryService) List(params FinanceCategoryListParams) ([]models.FinanceCategory, int64, int, error) {
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
	sortableFinanceCategory := map[string]bool{"id": true, "created_at": true, "updated_at": true, "name": true, "type": true, "description": true}
	if !sortableFinanceCategory[params.SortBy] {
		params.SortBy = "created_at"
	}

	query := s.DB.Model(&models.FinanceCategory{})

	if params.Search != "" {
		query = query.Where("name ILIKE ? OR type ILIKE ? OR description ILIKE ?", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%")
	}

	var total int64
	query.Count(&total)

	var items []models.FinanceCategory
	offset := (params.Page - 1) * params.PageSize
	if err := query.Order(params.SortBy + " " + params.SortOrder).Offset(offset).Limit(params.PageSize).Find(&items).Error; err != nil {
		return nil, 0, 0, fmt.Errorf("fetching finance_categories: %w", err)
	}

	pages := int(math.Ceil(float64(total) / float64(params.PageSize)))
	return items, total, pages, nil
}

// GetByID returns a single financecategory by ID.
func (s *FinanceCategoryService) GetByID(id string) (*models.FinanceCategory, error) {
	var item models.FinanceCategory
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("financecategory not found: %w", err)
	}
	return &item, nil
}

// Create creates a new financecategory.
func (s *FinanceCategoryService) Create(item *models.FinanceCategory) error {
	if err := s.DB.Create(item).Error; err != nil {
		return fmt.Errorf("creating financecategory: %w", err)
	}
	return nil
}

// Update modifies an existing financecategory. Two queries: First() loads
// the row + verifies existence; Updates() persists the diff. The
// loaded struct is mutated by Updates() so we can return it directly
// without a third refetch.
func (s *FinanceCategoryService) Update(id string, updates map[string]interface{}) (*models.FinanceCategory, error) {
	var item models.FinanceCategory
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("financecategory not found: %w", err)
	}

	if err := s.DB.Model(&item).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("updating financecategory: %w", err)
	}

	return &item, nil
}

// Delete soft-deletes a financecategory. One query — we don't need to load
// the row first; GORM's Delete is atomic and rows-affected tells us
// whether it existed.
func (s *FinanceCategoryService) Delete(id string) error {
	res := s.DB.Where("id = ?", id).Delete(&models.FinanceCategory{})
	if res.Error != nil {
		return fmt.Errorf("deleting financecategory: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return fmt.Errorf("financecategory not found")
	}
	return nil
}
