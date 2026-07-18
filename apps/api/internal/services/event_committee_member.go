package services

import (
	"fmt"
	"math"

	"gorm.io/gorm"

	"myorg/apps/api/internal/models"
)

// EventCommitteeMemberService handles business logic for event_committee_members.
type EventCommitteeMemberService struct {
	DB *gorm.DB
}

// EventCommitteeMemberListParams holds pagination and filter parameters.
type EventCommitteeMemberListParams struct {
	Page      int
	PageSize  int
	Search    string
	SortBy    string
	SortOrder string
}

// List returns a paginated list of event_committee_members.
func (s *EventCommitteeMemberService) List(params EventCommitteeMemberListParams) ([]models.EventCommitteeMember, int64, int, error) {
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
	sortableEventCommitteeMember := map[string]bool{"id": true, "created_at": true, "updated_at": true, "sie_id": true, "user_id": true, "role": true}
	if !sortableEventCommitteeMember[params.SortBy] {
		params.SortBy = "created_at"
	}

	query := s.DB.Model(&models.EventCommitteeMember{})

	if params.Search != "" {
		query = query.Where("sie ILIKE ? OR user ILIKE ? OR role ILIKE ?", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%")
	}

	var total int64
	query.Count(&total)

	var items []models.EventCommitteeMember
	offset := (params.Page - 1) * params.PageSize
	if err := query.Order(params.SortBy + " " + params.SortOrder).Offset(offset).Limit(params.PageSize).Find(&items).Error; err != nil {
		return nil, 0, 0, fmt.Errorf("fetching event_committee_members: %w", err)
	}

	pages := int(math.Ceil(float64(total) / float64(params.PageSize)))
	return items, total, pages, nil
}

// GetByID returns a single eventcommitteemember by ID.
func (s *EventCommitteeMemberService) GetByID(id string) (*models.EventCommitteeMember, error) {
	var item models.EventCommitteeMember
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("eventcommitteemember not found: %w", err)
	}
	return &item, nil
}

// Create creates a new eventcommitteemember.
func (s *EventCommitteeMemberService) Create(item *models.EventCommitteeMember) error {
	if err := s.DB.Create(item).Error; err != nil {
		return fmt.Errorf("creating eventcommitteemember: %w", err)
	}
	return nil
}

// Update modifies an existing eventcommitteemember. Two queries: First() loads
// the row + verifies existence; Updates() persists the diff. The
// loaded struct is mutated by Updates() so we can return it directly
// without a third refetch.
func (s *EventCommitteeMemberService) Update(id string, updates map[string]interface{}) (*models.EventCommitteeMember, error) {
	var item models.EventCommitteeMember
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("eventcommitteemember not found: %w", err)
	}

	if err := s.DB.Model(&item).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("updating eventcommitteemember: %w", err)
	}

	return &item, nil
}

// Delete soft-deletes a eventcommitteemember. One query — we don't need to load
// the row first; GORM's Delete is atomic and rows-affected tells us
// whether it existed.
func (s *EventCommitteeMemberService) Delete(id string) error {
	res := s.DB.Where("id = ?", id).Delete(&models.EventCommitteeMember{})
	if res.Error != nil {
		return fmt.Errorf("deleting eventcommitteemember: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return fmt.Errorf("eventcommitteemember not found")
	}
	return nil
}
