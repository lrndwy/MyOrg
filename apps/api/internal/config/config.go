package config

import (
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

// StorageConfig holds credentials for a single S3-compatible provider.
type StorageConfig struct {
	Endpoint       string // SDK / server-side access (may be Docker service name)
	PublicEndpoint string // Browser-facing base URL for GetURL; empty = use Endpoint
	AccessKey      string
	SecretKey      string
	Bucket         string
	Region         string
	UseSSL         bool
}

// Config holds all application configuration.
type Config struct {
	AppName     string
	AppEnv      string
	Port        string
	AppURL      string
	DatabaseURL string

	JWTSecret        string
	JWTAccessExpiry  time.Duration
	JWTRefreshExpiry time.Duration

	// AuthCookieDomain sets Domain on grit_* cookies (e.g. ".heroflow.my.id")
	// so web/admin/API subdomains share session + CSRF double-submit token.
	AuthCookieDomain string

	RedisURL string

	// Storage
	StorageDriver string        // "minio", "s3", "r2", or "b2"
	Storage       StorageConfig // Resolved config for the active driver

	ResendAPIKey string
	MailFrom     string

	CORSOrigins []string

	GORMStudioEnabled  bool
	GORMStudioUsername string
	GORMStudioPassword string

	// AI (Vercel AI Gateway)
	AIGatewayAPIKey string
	AIGatewayModel  string
	AIGatewayURL    string

	// TOTP (Two-Factor Authentication)
	TOTPIssuer string

	// Security (Sentinel)
	SentinelEnabled        bool
	SentinelUsername       string
	SentinelPassword       string
	SentinelSecretKey      string
	// Sentinel v2.0 — CIDRs allowed to send X-Forwarded-For / X-Real-IP.
	// Empty (default) means "ignore those headers entirely" — safe when
	// the app speaks to the public internet directly; populate when
	// you're behind a known reverse proxy (Caddy/Traefik/Cloudflare).
	SentinelTrustedProxies []string

	// Observability (Pulse v1.0)
	PulseEnabled    bool
	PulseUsername    string
	PulsePassword   string
	// Pulse v1.0 storage. Defaults to in-memory ring buffer (no disk).
	// Set PULSE_STORAGE=sqlite + PULSE_STORAGE_DSN=pulse.db to enable
	// the new persistent backend (WAL, busy_timeout=5s, survives restart).
	PulseStorage    string // "memory" (default) | "sqlite"
	PulseStorageDSN string // path for sqlite, e.g. "pulse.db" or ":memory:"

	// OAuth2 Social Login
	GoogleClientID     string
	GoogleClientSecret string
	GithubClientID     string
	GithubClientSecret string
	OAuthFrontendURL   string // Where to redirect after OAuth callback

	// Web Push (VAPID) — required for PWA announcement notifications
	VAPIDPublicKey  string
	VAPIDPrivateKey string
	VAPIDSubject    string // mailto:ops@example.com or https://example.com
	WebAppURL       string // NEXT_PUBLIC_WEB_URL / public portal origin
}

// Load reads configuration from environment variables.
func Load() (*Config, error) {
	// Load .env file (ignore error if not found — production uses real env vars)
	_ = godotenv.Load()
	_ = godotenv.Load("../../.env") // Load from project root when running from apps/api

	storageDriver := getEnv("STORAGE_DRIVER", "minio")

	cfg := &Config{
		AppName:     getEnv("APP_NAME", "grit-app"),
		AppEnv:      getEnv("APP_ENV", "development"),
		Port:        getEnv("APP_PORT", "8080"),
		AppURL:      getEnv("APP_URL", "http://localhost:8080"),
		DatabaseURL: resolveDatabaseURL(),
		JWTSecret:   getEnv("JWT_SECRET", ""),
		RedisURL:    getEnv("REDIS_URL", "redis://localhost:6380"),
		AuthCookieDomain: strings.TrimSpace(getEnv("AUTH_COOKIE_DOMAIN", "")),

		StorageDriver: storageDriver,
		Storage:       resolveStorage(storageDriver),

		ResendAPIKey: getEnv("RESEND_API_KEY", ""),
		MailFrom:     getEnv("MAIL_FROM", "noreply@localhost"),

		// The Wails desktop webview is allowed by middleware.isWailsOrigin (it
		// matches the wails.localhost host on any port), so it needs no entry
		// here — its dev origin includes a configurable port.
		CORSOrigins: strings.Split(getEnv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001"), ","),

		GORMStudioEnabled:  getEnv("GORM_STUDIO_ENABLED", "true") == "true",
		GORMStudioUsername: getEnv("GORM_STUDIO_USERNAME", "admin"),
		GORMStudioPassword: getEnv("GORM_STUDIO_PASSWORD", "studio"),

		AIGatewayAPIKey: getEnv("AI_GATEWAY_API_KEY", ""),
		AIGatewayModel:  getEnv("AI_GATEWAY_MODEL", "anthropic/claude-sonnet-4-6"),
		AIGatewayURL:    getEnv("AI_GATEWAY_URL", "https://ai-gateway.vercel.sh/v1"),

		TOTPIssuer: getEnv("TOTP_ISSUER", getEnv("APP_NAME", "grit-app")),

		SentinelEnabled:        getEnv("SENTINEL_ENABLED", "true") == "true",
		SentinelUsername:       getEnv("SENTINEL_USERNAME", "admin"),
		SentinelPassword:       getEnv("SENTINEL_PASSWORD", "sentinel"),
		SentinelSecretKey:      getEnv("SENTINEL_SECRET_KEY", "sentinel-secret-change-me"),
		SentinelTrustedProxies: splitCSV(getEnv("SENTINEL_TRUSTED_PROXIES", "")),

		PulseEnabled:    getEnv("PULSE_ENABLED", "true") == "true",
		PulseUsername:    getEnv("PULSE_USERNAME", "admin"),
		PulsePassword:   getEnv("PULSE_PASSWORD", "pulse"),
		PulseStorage:    getEnv("PULSE_STORAGE", "memory"),
		PulseStorageDSN: getEnv("PULSE_STORAGE_DSN", "pulse.db"),

		GoogleClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
		GithubClientID:     getEnv("GITHUB_CLIENT_ID", ""),
		GithubClientSecret: getEnv("GITHUB_CLIENT_SECRET", ""),
		OAuthFrontendURL:   getEnv("OAUTH_FRONTEND_URL", "http://localhost:3001"),

		VAPIDPublicKey:  getEnv("VAPID_PUBLIC_KEY", ""),
		VAPIDPrivateKey: getEnv("VAPID_PRIVATE_KEY", ""),
		VAPIDSubject:    getEnv("VAPID_SUBJECT", "mailto:noreply@localhost"),
		WebAppURL:       getEnv("NEXT_PUBLIC_WEB_URL", getEnv("OAUTH_FRONTEND_URL", "http://localhost:3000")),
	}

	// DatabaseURL is always populated by resolveDatabaseURL() — either from
	// the DATABASE_URL env var or built from POSTGRES_* parts. The actual
	// connection attempt in cmd/server/main.go will surface a useful error
	// if the resolved URL points at an unreachable database.

	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}
	if len(cfg.JWTSecret) < 32 {
		log.Println("WARNING: JWT_SECRET should be at least 32 characters for security. Generate one with: openssl rand -hex 32")
	}

	// Parse durations
	accessExpiry, err := time.ParseDuration(getEnv("JWT_ACCESS_EXPIRY", "15m"))
	if err != nil {
		return nil, fmt.Errorf("invalid JWT_ACCESS_EXPIRY: %w", err)
	}
	cfg.JWTAccessExpiry = accessExpiry

	refreshExpiry, err := time.ParseDuration(getEnv("JWT_REFRESH_EXPIRY", "168h"))
	if err != nil {
		return nil, fmt.Errorf("invalid JWT_REFRESH_EXPIRY: %w", err)
	}
	cfg.JWTRefreshExpiry = refreshExpiry

	return cfg, nil
}

// IsDevelopment returns true if the app is running in development mode.
func (c *Config) IsDevelopment() bool {
	return c.AppEnv == "development"
}

// resolveDatabaseURL returns the connection string for the database.
//
// Single source of truth: edit POSTGRES_USER / POSTGRES_PASSWORD /
// POSTGRES_DB / POSTGRES_HOST / POSTGRES_PORT in .env and both
// docker-compose.yml and this function read the SAME values, so they
// can't drift.
//
// Resolution order:
//
//  1. If DATABASE_URL is set, use it verbatim — that's the escape hatch
//     for external Postgres (Neon, Supabase, RDS) or SQLite. It wins over
//     the POSTGRES_* parts so a one-line override is enough to swap.
//  2. Otherwise build postgres://USER:PASS@HOST:PORT/DB?sslmode=disable
//     from the parts above. Defaults match docker-compose.yml's
//     ${VAR:-grit} fallbacks so a fresh project boots even before the
//     user touches .env.
func resolveDatabaseURL() string {
	if v := os.Getenv("DATABASE_URL"); v != "" {
		return v
	}
	user := getEnv("POSTGRES_USER", "grit")
	pass := getEnv("POSTGRES_PASSWORD", "grit")
	host := getEnv("POSTGRES_HOST", "localhost")
	port := getEnv("POSTGRES_PORT", "5432")
	db := getEnv("POSTGRES_DB", getEnv("APP_NAME", "grit-app"))
	return fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable",
		user, pass, host, port, db)
}

// resolveStorage returns the StorageConfig for the active driver.
//
// For AWS S3, leave S3_ENDPOINT empty — the AWS SDK will use the
// regional endpoint automatically (s3.<region>.amazonaws.com).
// Credentials fall back to the AWS standard env vars
// AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY if you don't set the S3_*
// variants, which is convenient when running on EC2 / ECS / Lambda
// with an IAM role and you'd rather not duplicate keys in .env.
func resolveStorage(driver string) StorageConfig {
	switch driver {
	case "s3":
		// Empty endpoint = AWS SDK uses the regional default
		// (s3.<region>.amazonaws.com). This also flips the client into
		// virtual-hosted style, which AWS requires for buckets created
		// after Sep 2020.
		return StorageConfig{
			Endpoint:  getEnv("S3_ENDPOINT", ""),
			AccessKey: firstNonEmpty(os.Getenv("S3_ACCESS_KEY"), os.Getenv("AWS_ACCESS_KEY_ID")),
			SecretKey: firstNonEmpty(os.Getenv("S3_SECRET_KEY"), os.Getenv("AWS_SECRET_ACCESS_KEY")),
			Bucket:    getEnv("S3_BUCKET", "uploads"),
			Region:    firstNonEmpty(os.Getenv("S3_REGION"), os.Getenv("AWS_REGION"), "us-east-1"),
			UseSSL:    true,
		}
	case "r2":
		return StorageConfig{
			Endpoint:  getEnv("R2_ENDPOINT", ""),
			AccessKey: getEnv("R2_ACCESS_KEY", ""),
			SecretKey: getEnv("R2_SECRET_KEY", ""),
			Bucket:    getEnv("R2_BUCKET", "uploads"),
			Region:    getEnv("R2_REGION", "auto"),
			UseSSL:    true,
		}
	case "b2":
		return StorageConfig{
			Endpoint:  getEnv("B2_ENDPOINT", ""),
			AccessKey: getEnv("B2_ACCESS_KEY", ""),
			SecretKey: getEnv("B2_SECRET_KEY", ""),
			Bucket:    getEnv("B2_BUCKET", "uploads"),
			Region:    getEnv("B2_REGION", "us-west-004"),
			UseSSL:    true,
		}
	default: // minio
		return StorageConfig{
			Endpoint:       getEnv("MINIO_ENDPOINT", "http://localhost:9000"),
			PublicEndpoint: getEnv("MINIO_PUBLIC_URL", ""),
			AccessKey:      getEnv("MINIO_ACCESS_KEY", "minioadmin"),
			SecretKey:      getEnv("MINIO_SECRET_KEY", "minioadmin"),
			Bucket:         getEnv("MINIO_BUCKET", "uploads"),
			Region:         getEnv("MINIO_REGION", "us-east-1"),
			UseSSL:         getEnv("MINIO_USE_SSL", "false") == "true",
		}
	}
}

// firstNonEmpty returns the first non-empty string in vals, or "" if all
// are empty. Useful for letting S3_* override AWS_* with a graceful
// fallback.
func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

// splitCSV trims and splits a comma-separated env var. Empty strings
// after trimming are dropped so "a, ,b" yields ["a","b"].
func splitCSV(s string) []string {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}
