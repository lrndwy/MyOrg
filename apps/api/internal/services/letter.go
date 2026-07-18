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
	return renderLetterCode(cat.NumberFormatTemplate, next, cat.Code, cat.Name, t), nil
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
		if strings.TrimSpace(input.DocumentUrl) == "" {
			return nil, fmt.Errorf("document file is required for incoming letters")
		}
		if strings.TrimSpace(input.Subject) == "" {
			return nil, fmt.Errorf("subject is required for incoming letters")
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
		if typ == "incoming" {
			catID, err := s.resolveIncomingCategoryID(tx)
			if err != nil {
				return err
			}
			item.CategoryID = catID

			docBytes, err := downloadBytes(item.DocumentUrl)
			if err != nil {
				return fmt.Errorf("mengunduh file surat masuk: %w", err)
			}
			override := strings.TrimSpace(input.LetterCode)
			if override != "" {
				item.LetterCode = override
			} else {
				parsedCode, err := letterdoc.ParseIncomingLetterNumber(docBytes, input.FileName)
				if err != nil {
					return err
				}
				item.LetterCode = parsedCode
			}
			if strings.TrimSpace(item.LetterCode) == "" {
				return fmt.Errorf("nomor surat wajib diisi untuk surat masuk")
			}
			now := time.Now()
			if item.LetterDate == nil {
				item.LetterDate = &now
			}

			if err := tx.Create(item).Error; err != nil {
				return fmt.Errorf("creating letter: %w", err)
			}
			return nil
		}

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
		autoCode := renderLetterCode(cat.NumberFormatTemplate, next, cat.Code, cat.Name, letterDate)

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

func renderLetterCode(tmpl string, number int, code, name string, t time.Time) string {
	month := int(t.Month())
	day := t.Day()
	year := t.Year()

	romans := []string{"", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"}
	monthRoman := strconv.Itoa(month)
	if month >= 1 && month <= 12 {
		monthRoman = romans[month]
	}

	monthsID := []string{
		"", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
		"Juli", "Agustus", "September", "Oktober", "November", "Desember",
	}
	weekdaysID := []string{"Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"}
	weekdaysShortID := []string{"Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"}

	monthName := monthsID[month]
	if monthName == "" {
		monthName = strconv.Itoa(month)
	}
	weekday := weekdaysID[int(t.Weekday())]
	weekdayShort := weekdaysShortID[int(t.Weekday())]

	// Longer keys first so partial tokens are not corrupted.
	replacements := []struct{ key, val string }{
		{"{number_padded_4}", fmt.Sprintf("%04d", number)},
		{"{number_padded_2}", fmt.Sprintf("%02d", number)},
		{"{number_padded}", fmt.Sprintf("%03d", number)},
		{"{nomor_padded}", fmt.Sprintf("%03d", number)},
		{"{month_roman}", monthRoman},
		{"{bulan_romawi}", monthRoman},
		{"{month_name}", monthName},
		{"{bulan_nama}", monthName},
		{"{month_padded}", fmt.Sprintf("%02d", month)},
		{"{day_padded}", fmt.Sprintf("%02d", day)},
		{"{year_short}", fmt.Sprintf("%02d", year%100)},
		{"{tahun_pendek}", fmt.Sprintf("%02d", year%100)},
		{"{date_id}", fmt.Sprintf("%02d/%02d/%04d", day, month, year)},
		{"{tanggal}", fmt.Sprintf("%02d/%02d/%04d", day, month, year)},
		{"{date}", fmt.Sprintf("%04d-%02d-%02d", year, month, day)},
		{"{weekday_short}", weekdayShort},
		{"{weekday}", weekday},
		{"{hari_nama}", weekday},
		{"{number}", strconv.Itoa(number)},
		{"{nomor}", strconv.Itoa(number)},
		{"{code}", code},
		{"{kategori}", code},
		{"{name}", name},
		{"{nama_kategori}", name},
		{"{year}", strconv.Itoa(year)},
		{"{tahun}", strconv.Itoa(year)},
		{"{month}", strconv.Itoa(month)},
		{"{bulan_angka}", strconv.Itoa(month)},
		{"{bulan}", fmt.Sprintf("%02d", month)},
		{"{day}", strconv.Itoa(day)},
		{"{hari_angka}", strconv.Itoa(day)},
		{"{hari}", fmt.Sprintf("%02d", day)},
	}

	out := tmpl
	for _, r := range replacements {
		out = strings.ReplaceAll(out, r.key, r.val)
	}
	return out
}

// ParseIncomingDocument downloads an uploaded file and extracts nomor surat.
func (s *LetterService) ParseIncomingDocument(documentURL, fileName string) (string, error) {
	if strings.TrimSpace(documentURL) == "" {
		return "", fmt.Errorf("document_url is required")
	}
	data, err := downloadBytes(documentURL)
	if err != nil {
		return "", fmt.Errorf("mengunduh file: %w", err)
	}
	return letterdoc.ParseIncomingLetterNumber(data, fileName)
}

// IncomingParsePreview holds OCR text and optional auto-detected nomor surat.
type IncomingParsePreview struct {
	LetterCode    string
	ExtractedText string
}

// ParseIncomingPreview downloads a file and returns detected nomor plus copyable OCR text.
func (s *LetterService) ParseIncomingPreview(documentURL, fileName string) (*IncomingParsePreview, error) {
	if strings.TrimSpace(documentURL) == "" {
		return nil, fmt.Errorf("document_url is required")
	}
	data, err := downloadBytes(documentURL)
	if err != nil {
		return nil, fmt.Errorf("mengunduh file: %w", err)
	}
	code, text := letterdoc.PreviewIncomingDocument(data, fileName)
	return &IncomingParsePreview{
		LetterCode:    code,
		ExtractedText: text,
	}, nil
}

func (s *LetterService) resolveIncomingCategoryID(tx *gorm.DB) (string, error) {
	var cat models.LetterCategory
	if err := tx.Where("code = ?", "SM-IN").First(&cat).Error; err != nil {
		return "", fmt.Errorf("kategori surat masuk belum dikonfigurasi (jalankan seed)")
	}
	return cat.ID, nil
}

// Update modifies an existing letter.
func (s *LetterService) Update(id string, updates map[string]interface{}) (*models.Letter, error) {
	var item models.Letter
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("letter not found: %w", err)
	}

	if item.Type == "incoming" {
		fileName := item.Subject
		if fn, ok := updates["file_name"].(string); ok && strings.TrimSpace(fn) != "" {
			fileName = fn
		}
		delete(updates, "file_name")

		if docURL, ok := updates["document_url"].(string); ok && strings.TrimSpace(docURL) != "" && docURL != item.DocumentUrl {
			if fileName == "" {
				fileName = path.Base(docURL)
			}
			parsed, err := s.ParseIncomingDocument(docURL, fileName)
			if err != nil {
				return nil, err
			}
			updates["letter_code"] = parsed
		}
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
