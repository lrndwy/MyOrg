package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// Letter represents a letter in the system.
type Letter struct {
	ID         string         `gorm:"primarykey;size:36" json:"id"`
	Type       string         `gorm:"size:255" json:"type" binding:"required"`
	CategoryID string         `gorm:"size:36;index" json:"category_id" binding:"required"`
	Category   LetterCategory `gorm:"foreignKey:CategoryID" json:"category"`
	// TemplateID is set for outgoing letters created from a LetterTemplate.
	TemplateID *string         `gorm:"size:36;index" json:"template_id,omitempty"`
	Template   *LetterTemplate `gorm:"foreignKey:TemplateID" json:"template,omitempty"`
	LetterCode string          `gorm:"size:255" json:"letter_code"` // auto-generated or override
	Subject    string          `gorm:"size:255" json:"subject"`
	LetterDate *time.Time      `gorm:"type:date" json:"letter_date"`
	Sender     string          `gorm:"size:255" json:"sender"`
	Recipient  string          `gorm:"size:255" json:"recipient"`
	// Deprecated: kept for AutoMigrate compatibility; outgoing no longer uses WYSIWYG content.
	Content string `gorm:"type:text" json:"content,omitempty"`
	// VariableValues stores placeholder → value map used when generating outgoing docs.
	VariableValues datatypes.JSON `gorm:"type:jsonb" json:"variable_values,omitempty"`
	// DocumentUrl is the main downloadable file: generated .docx (outgoing)
	// or the uploaded incoming letter file.
	DocumentUrl string `gorm:"size:512" json:"document_url"`
	// Deprecated: kept for AutoMigrate compatibility with older rows.
	AttachmentUrl string         `gorm:"size:255" json:"attachment_url,omitempty"`
	Version       int            `gorm:"not null;default:1" json:"version"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate generates a UUID before inserting.
func (m *Letter) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	return nil
}

// BeforeUpdate increments Version so offline clients can detect server-side updates.
func (m *Letter) BeforeUpdate(tx *gorm.DB) error {
	m.Version++
	return nil
}
