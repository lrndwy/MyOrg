package letterdoc

import (
	"archive/zip"
	"bytes"
	"testing"
	"time"
)

func TestFormatDateID(t *testing.T) {
	d := time.Date(2025, 12, 4, 0, 0, 0, 0, time.UTC)
	got := FormatDateID(d)
	want := "04 Desember 2025"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestNormalizeValuesAliases(t *testing.T) {
	v := NormalizeValues(map[string]string{"NOMOR_SURAT": "1/UND/I/2026"})
	if v["{NOMOR_SURAT}"] != "1/UND/I/2026" || v["{NOMOR}"] != "1/UND/I/2026" {
		t.Fatalf("unexpected: %#v", v)
	}
}

func TestMergeMissingZip(t *testing.T) {
	_, err := Merge([]byte("not-a-zip"), Values{"{NOMOR_SURAT}": "x"})
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestDetectVariables(t *testing.T) {
	// Minimal docx: zip with word/document.xml containing placeholders.
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	w, err := zw.Create("word/document.xml")
	if err != nil {
		t.Fatal(err)
	}
	xml := `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>{NOMOR_SURAT}</w:t></w:r></w:p><w:p><w:r><w:t>{NAMA_KEGIATAN}</w:t></w:r></w:p></w:body></w:document>`
	if _, err := w.Write([]byte(xml)); err != nil {
		t.Fatal(err)
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}

	vars, err := DetectVariables(buf.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	if len(vars) != 2 {
		t.Fatalf("got %v", vars)
	}
	if vars[0] != "NAMA_KEGIATAN" || vars[1] != "NOMOR_SURAT" {
		t.Fatalf("got %v", vars)
	}
}
