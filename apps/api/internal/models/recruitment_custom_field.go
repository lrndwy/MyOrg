package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// RecruitmentCustomField represents a recruitmentcustomfield in the system.
type RecruitmentCustomField struct {
	ID        string         `gorm:"primarykey;size:36" json:"id"`
	RecruitmentID string `gorm:"size:36;index" json:"recruitment_id" binding:"required"`
	Recruitment Recruitment `gorm:"foreignKey:RecruitmentID" json:"recruitment"`
	FieldLabel string `gorm:"size:255" json:"field_label" binding:"required"`
	FieldType string `gorm:"size:255" json:"field_type" binding:"required"`
	FieldOptions datatypes.JSONSlice[string] `gorm:"type:json" json:"field_options"`
	IsRequired bool `json:"is_required"`
	OrderIndex int `json:"order_index"`
	Version   int            `gorm:"not null;default:1" json:"version"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate generates a UUID before inserting.
func (m *RecruitmentCustomField) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	return nil
}

// BeforeUpdate increments Version so offline clients can detect server-side updates.
func (m *RecruitmentCustomField) BeforeUpdate(tx *gorm.DB) error {
	m.Version++
	return nil
}
