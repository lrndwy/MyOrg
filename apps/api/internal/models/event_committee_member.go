package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// EventCommitteeMember represents a eventcommitteemember in the system.
type EventCommitteeMember struct {
	ID        string         `gorm:"primarykey;size:36" json:"id"`
	SieID string `gorm:"size:36;uniqueIndex:idx_committee_member_sie_user" json:"sie_id" binding:"required"`
	Sie EventCommitteeSie `gorm:"foreignKey:SieID" json:"sie"`
	UserID string `gorm:"size:36;uniqueIndex:idx_committee_member_sie_user" json:"user_id" binding:"required"`
	User User `gorm:"foreignKey:UserID" json:"user"`
	Role string `gorm:"size:255" json:"role" binding:"required"`
	Version   int            `gorm:"not null;default:1" json:"version"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate generates a UUID before inserting.
func (m *EventCommitteeMember) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	return nil
}

// BeforeUpdate increments Version so offline clients can detect server-side updates.
func (m *EventCommitteeMember) BeforeUpdate(tx *gorm.DB) error {
	m.Version++
	return nil
}
