package backup

import (
	"fmt"
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/schema"

	"myorg/apps/api/internal/models"
)

// Tables returns every registered table in FK-safe order: parents before
// children so INSERT replay respects foreign keys.
func Tables(db *gorm.DB) ([]string, error) {
	raw, deps, err := collectTablesAndDeps(db)
	if err != nil {
		return nil, err
	}
	return topoSortTables(raw, deps)
}

func collectTablesAndDeps(db *gorm.DB) ([]string, map[string][]string, error) {
	var tables []string
	seen := map[string]bool{}
	deps := map[string][]string{}
	var joinTables []string

	addDep := func(child, parent string) {
		if child == "" || parent == "" || child == parent {
			return
		}
		deps[child] = append(deps[child], parent)
	}

	for _, m := range models.Models() {
		stmt := &gorm.Statement{DB: db}
		if err := stmt.Parse(m); err != nil {
			return nil, nil, fmt.Errorf("parsing model %T: %w", m, err)
		}
		t := stmt.Schema.Table
		if t != "" && !seen[t] {
			seen[t] = true
			tables = append(tables, t)
		}

		for _, rel := range stmt.Schema.Relationships.Relations {
			if rel.Type == schema.BelongsTo && rel.FieldSchema != nil {
				addDep(t, rel.FieldSchema.Table)
			}
			if rel.JoinTable != nil {
				jt := rel.JoinTable.Table
				if jt != "" && !seen[jt] {
					seen[jt] = true
					joinTables = append(joinTables, jt)
				}
				if rel.FieldSchema != nil {
					addDep(jt, t)
					addDep(jt, rel.FieldSchema.Table)
				}
			}
		}
	}

	tables = append(tables, joinTables...)
	for _, jt := range joinTables {
		if _, ok := deps[jt]; !ok {
			deps[jt] = nil
		}
	}

	// Dedupe dependency lists while preserving order.
	for child, parents := range deps {
		uniq := make([]string, 0, len(parents))
		added := map[string]bool{}
		for _, p := range parents {
			if p == "" || added[p] {
				continue
			}
			added[p] = true
			uniq = append(uniq, p)
		}
		deps[child] = uniq
	}

	return tables, deps, nil
}

// topoSortTables orders tables so every dependency appears before dependents.
// Registration order is used as a stable tie-breaker among siblings.
func topoSortTables(tables []string, deps map[string][]string) ([]string, error) {
	index := make(map[string]int, len(tables))
	for i, t := range tables {
		index[t] = i
	}

	inDegree := make(map[string]int, len(tables))
	children := make(map[string][]string)
	for _, t := range tables {
		inDegree[t] = 0
	}
	for child, parents := range deps {
		if _, ok := inDegree[child]; !ok {
			continue
		}
		for _, parent := range parents {
			if _, ok := inDegree[parent]; !ok {
				continue
			}
			children[parent] = append(children[parent], child)
			inDegree[child]++
		}
	}

	var queue []string
	for _, t := range tables {
		if inDegree[t] == 0 {
			queue = append(queue, t)
		}
	}

	sorted := make([]string, 0, len(tables))
	for len(queue) > 0 {
		// Pick the queued table with the smallest registration index.
		best := 0
		for i := 1; i < len(queue); i++ {
			if index[queue[i]] < index[queue[best]] {
				best = i
			}
		}
		n := queue[best]
		queue = append(queue[:best], queue[best+1:]...)
		sorted = append(sorted, n)

		for _, child := range children[n] {
			inDegree[child]--
			if inDegree[child] == 0 {
				queue = append(queue, child)
			}
		}
	}

	if len(sorted) != len(tables) {
		return nil, fmt.Errorf("cycle detected in table foreign-key dependencies")
	}
	return sorted, nil
}

// parseInsertTable extracts the target table from our generated INSERT statements.
func parseInsertTable(stmt string) string {
	s := strings.TrimSpace(stmt)
	if len(s) < 12 || !strings.EqualFold(s[:12], "INSERT INTO ") {
		return ""
	}
	rest := strings.TrimSpace(s[12:])
	if rest == "" {
		return ""
	}
	if rest[0] == '"' {
		end := strings.Index(rest[1:], `"`)
		if end < 0 {
			return ""
		}
		return rest[1 : 1+end]
	}
	if i := strings.IndexAny(rest, " ("); i >= 0 {
		return strings.Trim(rest[:i], `"`)
	}
	return strings.Trim(rest, `"`)
}

// orderInsertStatements replays INSERTs in FK-safe table order regardless of
// the order they appear in dump.sql (older backups wrote users before roles).
func orderInsertStatements(db *gorm.DB, stmts []string) ([]string, error) {
	orderedTables, err := Tables(db)
	if err != nil {
		return nil, err
	}

	byTable := map[string][]string{}
	for _, s := range stmts {
		switch strings.ToUpper(strings.TrimSpace(s)) {
		case "BEGIN", "COMMIT":
			continue
		}
		if t := parseInsertTable(s); t != "" {
			byTable[t] = append(byTable[t], s)
			continue
		}
	}

	out := make([]string, 0, len(stmts))
	seen := map[string]bool{}
	for _, t := range orderedTables {
		seen[t] = true
		out = append(out, byTable[t]...)
	}
	for t, ss := range byTable {
		if !seen[t] {
			out = append(out, ss...)
		}
	}
	return out, nil
}
