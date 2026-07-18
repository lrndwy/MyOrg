package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// SubEventAttendance represents a subeventattendance in the system.
type SubEventAttendance struct {
	ID        string         `gorm:"primarykey;size:36" json:"id"`
	SubEventID string `gorm:"size:36;uniqueIndex:idx_sub_event_attendance_user" json:"sub_event_id" binding:"required"`
	SubEvent EventSubEvent `gorm:"foreignKey:SubEventID" json:"sub_event"`
	UserID string `gorm:"size:36;uniqueIndex:idx_sub_event_attendance_user" json:"user_id" binding:"required"`
	User User `gorm:"foreignKey:UserID" json:"user"`
	Status string `gorm:"size:255" json:"status" binding:"required"`
	SelfieUrl string `gorm:"size:255" json:"selfie_url"`
	SignatureUrl string `gorm:"size:255" json:"signature_url"`
	CheckedInAt *time.Time `json:"checked_in_at"`
	MarkedByID *string `gorm:"size:36;index" json:"marked_by_id"`
	MarkedBy *User `gorm:"foreignKey:MarkedByID" json:"marked_by,omitempty"`
	Version   int            `gorm:"not null;default:1" json:"version"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate generates a UUID before inserting.
func (m *SubEventAttendance) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	return nil
}

// BeforeUpdate increments Version so offline clients can detect server-side updates.
func (m *SubEventAttendance) BeforeUpdate(tx *gorm.DB) error {
	m.Version++
	return nil
}
