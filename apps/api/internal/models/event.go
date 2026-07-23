package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Event represents a event in the system.
type Event struct {
	ID        string         `gorm:"primarykey;size:36" json:"id"`
	Title string `gorm:"size:255" json:"title" binding:"required"`
	Description string `gorm:"type:text" json:"description"`
	DivisionID *string `gorm:"size:36;index" json:"division_id"` // nil = General event
	Division *Division `gorm:"foreignKey:DivisionID" json:"division,omitempty"`
	Location string `gorm:"size:255" json:"location" binding:"required"`
	BannerUrl string `gorm:"size:255" json:"banner_url"`
	StartTime *time.Time `json:"start_time"`
	EndTime *time.Time `json:"end_time"`
	AllowPermission bool `json:"allow_permission"`
	Status string `gorm:"size:255" json:"status" binding:"required"`
	Version   int            `gorm:"not null;default:1" json:"version"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate generates a UUID before inserting.
func (m *Event) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	return nil
}

// BeforeUpdate increments Version so offline clients can detect server-side updates.
func (m *Event) BeforeUpdate(tx *gorm.DB) error {
	m.Version++
	return nil
}
