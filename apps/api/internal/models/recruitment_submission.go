package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// RecruitmentSubmission represents a recruitmentsubmission in the system.
type RecruitmentSubmission struct {
	ID        string         `gorm:"primarykey;size:36" json:"id"`
	RecruitmentID string `gorm:"size:36;index" json:"recruitment_id" binding:"required"`
	Recruitment Recruitment `gorm:"foreignKey:RecruitmentID" json:"recruitment"`
	Name string `gorm:"size:255" json:"name" binding:"required"`
	Nim string `gorm:"size:255" json:"nim"`
	DivisionInterestID string `gorm:"size:36;index" json:"division_interest_id" binding:"required"`
	DivisionInterest Division `gorm:"foreignKey:DivisionInterestID" json:"division_interest"`
	Contact string `gorm:"size:255" json:"contact" binding:"required"`
	CustomAnswers datatypes.JSON `gorm:"type:jsonb" json:"custom_answers"`
	Status string `gorm:"size:255" json:"status" binding:"required"`
	Version   int            `gorm:"not null;default:1" json:"version"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate generates a UUID before inserting.
func (m *RecruitmentSubmission) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	return nil
}

// BeforeUpdate increments Version so offline clients can detect server-side updates.
func (m *RecruitmentSubmission) BeforeUpdate(tx *gorm.DB) error {
	m.Version++
	return nil
}
