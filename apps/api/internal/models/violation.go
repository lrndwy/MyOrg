package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Violation represents a violation in the system.
type Violation struct {
	ID        string         `gorm:"primarykey;size:36" json:"id"`
	UserID string `gorm:"size:36;index" json:"user_id" binding:"required"`
	User User `gorm:"foreignKey:UserID" json:"user"`
	ViolationType string `gorm:"size:255" json:"violation_type" binding:"required"`
	Description string `gorm:"type:text" json:"description"`
	SpLevel string `gorm:"size:255" json:"sp_level" binding:"required"`
	DocumentUrl string `gorm:"size:255" json:"document_url"`
	IssuedByID string `gorm:"size:36;index" json:"issued_by_id" binding:"required"`
	IssuedBy User `gorm:"foreignKey:IssuedByID" json:"issued_by"`
	IssuedDate *time.Time `gorm:"type:date" json:"issued_date"`
	Version   int            `gorm:"not null;default:1" json:"version"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate generates a UUID before inserting.
func (m *Violation) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	return nil
}

// BeforeUpdate increments Version so offline clients can detect server-side updates.
func (m *Violation) BeforeUpdate(tx *gorm.DB) error {
	m.Version++
	return nil
}
