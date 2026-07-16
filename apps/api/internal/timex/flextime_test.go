package timex

import (
	"encoding/json"
	"testing"
	"time"
)

func TestParseDatetimeLocal(t *testing.T) {
	got, err := Parse("2026-07-16T19:38")
	if err != nil {
		t.Fatal(err)
	}
	if got.Year() != 2026 || got.Month() != 7 || got.Day() != 16 {
		t.Fatalf("unexpected date: %v", got)
	}
	if got.Hour() != 19 || got.Minute() != 38 {
		t.Fatalf("unexpected time: %v", got)
	}
}

func TestParseRFC3339(t *testing.T) {
	got, err := Parse("2026-07-16T12:38:00.000Z")
	if err != nil {
		t.Fatal(err)
	}
	if !got.Equal(time.Date(2026, 7, 16, 12, 38, 0, 0, time.UTC)) {
		t.Fatalf("unexpected: %v", got)
	}
}

func TestFlexTimeUnmarshal(t *testing.T) {
	var f *FlexTime
	if err := json.Unmarshal([]byte(`"2026-07-16T19:38"`), &f); err != nil {
		t.Fatal(err)
	}
	if f == nil || f.Ptr() == nil {
		t.Fatal("expected non-nil")
	}
	if f.Time.Hour() != 19 || f.Time.Minute() != 38 {
		t.Fatalf("unexpected: %v", f.Time)
	}
}
