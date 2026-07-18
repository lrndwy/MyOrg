package letterdoc

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os/exec"
	"strings"
	"testing"
)

func TestParseLetterNumberFromText(t *testing.T) {
	tests := []struct {
		text string
		want string
	}{
		{"Nomor: 12/UND/XII/2025", "12/UND/XII/2025"},
		{"No. Surat 003/SK/07/2026 Perihal ...", "003/SK/07/2026"},
		{"NOMOR SURAT : 001/SM/01/2026", "001/SM/01/2026"},
		{
			"LOGI POLITEKNIK NEGERI CILACAP HIMPUNAN MAHASISWA NOMOR SURAT : 045/HMKO/PLTI/XII/2024 HAL PERMOHONAN",
			"045/HMKO/PLTI/XII/2024",
		},
		{"Jalan Dr. Soetomo No.1 Sidakaya Cilacap 53212 Jawa Tengah", ""},
		{"tanpa nomor", ""},
	}
	for _, tc := range tests {
		got := ParseLetterNumberFromText(tc.text)
		if got != tc.want {
			t.Fatalf("text=%q got %q want %q", tc.text, got, tc.want)
		}
	}
}

func TestParseIncomingLetterNumberFromDocx(t *testing.T) {
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	w, err := zw.Create("word/document.xml")
	if err != nil {
		t.Fatal(err)
	}
	xml := `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Nomor</w:t></w:r><w:r><w:t>: 45/UND/X/2025</w:t></w:r></w:p></w:body></w:document>`
	if _, err := w.Write([]byte(xml)); err != nil {
		t.Fatal(err)
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}

	got, err := ParseIncomingLetterNumber(buf.Bytes(), "surat.docx")
	if err != nil {
		t.Fatal(err)
	}
	if got != "45/UND/X/2025" {
		t.Fatalf("got %q", got)
	}
}

func TestExtractImageTextHTTP(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/tesseract" {
			http.NotFound(w, r)
			return
		}
		if err := r.ParseMultipartForm(10 << 20); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if r.FormValue("options") == "" {
			http.Error(w, "missing options", http.StatusBadRequest)
			return
		}
		if _, _, err := r.FormFile("file"); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": map[string]string{
				"stdout": "Nomor: 99/OCR/01/2026",
				"stderr": "",
			},
		})
	}))
	defer srv.Close()

	t.Setenv("TESSERACT_HTTP_URL", srv.URL)

	got, err := extractImageText([]byte("fake-image"), "scan.png")
	if err != nil {
		t.Fatal(err)
	}
	if got != "Nomor: 99/OCR/01/2026" {
		t.Fatalf("got %q", got)
	}
}

func TestExtractImageTextHTTPUnsetRequiresLocalBinary(t *testing.T) {
	t.Setenv("TESSERACT_HTTP_URL", "")
	if _, err := exec.LookPath("tesseract"); err != nil {
		_, err2 := extractImageText([]byte("fake"), "x.png")
		if err2 == nil {
			t.Fatal("expected error when tesseract is missing")
		}
		return
	}
	t.Skip("tesseract installed locally")
}

var minimalPDFWithoutText = []byte(`%PDF-1.4
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
trailer<< /Size 4 /Root 1 0 R >>
startxref
190
%%EOF`)

func TestExtractPDFTextLayerEmptyForScanPDF(t *testing.T) {
	text, err := extractPDFTextLayer(minimalPDFWithoutText)
	if err == nil && strings.TrimSpace(text) != "" {
		t.Fatalf("expected empty text layer, got %q", text)
	}
}

func TestParseIncomingLetterNumberFromScannedPDFViaHTTP(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": map[string]string{
				"stdout": "Nomor Surat : 88/SCAN/PDF/2026",
				"stderr": "",
			},
		})
	}))
	defer srv.Close()

	t.Setenv("TESSERACT_HTTP_URL", srv.URL)

	got, err := ParseIncomingLetterNumber(minimalPDFWithoutText, "scan.pdf")
	if err != nil {
		t.Fatal(err)
	}
	if got != "88/SCAN/PDF/2026" {
		t.Fatalf("got %q", got)
	}
}
