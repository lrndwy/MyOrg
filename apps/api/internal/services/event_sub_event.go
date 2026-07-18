package services

import (
	"fmt"
	"math"

	"gorm.io/gorm"

	"myorg/apps/api/internal/models"
)

// EventSubEventService handles business logic for event_sub_events.
type EventSubEventService struct {
	DB *gorm.DB
}

// EventSubEventListParams holds pagination and filter parameters.
type EventSubEventListParams struct {
	Page      int
	PageSize  int
	Search    string
	SortBy    string
	SortOrder string
}

// List returns a paginated list of event_sub_events.
func (s *EventSubEventService) List(params EventSubEventListParams) ([]models.EventSubEvent, int64, int, error) {
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
	sortableEventSubEvent := map[string]bool{"id": true, "created_at": true, "updated_at": true, "event_id": true, "sie_id": true, "title": true, "description": true, "location": true, "start_time": true, "end_time": true, "ketua_pelaksana_id": true, "attendance_mode": true, "minutes_url": true, "status": true}
	if !sortableEventSubEvent[params.SortBy] {
		params.SortBy = "created_at"
	}

	query := s.DB.Model(&models.EventSubEvent{})

	if params.Search != "" {
		query = query.Where("event ILIKE ? OR sie ILIKE ? OR title ILIKE ? OR description ILIKE ? OR location ILIKE ? OR ketua_pelaksana ILIKE ? OR attendance_mode ILIKE ? OR minutes_url ILIKE ? OR status ILIKE ?", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%")
	}

	var total int64
	query.Count(&total)

	var items []models.EventSubEvent
	offset := (params.Page - 1) * params.PageSize
	if err := query.Order(params.SortBy + " " + params.SortOrder).Offset(offset).Limit(params.PageSize).Find(&items).Error; err != nil {
		return nil, 0, 0, fmt.Errorf("fetching event_sub_events: %w", err)
	}

	pages := int(math.Ceil(float64(total) / float64(params.PageSize)))
	return items, total, pages, nil
}

// GetByID returns a single eventsubevent by ID.
func (s *EventSubEventService) GetByID(id string) (*models.EventSubEvent, error) {
	var item models.EventSubEvent
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("eventsubevent not found: %w", err)
	}
	return &item, nil
}

// Create creates a new eventsubevent.
func (s *EventSubEventService) Create(item *models.EventSubEvent) error {
	committee := &EventCommitteeService{DB: s.DB}
	if err := committee.ValidateSubEvent(item); err != nil {
		return err
	}
	if err := s.DB.Create(item).Error; err != nil {
		return fmt.Errorf("creating eventsubevent: %w", err)
	}
	return nil
}

// Update modifies an existing eventsubevent. Two queries: First() loads
// the row + verifies existence; Updates() persists the diff. The
// loaded struct is mutated by Updates() so we can return it directly
// without a third refetch.
func (s *EventSubEventService) Update(id string, updates map[string]interface{}) (*models.EventSubEvent, error) {
	var item models.EventSubEvent
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("eventsubevent not found: %w", err)
	}

	if err := s.DB.Model(&item).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("updating eventsubevent: %w", err)
	}

	return &item, nil
}

// Delete soft-deletes a eventsubevent. One query — we don't need to load
// the row first; GORM's Delete is atomic and rows-affected tells us
// whether it existed.
func (s *EventSubEventService) Delete(id string) error {
	res := s.DB.Where("id = ?", id).Delete(&models.EventSubEvent{})
	if res.Error != nil {
		return fmt.Errorf("deleting eventsubevent: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return fmt.Errorf("eventsubevent not found")
	}
	return nil
}
