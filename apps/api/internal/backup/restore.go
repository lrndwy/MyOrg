package backup

import (
	"archive/zip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"

	"gorm.io/gorm"

	"myorg/apps/api/internal/models"
	"myorg/apps/api/internal/storage"
)

// RestoreOptions controls how a backup archive is replayed.
type RestoreOptions struct {
	MigrateFirst  bool
	ClearExisting bool // TRUNCATE registered tables before INSERTs
}

// SplitStatements splits our generated dump.sql into executable statements.
//
// This is NOT a general SQL parser — it doesn't need to be. We generate the file
// ourselves and only ever emit numbers, NULL/TRUE/FALSE, and single-quoted
// literals with '' escaping. Tracking quote state is therefore exact. Splitting
// naively on ";" would corrupt any value containing a semicolon.
func SplitStatements(script string) []string {
	var out []string
	var cur strings.Builder
	inString := false

	rs := []rune(script)
	for i := 0; i < len(rs); i++ {
		c := rs[i]
		if inString {
			cur.WriteRune(c)
			if c == '\'' {
				// '' is an escaped quote, not the end of the literal.
				if i+1 < len(rs) && rs[i+1] == '\'' {
					cur.WriteRune('\'')
					i++
					continue
				}
				inString = false
			}
			continue
		}
		switch c {
		case '\'':
			inString = true
			cur.WriteRune(c)
		case ';':
			if s := strings.TrimSpace(cur.String()); s != "" {
				out = append(out, s)
			}
			cur.Reset()
		default:
			cur.WriteRune(c)
		}
	}
	if s := strings.TrimSpace(cur.String()); s != "" {
		out = append(out, s)
	}
	return out
}

// stripComments removes SQL "--" comments, but ONLY when they're real comments
// and not part of a quoted string value.
func stripComments(script string) string {
	var b strings.Builder
	inString := false
	for i := 0; i < len(script); i++ {
		c := script[i]
		if inString {
			b.WriteByte(c)
			if c == '\'' {
				if i+1 < len(script) && script[i+1] == '\'' {
					b.WriteByte(script[i+1])
					i++
					continue
				}
				inString = false
			}
			continue
		}
		if c == '\'' {
			inString = true
			b.WriteByte(c)
			continue
		}
		if c == '-' && i+1 < len(script) && script[i+1] == '-' {
			for i < len(script) && script[i] != '\n' {
				i++
			}
			if i < len(script) {
				b.WriteByte('\n')
			}
			continue
		}
		b.WriteByte(c)
	}
	return b.String()
}

// TruncateAll removes all rows from every registered table. Used before restore
// so INSERT replay does not hit duplicate-key errors on a populated database.
func TruncateAll(db *gorm.DB) error {
	tables, err := Tables(db)
	if err != nil {
		return err
	}
	if len(tables) == 0 {
		return nil
	}
	quoted := make([]string, len(tables))
	for i, t := range tables {
		quoted[i] = `"` + strings.ReplaceAll(t, `"`, `""`) + `"`
	}
	sql := "TRUNCATE " + strings.Join(quoted, ", ") + " RESTART IDENTITY CASCADE"
	return db.Exec(sql).Error
}

func parseArchive(zr *zip.Reader) (dump string, man Manifest, err error) {
	for _, f := range zr.File {
		switch f.Name {
		case "dump.sql", "metadata.json":
			rc, openErr := f.Open()
			if openErr != nil {
				return "", man, openErr
			}
			data, readErr := io.ReadAll(rc)
			rc.Close()
			if readErr != nil {
				return "", man, readErr
			}
			if f.Name == "dump.sql" {
				dump = string(data)
			} else {
				_ = json.Unmarshal(data, &man)
			}
		}
	}
	if dump == "" {
		return "", man, errors.New("dump.sql not found in archive")
	}
	return dump, man, nil
}

func applyRestore(db *gorm.DB, dump string, clearExisting bool) error {
	if clearExisting {
		if err := TruncateAll(db); err != nil {
			return fmt.Errorf("truncating tables: %w", err)
		}
	}

	stmts, err := prepareInsertStatements(db, SplitStatements(stripComments(dump)))
	if err != nil {
		return fmt.Errorf("preparing insert statements: %w", err)
	}
	return db.Transaction(func(tx *gorm.DB) error {
		for _, s := range stmts {
			switch strings.ToUpper(strings.TrimSpace(s)) {
			case "BEGIN", "COMMIT":
				continue // we own the transaction
			}
			if err := tx.Exec(s).Error; err != nil {
				head := s
				if len(head) > 120 {
					head = head[:120] + "..."
				}
				return fmt.Errorf("executing %q: %w", head, err)
			}
		}
		return nil
	})
}

// RestoreFromReader replays a backup ZIP from memory or a temp file.
func RestoreFromReader(db *gorm.DB, st *storage.Storage, r io.ReaderAt, size int64, opts RestoreOptions) (Manifest, error) {
	var man Manifest

	if opts.MigrateFirst {
		if err := models.Migrate(db); err != nil {
			return man, fmt.Errorf("migration before restore: %w", err)
		}
	}

	zr, err := zip.NewReader(r, size)
	if err != nil {
		return man, fmt.Errorf("reading zip archive: %w", err)
	}

	dump, man, err := parseArchive(zr)
	if err != nil {
		return man, err
	}

	if err := applyRestore(db, dump, opts.ClearExisting); err != nil {
		return man, err
	}

	if st != nil {
		fileCount, err := restoreFiles(context.Background(), st, zr)
		if err != nil {
			return man, fmt.Errorf("restoring files: %w", err)
		}
		man.FileCount = fileCount
	}

	return man, nil
}

// Restore replays a backup archive from a local zip file path.
//
// The archive carries DATA, not schema — run migrations on the target database
// first unless opts.MigrateFirst is set. Pass st to restore files/ objects into
// object storage after the database replay succeeds.
func Restore(db *gorm.DB, st *storage.Storage, zipPath string, opts RestoreOptions) (Manifest, error) {
	var man Manifest

	fi, err := os.Stat(zipPath)
	if err != nil {
		return man, fmt.Errorf("stat %s: %w", zipPath, err)
	}

	f, err := os.Open(zipPath)
	if err != nil {
		return man, fmt.Errorf("opening %s: %w", zipPath, err)
	}
	defer f.Close()

	return RestoreFromReader(db, st, f, fi.Size(), opts)
}
