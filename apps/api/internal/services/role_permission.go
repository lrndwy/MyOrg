package services

import (
	"fmt"
	"math"

	"gorm.io/gorm"

	"myorg/apps/api/internal/models"
)

// RolePermissionService handles business logic for role_permissions.
type RolePermissionService struct {
	DB *gorm.DB
}

// RolePermissionListParams holds pagination and filter parameters.
type RolePermissionListParams struct {
	Page      int
	PageSize  int
	Search    string
	SortBy    string
	SortOrder string
}

// List returns a paginated list of role_permissions.
func (s *RolePermissionService) List(params RolePermissionListParams) ([]models.RolePermission, int64, int, error) {
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
	sortableRolePermission := map[string]bool{"id": true, "created_at": true, "updated_at": true, "role_id": true, "permission_id": true}
	if !sortableRolePermission[params.SortBy] {
		params.SortBy = "created_at"
	}

	query := s.DB.Model(&models.RolePermission{})

	if params.Search != "" {
		query = query.Where("role ILIKE ? OR permission ILIKE ?", "%"+params.Search+"%", "%"+params.Search+"%")
	}

	var total int64
	query.Count(&total)

	var items []models.RolePermission
	offset := (params.Page - 1) * params.PageSize
	if err := query.Order(params.SortBy + " " + params.SortOrder).Offset(offset).Limit(params.PageSize).Find(&items).Error; err != nil {
		return nil, 0, 0, fmt.Errorf("fetching role_permissions: %w", err)
	}

	pages := int(math.Ceil(float64(total) / float64(params.PageSize)))
	return items, total, pages, nil
}

// GetByID returns a single rolepermission by ID.
func (s *RolePermissionService) GetByID(id string) (*models.RolePermission, error) {
	var item models.RolePermission
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("rolepermission not found: %w", err)
	}
	return &item, nil
}

// Create creates a new rolepermission.
func (s *RolePermissionService) Create(item *models.RolePermission) error {
	if err := s.DB.Create(item).Error; err != nil {
		return fmt.Errorf("creating rolepermission: %w", err)
	}
	return nil
}

// Update modifies an existing rolepermission. Two queries: First() loads
// the row + verifies existence; Updates() persists the diff. The
// loaded struct is mutated by Updates() so we can return it directly
// without a third refetch.
func (s *RolePermissionService) Update(id string, updates map[string]interface{}) (*models.RolePermission, error) {
	var item models.RolePermission
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("rolepermission not found: %w", err)
	}

	if err := s.DB.Model(&item).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("updating rolepermission: %w", err)
	}

	return &item, nil
}

// Delete soft-deletes a rolepermission. One query — we don't need to load
// the row first; GORM's Delete is atomic and rows-affected tells us
// whether it existed.
func (s *RolePermissionService) Delete(id string) error {
	res := s.DB.Where("id = ?", id).Delete(&models.RolePermission{})
	if res.Error != nil {
		return fmt.Errorf("deleting rolepermission: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return fmt.Errorf("rolepermission not found")
	}
	return nil
}
