package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// PushSubscription stores a browser Web Push subscription for a user.
// Endpoint is unique — re-subscribing the same browser upserts keys.
type PushSubscription struct {
	ID        string         `gorm:"primarykey;size:36" json:"id"`
	UserID    string         `gorm:"size:36;index;not null" json:"user_id"`
	Endpoint  string         `gorm:"type:text;uniqueIndex;not null" json:"endpoint"`
	P256dh    string         `gorm:"type:text;not null" json:"-"`
	Auth      string         `gorm:"type:text;not null" json:"-"`
	UserAgent string         `gorm:"size:500" json:"user_agent"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (p *PushSubscription) BeforeCreate(tx *gorm.DB) error {
	if p.ID == "" {
		p.ID = uuid.New().String()
	}
	return nil
}
