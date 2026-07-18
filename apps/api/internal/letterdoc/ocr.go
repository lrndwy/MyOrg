package letterdoc

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

const (
	maxPDFPagesForOCR = 3
	pdfRenderDPI      = "300"
)

func ocrDocumentBytes(data []byte, fileName string) (string, error) {
	if strings.EqualFold(filepath.Ext(fileName), ".pdf") {
		return ocrPDFDocument(data, fileName)
	}

	if url := strings.TrimSpace(os.Getenv("TESSERACT_HTTP_URL")); url != "" {
		return postTesseractHTTP(url, data, fileName)
	}
	return ocrImageLocal(data, fileName)
}

func ocrPDFDocument(data []byte, fileName string) (string, error) {
	pages, err := collectPDFPagesForOCR(data)
	if err != nil {
		return "", err
	}
	return ocrPageImages(pages)
}

func ocrPageImages(pages []pdfPageImage) (string, error) {
	if len(pages) == 0 {
		return "", fmt.Errorf("tidak ada halaman PDF untuk OCR")
	}

	useHTTP := strings.TrimSpace(os.Getenv("TESSERACT_HTTP_URL")) != ""
	var parts []string
	var lastErr error

	for _, page := range pages {
		var text string
		var err error
		if useHTTP {
			text, err = postTesseractHTTP(os.Getenv("TESSERACT_HTTP_URL"), page.data, page.fileName)
		} else {
			text, err = ocrImageLocal(page.data, page.fileName)
		}
		if err != nil {
			lastErr = err
			continue
		}
		if strings.TrimSpace(text) != "" {
			parts = append(parts, text)
		}
	}

	out := strings.TrimSpace(strings.Join(parts, "\n"))
	if out != "" {
		return out, nil
	}
	if lastErr != nil {
		return "", fmt.Errorf("OCR PDF hasil scan gagal: %w", lastErr)
	}
	return "", fmt.Errorf("tidak ada teks terbaca pada PDF hasil scan")
}

func ocrImageLocal(data []byte, fileName string) (string, error) {
	if _, err := exec.LookPath("tesseract"); err != nil {
		return "", fmt.Errorf("OCR membutuhkan tesseract terpasang di server atau TESSERACT_HTTP_URL (docker compose service ocr)")
	}

	tmpPath, cleanup, err := writeTempDocument(data, fileName)
	if err != nil {
		return "", err
	}
	defer cleanup()

	text, err := runTesseractCLI(tmpPath)
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(text) == "" {
		return "", fmt.Errorf("tidak ada teks terbaca pada dokumen")
	}
	return text, nil
}

func runTesseractCLI(filePath string) (string, error) {
	cmd := exec.Command("tesseract", filePath, "stdout", "-l", "ind+eng", "--psm", "3", "--dpi", pdfRenderDPI)
	out, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("OCR gagal: %w", err)
	}
	return strings.TrimSpace(string(out)), nil
}

func parseTesseractHTTPBody(body []byte) (stdout, stderr string, err error) {
	var envelope map[string]json.RawMessage
	if err := json.Unmarshal(body, &envelope); err != nil {
		return "", "", fmt.Errorf("OCR gagal memparse respons: %w", err)
	}

	payload := body
	if data, ok := envelope["data"]; ok {
		payload = data
	}

	var parsed struct {
		Stdout string `json:"stdout"`
		Stderr string `json:"stderr"`
	}
	if err := json.Unmarshal(payload, &parsed); err != nil {
		return "", "", fmt.Errorf("OCR gagal memparse respons: %w", err)
	}
	return parsed.Stdout, parsed.Stderr, nil
}

func postTesseractHTTP(baseURL string, data []byte, fileName string) (string, error) {
	endpoint := strings.TrimRight(baseURL, "/") + "/tesseract"

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	options := map[string]any{
		"languages":              []string{"ind", "eng"},
		"pageSegmentationMethod": 3,
		"dpi":                    300,
	}
	optionsJSON, err := json.Marshal(options)
	if err != nil {
		return "", err
	}
	if err := writer.WriteField("options", string(optionsJSON)); err != nil {
		return "", err
	}

	partName := filepath.Base(fileName)
	if partName == "" || partName == "." {
		partName = "document.png"
	}
	part, err := writer.CreateFormFile("file", partName)
	if err != nil {
		return "", err
	}
	if _, err := part.Write(data); err != nil {
		return "", err
	}
	if err := writer.Close(); err != nil {
		return "", err
	}

	req, err := http.NewRequest(http.MethodPost, endpoint, &body)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	client := &http.Client{Timeout: 2 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("OCR gagal (HTTP): %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("OCR gagal (HTTP %d): %s", resp.StatusCode, strings.TrimSpace(string(respBody)))
	}

	stdout, stderr, err := parseTesseractHTTPBody(respBody)
	if err != nil {
		return "", err
	}
	text := strings.TrimSpace(stdout)
	if text == "" {
		if msg := strings.TrimSpace(stderr); msg != "" {
			return "", fmt.Errorf("OCR gagal: %s", msg)
		}
		return "", fmt.Errorf("tidak ada teks terbaca pada dokumen")
	}
	return text, nil
}

func writeTempDocument(data []byte, fileName string) (path string, cleanup func(), err error) {
	ext := strings.ToLower(filepath.Ext(fileName))
	if ext == "" {
		ext = ".bin"
	}
	tmpFile, err := os.CreateTemp("", "incoming-doc-*"+ext)
	if err != nil {
		return "", func() {}, err
	}
	tmpPath := tmpFile.Name()
	cleanup = func() { _ = os.Remove(tmpPath) }
	if _, err := tmpFile.Write(data); err != nil {
		_ = tmpFile.Close()
		cleanup()
		return "", func() {}, err
	}
	if err := tmpFile.Close(); err != nil {
		cleanup()
		return "", func() {}, err
	}
	return tmpPath, cleanup, nil
}

func pdfFileName(fileName string) string {
	base := filepath.Base(fileName)
	if base == "" || base == "." {
		return "document.pdf"
	}
	if strings.EqualFold(filepath.Ext(base), ".pdf") {
		return base
	}
	return base + ".pdf"
}
