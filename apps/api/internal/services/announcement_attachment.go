package services

import (
	"fmt"
	"math"

	"gorm.io/gorm"

	"myorg/apps/api/internal/models"
)

// AnnouncementAttachmentService handles business logic for announcement_attachments.
type AnnouncementAttachmentService struct {
	DB *gorm.DB
}

// AnnouncementAttachmentListParams holds pagination and filter parameters.
type AnnouncementAttachmentListParams struct {
	Page      int
	PageSize  int
	Search    string
	SortBy    string
	SortOrder string
}

// List returns a paginated list of announcement_attachments.
func (s *AnnouncementAttachmentService) List(params AnnouncementAttachmentListParams) ([]models.AnnouncementAttachment, int64, int, error) {
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
	sortableAnnouncementAttachment := map[string]bool{"id": true, "created_at": true, "updated_at": true, "announcement_id": true, "file_url": true, "file_type": true}
	if !sortableAnnouncementAttachment[params.SortBy] {
		params.SortBy = "created_at"
	}

	query := s.DB.Model(&models.AnnouncementAttachment{})

	if params.Search != "" {
		query = query.Where("announcement ILIKE ? OR file_url ILIKE ? OR file_type ILIKE ?", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%")
	}

	var total int64
	query.Count(&total)

	var items []models.AnnouncementAttachment
	offset := (params.Page - 1) * params.PageSize
	if err := query.Order(params.SortBy + " " + params.SortOrder).Offset(offset).Limit(params.PageSize).Find(&items).Error; err != nil {
		return nil, 0, 0, fmt.Errorf("fetching announcement_attachments: %w", err)
	}

	pages := int(math.Ceil(float64(total) / float64(params.PageSize)))
	return items, total, pages, nil
}

// GetByID returns a single announcementattachment by ID.
func (s *AnnouncementAttachmentService) GetByID(id string) (*models.AnnouncementAttachment, error) {
	var item models.AnnouncementAttachment
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("announcementattachment not found: %w", err)
	}
	return &item, nil
}

// Create creates a new announcementattachment.
func (s *AnnouncementAttachmentService) Create(item *models.AnnouncementAttachment) error {
	if err := s.DB.Create(item).Error; err != nil {
		return fmt.Errorf("creating announcementattachment: %w", err)
	}
	return nil
}

// Update modifies an existing announcementattachment. Two queries: First() loads
// the row + verifies existence; Updates() persists the diff. The
// loaded struct is mutated by Updates() so we can return it directly
// without a third refetch.
func (s *AnnouncementAttachmentService) Update(id string, updates map[string]interface{}) (*models.AnnouncementAttachment, error) {
	var item models.AnnouncementAttachment
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("announcementattachment not found: %w", err)
	}

	if err := s.DB.Model(&item).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("updating announcementattachment: %w", err)
	}

	return &item, nil
}

// Delete soft-deletes a announcementattachment. One query — we don't need to load
// the row first; GORM's Delete is atomic and rows-affected tells us
// whether it existed.
func (s *AnnouncementAttachmentService) Delete(id string) error {
	res := s.DB.Where("id = ?", id).Delete(&models.AnnouncementAttachment{})
	if res.Error != nil {
		return fmt.Errorf("deleting announcementattachment: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return fmt.Errorf("announcementattachment not found")
	}
	return nil
}
