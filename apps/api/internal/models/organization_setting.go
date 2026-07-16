package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// OrganizationSetting represents a organizationsetting in the system.
type OrganizationSetting struct {
	ID        string         `gorm:"primarykey;size:36" json:"id"`
	WebName                      string `gorm:"size:255" json:"web_name" binding:"required"`
	LogoUrl                      string `gorm:"size:255" json:"logo_url"`
	IconUrl                      string `gorm:"size:255" json:"icon_url"`
	Theme                        string `gorm:"size:255" json:"theme" binding:"required"`
	AllowSelfRegister            bool   `json:"allow_self_register"`
	AllowCrossDivisionEventsView bool   `json:"allow_cross_division_events_view"`
	// Deprecated letterhead fields — kop surat diganti LetterTemplate; kolom tetap untuk kompatibilitas DB.
	LetterheadTemplateUrl string `gorm:"size:512" json:"letterhead_template_url,omitempty"`
	LetterPlace           string `gorm:"size:128" json:"letter_place,omitempty"`
	SignatureIdLabel      string `gorm:"size:64;default:NIM/NIP" json:"signature_id_label,omitempty"`
	Version               int    `gorm:"not null;default:1" json:"version"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate generates a UUID before inserting.
func (m *OrganizationSetting) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	return nil
}

// BeforeUpdate increments Version so offline clients can detect server-side updates.
func (m *OrganizationSetting) BeforeUpdate(tx *gorm.DB) error {
	m.Version++
	return nil
}
