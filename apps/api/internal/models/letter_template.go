package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// LetterTemplate represents a lettertemplate in the system.
type LetterTemplate struct {
	ID        string         `gorm:"primarykey;size:36" json:"id"`
	Name string `gorm:"size:255" json:"name" binding:"required"`
	CategoryID string `gorm:"size:36;index" json:"category_id" binding:"required"`
	Category LetterCategory `gorm:"foreignKey:CategoryID" json:"category"`
	TemplateUrl string `gorm:"size:512" json:"template_url" binding:"required"`
	Version   int            `gorm:"not null;default:1" json:"version"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate generates a UUID before inserting.
func (m *LetterTemplate) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	return nil
}

// BeforeUpdate increments Version so offline clients can detect server-side updates.
func (m *LetterTemplate) BeforeUpdate(tx *gorm.DB) error {
	m.Version++
	return nil
}
