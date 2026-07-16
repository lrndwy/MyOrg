package services

import (
	"fmt"
	"math"

	"gorm.io/gorm"

	"myorg/apps/api/internal/models"
)

// ViolationService handles business logic for violations.
type ViolationService struct {
	DB *gorm.DB
}

// ViolationListParams holds pagination and filter parameters.
type ViolationListParams struct {
	Page      int
	PageSize  int
	Search    string
	SortBy    string
	SortOrder string
}

// List returns a paginated list of violations.
func (s *ViolationService) List(params ViolationListParams) ([]models.Violation, int64, int, error) {
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
	sortableViolation := map[string]bool{"id": true, "created_at": true, "updated_at": true, "user_id": true, "violation_type": true, "description": true, "sp_level": true, "document_url": true, "issued_by_id": true, "issued_date": true}
	if !sortableViolation[params.SortBy] {
		params.SortBy = "created_at"
	}

	query := s.DB.Model(&models.Violation{})

	if params.Search != "" {
		query = query.Where("user ILIKE ? OR violation_type ILIKE ? OR description ILIKE ? OR sp_level ILIKE ? OR document_url ILIKE ? OR issued_by ILIKE ?", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%")
	}

	var total int64
	query.Count(&total)

	var items []models.Violation
	offset := (params.Page - 1) * params.PageSize
	if err := query.Order(params.SortBy + " " + params.SortOrder).Offset(offset).Limit(params.PageSize).Find(&items).Error; err != nil {
		return nil, 0, 0, fmt.Errorf("fetching violations: %w", err)
	}

	pages := int(math.Ceil(float64(total) / float64(params.PageSize)))
	return items, total, pages, nil
}

// GetByID returns a single violation by ID.
func (s *ViolationService) GetByID(id string) (*models.Violation, error) {
	var item models.Violation
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("violation not found: %w", err)
	}
	return &item, nil
}

// Create creates a new violation.
func (s *ViolationService) Create(item *models.Violation) error {
	if err := s.DB.Create(item).Error; err != nil {
		return fmt.Errorf("creating violation: %w", err)
	}
	return nil
}

// Update modifies an existing violation. Two queries: First() loads
// the row + verifies existence; Updates() persists the diff. The
// loaded struct is mutated by Updates() so we can return it directly
// without a third refetch.
func (s *ViolationService) Update(id string, updates map[string]interface{}) (*models.Violation, error) {
	var item models.Violation
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("violation not found: %w", err)
	}

	if err := s.DB.Model(&item).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("updating violation: %w", err)
	}

	return &item, nil
}

// Delete soft-deletes a violation. One query — we don't need to load
// the row first; GORM's Delete is atomic and rows-affected tells us
// whether it existed.
func (s *ViolationService) Delete(id string) error {
	res := s.DB.Where("id = ?", id).Delete(&models.Violation{})
	if res.Error != nil {
		return fmt.Errorf("deleting violation: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return fmt.Errorf("violation not found")
	}
	return nil
}
