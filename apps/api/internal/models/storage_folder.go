package models

import (
	"time"

	"gorm.io/gorm"
)

// StorageFolder is a virtual directory in Penyimpanan Cloud (admin-only).
type StorageFolder struct {
	ID        string         `gorm:"primarykey;size:36" json:"id"`
	Name      string         `gorm:"size:255;not null" json:"name"`
	ParentID  *string        `gorm:"size:36;index" json:"parent_id,omitempty"`
	Parent    *StorageFolder `gorm:"foreignKey:ParentID" json:"-"`
	UserID    string         `gorm:"size:36;index;not null" json:"user_id"`
	User      User           `gorm:"foreignKey:UserID" json:"-"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}
