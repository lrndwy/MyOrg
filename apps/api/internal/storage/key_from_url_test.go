package storage

import (
	"testing"

	"myorg/apps/api/internal/config"
)

func TestParseKey(t *testing.T) {
	t.Parallel()
	bucket := "myorg"
	public := "http://localhost:9000"

	cases := []struct {
		raw  string
		want string
	}{
		{"uploads/2026/01/file.jpg", "uploads/2026/01/file.jpg"},
		{"letters/abc/generated.docx", "letters/abc/generated.docx"},
		{"", ""},
		{"https://example.com/other", ""},
		{
			"http://localhost:9000/myorg/uploads/2026/01/file.jpg",
			"uploads/2026/01/file.jpg",
		},
		{
			public + "/" + bucket + "/thumbnails/2026/01/file.jpg",
			"thumbnails/2026/01/file.jpg",
		},
	}
	for _, tc := range cases {
		if got := ParseKey(public, public, bucket, tc.raw); got != tc.want {
			t.Errorf("ParseKey(%q) = %q, want %q", tc.raw, got, tc.want)
		}
	}
}

func TestKeyFromURL_onStorage(t *testing.T) {
	s := &Storage{
		bucket: "myorg",
		cfg: config.StorageConfig{
			PublicEndpoint: "http://localhost:9000",
			Endpoint:       "http://localhost:9000",
			Bucket:         "myorg",
		},
	}
	got := s.KeyFromURL("http://localhost:9000/myorg/uploads/x.png")
	if got != "uploads/x.png" {
		t.Fatalf("KeyFromURL = %q, want uploads/x.png", got)
	}
}
