package services

import (
	"fmt"
	"math"

	"gorm.io/gorm"

	"myorg/apps/api/internal/models"
)

// EventCommitteeSieService handles business logic for event_committee_sies.
type EventCommitteeSieService struct {
	DB *gorm.DB
}

// EventCommitteeSieListParams holds pagination and filter parameters.
type EventCommitteeSieListParams struct {
	Page      int
	PageSize  int
	Search    string
	SortBy    string
	SortOrder string
}

// List returns a paginated list of event_committee_sies.
func (s *EventCommitteeSieService) List(params EventCommitteeSieListParams) ([]models.EventCommitteeSie, int64, int, error) {
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
	sortableEventCommitteeSie := map[string]bool{"id": true, "created_at": true, "updated_at": true, "event_id": true, "name": true, "description": true, "order_index": true}
	if !sortableEventCommitteeSie[params.SortBy] {
		params.SortBy = "created_at"
	}

	query := s.DB.Model(&models.EventCommitteeSie{})

	if params.Search != "" {
		query = query.Where("event ILIKE ? OR name ILIKE ? OR description ILIKE ?", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%")
	}

	var total int64
	query.Count(&total)

	var items []models.EventCommitteeSie
	offset := (params.Page - 1) * params.PageSize
	if err := query.Order(params.SortBy + " " + params.SortOrder).Offset(offset).Limit(params.PageSize).Find(&items).Error; err != nil {
		return nil, 0, 0, fmt.Errorf("fetching event_committee_sies: %w", err)
	}

	pages := int(math.Ceil(float64(total) / float64(params.PageSize)))
	return items, total, pages, nil
}

// GetByID returns a single eventcommitteesie by ID.
func (s *EventCommitteeSieService) GetByID(id string) (*models.EventCommitteeSie, error) {
	var item models.EventCommitteeSie
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("eventcommitteesie not found: %w", err)
	}
	return &item, nil
}

// Create creates a new eventcommitteesie.
func (s *EventCommitteeSieService) Create(item *models.EventCommitteeSie) error {
	if err := s.DB.Create(item).Error; err != nil {
		return fmt.Errorf("creating eventcommitteesie: %w", err)
	}
	return nil
}

// Update modifies an existing eventcommitteesie. Two queries: First() loads
// the row + verifies existence; Updates() persists the diff. The
// loaded struct is mutated by Updates() so we can return it directly
// without a third refetch.
func (s *EventCommitteeSieService) Update(id string, updates map[string]interface{}) (*models.EventCommitteeSie, error) {
	var item models.EventCommitteeSie
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("eventcommitteesie not found: %w", err)
	}

	if err := s.DB.Model(&item).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("updating eventcommitteesie: %w", err)
	}

	return &item, nil
}

// Delete soft-deletes a eventcommitteesie. One query — we don't need to load
// the row first; GORM's Delete is atomic and rows-affected tells us
// whether it existed.
func (s *EventCommitteeSieService) Delete(id string) error {
	res := s.DB.Where("id = ?", id).Delete(&models.EventCommitteeSie{})
	if res.Error != nil {
		return fmt.Errorf("deleting eventcommitteesie: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return fmt.Errorf("eventcommitteesie not found")
	}
	return nil
}
