package services

import (
	"fmt"
	"math"

	"gorm.io/gorm"

	"myorg/apps/api/internal/models"
)

// LetterTemplateService handles business logic for letter_templates.
type LetterTemplateService struct {
	DB *gorm.DB
}

// LetterTemplateListParams holds pagination and filter parameters.
type LetterTemplateListParams struct {
	Page      int
	PageSize  int
	Search    string
	SortBy    string
	SortOrder string
}

// List returns a paginated list of letter_templates.
func (s *LetterTemplateService) List(params LetterTemplateListParams) ([]models.LetterTemplate, int64, int, error) {
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
	sortableLetterTemplate := map[string]bool{"id": true, "created_at": true, "updated_at": true, "name": true, "category_id": true, "template_url": true}
	if !sortableLetterTemplate[params.SortBy] {
		params.SortBy = "created_at"
	}

	query := s.DB.Model(&models.LetterTemplate{})

	if params.Search != "" {
		query = query.Where("name ILIKE ? OR category ILIKE ? OR template_url ILIKE ?", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%")
	}

	var total int64
	query.Count(&total)

	var items []models.LetterTemplate
	offset := (params.Page - 1) * params.PageSize
	if err := query.Order(params.SortBy + " " + params.SortOrder).Offset(offset).Limit(params.PageSize).Find(&items).Error; err != nil {
		return nil, 0, 0, fmt.Errorf("fetching letter_templates: %w", err)
	}

	pages := int(math.Ceil(float64(total) / float64(params.PageSize)))
	return items, total, pages, nil
}

// GetByID returns a single lettertemplate by ID.
func (s *LetterTemplateService) GetByID(id string) (*models.LetterTemplate, error) {
	var item models.LetterTemplate
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("lettertemplate not found: %w", err)
	}
	return &item, nil
}

// Create creates a new lettertemplate.
func (s *LetterTemplateService) Create(item *models.LetterTemplate) error {
	if err := s.DB.Create(item).Error; err != nil {
		return fmt.Errorf("creating lettertemplate: %w", err)
	}
	return nil
}

// Update modifies an existing lettertemplate. Two queries: First() loads
// the row + verifies existence; Updates() persists the diff. The
// loaded struct is mutated by Updates() so we can return it directly
// without a third refetch.
func (s *LetterTemplateService) Update(id string, updates map[string]interface{}) (*models.LetterTemplate, error) {
	var item models.LetterTemplate
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("lettertemplate not found: %w", err)
	}

	if err := s.DB.Model(&item).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("updating lettertemplate: %w", err)
	}

	return &item, nil
}

// Delete soft-deletes a lettertemplate. One query — we don't need to load
// the row first; GORM's Delete is atomic and rows-affected tells us
// whether it existed.
func (s *LetterTemplateService) Delete(id string) error {
	res := s.DB.Where("id = ?", id).Delete(&models.LetterTemplate{})
	if res.Error != nil {
		return fmt.Errorf("deleting lettertemplate: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return fmt.Errorf("lettertemplate not found")
	}
	return nil
}
