package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// RecruitmentTargetDivision represents a recruitmenttargetdivision in the system.
type RecruitmentTargetDivision struct {
	ID        string         `gorm:"primarykey;size:36" json:"id"`
	RecruitmentID string `gorm:"size:36;index" json:"recruitment_id" binding:"required"`
	Recruitment Recruitment `gorm:"foreignKey:RecruitmentID" json:"recruitment"`
	DivisionID string `gorm:"size:36;index" json:"division_id" binding:"required"`
	Division Division `gorm:"foreignKey:DivisionID" json:"division"`
	Version   int            `gorm:"not null;default:1" json:"version"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate generates a UUID before inserting.
func (m *RecruitmentTargetDivision) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	return nil
}

// BeforeUpdate increments Version so offline clients can detect server-side updates.
func (m *RecruitmentTargetDivision) BeforeUpdate(tx *gorm.DB) error {
	m.Version++
	return nil
}
