package letterdoc

import (
	"archive/zip"
	"bytes"
	"fmt"
	"io"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/ledongthuc/pdf"
)

var (
	// Flexible Indonesian org letter numbers, e.g. 045/HMKO/PLTI/XII/2024 or 12/UND/XII/2025.
	reLetterSlashFlexible = regexp.MustCompile(`(\d{1,4}(?:/[A-Z]{1,12}){1,5}/\d{4})`)
	// Numeric month variant, e.g. 003/SK/HMK/07/2026.
	reLetterSlashMonth = regexp.MustCompile(`(\d{1,4}(?:/[A-Z]{1,12}){1,4}/\d{1,2}/\d{4})`)
	// Explicit label — must include "surat" to avoid matching address lines like "No.1".
	reNomorLabelStrict = regexp.MustCompile(`(?:NOMOR|NO\.?\s*SURAT)\s*[:.\-]?\s*(\d{1,4}(?:/[A-Z0-9]{1,12}){2,7})`)
	reValidLetterNumber = regexp.MustCompile(`^\d{1,4}(?:/[A-Z0-9]{1,12})+(?:/\d{4}|/\d{1,2}/\d{4})$`)
	reWT               = regexp.MustCompile(`<w:t[^>]*>([^<]*)</w:t>`)
)

// ExtractIncomingDocumentText reads plain text from incoming letter files
// (.docx, .pdf, or common image formats via OCR when tesseract is available).
func ExtractIncomingDocumentText(data []byte, fileName string) (string, error) {
	kind := detectIncomingKind(data, fileName)
	switch kind {
	case "docx":
		return extractDocxText(data)
	case "pdf":
		return extractPDFText(data, fileName)
	case "image":
		return extractImageText(data, fileName)
	default:
		return "", fmt.Errorf("format file tidak didukung; gunakan .docx, .pdf, atau gambar (JPG/PNG/WebP)")
	}
}

// PreviewIncomingDocument extracts readable text and attempts nomor surat detection.
// When detection fails, extractedText may still contain OCR output for manual review.
func PreviewIncomingDocument(data []byte, fileName string) (code string, extractedText string) {
	text, err := ExtractIncomingDocumentText(data, fileName)
	if err == nil {
		extractedText = strings.TrimSpace(text)
	}
	if code = parseLetterNumberFromDocument(data, fileName, extractedText); code != "" {
		return code, extractedText
	}

	kind := detectIncomingKind(data, fileName)
	if kind == "pdf" || kind == "image" {
		headerText, err := ocrDocumentHeaderRegion(data, fileName)
		if err == nil {
			headerText = strings.TrimSpace(headerText)
			if headerText != "" {
				extractedText = mergeExtractedText(extractedText, headerText)
				if code = ParseLetterNumberFromText(headerText); code != "" {
					return code, extractedText
				}
			}
		}
	}
	return "", extractedText
}

func mergeExtractedText(base, extra string) string {
	base = strings.TrimSpace(base)
	extra = strings.TrimSpace(extra)
	if extra == "" {
		return base
	}
	if base == "" {
		return extra
	}
	if strings.Contains(base, extra) {
		return base
	}
	return extra + "\n\n---\n\n" + base
}

// ParseIncomingLetterNumber scans document bytes and returns the detected nomor surat.
func ParseIncomingLetterNumber(data []byte, fileName string) (string, error) {
	code, _ := PreviewIncomingDocument(data, fileName)
	if code == "" {
		return "", fmt.Errorf("nomor surat tidak terdeteksi pada file; pastikan teks nomor surat terbaca jelas")
	}
	return code, nil
}

func parseLetterNumberFromDocument(data []byte, fileName string, knownText string) string {
	if code := ParseLetterNumberFromText(knownText); code != "" {
		return code
	}

	kind := detectIncomingKind(data, fileName)
	if kind == "pdf" {
		if layerText, layerErr := extractPDFTextLayer(data); layerErr == nil && strings.TrimSpace(layerText) != "" {
			if code := ParseLetterNumberFromText(layerText); code != "" {
				return code
			}
		}
	}
	return ""
}

// ParseLetterNumberFromText finds a letter number in extracted plain text.
func ParseLetterNumberFromText(text string) string {
	header := letterNumberSearchText(text)
	if header == "" {
		return ""
	}

	seen := map[string]struct{}{}
	var candidates []string

	add := func(raw string) {
		c := cleanLetterNumber(raw)
		if c == "" {
			return
		}
		if !isPlausibleLetterNumber(c) {
			return
		}
		if _, ok := seen[c]; ok {
			return
		}
		seen[c] = struct{}{}
		candidates = append(candidates, c)
	}

	for _, re := range []*regexp.Regexp{reLetterSlashMonth, reLetterSlashFlexible} {
		for _, m := range re.FindAllStringSubmatch(header, -1) {
			if len(m) >= 2 {
				add(m[1])
			}
		}
	}
	for _, m := range reNomorLabelStrict.FindAllStringSubmatch(header, -1) {
		if len(m) >= 2 {
			add(m[1])
		}
	}

	return pickBestLetterNumber(candidates, header)
}

func isPlausibleLetterNumber(s string) bool {
	s = strings.TrimSpace(strings.ToUpper(s))
	if len(s) < 7 || len(s) > 48 {
		return false
	}
	if strings.Contains(s, " ") {
		return false
	}
	if !strings.Contains(s, "/") {
		return false
	}
	if !reValidLetterNumber.MatchString(s) {
		return false
	}
	lower := strings.ToLower(s)
	for _, bad := range []string{
		"jalan", "politeknik", "himpunan", "mahasiswa", "negeri",
		"sidakaya", "cilacap", "dr.", "soetomo", "jawa", "tengah",
	} {
		if strings.Contains(lower, bad) {
			return false
		}
	}
	return true
}

func pickBestLetterNumber(candidates []string, text string) string {
	if len(candidates) == 0 {
		return ""
	}
	if len(candidates) == 1 {
		return candidates[0]
	}

	best := candidates[0]
	bestScore := -1
	for _, c := range candidates {
		score := 80 - len(c)
		idx := strings.Index(text, c)
		if idx >= 0 {
			if idx < 600 {
				score += 40
			}
			start := idx - 50
			if start < 0 {
				start = 0
			}
			window := text[start:idx]
			if strings.Contains(window, "NOMOR") || strings.Contains(window, "NO. SURAT") || strings.Contains(window, "NO SURAT") {
				score += 120
			}
		}
		if score > bestScore {
			bestScore = score
			best = c
		}
	}
	return best
}

func cleanLetterNumber(raw string) string {
	s := strings.ToUpper(strings.TrimSpace(raw))
	for _, re := range []*regexp.Regexp{reLetterSlashMonth, reLetterSlashFlexible} {
		if m := re.FindStringSubmatch(s); len(m) >= 2 {
			return strings.Trim(m[1], ".,;:-\"'()[]")
		}
	}
	s = strings.Trim(s, ".,;:-\"'()[]")
	for _, stop := range []string{" PERIHAL", " HAL", " LAMPIRAN", " TANGGAL", " PERIODE", " LAMP"} {
		if idx := strings.Index(s, stop); idx >= 0 {
			s = strings.TrimSpace(s[:idx])
		}
	}
	if isPlausibleLetterNumber(s) {
		return s
	}
	return ""
}

func detectIncomingKind(data []byte, fileName string) string {
	ext := strings.ToLower(filepath.Ext(fileName))
	switch ext {
	case ".docx":
		return "docx"
	case ".pdf":
		return "pdf"
	case ".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tif", ".tiff":
		return "image"
	}
	if len(data) >= 4 && string(data[:2]) == "PK" {
		return "docx"
	}
	if len(data) >= 4 && string(data[:4]) == "%PDF" {
		return "pdf"
	}
	if len(data) >= 3 && data[0] == 0xFF && data[1] == 0xD8 {
		return "image"
	}
	if len(data) >= 8 && string(data[:8]) == "\x89PNG\r\n\x1a\n" {
		return "image"
	}
	return ""
}

func extractDocxText(data []byte) (string, error) {
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return "", fmt.Errorf("membaca file docx: %w", err)
	}
	var parts []string
	for _, f := range zr.File {
		name := f.Name
		if !strings.HasSuffix(name, ".xml") {
			continue
		}
		if !strings.Contains(name, "document") && !strings.Contains(name, "header") && !strings.Contains(name, "footer") {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			return "", err
		}
		xmlData, err := io.ReadAll(rc)
		_ = rc.Close()
		if err != nil {
			return "", err
		}
		for _, m := range reWT.FindAllStringSubmatch(string(xmlData), -1) {
			if len(m) >= 2 && strings.TrimSpace(m[1]) != "" {
				parts = append(parts, m[1])
			}
		}
	}
	if len(parts) == 0 {
		return "", fmt.Errorf("tidak ada teks terbaca pada file docx")
	}
	return strings.Join(parts, " "), nil
}

func extractPDFText(data []byte, fileName string) (string, error) {
	layerText, layerErr := extractPDFTextLayer(data)
	if layerErr == nil && strings.TrimSpace(layerText) != "" {
		return layerText, nil
	}

	ocrText, ocrErr := ocrDocumentBytes(data, pdfFileName(fileName))
	if ocrErr != nil {
		if layerErr != nil {
			return "", fmt.Errorf("pdf hasil scan: %w", ocrErr)
		}
		return "", ocrErr
	}
	return ocrText, nil
}

func extractPDFTextLayer(data []byte) (string, error) {
	r, err := pdf.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return "", fmt.Errorf("membaca file pdf: %w", err)
	}
	var b strings.Builder
	total := r.NumPage()
	if total <= 0 {
		return "", fmt.Errorf("file pdf tidak memiliki halaman")
	}
	limit := total
	if limit > 5 {
		limit = 5
	}
	for i := 1; i <= limit; i++ {
		page := r.Page(i)
		if page.V.IsNull() {
			continue
		}
		text, err := page.GetPlainText(nil)
		if err != nil {
			continue
		}
		b.WriteString(text)
		b.WriteByte('\n')
	}
	out := strings.TrimSpace(b.String())
	if out == "" {
		return "", fmt.Errorf("tidak ada teks terbaca pada file pdf")
	}
	return out, nil
}

func extractImageText(data []byte, fileName string) (string, error) {
	return ocrDocumentBytes(data, fileName)
}
