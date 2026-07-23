package storage

import (
	"bytes"
	"io"
	"strings"
	"testing"
)

func TestSeekableBody_nonSeekable(t *testing.T) {
	t.Parallel()
	src := strings.NewReader("hello zip restore")
	rs, err := seekableBody(src)
	if err != nil {
		t.Fatal(err)
	}
	data, err := io.ReadAll(rs)
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != "hello zip restore" {
		t.Fatalf("got %q", data)
	}
	if _, err := rs.Seek(0, io.SeekStart); err != nil {
		t.Fatal(err)
	}
}

func TestSeekableBody_reusesSeekable(t *testing.T) {
	t.Parallel()
	src := bytes.NewReader([]byte("seekable"))
	rs, err := seekableBody(src)
	if err != nil {
		t.Fatal(err)
	}
	if rs != src {
		t.Fatal("expected same ReadSeeker when input is already seekable")
	}
}
