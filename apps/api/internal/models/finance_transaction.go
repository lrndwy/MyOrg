package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// FinanceTransaction represents a financetransaction in the system.
type FinanceTransaction struct {
	ID        string         `gorm:"primarykey;size:36" json:"id"`
	Type string `gorm:"size:255" json:"type" binding:"required"`
	Amount float64 `gorm:"type:decimal(12,2)" json:"amount"`
	Description string `gorm:"type:text" json:"description"`
	ProofUrl string `gorm:"size:255" json:"proof_url"`
	TransactionDate *time.Time `gorm:"type:date" json:"transaction_date"`
	CategoryID string `gorm:"size:36;index" json:"category_id" binding:"required"`
	Category FinanceCategory `gorm:"foreignKey:CategoryID" json:"category"`
	RecordedByID string `gorm:"size:36;index" json:"recorded_by_id"`
	RecordedBy User `gorm:"foreignKey:RecordedByID" json:"recorded_by"`
	Version   int            `gorm:"not null;default:1" json:"version"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// BeforeCreate generates a UUID before inserting.
func (m *FinanceTransaction) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	return nil
}

// BeforeUpdate increments Version so offline clients can detect server-side updates.
func (m *FinanceTransaction) BeforeUpdate(tx *gorm.DB) error {
	m.Version++
	return nil
}
