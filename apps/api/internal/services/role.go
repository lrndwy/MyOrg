package services

import (
	"fmt"
	"math"

	"gorm.io/gorm"

	"myorg/apps/api/internal/models"
)

// RoleService handles business logic for roles.
type RoleService struct {
	DB *gorm.DB
}

// RoleListParams holds pagination and filter parameters.
type RoleListParams struct {
	Page      int
	PageSize  int
	Search    string
	SortBy    string
	SortOrder string
}

// List returns a paginated list of roles.
func (s *RoleService) List(params RoleListParams) ([]models.Role, int64, int, error) {
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
	sortableRole := map[string]bool{"id": true, "created_at": true, "updated_at": true, "name": true, "description": true, "is_system": true}
	if !sortableRole[params.SortBy] {
		params.SortBy = "created_at"
	}

	query := s.DB.Model(&models.Role{})

	if params.Search != "" {
		query = query.Where("name ILIKE ? OR description ILIKE ?", "%"+params.Search+"%", "%"+params.Search+"%")
	}

	var total int64
	query.Count(&total)

	var items []models.Role
	offset := (params.Page - 1) * params.PageSize
	if err := query.Order(params.SortBy + " " + params.SortOrder).Offset(offset).Limit(params.PageSize).Find(&items).Error; err != nil {
		return nil, 0, 0, fmt.Errorf("fetching roles: %w", err)
	}

	pages := int(math.Ceil(float64(total) / float64(params.PageSize)))
	return items, total, pages, nil
}

// GetByID returns a single role by ID.
func (s *RoleService) GetByID(id string) (*models.Role, error) {
	var item models.Role
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("role not found: %w", err)
	}
	return &item, nil
}

// Create creates a new role.
func (s *RoleService) Create(item *models.Role) error {
	if err := s.DB.Create(item).Error; err != nil {
		return fmt.Errorf("creating role: %w", err)
	}
	return nil
}

// Update modifies an existing role. Two queries: First() loads
// the row + verifies existence; Updates() persists the diff. The
// loaded struct is mutated by Updates() so we can return it directly
// without a third refetch.
func (s *RoleService) Update(id string, updates map[string]interface{}) (*models.Role, error) {
	var item models.Role
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("role not found: %w", err)
	}

	if err := s.DB.Model(&item).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("updating role: %w", err)
	}

	return &item, nil
}

// Delete soft-deletes a role. One query — we don't need to load
// the row first; GORM's Delete is atomic and rows-affected tells us
// whether it existed.
func (s *RoleService) Delete(id string) error {
	res := s.DB.Where("id = ?", id).Delete(&models.Role{})
	if res.Error != nil {
		return fmt.Errorf("deleting role: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return fmt.Errorf("role not found")
	}
	return nil
}
