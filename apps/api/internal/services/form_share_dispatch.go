package services

import (
	"fmt"
	"reflect"
	"strings"

	"gorm.io/gorm"

	"encoding/json"

	"myorg/apps/api/internal/models"
)

// SharedResourceSubmission is the result of a public form submission —
// the created record's ID and human label, both safe to return to
// anonymous visitors.
type SharedResourceSubmission struct {
	ID    string
	Label string
}

// SubmitSharedForm dispatches a public form submission to the right
// resource service based on the FormShare's ResourceName. fields is
// a free-form map (validated by the resource service's own binding
// rules), since public submissions don't carry the operator's typed
// struct context.
//
// Adding a new resource? grit generate resource appends a case to
// the switch below at the auto-dispatch marker. Each case re-marshals
// fields into the typed model via json.Marshal(fields) — that's why
// the parameter is named "fields" rather than "body".
func SubmitSharedForm(db *gorm.DB, resourceName string, fields map[string]interface{}) (*SharedResourceSubmission, error) {
	switch resourceName {
	case "Division":
		item := &models.Division{}
		body, _ := json.Marshal(fields)
		if err := json.Unmarshal(body, item); err != nil {
			return nil, fmt.Errorf("decoding Division body: %w", err)
		}
		if err := db.Create(item).Error; err != nil {
			return nil, fmt.Errorf("creating Division: %w", err)
		}
		return &SharedResourceSubmission{ID: item.ID, Label: item.Name}, nil

	case "Role":
		item := &models.Role{}
		body, _ := json.Marshal(fields)
		if err := json.Unmarshal(body, item); err != nil {
			return nil, fmt.Errorf("decoding Role body: %w", err)
		}
		if err := db.Create(item).Error; err != nil {
			return nil, fmt.Errorf("creating Role: %w", err)
		}
		return &SharedResourceSubmission{ID: item.ID, Label: item.Name}, nil

	case "Permission":
		item := &models.Permission{}
		body, _ := json.Marshal(fields)
		if err := json.Unmarshal(body, item); err != nil {
			return nil, fmt.Errorf("decoding Permission body: %w", err)
		}
		if err := db.Create(item).Error; err != nil {
			return nil, fmt.Errorf("creating Permission: %w", err)
		}
		return &SharedResourceSubmission{ID: item.ID, Label: item.ID}, nil

	case "RolePermission":
		item := &models.RolePermission{}
		body, _ := json.Marshal(fields)
		if err := json.Unmarshal(body, item); err != nil {
			return nil, fmt.Errorf("decoding RolePermission body: %w", err)
		}
		if err := db.Create(item).Error; err != nil {
			return nil, fmt.Errorf("creating RolePermission: %w", err)
		}
		return &SharedResourceSubmission{ID: item.ID, Label: item.ID}, nil

	case "OrganizationSetting":
		item := &models.OrganizationSetting{}
		body, _ := json.Marshal(fields)
		if err := json.Unmarshal(body, item); err != nil {
			return nil, fmt.Errorf("decoding OrganizationSetting body: %w", err)
		}
		if err := db.Create(item).Error; err != nil {
			return nil, fmt.Errorf("creating OrganizationSetting: %w", err)
		}
		return &SharedResourceSubmission{ID: item.ID, Label: item.ID}, nil

	case "Event":
		item := &models.Event{}
		body, _ := json.Marshal(fields)
		if err := json.Unmarshal(body, item); err != nil {
			return nil, fmt.Errorf("decoding Event body: %w", err)
		}
		if err := db.Create(item).Error; err != nil {
			return nil, fmt.Errorf("creating Event: %w", err)
		}
		return &SharedResourceSubmission{ID: item.ID, Label: item.Title}, nil

	case "Attendance":
		item := &models.Attendance{}
		body, _ := json.Marshal(fields)
		if err := json.Unmarshal(body, item); err != nil {
			return nil, fmt.Errorf("decoding Attendance body: %w", err)
		}
		if err := db.Create(item).Error; err != nil {
			return nil, fmt.Errorf("creating Attendance: %w", err)
		}
		return &SharedResourceSubmission{ID: item.ID, Label: item.ID}, nil

	case "PermissionRequest":
		item := &models.PermissionRequest{}
		body, _ := json.Marshal(fields)
		if err := json.Unmarshal(body, item); err != nil {
			return nil, fmt.Errorf("decoding PermissionRequest body: %w", err)
		}
		if err := db.Create(item).Error; err != nil {
			return nil, fmt.Errorf("creating PermissionRequest: %w", err)
		}
		return &SharedResourceSubmission{ID: item.ID, Label: item.ID}, nil

	case "Violation":
		item := &models.Violation{}
		body, _ := json.Marshal(fields)
		if err := json.Unmarshal(body, item); err != nil {
			return nil, fmt.Errorf("decoding Violation body: %w", err)
		}
		if err := db.Create(item).Error; err != nil {
			return nil, fmt.Errorf("creating Violation: %w", err)
		}
		return &SharedResourceSubmission{ID: item.ID, Label: item.ID}, nil

	case "Recruitment":
		item := &models.Recruitment{}
		body, _ := json.Marshal(fields)
		if err := json.Unmarshal(body, item); err != nil {
			return nil, fmt.Errorf("decoding Recruitment body: %w", err)
		}
		if err := db.Create(item).Error; err != nil {
			return nil, fmt.Errorf("creating Recruitment: %w", err)
		}
		return &SharedResourceSubmission{ID: item.ID, Label: item.Title}, nil

	case "RecruitmentTargetDivision":
		item := &models.RecruitmentTargetDivision{}
		body, _ := json.Marshal(fields)
		if err := json.Unmarshal(body, item); err != nil {
			return nil, fmt.Errorf("decoding RecruitmentTargetDivision body: %w", err)
		}
		if err := db.Create(item).Error; err != nil {
			return nil, fmt.Errorf("creating RecruitmentTargetDivision: %w", err)
		}
		return &SharedResourceSubmission{ID: item.ID, Label: item.ID}, nil

	case "RecruitmentCustomField":
		item := &models.RecruitmentCustomField{}
		body, _ := json.Marshal(fields)
		if err := json.Unmarshal(body, item); err != nil {
			return nil, fmt.Errorf("decoding RecruitmentCustomField body: %w", err)
		}
		if err := db.Create(item).Error; err != nil {
			return nil, fmt.Errorf("creating RecruitmentCustomField: %w", err)
		}
		return &SharedResourceSubmission{ID: item.ID, Label: item.ID}, nil

	case "RecruitmentSubmission":
		item := &models.RecruitmentSubmission{}
		body, _ := json.Marshal(fields)
		if err := json.Unmarshal(body, item); err != nil {
			return nil, fmt.Errorf("decoding RecruitmentSubmission body: %w", err)
		}
		if err := db.Create(item).Error; err != nil {
			return nil, fmt.Errorf("creating RecruitmentSubmission: %w", err)
		}
		return &SharedResourceSubmission{ID: item.ID, Label: item.Name}, nil

	case "LetterCategory":
		item := &models.LetterCategory{}
		body, _ := json.Marshal(fields)
		if err := json.Unmarshal(body, item); err != nil {
			return nil, fmt.Errorf("decoding LetterCategory body: %w", err)
		}
		if err := db.Create(item).Error; err != nil {
			return nil, fmt.Errorf("creating LetterCategory: %w", err)
		}
		return &SharedResourceSubmission{ID: item.ID, Label: item.Name}, nil

	case "Letter":
		item := &models.Letter{}
		body, _ := json.Marshal(fields)
		if err := json.Unmarshal(body, item); err != nil {
			return nil, fmt.Errorf("decoding Letter body: %w", err)
		}
		if err := db.Create(item).Error; err != nil {
			return nil, fmt.Errorf("creating Letter: %w", err)
		}
		return &SharedResourceSubmission{ID: item.ID, Label: item.Subject}, nil

	case "Announcement":
		item := &models.Announcement{}
		body, _ := json.Marshal(fields)
		if err := json.Unmarshal(body, item); err != nil {
			return nil, fmt.Errorf("decoding Announcement body: %w", err)
		}
		if err := db.Create(item).Error; err != nil {
			return nil, fmt.Errorf("creating Announcement: %w", err)
		}
		return &SharedResourceSubmission{ID: item.ID, Label: item.Title}, nil

	case "AnnouncementAttachment":
		item := &models.AnnouncementAttachment{}
		body, _ := json.Marshal(fields)
		if err := json.Unmarshal(body, item); err != nil {
			return nil, fmt.Errorf("decoding AnnouncementAttachment body: %w", err)
		}
		if err := db.Create(item).Error; err != nil {
			return nil, fmt.Errorf("creating AnnouncementAttachment: %w", err)
		}
		return &SharedResourceSubmission{ID: item.ID, Label: item.ID}, nil

	case "LetterTemplate":
		item := &models.LetterTemplate{}
		body, _ := json.Marshal(fields)
		if err := json.Unmarshal(body, item); err != nil {
			return nil, fmt.Errorf("decoding LetterTemplate body: %w", err)
		}
		if err := db.Create(item).Error; err != nil {
			return nil, fmt.Errorf("creating LetterTemplate: %w", err)
		}
		return &SharedResourceSubmission{ID: item.ID, Label: item.Name}, nil

	// grit:form-share:dispatch
	default:
		return nil, fmt.Errorf("public submission disabled for %q (no dispatch case registered)", resourceName)
	}
}

// PublicFieldInfo describes one form field the public page should
// render. Keep this struct small + JSON-friendly -- the web client
// reads it directly to build inputs.
type PublicFieldInfo struct {
	// Key matches the json tag on the Go model so the field name on
	// the wire matches what SubmitSharedForm's typed unmarshal
	// expects. e.g. "name", "category_id", "image".
	Key string `json:"key"`
	// Label is a human-friendly rendering of Key for the form label.
	Label string `json:"label"`
	// Type is the input shape the frontend should render. One of:
	//   "text" | "email" | "tel" | "textarea" | "number" |
	//   "checkbox" | "date" | "datetime" | "file"
	Type string `json:"type"`
	// Required mirrors the binding:"required" tag.
	Required bool `json:"required"`
}

// RegisteredResources returns every resource name that
// PublicFields knows how to render. v3.31.50 adds this so the
// admin New-Share modal can show a dropdown instead of a free-text
// input (typing "Catgeory" instead of "Category" was producing a
// silently-broken share). The generator injects one entry per
// `grit generate resource` at the marker below.
func RegisteredResources() []string {
	return []string{
		"Division",

		"Role",

		"Permission",

		"RolePermission",

		"OrganizationSetting",

		"Event",

		"Attendance",

		"PermissionRequest",

		"Violation",

		"Recruitment",

		"RecruitmentTargetDivision",

		"RecruitmentCustomField",

		"RecruitmentSubmission",

		"LetterCategory",

		"Letter",

		"Announcement",

		"AnnouncementAttachment",

		"LetterTemplate",

		// grit:form-share:registered
	}
}

// PublicFields returns the field schema for the public form to
// render. v3.31.43: replaces the previous hardcoded shape with the
// actual resource fields. The switch mirrors SubmitSharedForm so the
// generator only has to emit one extra case per new resource at the
// marker comment inside the switch.
func PublicFields(resourceName string) []PublicFieldInfo {
	switch resourceName {
	case "Division":
		return reflectPublicFields(&models.Division{})

	case "Role":
		return reflectPublicFields(&models.Role{})

	case "Permission":
		return reflectPublicFields(&models.Permission{})

	case "RolePermission":
		return reflectPublicFields(&models.RolePermission{})

	case "OrganizationSetting":
		return reflectPublicFields(&models.OrganizationSetting{})

	case "Event":
		return reflectPublicFields(&models.Event{})

	case "Attendance":
		return reflectPublicFields(&models.Attendance{})

	case "PermissionRequest":
		return reflectPublicFields(&models.PermissionRequest{})

	case "Violation":
		return reflectPublicFields(&models.Violation{})

	case "Recruitment":
		return reflectPublicFields(&models.Recruitment{})

	case "RecruitmentTargetDivision":
		return reflectPublicFields(&models.RecruitmentTargetDivision{})

	case "RecruitmentCustomField":
		return reflectPublicFields(&models.RecruitmentCustomField{})

	case "RecruitmentSubmission":
		return reflectPublicFields(&models.RecruitmentSubmission{})

	case "LetterCategory":
		return reflectPublicFields(&models.LetterCategory{})

	case "Letter":
		return reflectPublicFields(&models.Letter{})

	case "Announcement":
		return reflectPublicFields(&models.Announcement{})

	case "AnnouncementAttachment":
		return reflectPublicFields(&models.AnnouncementAttachment{})

	case "LetterTemplate":
		return reflectPublicFields(&models.LetterTemplate{})

	// grit:form-share:fields
	default:
		return nil
	}
}

// reflectPublicFields walks a model's struct fields and returns the
// public-form descriptors. Skips framework columns (id, created_at,
// etc), slug fields (auto-generated), and json:"-" fields. The
// generator-emitted cases in PublicFields call this with the model
// pointer.
func reflectPublicFields(model interface{}) []PublicFieldInfo {
	t := reflect.TypeOf(model)
	if t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	if t.Kind() != reflect.Struct {
		return nil
	}

	skip := map[string]bool{
		"id":         true,
		"created_at": true,
		"updated_at": true,
		"deleted_at": true,
		"version":    true,
		"slug":       true,
	}

	var out []PublicFieldInfo
	for i := 0; i < t.NumField(); i++ {
		f := t.Field(i)
		if !f.IsExported() {
			continue
		}
		jsonTag := strings.Split(f.Tag.Get("json"), ",")[0]
		if jsonTag == "" || jsonTag == "-" {
			continue
		}
		if skip[jsonTag] {
			continue
		}

		required := false
		for _, part := range strings.Split(f.Tag.Get("binding"), ",") {
			if strings.TrimSpace(part) == "required" {
				required = true
				break
			}
		}

		out = append(out, PublicFieldInfo{
			Key:      jsonTag,
			Label:    humanizePublicLabel(jsonTag),
			Type:     publicTypeFor(jsonTag, f.Type),
			Required: required,
		})
	}
	return out
}

// publicTypeFor maps a Go reflect.Type onto the public form's input
// type. FileRef columns resolve to "file" so the frontend renders
// the "not supported on public shares" state uniformly.
func publicTypeFor(fieldName string, t reflect.Type) string {
	for t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	typeName := t.String()
	if strings.Contains(typeName, "FileRef") || strings.Contains(typeName, "FileRefs") {
		return "file"
	}
	if strings.Contains(typeName, "time.Time") {
		return "datetime"
	}
	switch t.Kind() {
	case reflect.Bool:
		return "checkbox"
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64,
		reflect.Float32, reflect.Float64:
		return "number"
	case reflect.String:
		lower := strings.ToLower(fieldName)
		switch {
		case lower == "email" || strings.HasSuffix(lower, "_email"):
			return "email"
		case lower == "phone" || strings.HasSuffix(lower, "_phone") || lower == "tel":
			return "tel"
		case lower == "description" || lower == "notes" || lower == "message" ||
			lower == "body" || lower == "content" || lower == "bio" ||
			lower == "summary" || strings.HasSuffix(lower, "_description"):
			return "textarea"
		}
		return "text"
	}
	return "text"
}

// humanizePublicLabel turns "category_id" into "Category Id" and
// "first_name" into "First Name".
func humanizePublicLabel(key string) string {
	parts := strings.Split(key, "_")
	for i, p := range parts {
		if p == "" {
			continue
		}
		parts[i] = strings.ToUpper(p[:1]) + p[1:]
	}
	return strings.Join(parts, " ")
}
