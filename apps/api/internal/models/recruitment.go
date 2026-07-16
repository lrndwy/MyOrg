package models

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Recruitment represents a recruitment in the system.
type Recruitment struct {
	ID        string         `gorm:"primarykey;size:36" json:"id"`
	Title string `gorm:"size:255" json:"title" binding:"required"`
	Description string `gorm:"type:text" json:"description"`
	Slug string `gorm:"size:255;uniqueIndex" json:"slug"`
	OpenDate *time.Time `gorm:"type:date" json:"open_date"`
	CloseDate *time.Time `gorm:"type:date" json:"close_date"`
	Status string `gorm:"size:255" json:"status" binding:"required"`
	Version   int            `gorm:"not null;default:1" json:"version"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate generates a UUID and auto-generates the slug before inserting.
func (m *Recruitment) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	if m.Slug == "" {
		m.Slug = slugify(fmt.Sprintf("%v", m.Title))
	}
	return nil
}

// BeforeUpdate increments Version so offline clients can detect server-side updates.
func (m *Recruitment) BeforeUpdate(tx *gorm.DB) error {
	m.Version++
	return nil
}
