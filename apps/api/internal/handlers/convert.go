package handlers

import (
	"encoding/json"
	"strings"

	"gorm.io/datatypes"
)

func optionalStringPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func jsonFromString(s string) datatypes.JSON {
	if s == "" {
		return nil
	}
	return datatypes.JSON([]byte(s))
}

// FlexStringSlice unmarshals either a JSON string array, a JSON-encoded
// array string (from textarea forms), newline-/comma-separated text, or null.
type FlexStringSlice []string

func (s *FlexStringSlice) UnmarshalJSON(b []byte) error {
	b = bytesTrimSpace(b)
	if len(b) == 0 || string(b) == "null" {
		*s = nil
		return nil
	}

	var arr []string
	if err := json.Unmarshal(b, &arr); err == nil {
		*s = cleanStringSlice(arr)
		return nil
	}

	var str string
	if err := json.Unmarshal(b, &str); err != nil {
		return err
	}
	*s = parseOptionsText(str)
	return nil
}

func (s FlexStringSlice) ToJSONSlice() datatypes.JSONSlice[string] {
	if s == nil {
		return datatypes.JSONSlice[string]{}
	}
	return datatypes.NewJSONSlice([]string(s))
}

func parseOptionsText(raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	// Prefer JSON array text: ["A","B"]
	var arr []string
	if strings.HasPrefix(raw, "[") {
		if err := json.Unmarshal([]byte(raw), &arr); err == nil {
			return cleanStringSlice(arr)
		}
	}
	// Newline-separated first (admin form UX), then comma-separated.
	sep := "\n"
	if !strings.Contains(raw, "\n") {
		sep = ","
	}
	parts := strings.Split(raw, sep)
	return cleanStringSlice(parts)
}

func cleanStringSlice(in []string) []string {
	out := make([]string, 0, len(in))
	for _, p := range in {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		out = append(out, p)
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func bytesTrimSpace(b []byte) []byte {
	return []byte(strings.TrimSpace(string(b)))
}

// coerceFieldOptionsForUpdate normalizes field_options values that may arrive
// as a string (textarea) or []any / []string in map-based PATCH bodies.
func coerceFieldOptionsForUpdate(v interface{}) (datatypes.JSONSlice[string], bool) {
	switch t := v.(type) {
	case nil:
		return datatypes.JSONSlice[string]{}, true
	case FlexStringSlice:
		return t.ToJSONSlice(), true
	case []string:
		return datatypes.NewJSONSlice(cleanStringSlice(t)), true
	case []interface{}:
		arr := make([]string, 0, len(t))
		for _, item := range t {
			if s, ok := item.(string); ok {
				arr = append(arr, s)
			}
		}
		return datatypes.NewJSONSlice(cleanStringSlice(arr)), true
	case string:
		return datatypes.NewJSONSlice(parseOptionsText(t)), true
	default:
		raw, err := json.Marshal(v)
		if err != nil {
			return nil, false
		}
		var flex FlexStringSlice
		if err := json.Unmarshal(raw, &flex); err != nil {
			return nil, false
		}
		return flex.ToJSONSlice(), true
	}
}
