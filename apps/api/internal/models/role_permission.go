package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// RolePermission represents a rolepermission in the system.
type RolePermission struct {
	ID        string         `gorm:"primarykey;size:36" json:"id"`
	RoleID string `gorm:"size:36;index" json:"role_id" binding:"required"`
	Role Role `gorm:"foreignKey:RoleID" json:"role"`
	PermissionID string `gorm:"size:36;index" json:"permission_id" binding:"required"`
	Permission Permission `gorm:"foreignKey:PermissionID" json:"permission"`
	Version   int            `gorm:"not null;default:1" json:"version"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate generates a UUID before inserting.
func (m *RolePermission) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	return nil
}

// BeforeUpdate increments Version so offline clients can detect server-side updates.
func (m *RolePermission) BeforeUpdate(tx *gorm.DB) error {
	m.Version++
	return nil
}
