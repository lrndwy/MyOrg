package services

import (
	"fmt"
	"math"

	"gorm.io/gorm"

	"myorg/apps/api/internal/models"
)

// EventService handles business logic for events.
type EventService struct {
	DB *gorm.DB
}

// EventListParams holds pagination and filter parameters.
type EventListParams struct {
	Page      int
	PageSize  int
	Search    string
	SortBy    string
	SortOrder string
}

// List returns a paginated list of events.
func (s *EventService) List(params EventListParams) ([]models.Event, int64, int, error) {
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
	sortableEvent := map[string]bool{"id": true, "created_at": true, "updated_at": true, "title": true, "description": true, "division_id": true, "location": true, "banner_url": true, "start_time": true, "end_time": true, "allow_permission": true, "status": true}
	if !sortableEvent[params.SortBy] {
		params.SortBy = "created_at"
	}

	query := s.DB.Model(&models.Event{}).Preload("Division")

	if params.Search != "" {
		query = query.Where("title ILIKE ? OR description ILIKE ? OR location ILIKE ? OR status ILIKE ?", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%")
	}

	var total int64
	query.Count(&total)

	var items []models.Event
	offset := (params.Page - 1) * params.PageSize
	if err := query.Order(params.SortBy + " " + params.SortOrder).Offset(offset).Limit(params.PageSize).Find(&items).Error; err != nil {
		return nil, 0, 0, fmt.Errorf("fetching events: %w", err)
	}

	pages := int(math.Ceil(float64(total) / float64(params.PageSize)))
	return items, total, pages, nil
}

// GetByID returns a single event by ID.
func (s *EventService) GetByID(id string) (*models.Event, error) {
	var item models.Event
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("event not found: %w", err)
	}
	return &item, nil
}

// ListVisible returns events visible to a user based on division settings.
func (s *EventService) ListVisible(params EventListParams, divisionID *string, allowCrossDivision bool) ([]models.Event, int64, int, error) {
	if params.Page < 1 {
		params.Page = 1
	}
	if params.PageSize < 1 || params.PageSize > 100 {
		params.PageSize = 20
	}
	if params.SortOrder != "asc" && params.SortOrder != "desc" {
		params.SortOrder = "desc"
	}
	sortableEvent := map[string]bool{"id": true, "created_at": true, "updated_at": true, "title": true, "start_time": true, "end_time": true, "status": true}
	if !sortableEvent[params.SortBy] {
		params.SortBy = "start_time"
	}

	query := s.DB.Model(&models.Event{}).Preload("Division")
	if !allowCrossDivision && divisionID != nil && *divisionID != "" {
		query = query.Where("division_id IS NULL OR division_id = ?", *divisionID)
	}
	if params.Search != "" {
		query = query.Where("title ILIKE ? OR description ILIKE ? OR location ILIKE ?", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%")
	}

	var total int64
	query.Count(&total)
	var items []models.Event
	offset := (params.Page - 1) * params.PageSize
	if err := query.Order(params.SortBy + " " + params.SortOrder).Offset(offset).Limit(params.PageSize).Find(&items).Error; err != nil {
		return nil, 0, 0, fmt.Errorf("fetching events: %w", err)
	}
	pages := int(math.Ceil(float64(total) / float64(params.PageSize)))
	return items, total, pages, nil
}

// Create creates a new event.
func (s *EventService) Create(item *models.Event) error {
	if item.Status == "" {
		item.Status = "upcoming"
	}
	if err := s.DB.Create(item).Error; err != nil {
		return fmt.Errorf("creating event: %w", err)
	}
	return nil
}

// Update modifies an existing event. Two queries: First() loads
// the row + verifies existence; Updates() persists the diff. The
// loaded struct is mutated by Updates() so we can return it directly
// without a third refetch.
func (s *EventService) Update(id string, updates map[string]interface{}) (*models.Event, error) {
	var item models.Event
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("event not found: %w", err)
	}

	if err := s.DB.Model(&item).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("updating event: %w", err)
	}

	return &item, nil
}

// Delete soft-deletes a event. One query — we don't need to load
// the row first; GORM's Delete is atomic and rows-affected tells us
// whether it existed.
func (s *EventService) Delete(id string) error {
	res := s.DB.Where("id = ?", id).Delete(&models.Event{})
	if res.Error != nil {
		return fmt.Errorf("deleting event: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return fmt.Errorf("event not found")
	}
	return nil
}
