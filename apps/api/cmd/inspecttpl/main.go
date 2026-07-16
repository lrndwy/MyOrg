package main

import (
	"archive/zip"
	"bytes"
	"fmt"
	"io"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	"myorg/apps/api/internal/config"
	"myorg/apps/api/internal/database"
	"myorg/apps/api/internal/models"
)

func main() {
	cfg, _ := config.Load()
	db, _ := database.Connect(cfg.DatabaseURL)
	var org models.OrganizationSetting
	db.Order("created_at asc").First(&org)
	res, err := http.Get(org.LetterheadTemplateUrl)
	if err != nil { log.Fatal(err) }
	defer res.Body.Close()
	b, _ := io.ReadAll(io.LimitReader(res.Body, 5<<20))
	zr, err := zip.NewReader(bytes.NewReader(b), int64(len(b)))
	if err != nil { log.Fatal(err) }

	client := &http.Client{Timeout: 20 * time.Second}
	_ = client

	for _, f := range zr.File {
		fmt.Printf("file: %s size=%d\n", f.Name, f.UncompressedSize64)
	}
	for _, f := range zr.File {
		if f.Name != "word/document.xml" && !strings.Contains(f.Name, "header") && !strings.Contains(f.Name, "footer") {
			continue
		}
		rc, _ := f.Open()
		data, _ := io.ReadAll(rc)
		rc.Close()
		// extract all w:t text
		re := regexp.MustCompile(`<w:t[^>]*>([^<]*)</w:t>`)
		var parts []string
		for _, m := range re.FindAllStringSubmatch(string(data), -1) {
			if m[1] != "" {
				parts = append(parts, m[1])
			}
		}
		fmt.Printf("\n== %s (%d bytes) ==\njoined w:t (%d runs): %q\n", f.Name, len(data), len(parts), strings.Join(parts, "|"))
		// show if CONTENT-like substrings appear split
		joined := strings.Join(parts, "")
		fmt.Printf("concat: %q\n", truncate(joined, 500))
		for _, needle := range []string{"NOMOR", "HAL", "CONTENT", "SIGNATURE", "LAMPIRAN", "TEMPAT", "{", "}"} {
			if strings.Contains(joined, needle) || strings.Contains(string(data), needle) {
				fmt.Printf("  found %q in concat=%v raw=%v\n", needle, strings.Contains(joined, needle), strings.Contains(string(data), needle))
			}
		}
	}

	// latest generated letter doc?
	var letter models.Letter
	if err := db.Where("type = ? AND document_url <> ''", "outgoing").Order("created_at desc").First(&letter).Error; err == nil {
		fmt.Println("\n--- latest letter ---")
		fmt.Println("code", letter.LetterCode, "subject", letter.Subject)
		fmt.Println("content len", len(letter.Content), "preview", truncate(letter.Content, 120))
		fmt.Println("doc", truncate(letter.DocumentUrl, 80))
		res2, err := http.Get(letter.DocumentUrl)
		if err == nil {
			defer res2.Body.Close()
			gb, _ := io.ReadAll(io.LimitReader(res2.Body, 5<<20))
			gz, err := zip.NewReader(bytes.NewReader(gb), int64(len(gb)))
			if err == nil {
				for _, f := range gz.File {
					if f.Name != "word/document.xml" { continue }
					rc, _ := f.Open()
					data, _ := io.ReadAll(rc)
					rc.Close()
					re := regexp.MustCompile(`<w:t[^>]*>([^<]*)</w:t>`)
					var parts []string
					for _, m := range re.FindAllStringSubmatch(string(data), -1) {
						if m[1] != "" { parts = append(parts, m[1]) }
					}
					fmt.Printf("generated concat: %q\n", truncate(strings.Join(parts, ""), 800))
				}
			}
		}
	}
}

func truncate(s string, n int) string {
	if len(s) <= n { return s }
	return s[:n] + "..."
}
