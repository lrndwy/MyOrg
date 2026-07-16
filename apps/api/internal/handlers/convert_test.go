package handlers

import (
	"encoding/json"
	"testing"
)

func TestFlexStringSlice_UnmarshalJSON(t *testing.T) {
	cases := []struct {
		name string
		raw  string
		want []string
	}{
		{name: "array", raw: `["A","B"]`, want: []string{"A", "B"}},
		{name: "json string array", raw: `"[\"A\",\"B\"]"`, want: []string{"A", "B"}},
		{name: "newline string", raw: `"A\nB\nC"`, want: []string{"A", "B", "C"}},
		{name: "comma string", raw: `"A, B, C"`, want: []string{"A", "B", "C"}},
		{name: "empty string", raw: `""`, want: nil},
		{name: "null", raw: `null`, want: nil},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var got FlexStringSlice
			if err := json.Unmarshal([]byte(tc.raw), &got); err != nil {
				t.Fatalf("unmarshal: %v", err)
			}
			if len(got) != len(tc.want) {
				t.Fatalf("len=%d want %d (%v)", len(got), len(tc.want), []string(got))
			}
			for i := range tc.want {
				if got[i] != tc.want[i] {
					t.Fatalf("idx %d: got %q want %q", i, got[i], tc.want[i])
				}
			}
		})
	}
}
