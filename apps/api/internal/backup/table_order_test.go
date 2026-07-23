package backup

import (
	"strings"
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestParseInsertTable(t *testing.T) {
	t.Parallel()
	cases := map[string]string{
		`INSERT INTO "users" ("id") VALUES ('x');`: "users",
		`INSERT INTO users (id) VALUES (1);`:        "users",
		`BEGIN`:  "",
		`SELECT 1`: "",
	}
	for in, want := range cases {
		if got := parseInsertTable(in); got != want {
			t.Errorf("parseInsertTable(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestTables_usersAfterRolesAndDivisions(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	tables, err := Tables(db)
	if err != nil {
		t.Fatal(err)
	}
	idx := func(name string) int {
		for i, tbl := range tables {
			if tbl == name {
				return i
			}
		}
		return -1
	}
	users := idx("users")
	roles := idx("roles")
	divisions := idx("divisions")
	if users < 0 || roles < 0 || divisions < 0 {
		t.Fatalf("missing table: users=%d roles=%d divisions=%d in %v", users, roles, divisions, tables)
	}
	if roles >= users {
		t.Errorf("roles (idx %d) must come before users (idx %d)", roles, users)
	}
	if divisions >= users {
		t.Errorf("divisions (idx %d) must come before users (idx %d)", divisions, users)
	}
}

func TestOrderInsertStatements_reordersLegacyDump(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	legacy := []string{
		`INSERT INTO "users" ("id", "app_role_id") VALUES ('u1', 'r1');`,
		`INSERT INTO "roles" ("id") VALUES ('r1');`,
		`INSERT INTO "divisions" ("id") VALUES ('d1');`,
	}
	ordered, err := orderInsertStatements(db, legacy)
	if err != nil {
		t.Fatal(err)
	}
	if len(ordered) != 3 {
		t.Fatalf("got %d statements, want 3", len(ordered))
	}
	if parseInsertTable(ordered[0]) != "roles" && parseInsertTable(ordered[0]) != "divisions" {
		t.Errorf("first insert should be roles or divisions, got %q", parseInsertTable(ordered[0]))
	}
	if parseInsertTable(ordered[2]) != "users" {
		t.Errorf("users should be last, got %q", parseInsertTable(ordered[2]))
	}
}

func TestAdaptInsertStatement_dropsRemovedColumns(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	schema, err := tableColumns(db)
	if err != nil {
		t.Fatal(err)
	}

	legacy := `INSERT INTO "events" ("id", "title", "event_type", "committee_description", "status") VALUES ('e1', 'Meetup', 'general', 'desc', 'active')`
	adapted, ok := adaptInsertStatement(legacy, schema)
	if !ok {
		t.Fatal("expected adapted insert")
	}
	if strings.Contains(adapted, "event_type") || strings.Contains(adapted, "committee_description") {
		t.Fatalf("removed columns still present: %s", adapted)
	}
	for _, col := range []string{`"id"`, `"title"`, `"status"`} {
		if !strings.Contains(adapted, col) {
			t.Fatalf("missing column %s in %s", col, adapted)
		}
	}
}

func TestAdaptInsertStatement_skipsRemovedTable(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	schema, err := tableColumns(db)
	if err != nil {
		t.Fatal(err)
	}

	_, ok := adaptInsertStatement(`INSERT INTO "event_committee_sies" ("id") VALUES ('x')`, schema)
	if ok {
		t.Fatal("expected removed table insert to be skipped")
	}
}
