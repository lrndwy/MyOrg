package services

import (
	"fmt"
	"math"
	"path"
	"strings"

	"gorm.io/gorm"

	"myorg/apps/api/internal/models"
)

// AnnouncementService handles business logic for announcements.
type AnnouncementService struct {
	DB *gorm.DB
}

// AnnouncementAttachmentInput accepts either admin FileRef shape (url/mime/name)
// or the DB field names (file_url/file_type).
type AnnouncementAttachmentInput struct {
	FileURL  string `json:"file_url"`
	FileType string `json:"file_type"`
	URL      string `json:"url"`
	Mime     string `json:"mime"`
	Name     string `json:"name"`
	Key      string `json:"key"`
}

// AnnouncementListParams holds pagination and filter parameters.
type AnnouncementListParams struct {
	Page      int
	PageSize  int
	Search    string
	SortBy    string
	SortOrder string
}

// List returns a paginated list of announcements.
func (s *AnnouncementService) List(params AnnouncementListParams) ([]models.Announcement, int64, int, error) {
	if params.Page < 1 {
		params.Page = 1
	}
	if params.PageSize < 1 || params.PageSize > 100 {
		params.PageSize = 20
	}
	if params.SortOrder != "asc" && params.SortOrder != "desc" {
		params.SortOrder = "desc"
	}
	sortableAnnouncement := map[string]bool{"id": true, "created_at": true, "updated_at": true, "title": true, "content": true, "target_type": true, "target_division_id": true, "publish_date": true}
	if !sortableAnnouncement[params.SortBy] {
		params.SortBy = "created_at"
	}

	query := s.DB.Model(&models.Announcement{})

	if params.Search != "" {
		query = query.Where("title ILIKE ? OR content ILIKE ? OR target_type ILIKE ?", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%")
	}

	var total int64
	query.Count(&total)

	var items []models.Announcement
	offset := (params.Page - 1) * params.PageSize
	if err := query.Preload("Attachments").Order(params.SortBy + " " + params.SortOrder).Offset(offset).Limit(params.PageSize).Find(&items).Error; err != nil {
		return nil, 0, 0, fmt.Errorf("fetching announcements: %w", err)
	}

	pages := int(math.Ceil(float64(total) / float64(params.PageSize)))
	return items, total, pages, nil
}

// GetByID returns a single announcement by ID.
func (s *AnnouncementService) GetByID(id string) (*models.Announcement, error) {
	var item models.Announcement
	if err := s.DB.Preload("TargetDivision").Preload("Attachments").First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("announcement not found: %w", err)
	}
	return &item, nil
}

// Create creates a new announcement with optional nested attachments.
func (s *AnnouncementService) Create(item *models.Announcement) error {
	return s.CreateWithAttachments(item, nil)
}

// CreateWithAttachments creates an announcement and its attachment rows in one transaction.
func (s *AnnouncementService) CreateWithAttachments(item *models.Announcement, attachments []AnnouncementAttachmentInput) error {
	targetType := strings.ToLower(strings.TrimSpace(item.TargetType))
	if targetType == "" {
		return fmt.Errorf("target_type is required")
	}
	item.TargetType = targetType
	if targetType == "all" {
		item.TargetDivisionID = nil
	} else if targetType == "division" {
		if item.TargetDivisionID == nil || strings.TrimSpace(*item.TargetDivisionID) == "" {
			return fmt.Errorf("target_division_id is required when target_type is division")
		}
	}

	return s.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(item).Error; err != nil {
			return fmt.Errorf("creating announcement: %w", err)
		}
		rows, err := buildAttachmentRows(item.ID, attachments)
		if err != nil {
			return err
		}
		for i := range rows {
			if err := tx.Create(&rows[i]).Error; err != nil {
				return fmt.Errorf("creating attachment: %w", err)
			}
			item.Attachments = append(item.Attachments, rows[i])
		}
		return nil
	})
}

// ReplaceAttachments soft-deletes existing attachments and creates the new set.
func (s *AnnouncementService) ReplaceAttachments(announcementID string, attachments []AnnouncementAttachmentInput) ([]models.AnnouncementAttachment, error) {
	var created []models.AnnouncementAttachment
	err := s.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("announcement_id = ?", announcementID).Delete(&models.AnnouncementAttachment{}).Error; err != nil {
			return fmt.Errorf("clearing attachments: %w", err)
		}
		rows, err := buildAttachmentRows(announcementID, attachments)
		if err != nil {
			return err
		}
		for i := range rows {
			if err := tx.Create(&rows[i]).Error; err != nil {
				return fmt.Errorf("creating attachment: %w", err)
			}
			created = append(created, rows[i])
		}
		return nil
	})
	return created, err
}

// Update modifies an existing announcement.
func (s *AnnouncementService) Update(id string, updates map[string]interface{}) (*models.Announcement, error) {
	var item models.Announcement
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("announcement not found: %w", err)
	}

	if err := s.DB.Model(&item).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("updating announcement: %w", err)
	}

	return &item, nil
}

// Delete soft-deletes an announcement and its attachments.
func (s *AnnouncementService) Delete(id string) error {
	return s.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("announcement_id = ?", id).Delete(&models.AnnouncementAttachment{}).Error; err != nil {
			return fmt.Errorf("deleting attachments: %w", err)
		}
		res := tx.Where("id = ?", id).Delete(&models.Announcement{})
		if res.Error != nil {
			return fmt.Errorf("deleting announcement: %w", res.Error)
		}
		if res.RowsAffected == 0 {
			return fmt.Errorf("announcement not found")
		}
		return nil
	})
}

func buildAttachmentRows(announcementID string, inputs []AnnouncementAttachmentInput) ([]models.AnnouncementAttachment, error) {
	var rows []models.AnnouncementAttachment
	for _, in := range inputs {
		url := strings.TrimSpace(firstNonEmpty(in.FileURL, in.URL))
		if url == "" {
			continue
		}
		fileType := normalizeAnnouncementFileType(firstNonEmpty(in.FileType, in.Mime, in.Name, url))
		rows = append(rows, models.AnnouncementAttachment{
			AnnouncementID: announcementID,
			FileUrl:        url,
			FileType:       fileType,
		})
	}
	return rows, nil
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

func normalizeAnnouncementFileType(raw string) string {
	v := strings.ToLower(strings.TrimSpace(raw))
	if v == "image" || v == "document" {
		return v
	}
	if strings.HasPrefix(v, "image/") {
		return "image"
	}
	ext := strings.ToLower(path.Ext(v))
	switch ext {
	case ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".heic":
		return "image"
	}
	if strings.Contains(v, "image") {
		return "image"
	}
	return "document"
}
