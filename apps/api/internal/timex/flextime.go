package timex

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// FlexTime unmarshals JSON time strings in RFC3339 or HTML datetime-local
// forms (e.g. "2026-07-16T19:38") that browsers send without seconds/zone.
type FlexTime struct {
	Time time.Time
}

func (f *FlexTime) UnmarshalJSON(b []byte) error {
	if string(b) == "null" {
		return nil
	}
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return err
	}
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	t, err := Parse(s)
	if err != nil {
		return err
	}
	f.Time = t
	return nil
}

// Ptr returns a *time.Time, or nil when the receiver is nil / zero.
func (f *FlexTime) Ptr() *time.Time {
	if f == nil || f.Time.IsZero() {
		return nil
	}
	t := f.Time
	return &t
}

// Parse accepts RFC3339 and common datetime-local / date-only layouts.
// Values without a timezone are interpreted in the server local zone.
func Parse(s string) (time.Time, error) {
	s = strings.TrimSpace(s)
	for _, layout := range []string{time.RFC3339Nano, time.RFC3339} {
		if t, err := time.Parse(layout, s); err == nil {
			return t, nil
		}
	}
	for _, layout := range []string{
		"2006-01-02T15:04:05",
		"2006-01-02T15:04",
		"2006-01-02 15:04:05",
		"2006-01-02 15:04",
		"2006-01-02",
	} {
		if t, err := time.ParseInLocation(layout, s, time.Local); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("cannot parse time %q", s)
}
