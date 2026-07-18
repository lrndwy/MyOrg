package letterdoc

import (
	"encoding/json"
	"testing"
)

func TestParseTesseractHTTPBodyWrapped(t *testing.T) {
	body := []byte(`{"data":{"exit":{"code":0,"signal":null},"stdout":"Nomor: 1/A/B/2026","stderr":""}}`)
	stdout, stderr, err := parseTesseractHTTPBody(body)
	if err != nil {
		t.Fatal(err)
	}
	if stdout != "Nomor: 1/A/B/2026" {
		t.Fatalf("stdout=%q", stdout)
	}
	if stderr != "" {
		t.Fatalf("stderr=%q", stderr)
	}
}

func TestParseTesseractHTTPBodyFlat(t *testing.T) {
	body := []byte(`{"stdout":"hello","stderr":"warn"}`)
	stdout, stderr, err := parseTesseractHTTPBody(body)
	if err != nil {
		t.Fatal(err)
	}
	if stdout != "hello" || stderr != "warn" {
		t.Fatalf("stdout=%q stderr=%q", stdout, stderr)
	}
}

func TestParseTesseractHTTPBodyInvalid(t *testing.T) {
	_, _, err := parseTesseractHTTPBody([]byte(`not json`))
	if err == nil {
		t.Fatal("expected error")
	}
	_ = json.Valid([]byte(`{}`))
}
