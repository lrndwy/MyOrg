package backup

import (
	"archive/zip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime"
	"path/filepath"
	"reflect"
	"strings"

	"gorm.io/gorm"

	"myorg/apps/api/internal/files"
	"myorg/apps/api/internal/models"
	"myorg/apps/api/internal/storage"
)

const filesZipPrefix = "files/"

// urlColumnSpec lists string columns that store public file URLs or keys.
var urlColumnSpecs = []struct {
	model  interface{}
	column string
}{
	{&models.User{}, "avatar"},
	{&models.Event{}, "banner_url"},
	{&models.Attendance{}, "selfie_url"},
	{&models.Attendance{}, "signature_url"},
	{&models.FinanceTransaction{}, "proof_url"},
	{&models.Letter{}, "document_url"},
	{&models.Letter{}, "attachment_url"},
	{&models.AnnouncementAttachment{}, "file_url"},
	{&models.OrganizationSetting{}, "logo_url"},
	{&models.OrganizationSetting{}, "icon_url"},
	{&models.OrganizationSetting{}, "letterhead_template_url"},
	{&models.PermissionRequest{}, "proof_url"},
	{&models.LetterTemplate{}, "template_url"},
	{&models.Violation{}, "document_url"},
}

type filesManifest struct {
	Keys  []string `json:"keys"`
	Count int      `json:"count"`
}

// collectStorageKeys gathers every S3 object key referenced by the database.
func collectStorageKeys(db *gorm.DB, st *storage.Storage) ([]string, error) {
	seen := map[string]bool{}
	var keys []string

	add := func(k string) {
		k = strings.TrimSpace(k)
		if k == "" || strings.Contains(k, "..") || strings.HasPrefix(k, "backups/") {
			return
		}
		if seen[k] {
			return
		}
		seen[k] = true
		keys = append(keys, k)
	}

	addKey := func(raw string) {
		if st != nil {
			add(st.KeyFromURL(raw))
			return
		}
		add(storage.ParseKey("", "", "", raw))
	}

	var uploads []models.Upload
	if err := db.Find(&uploads).Error; err != nil {
		return nil, fmt.Errorf("listing uploads: %w", err)
	}
	for _, u := range uploads {
		add(u.Path)
		if u.ThumbnailURL != "" {
			addKey(u.ThumbnailURL)
		} else if strings.HasPrefix(u.Path, "uploads/") {
			add(strings.Replace(u.Path, "uploads/", "thumbnails/", 1))
		}
	}

	for _, spec := range urlColumnSpecs {
		var urls []string
		if err := db.Model(spec.model).
			Where(spec.column+" <> ''").
			Pluck(spec.column, &urls).Error; err != nil {
			return nil, fmt.Errorf("pluck %T.%s: %w", spec.model, spec.column, err)
		}
		for _, raw := range urls {
			addKey(raw)
		}
	}

	if err := collectFileRefKeys(db, addKey); err != nil {
		return nil, err
	}

	return keys, nil
}

func collectFileRefKeys(db *gorm.DB, addKey func(string)) error {
	for _, m := range models.Models() {
		stmt := &gorm.Statement{DB: db}
		if err := stmt.Parse(m); err != nil {
			return fmt.Errorf("parsing model %T: %w", m, err)
		}
		t := stmt.Schema.Table
		if t == "" {
			continue
		}

		var fileCols []string
		rt := reflect.TypeOf(m)
		if rt.Kind() == reflect.Ptr {
			rt = rt.Elem()
		}
		for i := 0; i < rt.NumField(); i++ {
			f := rt.Field(i)
			switch f.Type {
			case reflect.TypeOf((*files.FileRef)(nil)):
				if col := stmt.Schema.LookUpField(f.Name); col != nil && col.DBName != "" {
					fileCols = append(fileCols, col.DBName)
				}
			case reflect.TypeOf(files.FileRefs{}):
				if col := stmt.Schema.LookUpField(f.Name); col != nil && col.DBName != "" {
					fileCols = append(fileCols, col.DBName)
				}
			}
		}
		if len(fileCols) == 0 {
			continue
		}

		rows, err := db.Table(t).Select(strings.Join(fileCols, ", ")).Rows()
		if err != nil {
			return fmt.Errorf("scanning file refs in %s: %w", t, err)
		}
		for rows.Next() {
			vals := make([]any, len(fileCols))
			ptrs := make([]any, len(fileCols))
			for i := range vals {
				ptrs[i] = &vals[i]
			}
			if err := rows.Scan(ptrs...); err != nil {
				rows.Close()
				return err
			}
			for _, v := range vals {
				scanFileRefValue(v, addKey)
			}
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return err
		}
	}
	return nil
}

func scanFileRefValue(v any, addKey func(string)) {
	if v == nil {
		return
	}
	var data []byte
	switch t := v.(type) {
	case []byte:
		data = t
	case string:
		data = []byte(t)
	default:
		return
	}
	if len(data) == 0 {
		return
	}

	var ref files.FileRef
	if json.Unmarshal(data, &ref) == nil && ref.Key != "" {
		addKey(ref.Key)
		if ref.ThumbnailURL != "" {
			addKey(ref.ThumbnailURL)
		}
		return
	}
	var refs files.FileRefs
	if json.Unmarshal(data, &refs) == nil {
		for _, r := range refs {
			if r.Key != "" {
				addKey(r.Key)
			}
			if r.ThumbnailURL != "" {
				addKey(r.ThumbnailURL)
			}
		}
	}
}

func (s *Service) archiveFiles(ctx context.Context, zw *zip.Writer, keys []string) (int, error) {
	if s.Storage == nil || len(keys) == 0 {
		return 0, nil
	}

	fmw, err := zw.Create("files-manifest.json")
	if err != nil {
		return 0, err
	}
	enc := json.NewEncoder(fmw)
	enc.SetIndent("", "  ")
	if err := enc.Encode(filesManifest{Keys: keys, Count: len(keys)}); err != nil {
		return 0, err
	}

	count := 0
	for _, key := range keys {
		rc, err := s.Storage.Download(ctx, key)
		if err != nil {
			log.Printf("[backup] skipping missing file %q: %v", key, err)
			continue
		}
		w, err := zw.Create(filesZipPrefix + key)
		if err != nil {
			rc.Close()
			return count, err
		}
		if _, err := io.Copy(w, rc); err != nil {
			rc.Close()
			return count, fmt.Errorf("archiving %q: %w", key, err)
		}
		rc.Close()
		count++
	}
	return count, nil
}

func restoreFiles(ctx context.Context, st *storage.Storage, zr *zip.Reader) (int, error) {
	if st == nil {
		return 0, nil
	}

	count := 0
	for _, f := range zr.File {
		if !strings.HasPrefix(f.Name, filesZipPrefix) {
			continue
		}
		key := strings.TrimPrefix(f.Name, filesZipPrefix)
		if key == "" || strings.Contains(key, "..") || strings.HasPrefix(key, "backups/") {
			continue
		}

		rc, err := f.Open()
		if err != nil {
			return count, fmt.Errorf("opening %q in archive: %w", f.Name, err)
		}

		contentType := mime.TypeByExtension(filepath.Ext(key))
		if contentType == "" {
			contentType = "application/octet-stream"
		}
		if err := st.Upload(ctx, key, rc, contentType); err != nil {
			rc.Close()
			return count, fmt.Errorf("restoring file %q: %w", key, err)
		}
		rc.Close()
		count++
	}
	return count, nil
}
