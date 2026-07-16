package services

import (
	"fmt"
	"math"

	"gorm.io/gorm"

	"myorg/apps/api/internal/models"
)

// LetterCategoryService handles business logic for letter_categories.
type LetterCategoryService struct {
	DB *gorm.DB
}

// LetterCategoryListParams holds pagination and filter parameters.
type LetterCategoryListParams struct {
	Page      int
	PageSize  int
	Search    string
	SortBy    string
	SortOrder string
}

// List returns a paginated list of letter_categories.
func (s *LetterCategoryService) List(params LetterCategoryListParams) ([]models.LetterCategory, int64, int, error) {
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
	sortableLetterCategory := map[string]bool{"id": true, "created_at": true, "updated_at": true, "name": true, "code": true, "start_number": true, "current_number": true, "number_format_template": true}
	if !sortableLetterCategory[params.SortBy] {
		params.SortBy = "created_at"
	}

	query := s.DB.Model(&models.LetterCategory{})

	if params.Search != "" {
		query = query.Where("name ILIKE ? OR code ILIKE ? OR number_format_template ILIKE ?", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%")
	}

	var total int64
	query.Count(&total)

	var items []models.LetterCategory
	offset := (params.Page - 1) * params.PageSize
	if err := query.Order(params.SortBy + " " + params.SortOrder).Offset(offset).Limit(params.PageSize).Find(&items).Error; err != nil {
		return nil, 0, 0, fmt.Errorf("fetching letter_categories: %w", err)
	}

	pages := int(math.Ceil(float64(total) / float64(params.PageSize)))
	return items, total, pages, nil
}

// GetByID returns a single lettercategory by ID.
func (s *LetterCategoryService) GetByID(id string) (*models.LetterCategory, error) {
	var item models.LetterCategory
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("lettercategory not found: %w", err)
	}
	return &item, nil
}

// Create creates a new lettercategory.
func (s *LetterCategoryService) Create(item *models.LetterCategory) error {
	if err := s.DB.Create(item).Error; err != nil {
		return fmt.Errorf("creating lettercategory: %w", err)
	}
	return nil
}

// Update modifies an existing lettercategory. Two queries: First() loads
// the row + verifies existence; Updates() persists the diff. The
// loaded struct is mutated by Updates() so we can return it directly
// without a third refetch.
func (s *LetterCategoryService) Update(id string, updates map[string]interface{}) (*models.LetterCategory, error) {
	var item models.LetterCategory
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("lettercategory not found: %w", err)
	}

	if err := s.DB.Model(&item).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("updating lettercategory: %w", err)
	}

	return &item, nil
}

// Delete soft-deletes a lettercategory. One query — we don't need to load
// the row first; GORM's Delete is atomic and rows-affected tells us
// whether it existed.
func (s *LetterCategoryService) Delete(id string) error {
	res := s.DB.Where("id = ?", id).Delete(&models.LetterCategory{})
	if res.Error != nil {
		return fmt.Errorf("deleting lettercategory: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return fmt.Errorf("lettercategory not found")
	}
	return nil
}
