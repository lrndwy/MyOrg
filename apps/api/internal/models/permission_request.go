package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// PermissionRequest represents a permissionrequest in the system.
type PermissionRequest struct {
	ID        string         `gorm:"primarykey;size:36" json:"id"`
	EventID string `gorm:"size:36;index" json:"event_id" binding:"required"`
	Event Event `gorm:"foreignKey:EventID" json:"event"`
	UserID string `gorm:"size:36;index" json:"user_id" binding:"required"`
	User User `gorm:"foreignKey:UserID" json:"user"`
	Reason string `gorm:"type:text" json:"reason"`
	ProofUrl string `gorm:"size:255" json:"proof_url" binding:"required"`
	Status string `gorm:"size:255" json:"status" binding:"required"`
	ReviewedByID *string `gorm:"size:36;index" json:"reviewed_by_id"`
	ReviewedBy *User `gorm:"foreignKey:ReviewedByID" json:"reviewed_by,omitempty"`
	ReviewNote string `gorm:"type:text" json:"review_note"`
	ReviewedAt *time.Time `json:"reviewed_at"`
	Version   int            `gorm:"not null;default:1" json:"version"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate generates a UUID before inserting.
func (m *PermissionRequest) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	return nil
}

// BeforeUpdate increments Version so offline clients can detect server-side updates.
func (m *PermissionRequest) BeforeUpdate(tx *gorm.DB) error {
	m.Version++
	return nil
}
