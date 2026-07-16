package services

import (
	"fmt"
	"math"

	"gorm.io/gorm"

	"myorg/apps/api/internal/models"
)

// RecruitmentCustomFieldService handles business logic for recruitment_custom_fields.
type RecruitmentCustomFieldService struct {
	DB *gorm.DB
}

// RecruitmentCustomFieldListParams holds pagination and filter parameters.
type RecruitmentCustomFieldListParams struct {
	Page      int
	PageSize  int
	Search    string
	SortBy    string
	SortOrder string
}

// List returns a paginated list of recruitment_custom_fields.
func (s *RecruitmentCustomFieldService) List(params RecruitmentCustomFieldListParams) ([]models.RecruitmentCustomField, int64, int, error) {
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
	sortableRecruitmentCustomField := map[string]bool{"id": true, "created_at": true, "updated_at": true, "recruitment_id": true, "field_label": true, "field_type": true, "is_required": true, "order_index": true}
	if !sortableRecruitmentCustomField[params.SortBy] {
		params.SortBy = "created_at"
	}

	query := s.DB.Model(&models.RecruitmentCustomField{})

	if params.Search != "" {
		query = query.Where("recruitment ILIKE ? OR field_label ILIKE ? OR field_type ILIKE ?", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%")
	}

	var total int64
	query.Count(&total)

	var items []models.RecruitmentCustomField
	offset := (params.Page - 1) * params.PageSize
	if err := query.Order(params.SortBy + " " + params.SortOrder).Offset(offset).Limit(params.PageSize).Find(&items).Error; err != nil {
		return nil, 0, 0, fmt.Errorf("fetching recruitment_custom_fields: %w", err)
	}

	pages := int(math.Ceil(float64(total) / float64(params.PageSize)))
	return items, total, pages, nil
}

// GetByID returns a single recruitmentcustomfield by ID.
func (s *RecruitmentCustomFieldService) GetByID(id string) (*models.RecruitmentCustomField, error) {
	var item models.RecruitmentCustomField
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("recruitmentcustomfield not found: %w", err)
	}
	return &item, nil
}

// Create creates a new recruitmentcustomfield.
func (s *RecruitmentCustomFieldService) Create(item *models.RecruitmentCustomField) error {
	if err := s.DB.Create(item).Error; err != nil {
		return fmt.Errorf("creating recruitmentcustomfield: %w", err)
	}
	return nil
}

// Update modifies an existing recruitmentcustomfield. Two queries: First() loads
// the row + verifies existence; Updates() persists the diff. The
// loaded struct is mutated by Updates() so we can return it directly
// without a third refetch.
func (s *RecruitmentCustomFieldService) Update(id string, updates map[string]interface{}) (*models.RecruitmentCustomField, error) {
	var item models.RecruitmentCustomField
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("recruitmentcustomfield not found: %w", err)
	}

	if err := s.DB.Model(&item).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("updating recruitmentcustomfield: %w", err)
	}

	return &item, nil
}

// Delete soft-deletes a recruitmentcustomfield. One query — we don't need to load
// the row first; GORM's Delete is atomic and rows-affected tells us
// whether it existed.
func (s *RecruitmentCustomFieldService) Delete(id string) error {
	res := s.DB.Where("id = ?", id).Delete(&models.RecruitmentCustomField{})
	if res.Error != nil {
		return fmt.Errorf("deleting recruitmentcustomfield: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return fmt.Errorf("recruitmentcustomfield not found")
	}
	return nil
}
