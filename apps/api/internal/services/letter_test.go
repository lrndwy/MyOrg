package services

import (
	"testing"
	"time"
)

func TestRenderLetterCode(t *testing.T) {
	tmpl := "{number}/{code}/{month_roman}/{year}"
	got := renderLetterCode(tmpl, 7, "UND", time.Date(2026, 7, 16, 0, 0, 0, 0, time.UTC))
	want := "7/UND/VII/2026"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}
