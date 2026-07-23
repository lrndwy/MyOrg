package backup

import (
	"fmt"
	"strings"
	"unicode"

	"gorm.io/gorm"

	"myorg/apps/api/internal/models"
)

// tableColumns maps each registered table to its current DB column names.
func tableColumns(db *gorm.DB) (map[string]map[string]bool, error) {
	out := map[string]map[string]bool{}
	for _, m := range models.Models() {
		stmt := &gorm.Statement{DB: db}
		if err := stmt.Parse(m); err != nil {
			return nil, fmt.Errorf("parsing model %T: %w", m, err)
		}
		t := stmt.Schema.Table
		if t == "" {
			continue
		}
		set := out[t]
		if set == nil {
			set = map[string]bool{}
			out[t] = set
		}
		for _, f := range stmt.Schema.Fields {
			if f.DBName != "" {
				set[f.DBName] = true
			}
		}
	}
	return out, nil
}

// parseInsert splits our generated INSERT statements into table, columns, values.
func parseInsert(stmt string) (table string, columns []string, values []string, ok bool) {
	s := strings.TrimSpace(stmt)
	up := strings.ToUpper(s)
	if !strings.HasPrefix(up, "INSERT INTO ") {
		return "", nil, nil, false
	}

	pos := 12
	pos = skipSpace(s, pos)
	table, pos, ok = parseQuotedIdent(s, pos)
	if !ok {
		table, pos, ok = parseBareIdent(s, pos)
		if !ok {
			return "", nil, nil, false
		}
	}
	pos = skipSpace(s, pos)
	if pos >= len(s) || s[pos] != '(' {
		return "", nil, nil, false
	}

	valMarker := ") VALUES ("
	valIdx := strings.Index(up, valMarker)
	if valIdx < 0 {
		return "", nil, nil, false
	}

	columns, err := splitSQLList(s[pos+1 : valIdx])
	if err != nil || len(columns) == 0 {
		return "", nil, nil, false
	}

	valStart := valIdx + len(valMarker)
	valEnd := strings.LastIndex(s, ")")
	if valEnd <= valStart {
		return "", nil, nil, false
	}
	values, err = splitSQLList(s[valStart:valEnd])
	if err != nil || len(values) != len(columns) {
		return "", nil, nil, false
	}
	return table, columns, values, true
}

func skipSpace(s string, pos int) int {
	for pos < len(s) && unicode.IsSpace(rune(s[pos])) {
		pos++
	}
	return pos
}

func parseQuotedIdent(s string, pos int) (ident string, next int, ok bool) {
	if pos >= len(s) || s[pos] != '"' {
		return "", pos, false
	}
	end := strings.Index(s[pos+1:], `"`)
	if end < 0 {
		return "", pos, false
	}
	end = pos + 1 + end
	return s[pos+1 : end], end + 1, true
}

func parseBareIdent(s string, pos int) (ident string, next int, ok bool) {
	start := pos
	for pos < len(s) && (unicode.IsLetter(rune(s[pos])) || unicode.IsDigit(rune(s[pos])) || s[pos] == '_') {
		pos++
	}
	if pos == start {
		return "", start, false
	}
	return s[start:pos], pos, true
}

// splitSQLList splits a comma-separated SQL fragment respecting quoted strings.
func splitSQLList(s string) ([]string, error) {
	var items []string
	var cur strings.Builder
	inString := false
	depth := 0

	rs := []rune(strings.TrimSpace(s))
	for i := 0; i < len(rs); i++ {
		c := rs[i]
		if inString {
			cur.WriteRune(c)
			if c == '\'' {
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
		case '(':
			depth++
			cur.WriteRune(c)
		case ')':
			if depth > 0 {
				depth--
				cur.WriteRune(c)
			}
		case ',':
			if depth == 0 {
				items = append(items, strings.TrimSpace(cur.String()))
				cur.Reset()
			} else {
				cur.WriteRune(c)
			}
		default:
			cur.WriteRune(c)
		}
	}
	if inString {
		return nil, fmt.Errorf("unterminated string in SQL list")
	}
	if t := strings.TrimSpace(cur.String()); t != "" {
		items = append(items, t)
	}
	return items, nil
}

func columnName(raw string) string {
	return strings.Trim(raw, `"`)
}

func quoteColumn(name string) string {
	return `"` + strings.ReplaceAll(name, `"`, `""`) + `"`
}

// adaptInsertStatement drops columns absent from the current schema so older
// backups still restore after migrations remove fields. Returns ok=false when
// the INSERT should be skipped (unknown table or no compatible columns).
func adaptInsertStatement(stmt string, schema map[string]map[string]bool) (string, bool) {
	table, cols, vals, parsed := parseInsert(stmt)
	if !parsed {
		return stmt, true
	}

	allowed, known := schema[table]
	if !known {
		return "", false
	}

	var newCols, newVals []string
	for i, col := range cols {
		if allowed[columnName(col)] {
			newCols = append(newCols, quoteColumn(columnName(col)))
			newVals = append(newVals, vals[i])
		}
	}
	if len(newCols) == 0 {
		return "", false
	}
	return fmt.Sprintf(`INSERT INTO "%s" (%s) VALUES (%s)`,
		strings.ReplaceAll(table, `"`, `""`),
		strings.Join(newCols, ", "),
		strings.Join(newVals, ", "),
	), true
}

// prepareInsertStatements orders INSERTs for FK safety and adapts each one to
// the current schema (drops removed columns, skips removed tables).
func prepareInsertStatements(db *gorm.DB, stmts []string) ([]string, error) {
	ordered, err := orderInsertStatements(db, stmts)
	if err != nil {
		return nil, err
	}
	schema, err := tableColumns(db)
	if err != nil {
		return nil, err
	}

	out := make([]string, 0, len(ordered))
	for _, s := range ordered {
		switch strings.ToUpper(strings.TrimSpace(s)) {
		case "BEGIN", "COMMIT":
			continue
		}
		adapted, ok := adaptInsertStatement(s, schema)
		if !ok {
			continue
		}
		out = append(out, adapted)
	}
	return out, nil
}
