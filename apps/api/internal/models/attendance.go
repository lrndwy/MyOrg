package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Attendance represents a attendance in the system.
type Attendance struct {
	ID        string         `gorm:"primarykey;size:36" json:"id"`
	EventID string `gorm:"size:36;uniqueIndex:idx_attendance_event_user" json:"event_id" binding:"required"`
	Event Event `gorm:"foreignKey:EventID" json:"event"`
	UserID string `gorm:"size:36;uniqueIndex:idx_attendance_event_user" json:"user_id" binding:"required"`
	User User `gorm:"foreignKey:UserID" json:"user"`
	Status string `gorm:"size:255" json:"status" binding:"required"`
	SelfieUrl string `gorm:"size:255" json:"selfie_url"`
	SignatureUrl string `gorm:"size:255" json:"signature_url"`
	CheckedInAt *time.Time `json:"checked_in_at"`
	Version   int            `gorm:"not null;default:1" json:"version"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate generates a UUID before inserting.
func (m *Attendance) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	return nil
}

// BeforeUpdate increments Version so offline clients can detect server-side updates.
func (m *Attendance) BeforeUpdate(tx *gorm.DB) error {
	m.Version++
	return nil
}
