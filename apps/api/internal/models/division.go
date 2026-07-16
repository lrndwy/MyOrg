package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Division represents a division in the system.
type Division struct {
	ID        string         `gorm:"primarykey;size:36" json:"id"`
	Name string `gorm:"size:255" json:"name" binding:"required"`
	Description string `gorm:"type:text" json:"description"`
	Version   int            `gorm:"not null;default:1" json:"version"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate generates a UUID before inserting.
func (m *Division) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	return nil
}

// BeforeUpdate increments Version so offline clients can detect server-side updates.
func (m *Division) BeforeUpdate(tx *gorm.DB) error {
	m.Version++
	return nil
}
