package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"path"
	"strconv"
	"strings"
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"myorg/apps/api/internal/letterdoc"
	"myorg/apps/api/internal/models"
	"myorg/apps/api/internal/storage"
)

// LetterService handles business logic for letters.
type LetterService struct {
	DB      *gorm.DB
	Storage *storage.Storage
}

// LetterListParams holds pagination and filter parameters.
type LetterListParams struct {
	Page      int
	PageSize  int
	Search    string
	SortBy    string
	SortOrder string
	Type      string // incoming | outgoing
}

// CreateLetterInput is the payload for creating incoming or outgoing letters.
type CreateLetterInput struct {
	Type        string            `json:"type"`
	CategoryID  string            `json:"category_id"`  // required for incoming; outgoing taken from template if empty
	TemplateID  string            `json:"template_id"`  // required for outgoing
	Subject     string            `json:"subject"`
	LetterDate  *time.Time        `json:"letter_date"`
	Sender      string            `json:"sender"`
	Recipient   string            `json:"recipient"`
	DocumentUrl string            `json:"document_url"` // incoming file
	DocumentKey string            `json:"document_key"`
	FileName    string            `json:"file_name"`
	Variables   map[string]string `json:"variables"` // placeholder name (with/without braces) → value
	LetterCode  string            `json:"letter_code"` // optional override for NOMOR_SURAT
}

// List returns a paginated list of letters.
func (s *LetterService) List(params LetterListParams) ([]models.Letter, int64, int, error) {
	if params.Page < 1 {
		params.Page = 1
	}
	if params.PageSize < 1 || params.PageSize > 100 {
		params.PageSize = 20
	}
	if params.SortOrder != "asc" && params.SortOrder != "desc" {
		params.SortOrder = "desc"
	}
	sortableLetter := map[string]bool{
		"id": true, "created_at": true, "updated_at": true, "type": true,
		"category_id": true, "letter_code": true, "subject": true, "letter_date": true,
		"sender": true, "recipient": true, "document_url": true,
	}
	if !sortableLetter[params.SortBy] {
		params.SortBy = "created_at"
	}

	query := s.DB.Model(&models.Letter{}).
		Preload("Category").
		Preload("Template")

	if params.Type != "" {
		query = query.Where("type = ?", params.Type)
	}
	if params.Search != "" {
		like := "%" + params.Search + "%"
		query = query.Where(
			"letter_code ILIKE ? OR subject ILIKE ? OR sender ILIKE ? OR recipient ILIKE ?",
			like, like, like, like,
		)
	}

	var total int64
	query.Count(&total)

	var items []models.Letter
	offset := (params.Page - 1) * params.PageSize
	if err := query.Order(params.SortBy + " " + params.SortOrder).Offset(offset).Limit(params.PageSize).Find(&items).Error; err != nil {
		return nil, 0, 0, fmt.Errorf("fetching letters: %w", err)
	}

	pages := int(math.Ceil(float64(total) / float64(params.PageSize)))
	return items, total, pages, nil
}

// GetByID returns a single letter by ID.
func (s *LetterService) GetByID(id string) (*models.Letter, error) {
	var item models.Letter
	err := s.DB.Preload("Category").Preload("Template").First(&item, "id = ?", id).Error
	if err != nil {
		return nil, fmt.Errorf("letter not found: %w", err)
	}
	return &item, nil
}

// PreviewNextLetterCode returns the next nomor for a category without incrementing.
func (s *LetterService) PreviewNextLetterCode(categoryID string, letterDate *time.Time) (string, error) {
	var cat models.LetterCategory
	if err := s.DB.First(&cat, "id = ?", categoryID).Error; err != nil {
		return "", fmt.Errorf("letter category not found: %w", err)
	}
	next := cat.CurrentNumber + 1
	if cat.CurrentNumber == 0 && cat.StartNumber > 0 {
		next = cat.StartNumber
	}
	t := time.Now()
	if letterDate != nil {
		t = *letterDate
	}
	return renderLetterCode(cat.NumberFormatTemplate, next, cat.Code, t), nil
}

// Create creates a letter (incoming or outgoing) with auto letter code.
func (s *LetterService) Create(input CreateLetterInput) (*models.Letter, error) {
	typ := strings.ToLower(strings.TrimSpace(input.Type))
	if typ != "incoming" && typ != "outgoing" {
		return nil, fmt.Errorf("type must be incoming or outgoing")
	}

	var tpl *models.LetterTemplate
	if typ == "outgoing" {
		if strings.TrimSpace(input.TemplateID) == "" {
			return nil, fmt.Errorf("template_id is required for outgoing letters")
		}
		var t models.LetterTemplate
		if err := s.DB.Preload("Category").First(&t, "id = ?", input.TemplateID).Error; err != nil {
			return nil, fmt.Errorf("letter template not found: %w", err)
		}
		if strings.TrimSpace(t.TemplateUrl) == "" {
			return nil, fmt.Errorf("letter template belum punya file .docx")
		}
		tpl = &t
		if strings.TrimSpace(input.CategoryID) == "" {
			input.CategoryID = t.CategoryID
		}
		if strings.TrimSpace(input.Subject) == "" {
			input.Subject = t.Name
		}
		if input.LetterDate == nil {
			now := time.Now()
			input.LetterDate = &now
		}
		// Derive recipient from variables if not provided
		if strings.TrimSpace(input.Recipient) == "" && input.Variables != nil {
			for _, k := range []string{"TUJUAN_INSTANSI", "{TUJUAN_INSTANSI}"} {
				if v := strings.TrimSpace(input.Variables[k]); v != "" {
					input.Recipient = v
					break
				}
			}
		}
	} else {
		if strings.TrimSpace(input.CategoryID) == "" {
			return nil, fmt.Errorf("category_id is required")
		}
		if strings.TrimSpace(input.DocumentUrl) == "" {
			return nil, fmt.Errorf("document file is required for incoming letters")
		}
		if strings.TrimSpace(input.Subject) == "" {
			input.Subject = input.FileName
			if input.Subject == "" {
				input.Subject = "Surat Masuk"
			}
		}
	}

	varsJSON, _ := json.Marshal(input.Variables)
	item := &models.Letter{
		Type:           typ,
		CategoryID:     input.CategoryID,
		Subject:        input.Subject,
		LetterDate:     input.LetterDate,
		Sender:         input.Sender,
		Recipient:      input.Recipient,
		DocumentUrl:    input.DocumentUrl,
		VariableValues: datatypes.JSON(varsJSON),
	}
	if tpl != nil {
		tid := tpl.ID
		item.TemplateID = &tid
	}

	err := s.DB.Transaction(func(tx *gorm.DB) error {
		var cat models.LetterCategory
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			First(&cat, "id = ?", item.CategoryID).Error; err != nil {
			return fmt.Errorf("letter category not found: %w", err)
		}

		next := cat.CurrentNumber + 1
		if cat.CurrentNumber == 0 && cat.StartNumber > 0 {
			next = cat.StartNumber
		}

		letterDate := time.Now()
		if item.LetterDate != nil {
			letterDate = *item.LetterDate
		}
		autoCode := renderLetterCode(cat.NumberFormatTemplate, next, cat.Code, letterDate)

		override := strings.TrimSpace(input.LetterCode)
		if override == "" && input.Variables != nil {
			for _, k := range []string{"NOMOR_SURAT", "{NOMOR_SURAT}", "NOMOR", "{NOMOR}", "LETTER_CODE", "{LETTER_CODE}"} {
				if v := strings.TrimSpace(input.Variables[k]); v != "" {
					override = v
					break
				}
			}
		}
		if override != "" {
			item.LetterCode = override
		} else {
			item.LetterCode = autoCode
		}

		if err := tx.Model(&cat).Update("current_number", next).Error; err != nil {
			return fmt.Errorf("updating letter counter: %w", err)
		}
		if err := tx.Create(item).Error; err != nil {
			return fmt.Errorf("creating letter: %w", err)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	if typ == "outgoing" {
		docURL, genErr := s.generateOutgoingDocument(item, tpl, input.Variables)
		if genErr != nil {
			_ = s.Delete(item.ID)
			return nil, fmt.Errorf("generating letter document: %w", genErr)
		}
		item.DocumentUrl = docURL
		if err := s.DB.Model(item).Update("document_url", docURL).Error; err != nil {
			_ = s.Delete(item.ID)
			return nil, fmt.Errorf("saving document url: %w", err)
		}
	}

	return s.GetByID(item.ID)
}

func (s *LetterService) generateOutgoingDocument(item *models.Letter, tpl *models.LetterTemplate, variables map[string]string) (string, error) {
	if s.Storage == nil {
		return "", fmt.Errorf("file storage is not configured")
	}
	if tpl == nil || strings.TrimSpace(tpl.TemplateUrl) == "" {
		return "", fmt.Errorf("letter template belum diatur")
	}

	templateBytes, err := downloadBytes(tpl.TemplateUrl)
	if err != nil {
		return "", fmt.Errorf("mengunduh letter template: %w", err)
	}
	if len(templateBytes) < 4 || string(templateBytes[:2]) != "PK" {
		return "", fmt.Errorf("letter template harus file .docx (ZIP/OOXML)")
	}

	raw := map[string]string{}
	for k, v := range variables {
		raw[k] = v
	}
	// Always ensure NOMOR_SURAT is set from letter_code
	raw["NOMOR_SURAT"] = item.LetterCode
	raw["{NOMOR_SURAT}"] = item.LetterCode

	values := letterdoc.NormalizeValues(raw)
	merged, err := letterdoc.Merge(templateBytes, values)
	if err != nil {
		return "", err
	}

	key := fmt.Sprintf("letters/%s/generated.docx", item.ID)
	ctx := context.Background()
	if err := s.Storage.Upload(ctx, key, bytes.NewReader(merged),
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document"); err != nil {
		return "", err
	}
	return s.Storage.GetURL(key), nil
}

func downloadBytes(url string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return nil, fmt.Errorf("HTTP %d", res.StatusCode)
	}
	return io.ReadAll(io.LimitReader(res.Body, 20<<20))
}

func renderLetterCode(tmpl string, number int, code string, t time.Time) string {
	romans := []string{"", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"}
	month := int(t.Month())
	roman := strconv.Itoa(month)
	if month >= 1 && month <= 12 {
		roman = romans[month]
	}
	out := tmpl
	out = strings.ReplaceAll(out, "{number}", strconv.Itoa(number))
	out = strings.ReplaceAll(out, "{code}", code)
	out = strings.ReplaceAll(out, "{month_roman}", roman)
	out = strings.ReplaceAll(out, "{year}", strconv.Itoa(t.Year()))
	return out
}

// Update modifies an existing letter.
func (s *LetterService) Update(id string, updates map[string]interface{}) (*models.Letter, error) {
	var item models.Letter
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("letter not found: %w", err)
	}

	if err := s.DB.Model(&item).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("updating letter: %w", err)
	}
	return s.GetByID(id)
}

// Delete soft-deletes a letter.
func (s *LetterService) Delete(id string) error {
	res := s.DB.Where("id = ?", id).Delete(&models.Letter{})
	if res.Error != nil {
		return fmt.Errorf("deleting letter: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return fmt.Errorf("letter not found")
	}
	return nil
}

// DocumentFileName suggests a download filename for a letter.
func DocumentFileName(item *models.Letter) string {
	code := strings.ReplaceAll(item.LetterCode, "/", "-")
	if code == "" {
		code = item.ID
	}
	if item.Type == "incoming" && item.DocumentUrl != "" {
		base := path.Base(item.DocumentUrl)
		if base != "" && base != "." && base != "/" {
			return base
		}
	}
	return code + ".docx"
}

// DetectTemplateVariables downloads a template and returns placeholder names + suggested nomor.
func (s *LetterService) DetectTemplateVariables(templateID string) (vars []string, suggestedNomor string, categoryID string, err error) {
	var tpl models.LetterTemplate
	if err := s.DB.Preload("Category").First(&tpl, "id = ?", templateID).Error; err != nil {
		return nil, "", "", fmt.Errorf("letter template not found: %w", err)
	}
	if strings.TrimSpace(tpl.TemplateUrl) == "" {
		return nil, "", tpl.CategoryID, fmt.Errorf("template file belum diunggah")
	}
	raw, err := downloadBytes(tpl.TemplateUrl)
	if err != nil {
		return nil, "", tpl.CategoryID, fmt.Errorf("mengunduh template: %w", err)
	}
	vars, err = letterdoc.DetectVariables(raw)
	if err != nil {
		return nil, "", tpl.CategoryID, err
	}
	suggested, err := s.PreviewNextLetterCode(tpl.CategoryID, nil)
	if err != nil {
		return vars, "", tpl.CategoryID, nil
	}
	return vars, suggested, tpl.CategoryID, nil
}
