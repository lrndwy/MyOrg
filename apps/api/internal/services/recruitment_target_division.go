package services

import (
	"fmt"
	"math"

	"gorm.io/gorm"

	"myorg/apps/api/internal/models"
)

// RecruitmentTargetDivisionService handles business logic for recruitment_target_divisions.
type RecruitmentTargetDivisionService struct {
	DB *gorm.DB
}

// RecruitmentTargetDivisionListParams holds pagination and filter parameters.
type RecruitmentTargetDivisionListParams struct {
	Page      int
	PageSize  int
	Search    string
	SortBy    string
	SortOrder string
}

// List returns a paginated list of recruitment_target_divisions.
func (s *RecruitmentTargetDivisionService) List(params RecruitmentTargetDivisionListParams) ([]models.RecruitmentTargetDivision, int64, int, error) {
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
	sortableRecruitmentTargetDivision := map[string]bool{"id": true, "created_at": true, "updated_at": true, "recruitment_id": true, "division_id": true}
	if !sortableRecruitmentTargetDivision[params.SortBy] {
		params.SortBy = "created_at"
	}

	query := s.DB.Model(&models.RecruitmentTargetDivision{})

	if params.Search != "" {
		query = query.Where("recruitment ILIKE ? OR division ILIKE ?", "%"+params.Search+"%", "%"+params.Search+"%")
	}

	var total int64
	query.Count(&total)

	var items []models.RecruitmentTargetDivision
	offset := (params.Page - 1) * params.PageSize
	if err := query.Order(params.SortBy + " " + params.SortOrder).Offset(offset).Limit(params.PageSize).Find(&items).Error; err != nil {
		return nil, 0, 0, fmt.Errorf("fetching recruitment_target_divisions: %w", err)
	}

	pages := int(math.Ceil(float64(total) / float64(params.PageSize)))
	return items, total, pages, nil
}

// GetByID returns a single recruitmenttargetdivision by ID.
func (s *RecruitmentTargetDivisionService) GetByID(id string) (*models.RecruitmentTargetDivision, error) {
	var item models.RecruitmentTargetDivision
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("recruitmenttargetdivision not found: %w", err)
	}
	return &item, nil
}

// Create creates a new recruitmenttargetdivision.
func (s *RecruitmentTargetDivisionService) Create(item *models.RecruitmentTargetDivision) error {
	if err := s.DB.Create(item).Error; err != nil {
		return fmt.Errorf("creating recruitmenttargetdivision: %w", err)
	}
	return nil
}

// Update modifies an existing recruitmenttargetdivision. Two queries: First() loads
// the row + verifies existence; Updates() persists the diff. The
// loaded struct is mutated by Updates() so we can return it directly
// without a third refetch.
func (s *RecruitmentTargetDivisionService) Update(id string, updates map[string]interface{}) (*models.RecruitmentTargetDivision, error) {
	var item models.RecruitmentTargetDivision
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("recruitmenttargetdivision not found: %w", err)
	}

	if err := s.DB.Model(&item).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("updating recruitmenttargetdivision: %w", err)
	}

	return &item, nil
}

// Delete soft-deletes a recruitmenttargetdivision. One query — we don't need to load
// the row first; GORM's Delete is atomic and rows-affected tells us
// whether it existed.
func (s *RecruitmentTargetDivisionService) Delete(id string) error {
	res := s.DB.Where("id = ?", id).Delete(&models.RecruitmentTargetDivision{})
	if res.Error != nil {
		return fmt.Errorf("deleting recruitmenttargetdivision: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return fmt.Errorf("recruitmenttargetdivision not found")
	}
	return nil
}
