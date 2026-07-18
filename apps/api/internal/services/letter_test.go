package services

import (
	"testing"
	"time"
)

func TestRenderLetterCode(t *testing.T) {
	tmpl := "{number}/{code}/{month_roman}/{year}"
	got := renderLetterCode(tmpl, 7, "UND", "Undangan", time.Date(2026, 7, 16, 0, 0, 0, 0, time.UTC))
	want := "7/UND/VII/2026"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestRenderLetterCodeExtendedVariables(t *testing.T) {
	d := time.Date(2026, 7, 16, 0, 0, 0, 0, time.UTC)
	tmpl := "{number_padded}/{name}/{date_id}/{weekday}/{month_name}/{year_short}"
	got := renderLetterCode(tmpl, 7, "UND", "Undangan", d)
	want := "007/Undangan/16/07/2026/Kamis/Juli/26"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestRenderLetterCodeIndonesianAliases(t *testing.T) {
	d := time.Date(2026, 3, 5, 0, 0, 0, 0, time.UTC)
	tmpl := "{nomor_padded}/{kategori}/{bulan_romawi}/{tahun}"
	got := renderLetterCode(tmpl, 12, "SK", "Surat Keputusan", d)
	want := "012/SK/III/2026"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}
