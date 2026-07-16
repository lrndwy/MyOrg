package services

import (
	"fmt"

	"gorm.io/gorm"
)

// PermissionChecker resolves custom RBAC permission codes for a user's AppRole.
type PermissionChecker struct {
	DB *gorm.DB
}

// NewPermissionChecker creates a PermissionChecker.
func NewPermissionChecker(db *gorm.DB) *PermissionChecker {
	return &PermissionChecker{DB: db}
}

// UserHasPermission returns true if the given app role ID includes the permission code.
func (c *PermissionChecker) UserHasPermission(appRoleID *string, code string) (bool, error) {
	if c.DB == nil {
		return false, fmt.Errorf("permission checker has no db")
	}
	if appRoleID == nil || *appRoleID == "" {
		return false, nil
	}

	var count int64
	err := c.DB.Table("role_permissions").
		Joins("JOIN permissions ON permissions.id = role_permissions.permission_id AND permissions.deleted_at IS NULL").
		Where("role_permissions.role_id = ? AND role_permissions.deleted_at IS NULL AND permissions.code = ?", *appRoleID, code).
		Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// ListCodesForRole returns all permission codes granted to an app role.
func (c *PermissionChecker) ListCodesForRole(appRoleID *string) ([]string, error) {
	if c.DB == nil {
		return nil, fmt.Errorf("permission checker has no db")
	}
	if appRoleID == nil || *appRoleID == "" {
		return []string{}, nil
	}
	var codes []string
	err := c.DB.Table("permissions").
		Select("permissions.code").
		Joins("JOIN role_permissions ON role_permissions.permission_id = permissions.id AND role_permissions.deleted_at IS NULL").
		Where("role_permissions.role_id = ? AND permissions.deleted_at IS NULL", *appRoleID).
		Order("permissions.code asc").
		Pluck("permissions.code", &codes).Error
	if err != nil {
		return nil, err
	}
	if codes == nil {
		codes = []string{}
	}
	return codes, nil
}

// RoleHasPermission checks by role ID string.
func (c *PermissionChecker) RoleHasPermission(roleID, code string) (bool, error) {
	return c.UserHasPermission(&roleID, code)
}