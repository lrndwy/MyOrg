package services

import (
	"fmt"
	"math"

	"gorm.io/gorm"

	"myorg/apps/api/internal/models"
)

// RecruitmentSubmissionService handles business logic for recruitment_submissions.
type RecruitmentSubmissionService struct {
	DB *gorm.DB
}

// RecruitmentSubmissionListParams holds pagination and filter parameters.
type RecruitmentSubmissionListParams struct {
	Page      int
	PageSize  int
	Search    string
	SortBy    string
	SortOrder string
}

// List returns a paginated list of recruitment_submissions.
func (s *RecruitmentSubmissionService) List(params RecruitmentSubmissionListParams) ([]models.RecruitmentSubmission, int64, int, error) {
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
	sortableRecruitmentSubmission := map[string]bool{"id": true, "created_at": true, "updated_at": true, "recruitment_id": true, "name": true, "nim": true, "division_interest_id": true, "contact": true, "custom_answers": true, "status": true}
	if !sortableRecruitmentSubmission[params.SortBy] {
		params.SortBy = "created_at"
	}

	query := s.DB.Model(&models.RecruitmentSubmission{})

	if params.Search != "" {
		query = query.Where("recruitment ILIKE ? OR name ILIKE ? OR nim ILIKE ? OR division_interest ILIKE ? OR contact ILIKE ? OR custom_answers ILIKE ? OR status ILIKE ?", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%")
	}

	var total int64
	query.Count(&total)

	var items []models.RecruitmentSubmission
	offset := (params.Page - 1) * params.PageSize
	if err := query.Order(params.SortBy + " " + params.SortOrder).Offset(offset).Limit(params.PageSize).Find(&items).Error; err != nil {
		return nil, 0, 0, fmt.Errorf("fetching recruitment_submissions: %w", err)
	}

	pages := int(math.Ceil(float64(total) / float64(params.PageSize)))
	return items, total, pages, nil
}

// GetByID returns a single recruitmentsubmission by ID.
func (s *RecruitmentSubmissionService) GetByID(id string) (*models.RecruitmentSubmission, error) {
	var item models.RecruitmentSubmission
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("recruitmentsubmission not found: %w", err)
	}
	return &item, nil
}

// Create creates a new recruitmentsubmission.
func (s *RecruitmentSubmissionService) Create(item *models.RecruitmentSubmission) error {
	if err := s.DB.Create(item).Error; err != nil {
		return fmt.Errorf("creating recruitmentsubmission: %w", err)
	}
	return nil
}

// Update modifies an existing recruitmentsubmission. Two queries: First() loads
// the row + verifies existence; Updates() persists the diff. The
// loaded struct is mutated by Updates() so we can return it directly
// without a third refetch.
func (s *RecruitmentSubmissionService) Update(id string, updates map[string]interface{}) (*models.RecruitmentSubmission, error) {
	var item models.RecruitmentSubmission
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("recruitmentsubmission not found: %w", err)
	}

	if err := s.DB.Model(&item).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("updating recruitmentsubmission: %w", err)
	}

	return &item, nil
}

// Delete soft-deletes a recruitmentsubmission. One query — we don't need to load
// the row first; GORM's Delete is atomic and rows-affected tells us
// whether it existed.
func (s *RecruitmentSubmissionService) Delete(id string) error {
	res := s.DB.Where("id = ?", id).Delete(&models.RecruitmentSubmission{})
	if res.Error != nil {
		return fmt.Errorf("deleting recruitmentsubmission: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return fmt.Errorf("recruitmentsubmission not found")
	}
	return nil
}
