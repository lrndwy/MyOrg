package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Announcement represents a announcement in the system.
type Announcement struct {
	ID        string         `gorm:"primarykey;size:36" json:"id"`
	Title string `gorm:"size:255" json:"title" binding:"required"`
	Content string `gorm:"type:text" json:"content"`
	TargetType string `gorm:"size:255" json:"target_type" binding:"required"`
	TargetDivisionID *string `gorm:"size:36;index" json:"target_division_id"`
	TargetDivision *Division `gorm:"foreignKey:TargetDivisionID" json:"target_division,omitempty"`
	PublishDate *time.Time `json:"publish_date"`
	Attachments []AnnouncementAttachment `gorm:"foreignKey:AnnouncementID" json:"attachments"`
	Version   int            `gorm:"not null;default:1" json:"version"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate generates a UUID before inserting.
func (m *Announcement) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	return nil
}

// BeforeUpdate increments Version so offline clients can detect server-side updates.
func (m *Announcement) BeforeUpdate(tx *gorm.DB) error {
	m.Version++
	return nil
}
