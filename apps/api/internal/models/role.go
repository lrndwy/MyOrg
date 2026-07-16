package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Role represents a role in the system.
type Role struct {
	ID        string         `gorm:"primarykey;size:36" json:"id"`
	Name string `gorm:"size:255;uniqueIndex" json:"name" binding:"required"`
	Description string `gorm:"type:text" json:"description"`
	IsSystem bool `json:"is_system"`
	Version   int            `gorm:"not null;default:1" json:"version"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate generates a UUID before inserting.
func (m *Role) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	return nil
}

// BeforeUpdate increments Version so offline clients can detect server-side updates.
func (m *Role) BeforeUpdate(tx *gorm.DB) error {
	m.Version++
	return nil
}
