package storage

import (
	"net/url"
	"strings"
)

// KeyFromURL extracts the object key from a stored public URL, or returns raw
// when the value is already a storage key (uploads/..., letters/..., etc.).
func (s *Storage) KeyFromURL(raw string) string {
	return keyFromURL(s.cfg.PublicEndpoint, s.cfg.Endpoint, s.bucket, raw)
}

func keyFromURL(publicEndpoint, endpoint, bucket, raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	if isStorageKey(raw) {
		return raw
	}
	if !strings.Contains(raw, "://") {
		return ""
	}

	u, err := url.Parse(raw)
	if err != nil {
		return ""
	}

	path := strings.TrimPrefix(u.Path, "/")
	if bucket != "" && strings.HasPrefix(path, bucket+"/") {
		return unescapeKeyPath(strings.TrimPrefix(path, bucket+"/"))
	}

	// Virtual-hosted style (bucket in hostname) — path is the key.
	if bucket != "" {
		host := strings.ToLower(u.Hostname())
		if strings.HasPrefix(host, bucket+".") {
			return unescapeKeyPath(path)
		}
	}

	// Fallback: match known endpoint prefixes from our GetURL output.
	for _, base := range []string{publicEndpoint, endpoint} {
		base = strings.TrimRight(base, "/")
		if base == "" {
			continue
		}
		prefix := base + "/" + bucket + "/"
		if strings.HasPrefix(raw, prefix) {
			return unescapeKeyPath(strings.TrimPrefix(raw, prefix))
		}
	}

	if isStorageKey(path) {
		return unescapeKeyPath(path)
	}
	return ""
}

func isStorageKey(s string) bool {
	return strings.HasPrefix(s, "uploads/") ||
		strings.HasPrefix(s, "thumbnails/") ||
		strings.HasPrefix(s, "letters/")
}

// ParseKey extracts an object key from a URL or raw key string without a
// Storage instance (used during backup key collection).
func ParseKey(publicEndpoint, endpoint, bucket, raw string) string {
	return keyFromURL(publicEndpoint, endpoint, bucket, raw)
}

func unescapeKeyPath(p string) string {
	if p == "" {
		return ""
	}
	parts := strings.Split(p, "/")
	for i, seg := range parts {
		if dec, err := url.PathUnescape(seg); err == nil {
			parts[i] = dec
		}
	}
	return strings.Join(parts, "/")
}
