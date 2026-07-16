package services

import (
	"fmt"
	"math"

	"gorm.io/gorm"

	"myorg/apps/api/internal/models"
)

// RecruitmentService handles business logic for recruitments.
type RecruitmentService struct {
	DB *gorm.DB
}

// RecruitmentListParams holds pagination and filter parameters.
type RecruitmentListParams struct {
	Page      int
	PageSize  int
	Search    string
	SortBy    string
	SortOrder string
}

// List returns a paginated list of recruitments.
func (s *RecruitmentService) List(params RecruitmentListParams) ([]models.Recruitment, int64, int, error) {
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
	sortableRecruitment := map[string]bool{"id": true, "created_at": true, "updated_at": true, "title": true, "description": true, "slug": true, "open_date": true, "close_date": true, "status": true}
	if !sortableRecruitment[params.SortBy] {
		params.SortBy = "created_at"
	}

	query := s.DB.Model(&models.Recruitment{})

	if params.Search != "" {
		query = query.Where("title ILIKE ? OR description ILIKE ? OR slug ILIKE ? OR status ILIKE ?", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%")
	}

	var total int64
	query.Count(&total)

	var items []models.Recruitment
	offset := (params.Page - 1) * params.PageSize
	if err := query.Order(params.SortBy + " " + params.SortOrder).Offset(offset).Limit(params.PageSize).Find(&items).Error; err != nil {
		return nil, 0, 0, fmt.Errorf("fetching recruitments: %w", err)
	}

	pages := int(math.Ceil(float64(total) / float64(params.PageSize)))
	return items, total, pages, nil
}

// GetByID returns a single recruitment by ID.
func (s *RecruitmentService) GetByID(id string) (*models.Recruitment, error) {
	var item models.Recruitment
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("recruitment not found: %w", err)
	}
	return &item, nil
}

// Create creates a new recruitment.
func (s *RecruitmentService) Create(item *models.Recruitment) error {
	if err := s.DB.Create(item).Error; err != nil {
		return fmt.Errorf("creating recruitment: %w", err)
	}
	return nil
}

// Update modifies an existing recruitment. Two queries: First() loads
// the row + verifies existence; Updates() persists the diff. The
// loaded struct is mutated by Updates() so we can return it directly
// without a third refetch.
func (s *RecruitmentService) Update(id string, updates map[string]interface{}) (*models.Recruitment, error) {
	var item models.Recruitment
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("recruitment not found: %w", err)
	}

	if err := s.DB.Model(&item).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("updating recruitment: %w", err)
	}

	return &item, nil
}

// Delete soft-deletes a recruitment. One query — we don't need to load
// the row first; GORM's Delete is atomic and rows-affected tells us
// whether it existed.
func (s *RecruitmentService) Delete(id string) error {
	res := s.DB.Where("id = ?", id).Delete(&models.Recruitment{})
	if res.Error != nil {
		return fmt.Errorf("deleting recruitment: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return fmt.Errorf("recruitment not found")
	}
	return nil
}
