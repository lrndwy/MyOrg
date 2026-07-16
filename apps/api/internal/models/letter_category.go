package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// LetterCategory represents a lettercategory in the system.
type LetterCategory struct {
	ID        string         `gorm:"primarykey;size:36" json:"id"`
	Name string `gorm:"size:255" json:"name" binding:"required"`
	Code string `gorm:"size:255;uniqueIndex" json:"code" binding:"required"`
	StartNumber int `json:"start_number"`
	CurrentNumber int `json:"current_number"`
	NumberFormatTemplate string `gorm:"size:255" json:"number_format_template" binding:"required"`
	Version   int            `gorm:"not null;default:1" json:"version"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate generates a UUID before inserting.
func (m *LetterCategory) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	return nil
}

// BeforeUpdate increments Version so offline clients can detect server-side updates.
func (m *LetterCategory) BeforeUpdate(tx *gorm.DB) error {
	m.Version++
	return nil
}
