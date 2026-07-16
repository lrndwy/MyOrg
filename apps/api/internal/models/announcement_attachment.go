package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// AnnouncementAttachment represents a announcementattachment in the system.
type AnnouncementAttachment struct {
	ID        string         `gorm:"primarykey;size:36" json:"id"`
	AnnouncementID string `gorm:"size:36;index" json:"announcement_id" binding:"required"`
	Announcement *Announcement `gorm:"foreignKey:AnnouncementID" json:"announcement,omitempty"`
	FileUrl string `gorm:"size:1024" json:"file_url" binding:"required"`
	FileType string `gorm:"size:255" json:"file_type" binding:"required"`
	Version   int            `gorm:"not null;default:1" json:"version"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate generates a UUID before inserting.
func (m *AnnouncementAttachment) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	return nil
}

// BeforeUpdate increments Version so offline clients can detect server-side updates.
func (m *AnnouncementAttachment) BeforeUpdate(tx *gorm.DB) error {
	m.Version++
	return nil
}
