package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// EventSubEvent represents a eventsubevent in the system.
type EventSubEvent struct {
	ID        string         `gorm:"primarykey;size:36" json:"id"`
	EventID string `gorm:"size:36;index" json:"event_id" binding:"required"`
	Event Event `gorm:"foreignKey:EventID" json:"event"`
	SieID string `gorm:"size:36;index" json:"sie_id"`
	Sie EventCommitteeSie `gorm:"foreignKey:SieID" json:"sie"`
	Title string `gorm:"size:255" json:"title" binding:"required"`
	Description string `gorm:"type:text" json:"description"`
	Location string `gorm:"size:255" json:"location" binding:"required"`
	StartTime *time.Time `json:"start_time"`
	EndTime *time.Time `json:"end_time"`
	KetuaPelaksanaID string `gorm:"size:36;index" json:"ketua_pelaksana_id" binding:"required"`
	KetuaPelaksana User `gorm:"foreignKey:KetuaPelaksanaID" json:"ketua_pelaksana"`
	AttendanceMode string `gorm:"size:255" json:"attendance_mode" binding:"required"`
	MinutesUrl string `gorm:"size:255" json:"minutes_url"`
	Status string `gorm:"size:255" json:"status" binding:"required"`
	Version   int            `gorm:"not null;default:1" json:"version"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate generates a UUID before inserting.
func (m *EventSubEvent) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	return nil
}

// BeforeUpdate increments Version so offline clients can detect server-side updates.
func (m *EventSubEvent) BeforeUpdate(tx *gorm.DB) error {
	m.Version++
	return nil
}
