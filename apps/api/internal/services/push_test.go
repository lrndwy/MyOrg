package services

import (
	"strings"
	"testing"
	"unicode/utf8"
)

func TestStripHTMLToPlain(t *testing.T) {
	if got := stripHTMLToPlain("<p>Halo <b>dunia</b></p>", 160); got != "Halo dunia" {
		t.Fatalf("got %q", got)
	}
	if got := stripHTMLToPlain("   ", 160); got != "Ada pengumuman baru." {
		t.Fatalf("empty got %q", got)
	}
	long := stripHTMLToPlain("<p>"+strings.Repeat("a", 200)+"</p>", 20)
	if utf8.RuneCountInString(long) != 20 {
		t.Fatalf("expected 20 runes, got %d (%q)", utf8.RuneCountInString(long), long)
	}
}
