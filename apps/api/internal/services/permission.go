package services

import (
	"fmt"
	"math"

	"gorm.io/gorm"

	"myorg/apps/api/internal/models"
)

// PermissionService handles business logic for permissions.
type PermissionService struct {
	DB *gorm.DB
}

// PermissionListParams holds pagination and filter parameters.
type PermissionListParams struct {
	Page      int
	PageSize  int
	Search    string
	SortBy    string
	SortOrder string
}

// List returns a paginated list of permissions.
func (s *PermissionService) List(params PermissionListParams) ([]models.Permission, int64, int, error) {
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
	sortablePermission := map[string]bool{"id": true, "created_at": true, "updated_at": true, "code": true, "module": true, "description": true}
	if !sortablePermission[params.SortBy] {
		params.SortBy = "created_at"
	}

	query := s.DB.Model(&models.Permission{})

	if params.Search != "" {
		query = query.Where("code ILIKE ? OR module ILIKE ? OR description ILIKE ?", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%")
	}

	var total int64
	query.Count(&total)

	var items []models.Permission
	offset := (params.Page - 1) * params.PageSize
	if err := query.Order(params.SortBy + " " + params.SortOrder).Offset(offset).Limit(params.PageSize).Find(&items).Error; err != nil {
		return nil, 0, 0, fmt.Errorf("fetching permissions: %w", err)
	}

	pages := int(math.Ceil(float64(total) / float64(params.PageSize)))
	return items, total, pages, nil
}

// GetByID returns a single permission by ID.
func (s *PermissionService) GetByID(id string) (*models.Permission, error) {
	var item models.Permission
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("permission not found: %w", err)
	}
	return &item, nil
}

// Create creates a new permission.
func (s *PermissionService) Create(item *models.Permission) error {
	if err := s.DB.Create(item).Error; err != nil {
		return fmt.Errorf("creating permission: %w", err)
	}
	return nil
}

// Update modifies an existing permission. Two queries: First() loads
// the row + verifies existence; Updates() persists the diff. The
// loaded struct is mutated by Updates() so we can return it directly
// without a third refetch.
func (s *PermissionService) Update(id string, updates map[string]interface{}) (*models.Permission, error) {
	var item models.Permission
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("permission not found: %w", err)
	}

	if err := s.DB.Model(&item).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("updating permission: %w", err)
	}

	return &item, nil
}

// Delete soft-deletes a permission. One query — we don't need to load
// the row first; GORM's Delete is atomic and rows-affected tells us
// whether it existed.
func (s *PermissionService) Delete(id string) error {
	res := s.DB.Where("id = ?", id).Delete(&models.Permission{})
	if res.Error != nil {
		return fmt.Errorf("deleting permission: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return fmt.Errorf("permission not found")
	}
	return nil
}
