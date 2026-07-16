package services

import (
	"fmt"
	"math"

	"gorm.io/gorm"

	"myorg/apps/api/internal/models"
)

// OrganizationSettingService handles business logic for organization_settings.
type OrganizationSettingService struct {
	DB *gorm.DB
}

// OrganizationSettingListParams holds pagination and filter parameters.
type OrganizationSettingListParams struct {
	Page      int
	PageSize  int
	Search    string
	SortBy    string
	SortOrder string
}

// List returns a paginated list of organization_settings.
func (s *OrganizationSettingService) List(params OrganizationSettingListParams) ([]models.OrganizationSetting, int64, int, error) {
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
	sortableOrganizationSetting := map[string]bool{"id": true, "created_at": true, "updated_at": true, "web_name": true, "logo_url": true, "icon_url": true, "theme": true, "allow_self_register": true, "allow_cross_division_events_view": true}
	if !sortableOrganizationSetting[params.SortBy] {
		params.SortBy = "created_at"
	}

	query := s.DB.Model(&models.OrganizationSetting{})

	if params.Search != "" {
		query = query.Where("web_name ILIKE ? OR logo_url ILIKE ? OR icon_url ILIKE ? OR theme ILIKE ?", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%")
	}

	var total int64
	query.Count(&total)

	var items []models.OrganizationSetting
	offset := (params.Page - 1) * params.PageSize
	if err := query.Order(params.SortBy + " " + params.SortOrder).Offset(offset).Limit(params.PageSize).Find(&items).Error; err != nil {
		return nil, 0, 0, fmt.Errorf("fetching organization_settings: %w", err)
	}

	pages := int(math.Ceil(float64(total) / float64(params.PageSize)))
	return items, total, pages, nil
}

// GetByID returns a single organizationsetting by ID.
func (s *OrganizationSettingService) GetByID(id string) (*models.OrganizationSetting, error) {
	var item models.OrganizationSetting
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("organizationsetting not found: %w", err)
	}
	return &item, nil
}

// Create creates a new organizationsetting — enforces singleton (max 1 row).
func (s *OrganizationSettingService) Create(item *models.OrganizationSetting) error {
	var count int64
	s.DB.Model(&models.OrganizationSetting{}).Count(&count)
	if count > 0 {
		return fmt.Errorf("organization settings already exist (singleton)")
	}
	if err := s.DB.Create(item).Error; err != nil {
		return fmt.Errorf("creating organizationsetting: %w", err)
	}
	return nil
}

// GetSingleton returns the single organization settings row (or nil).
func (s *OrganizationSettingService) GetSingleton() (*models.OrganizationSetting, error) {
	var item models.OrganizationSetting
	if err := s.DB.Order("created_at asc").First(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

// Update modifies an existing organizationsetting. Two queries: First() loads
// the row + verifies existence; Updates() persists the diff. The
// loaded struct is mutated by Updates() so we can return it directly
// without a third refetch.
func (s *OrganizationSettingService) Update(id string, updates map[string]interface{}) (*models.OrganizationSetting, error) {
	var item models.OrganizationSetting
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("organizationsetting not found: %w", err)
	}

	if err := s.DB.Model(&item).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("updating organizationsetting: %w", err)
	}

	return &item, nil
}

// Delete is refused — organization settings is a singleton row.
func (s *OrganizationSettingService) Delete(id string) error {
	return fmt.Errorf("organization settings cannot be deleted (singleton)")
}
