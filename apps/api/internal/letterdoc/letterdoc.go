// Package letterdoc merges Letter Template .docx files with placeholder values.
package letterdoc

import (
	"archive/zip"
	"bytes"
	"fmt"
	"io"
	"regexp"
	"sort"
	"strings"
	"time"
)

// KnownPlaceholders are the supported variables for Letter Templates.
// Templates may use a subset; DetectVariables reports which ones appear.
var KnownPlaceholders = []string{
	"TEMPAT_TANGGAL_SURAT_DIBUAT",
	"NOMOR_SURAT",
	"LEMBAR_LAMPIRAN",
	"EJA_LEMBAR_LAMPIRAN",
	"TUJUAN_INSTANSI",
	"NAMA_KEGIATAN",
	"NAMA_ORGANISASI",
	"NAMA_LENGKAP_JURI_INTERNAL",
	"HARI_TANGGAL_KEGIATAN",
	"WAKTU_MULAI_SELESAI_KEGIATAN",
	"TEMPAT_KEGIATAN",
	"GENDER_HORMAT",
	"MATA_LOMBA",
	"PEMBINA_DARI",
	"KETUA_DARI",
	"NAMA_PEMBINA",
	"NIP_PEMBINA",
	"NAMA_KETUA",
	"NIM_KETUA",
	"JUMLAH_ATAU_NAMA_ORANG",
	"DIUNDANG_SEBAGAI",
	"ALASAN_SPESIFIK_PENGAJUAN",
	"NAMA_NARSUM_LENGKAP_JABATAN_INSTANSI",
	"NAMA_JURI_EXTERNAL_LENGKAP_JABATAN_INSTANSI",
	"NAMA_JURI_INTERNAL_LENGKAP_JABATAN_INSTANSI",
	"MATERI",
}

// Values holds replacement text keyed by full placeholder including braces, e.g. "{NOMOR_SURAT}".
type Values map[string]string

var (
	reBraceBlock       = regexp.MustCompile(`\{[^}]*\}`)
	reXMLTag           = regexp.MustCompile(`<[^>]+>`)
	rePlaceholderName  = regexp.MustCompile(`^[A-Z][A-Z0-9_]*$`)
	reDetectedVar      = regexp.MustCompile(`\{([A-Z][A-Z0-9_]*)\}`)
)

// Merge replaces placeholders inside a .docx (ZIP of XML parts) and returns a new .docx.
func Merge(template []byte, values Values) ([]byte, error) {
	zr, err := zip.NewReader(bytes.NewReader(template), int64(len(template)))
	if err != nil {
		return nil, fmt.Errorf("reading docx zip: %w", err)
	}

	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)

	for _, f := range zr.File {
		rc, err := f.Open()
		if err != nil {
			return nil, err
		}
		data, err := io.ReadAll(rc)
		_ = rc.Close()
		if err != nil {
			return nil, err
		}

		name := f.Name
		if strings.HasSuffix(name, ".xml") || strings.HasSuffix(name, ".rels") {
			data = replaceInXML(data, values)
		}

		w, err := zw.Create(name)
		if err != nil {
			return nil, err
		}
		if _, err := w.Write(data); err != nil {
			return nil, err
		}
	}
	if err := zw.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// DetectVariables returns unique placeholder names (without braces) found in the .docx.
func DetectVariables(docx []byte) ([]string, error) {
	zr, err := zip.NewReader(bytes.NewReader(docx), int64(len(docx)))
	if err != nil {
		return nil, fmt.Errorf("reading docx zip: %w", err)
	}
	seen := map[string]struct{}{}
	for _, f := range zr.File {
		if !strings.HasSuffix(f.Name, ".xml") && !strings.HasSuffix(f.Name, ".rels") {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			return nil, err
		}
		data, err := io.ReadAll(rc)
		_ = rc.Close()
		if err != nil {
			return nil, err
		}
		s := coalesceSplitPlaceholders(string(data))
		for _, m := range reDetectedVar.FindAllStringSubmatch(s, -1) {
			if len(m) >= 2 {
				seen[m[1]] = struct{}{}
			}
		}
	}
	out := make([]string, 0, len(seen))
	for k := range seen {
		out = append(out, k)
	}
	sort.Strings(out)
	return out, nil
}

// NormalizeValues ensures keys use braces and copies NOMOR_SURAT aliases.
func NormalizeValues(raw map[string]string) Values {
	out := Values{}
	for k, v := range raw {
		key := strings.TrimSpace(k)
		if key == "" {
			continue
		}
		if !strings.HasPrefix(key, "{") {
			key = "{" + key + "}"
		}
		if !strings.HasSuffix(key, "}") {
			key = key + "}"
		}
		out[key] = v
	}
	// Legacy aliases ↔ NOMOR_SURAT
	if v, ok := out["{NOMOR_SURAT}"]; ok {
		out["{NOMOR}"] = v
		out["{LETTER_CODE}"] = v
	} else if v, ok := out["{NOMOR}"]; ok {
		out["{NOMOR_SURAT}"] = v
		out["{LETTER_CODE}"] = v
	} else if v, ok := out["{LETTER_CODE}"]; ok {
		out["{NOMOR_SURAT}"] = v
		out["{NOMOR}"] = v
	}
	return out
}

func replaceInXML(data []byte, values Values) []byte {
	s := string(data)
	s = coalesceSplitPlaceholders(s)
	keys := make([]string, 0, len(values))
	for k := range values {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(i, j int) bool { return len(keys[i]) > len(keys[j]) })
	for _, k := range keys {
		s = strings.ReplaceAll(s, k, xmlEscape(values[k]))
	}
	return []byte(s)
}

// coalesceSplitPlaceholders rejoins placeholders that Word split across runs
// by stripping XML tags between { and }.
func coalesceSplitPlaceholders(s string) string {
	return reBraceBlock.ReplaceAllStringFunc(s, func(m string) string {
		if len(m) < 2 {
			return m
		}
		inner := m[1 : len(m)-1]
		clean := strings.TrimSpace(reXMLTag.ReplaceAllString(inner, ""))
		if rePlaceholderName.MatchString(clean) {
			return "{" + clean + "}"
		}
		return m
	})
}

func xmlEscape(s string) string {
	r := strings.NewReplacer(
		"&", "&amp;",
		"<", "&lt;",
		">", "&gt;",
		`"`, "&quot;",
	)
	parts := strings.Split(s, "\n")
	for i := range parts {
		parts[i] = r.Replace(parts[i])
	}
	return strings.Join(parts, "</w:t><w:br/><w:t>")
}

var monthsID = []string{
	"", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
	"Juli", "Agustus", "September", "Oktober", "November", "Desember",
}

// FormatDateID returns e.g. "04 Desember 2025".
func FormatDateID(t time.Time) string {
	return fmt.Sprintf("%02d %s %d", t.Day(), monthsID[int(t.Month())], t.Year())
}
