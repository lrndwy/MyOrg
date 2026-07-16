package services

import (
	"fmt"
	"math"
	"time"

	"gorm.io/gorm"

	"myorg/apps/api/internal/models"
)

// AttendanceService handles business logic for attendances.
type AttendanceService struct {
	DB *gorm.DB
}

// AttendanceListParams holds pagination and filter parameters.
type AttendanceListParams struct {
	Page      int
	PageSize  int
	Search    string
	SortBy    string
	SortOrder string
}

// List returns a paginated list of attendances.
func (s *AttendanceService) List(params AttendanceListParams) ([]models.Attendance, int64, int, error) {
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
	sortableAttendance := map[string]bool{"id": true, "created_at": true, "updated_at": true, "event_id": true, "user_id": true, "status": true, "selfie_url": true, "signature_url": true, "checked_in_at": true}
	if !sortableAttendance[params.SortBy] {
		params.SortBy = "created_at"
	}

	query := s.DB.Model(&models.Attendance{})

	if params.Search != "" {
		query = query.Where("event ILIKE ? OR user ILIKE ? OR status ILIKE ? OR selfie_url ILIKE ? OR signature_url ILIKE ?", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%")
	}

	var total int64
	query.Count(&total)

	var items []models.Attendance
	offset := (params.Page - 1) * params.PageSize
	if err := query.Order(params.SortBy + " " + params.SortOrder).Offset(offset).Limit(params.PageSize).Find(&items).Error; err != nil {
		return nil, 0, 0, fmt.Errorf("fetching attendances: %w", err)
	}

	pages := int(math.Ceil(float64(total) / float64(params.PageSize)))
	return items, total, pages, nil
}

// GetByID returns a single attendance by ID.
func (s *AttendanceService) GetByID(id string) (*models.Attendance, error) {
	var item models.Attendance
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("attendance not found: %w", err)
	}
	return &item, nil
}

// Create creates a new attendance only when the event is ongoing.
func (s *AttendanceService) Create(item *models.Attendance) error {
	var event models.Event
	if err := s.DB.First(&event, "id = ?", item.EventID).Error; err != nil {
		return fmt.Errorf("event not found: %w", err)
	}
	if event.Status != "ongoing" {
		return fmt.Errorf("attendance only allowed when event status is ongoing (current: %s)", event.Status)
	}

	var existing models.Attendance
	if err := s.DB.Where("event_id = ? AND user_id = ?", item.EventID, item.UserID).First(&existing).Error; err == nil {
		return fmt.Errorf("you have already submitted attendance for this event")
	} else if err != gorm.ErrRecordNotFound {
		return fmt.Errorf("checking existing attendance: %w", err)
	}

	var activePerm models.PermissionRequest
	if err := s.DB.Where(
		"event_id = ? AND user_id = ? AND status IN ?",
		item.EventID, item.UserID, []string{"pending", "approved"},
	).First(&activePerm).Error; err == nil {
		return fmt.Errorf("you already have a %s permission request for this event; attendance is not allowed", activePerm.Status)
	} else if err != gorm.ErrRecordNotFound {
		return fmt.Errorf("checking existing permission: %w", err)
	}

	if item.Status == "" {
		item.Status = "present"
	}
	now := time.Now()
	if item.CheckedInAt == nil {
		item.CheckedInAt = &now
	}
	if err := s.DB.Create(item).Error; err != nil {
		return fmt.Errorf("creating attendance: %w", err)
	}
	return nil
}

// Update modifies an existing attendance. Two queries: First() loads
// the row + verifies existence; Updates() persists the diff. The
// loaded struct is mutated by Updates() so we can return it directly
// without a third refetch.
func (s *AttendanceService) Update(id string, updates map[string]interface{}) (*models.Attendance, error) {
	var item models.Attendance
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("attendance not found: %w", err)
	}

	if err := s.DB.Model(&item).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("updating attendance: %w", err)
	}

	return &item, nil
}

// Delete soft-deletes a attendance. One query — we don't need to load
// the row first; GORM's Delete is atomic and rows-affected tells us
// whether it existed.
func (s *AttendanceService) Delete(id string) error {
	res := s.DB.Where("id = ?", id).Delete(&models.Attendance{})
	if res.Error != nil {
		return fmt.Errorf("deleting attendance: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return fmt.Errorf("attendance not found")
	}
	return nil
}
