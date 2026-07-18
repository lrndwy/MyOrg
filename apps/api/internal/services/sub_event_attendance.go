package services

import (
	"fmt"
	"math"

	"gorm.io/gorm"

	"myorg/apps/api/internal/models"
)

// SubEventAttendanceService handles business logic for sub_event_attendances.
type SubEventAttendanceService struct {
	DB *gorm.DB
}

// SubEventAttendanceListParams holds pagination and filter parameters.
type SubEventAttendanceListParams struct {
	Page      int
	PageSize  int
	Search    string
	SortBy    string
	SortOrder string
}

// List returns a paginated list of sub_event_attendances.
func (s *SubEventAttendanceService) List(params SubEventAttendanceListParams) ([]models.SubEventAttendance, int64, int, error) {
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
	sortableSubEventAttendance := map[string]bool{"id": true, "created_at": true, "updated_at": true, "sub_event_id": true, "user_id": true, "status": true, "selfie_url": true, "signature_url": true, "checked_in_at": true, "marked_by_id": true}
	if !sortableSubEventAttendance[params.SortBy] {
		params.SortBy = "created_at"
	}

	query := s.DB.Model(&models.SubEventAttendance{})

	if params.Search != "" {
		query = query.Where("sub_event ILIKE ? OR user ILIKE ? OR status ILIKE ? OR selfie_url ILIKE ? OR signature_url ILIKE ? OR marked_by ILIKE ?", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%")
	}

	var total int64
	query.Count(&total)

	var items []models.SubEventAttendance
	offset := (params.Page - 1) * params.PageSize
	if err := query.Order(params.SortBy + " " + params.SortOrder).Offset(offset).Limit(params.PageSize).Find(&items).Error; err != nil {
		return nil, 0, 0, fmt.Errorf("fetching sub_event_attendances: %w", err)
	}

	pages := int(math.Ceil(float64(total) / float64(params.PageSize)))
	return items, total, pages, nil
}

// GetByID returns a single subeventattendance by ID.
func (s *SubEventAttendanceService) GetByID(id string) (*models.SubEventAttendance, error) {
	var item models.SubEventAttendance
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("subeventattendance not found: %w", err)
	}
	return &item, nil
}

// Create creates a new subeventattendance.
func (s *SubEventAttendanceService) Create(item *models.SubEventAttendance) error {
	if err := s.DB.Create(item).Error; err != nil {
		return fmt.Errorf("creating subeventattendance: %w", err)
	}
	return nil
}

// Update modifies an existing subeventattendance. Two queries: First() loads
// the row + verifies existence; Updates() persists the diff. The
// loaded struct is mutated by Updates() so we can return it directly
// without a third refetch.
func (s *SubEventAttendanceService) Update(id string, updates map[string]interface{}) (*models.SubEventAttendance, error) {
	var item models.SubEventAttendance
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("subeventattendance not found: %w", err)
	}

	if err := s.DB.Model(&item).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("updating subeventattendance: %w", err)
	}

	return &item, nil
}

// Delete soft-deletes a subeventattendance. One query — we don't need to load
// the row first; GORM's Delete is atomic and rows-affected tells us
// whether it existed.
func (s *SubEventAttendanceService) Delete(id string) error {
	res := s.DB.Where("id = ?", id).Delete(&models.SubEventAttendance{})
	if res.Error != nil {
		return fmt.Errorf("deleting subeventattendance: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return fmt.Errorf("subeventattendance not found")
	}
	return nil
}
