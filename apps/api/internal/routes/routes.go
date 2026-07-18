package routes

import (
	"context"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/MUKE-coder/gin-docs/gindocs"
	"github.com/MUKE-coder/gorm-studio/studio"
	"github.com/MUKE-coder/pulse/pulse"
	sentinel "github.com/MUKE-coder/sentinel/v2"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"myorg/apps/api/internal/ai"
	"myorg/apps/api/internal/cache"
	"myorg/apps/api/internal/config"
	"myorg/apps/api/internal/handlers"
	"myorg/apps/api/internal/mail"
	"myorg/apps/api/internal/middleware"
	"myorg/apps/api/internal/models"
	"myorg/apps/api/internal/jobs"
	"myorg/apps/api/internal/realtime"
	"myorg/apps/api/internal/services"
	"myorg/apps/api/internal/storage"
	"myorg/apps/api/internal/flags"
	"myorg/apps/api/internal/sync"
	"myorg/apps/api/internal/webhooks"
)

// Services holds all Phase 4 services for dependency injection.
type Services struct {
	Cache   *cache.Cache
	Storage *storage.Storage
	Mailer  *mail.Mailer
	AI      *ai.AI
	Jobs    *jobs.Client
	// SecObsBridge talks to Sentinel + Pulse over loopback so the
	// in-app Security/Observability dashboards can show summary cards
	// without iframing. Nil when Sentinel/Pulse are both disabled.
	SecObs  *services.SecObsBridge
}

// Setup configures all routes and returns the Gin engine.
func Setup(db *gorm.DB, cfg *config.Config, svc *Services) *gin.Engine {
	if cfg.AppEnv == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()

	// Global middleware
	r.Use(middleware.Maintenance())
	r.Use(middleware.SecurityHeaders())
	r.Use(middleware.MaxBodySize(10 << 20)) // 10MB max request body
	r.Use(middleware.RequestID())
	r.Use(middleware.Logger())
	r.Use(gin.Recovery())
	r.Use(middleware.CORS(cfg.CORSOrigins))
	r.Use(middleware.Gzip())

	// CSRF defence — only enforces on cookie-authenticated mutations.
	// Bearer (mobile/desktop) flows pass through with no header required.
	// Pairs with services.AuthService.SetAuthCookies (the HttpOnly cookie
	// path documented in /docs/backend/authentication).
	r.Use(middleware.AutoCSRF())

	// Idempotent retries for unsafe methods. Activates only when the client
	// sends an Idempotency-Key header; cached for 24h on 2xx responses.
	r.Use(middleware.Idempotency(svc.Cache))

	// Mount Sentinel security suite (WAF, rate limiting, auth shield, anomaly detection)
	if cfg.SentinelEnabled {
		// In development, use relaxed rate limits so devs don't get blocked while testing
		isDev := cfg.AppEnv == "development"
		ipLimit := &sentinel.Limit{Requests: 100, Window: 1 * time.Minute}
		routeLimits := map[string]sentinel.Limit{
			"/api/auth/login":    {Requests: 5, Window: 15 * time.Minute},
			"/api/auth/register": {Requests: 3, Window: 15 * time.Minute},
		}
		if isDev {
			ipLimit = &sentinel.Limit{Requests: 1000, Window: 1 * time.Minute}
			routeLimits = map[string]sentinel.Limit{
				"/api/auth/login":    {Requests: 100, Window: 1 * time.Minute},
				"/api/auth/register": {Requests: 100, Window: 1 * time.Minute},
			}
		}

		// Sentinel persists its security data (threat log, blocked IPs,
		// audit trail) through its own storage adapter, NOT the *gorm.DB we
		// pass in. Left unset it silently falls back to a local sentinel.db
		// SQLite file — which is ephemeral inside a container, so every
		// redeploy would drop the threat log and the blocked-IP list. Point
		// it at the same database the app uses when that's Postgres.
		sentinelStorage := sentinel.StorageConfig{Driver: sentinel.SQLite, DSN: "sentinel.db"}
		if !strings.HasPrefix(cfg.DatabaseURL, "sqlite:") {
			sentinelStorage = sentinel.StorageConfig{Driver: sentinel.Postgres, DSN: cfg.DatabaseURL}
		}

		// Sentinel v2 — use MountE so we can recover gracefully on
		// misconfiguration in dev instead of log.Fatalf-ing the host.
		// Mount runs sentinel.ValidateConfig and logs any dead config.
		if err := sentinel.MountE(r, db, sentinel.Config{
			Storage: sentinelStorage,
			Dashboard: sentinel.DashboardConfig{
				Username:               cfg.SentinelUsername,
				Password:               cfg.SentinelPassword,
				SecretKey:              cfg.SentinelSecretKey,
				// Sentinel refuses default credentials in gin.ReleaseMode;
				// opt-in only for dev so prod can't ship forgeable JWTs.
				AllowInsecureDefaults:  isDev,
			},
			WAF: sentinel.WAFConfig{
				Enabled: true,
				Mode: func() sentinel.WAFMode {
					if isDev { return sentinel.ModeLog }
					return sentinel.ModeBlock
				}(),
				// v2.0 X-Forwarded-For trust closed. Empty list = ignore
				// XFF entirely (the safe default). Operators behind a known
				// reverse proxy should populate via SENTINEL_TRUSTED_PROXIES.
				TrustedProxies:        cfg.SentinelTrustedProxies,
				// 1 MB cap covers richtext admin payloads — Tiptap blog
				// bodies with embedded inline images comfortably exceed
				// the prior 64 KB ceiling. Bump higher if your content
				// embeds large base64 images.
				MaxBodyBytes:          1 * 1024 * 1024,
				RejectOversizedBody:   true,
				// Authenticated admin write endpoints handle their own
				// HTML/richtext payloads via Tiptap. The WAF's XSS detection
				// otherwise flags every <p>/<strong>/<img> tag in a blog
				// body as a payload. These routes still pass through auth
				// + RBAC + binding validation; WAF is just stepped aside
				// for their bodies.
				//
				// IMPORTANT: the WAF matches these against the real request
				// path (c.Request.URL.Path), NOT gin's route template. Gin
				// params like "/api/blogs/:id" therefore match only the
				// literal string ":id" and never "/api/blogs/123" — they
				// were silent dead config. Use "/*" (a subtree match) so the
				// id/token routes are actually excluded.
				ExcludeRoutes: []string{
					"/api/posts",
					"/api/posts/*",
					"/api/articles",
					"/api/articles/*",
					"/api/announcements",
					"/api/announcements/*",
					"/api/letters",
					"/api/letters/*",
					"/api/uploads",
					// v3.31.20 — public form-share submissions. Auth is
					// the share's bcrypt password (optional) and the
					// token itself; Sentinel rate-limits the path. The
					// subtree match also covers .../submit.
					"/api/public/forms/*",
				},
			},
			RateLimit: sentinel.RateLimitConfig{
				Enabled: !isDev,
				ByIP:    ipLimit,
				ByRoute: routeLimits,
			},
			AuthShield: sentinel.AuthShieldConfig{
				Enabled:    !isDev,
				LoginRoute: "/api/auth/login",
				// v2.0 CAPTCHA tier sits between soft and hard thresholds.
				// Wire a provider by setting CaptchaProvider in your app code.
			},
			Anomaly: sentinel.AnomalyConfig{Enabled: !isDev},
			Geo:     sentinel.GeoConfig{Enabled: !isDev},
		}); err != nil {
			log.Printf("Warning: Sentinel mount failed: %v", err)
		} else {
			log.Println("Sentinel v2.2.0 mounted at /sentinel")
		}
	}

	// Mount GORM Studio
	if cfg.GORMStudioEnabled {
		studioCfg := studio.Config{
			Prefix: "/studio",
		}
		if cfg.GORMStudioUsername != "" && cfg.GORMStudioPassword != "" {
			studioCfg.AuthMiddleware = gin.BasicAuth(gin.Accounts{
				cfg.GORMStudioUsername: cfg.GORMStudioPassword,
			})
		}
		studio.Mount(r, db, []interface{}{&models.User{}, &models.Upload{}, &models.Division{}, &models.Role{}, &models.Permission{}, &models.RolePermission{}, &models.OrganizationSetting{}, &models.Event{}, &models.Attendance{}, &models.PermissionRequest{}, &models.Violation{}, &models.Recruitment{}, &models.RecruitmentTargetDivision{}, &models.RecruitmentCustomField{}, &models.RecruitmentSubmission{}, &models.LetterCategory{}, &models.Letter{}, &models.Announcement{}, &models.AnnouncementAttachment{}, &models.LetterTemplate{}, &models.FinanceCategory{}, &models.FinanceTransaction{}, &models.EventCommitteeSie{}, &models.EventCommitteeMember{}, &models.EventSubEvent{}, &models.SubEventAttendance{}, /* grit:studio */}, studioCfg)
		log.Println("GORM Studio mounted at /studio")
	}

	// API Documentation (gin-docs — auto-generated from routes + models)
	gindocs.Mount(r, db, gindocs.Config{
		Title:       cfg.AppName + " API",
		Description: "REST API built with [Grit](https://gritframework.dev) — Go + React meta-framework.",
		Version:     "1.0.0",
		UI:          gindocs.UIScalar,
		ScalarTheme: "kepler",
		Models:      []interface{}{&models.User{}, &models.Upload{}},
		Auth: gindocs.AuthConfig{
			Type:         gindocs.AuthBearer,
			BearerFormat: "JWT",
		},
	})
	log.Println("API docs available at /docs")

	// Mount Pulse observability (request tracing, DB monitoring, runtime metrics, error tracking)
	if cfg.PulseEnabled {
		// Pulse v1.0 uses functional options + a context. The context
		// drives clean shutdown of the dashboard's WebSocket + background
		// samplers; we hand it the request context so a server shutdown
		// also unwinds Pulse.
		pulseOpts := []pulse.Option{
			pulse.WithAppName(cfg.AppName),
			pulse.WithCredentials(cfg.PulseUsername, cfg.PulsePassword),
			pulse.WithExcludePaths("/studio/*", "/sentinel/*", "/docs/*", "/pulse/*"),
			pulse.WithPrometheus(),
			// CRITICAL: Pulse's error middleware captures a request-body snippet
			// (MaxBodySize, default 4096) for error context, but restores ONLY
			// that snippet to the request — it discards everything past 4096
			// bytes. That truncates EVERY request carrying a Content-Length
			// (mobile / native / curl clients; browsers dodge it by sending
			// chunked), silently breaking file uploads and any large JSON POST.
			// Disable body capture so the full body always reaches the handler.
			pulse.WithRequestBodyCaptureDisabled(),
		}
		if cfg.IsDevelopment() {
			pulseOpts = append(pulseOpts, pulse.WithDevMode())
		}
		// Pulse v1.0 SQLite-backed storage — request/query/error data
		// survives a restart. Stay on the in-memory ring buffer for peak
		// write throughput.
		if cfg.PulseStorage == "sqlite" && cfg.PulseStorageDSN != "" {
			pulseOpts = append(pulseOpts, pulse.WithSQLite(cfg.PulseStorageDSN))
		}
		p := pulse.Mount(context.Background(), r, db, pulseOpts...)

		// Register health checks for connected services
		if svc.Cache != nil {
			p.AddHealthCheck(pulse.HealthCheck{
				Name:     "redis",
				Type:     "redis",
				Critical: false,
				CheckFunc: func(ctx context.Context) error {
					return svc.Cache.Client().Ping(ctx).Err()
				},
			})
		}

		log.Println("Pulse observability mounted at /pulse")
	}

	// Auth service
	authService := &services.AuthService{
		Secret:        cfg.JWTSecret,
		AccessExpiry:  cfg.JWTAccessExpiry,
		RefreshExpiry: cfg.JWTRefreshExpiry,
	}

	// Handlers
	authHandler := &handlers.AuthHandler{
		DB:          db,
		AuthService: authService,
		Config:      cfg,
	}
	userHandler := &handlers.UserHandler{
		DB:          db,
		AuthService: authService,
	}
	uploadHandler := &handlers.UploadHandler{
		DB:      db,
		Storage: svc.Storage,
		Jobs:    svc.Jobs,
	}
	aiHandler := &handlers.AIHandler{
		AI: svc.AI,
	}
	jobsHandler := &handlers.JobsHandler{
		RedisURL: cfg.RedisURL,
	}
	cronHandler := &handlers.CronHandler{}
	totpHandler := &handlers.TOTPHandler{
		DB:          db,
		AuthService: authService,
		Issuer:      cfg.TOTPIssuer,
	}
	activityHandler := handlers.NewActivityHandler(db)
	webhookHandler := handlers.NewWebhookHandler(db)
	webhooks.Setup(db)
	realtimeHub := realtime.NewHub()
	flagsEngine := flags.New(db, realtimeHub)
	featureFlagHandler := handlers.NewFeatureFlagHandler(db, flagsEngine)
	realtimeHandler := handlers.NewRealtimeHandler(realtimeHub, authService)
	_ = realtimeHub // available to handlers/services that want to push events

	// In-app Security + Observability dashboards — read from Sentinel/Pulse APIs
	// over loopback. notificationHandler powers the admin bell.
	notificationHandler := &handlers.NotificationHandler{DB: db}
	pushService := &services.PushService{
		DB:              db,
		VAPIDPublicKey:  cfg.VAPIDPublicKey,
		VAPIDPrivateKey: cfg.VAPIDPrivateKey,
		VAPIDSubject:    cfg.VAPIDSubject,
		WebAppURL:       cfg.WebAppURL,
	}
	pushHandler := &handlers.PushHandler{DB: db, Push: pushService}
	securityHandler := &handlers.SecurityHandler{Bridge: svc.SecObs}
	observabilityHandler := &handlers.ObservabilityHandler{Bridge: svc.SecObs}

	// v3.30 — semantic activity log + ticket system. Mailer is optional;
	// when nil the ticket handler skips email-out and only writes the row
	// + admin notifications.
	userActivityHandler := &handlers.UserActivityHandler{DB: db}
	ticketHandler := &handlers.TicketHandler{DB: db, Mail: svc.Mailer}
	// v3.31.20 — public form sharing (Phase 2)
	formShareHandler := &handlers.FormShareHandler{DB: db}
	// v3.31.40 — per-user dashboard customisation
	dashboardLayoutHandler := &handlers.DashboardLayoutHandler{DB: db}
	// v3.31.44 — per-resource dashboard stats (Total + sparkline + Latest N)
	resourceStatsHandler := &handlers.ResourceStatsHandler{DB: db}
	// v3.31.47 — Preset Chart builder
	chartHandler := &handlers.ChartHandler{DB: db}

	// Sync registry — list every model that should be syncable from
	// offline-first desktop clients. The resource generator injects
	// new resources at the marker below.
	syncRegistry := sync.NewRegistry()
	syncRegistry.Register("users", &models.User{})
	syncRegistry.Register("uploads", &models.Upload{})
	syncRegistry.Register("divisions", &models.Division{})
	syncRegistry.Register("roles", &models.Role{})
	syncRegistry.Register("permissions", &models.Permission{})
	syncRegistry.Register("role_permissions", &models.RolePermission{})
	syncRegistry.Register("organization_settings", &models.OrganizationSetting{})
	syncRegistry.Register("events", &models.Event{})
	syncRegistry.Register("attendances", &models.Attendance{})
	syncRegistry.Register("permission_requests", &models.PermissionRequest{})
	syncRegistry.Register("violations", &models.Violation{})
	syncRegistry.Register("recruitments", &models.Recruitment{})
	syncRegistry.Register("recruitment_target_divisions", &models.RecruitmentTargetDivision{})
	syncRegistry.Register("recruitment_custom_fields", &models.RecruitmentCustomField{})
	syncRegistry.Register("recruitment_submissions", &models.RecruitmentSubmission{})
	syncRegistry.Register("letter_categories", &models.LetterCategory{})
	syncRegistry.Register("letters", &models.Letter{})
	syncRegistry.Register("announcements", &models.Announcement{})
	syncRegistry.Register("announcement_attachments", &models.AnnouncementAttachment{})
	syncRegistry.Register("letter_templates", &models.LetterTemplate{})
	syncRegistry.Register("finance_categories", &models.FinanceCategory{})
	syncRegistry.Register("finance_transactions", &models.FinanceTransaction{})
	syncRegistry.Register("event_committee_sies", &models.EventCommitteeSie{})
	syncRegistry.Register("event_committee_members", &models.EventCommitteeMember{})
	syncRegistry.Register("event_sub_events", &models.EventSubEvent{})
	syncRegistry.Register("sub_event_attendances", &models.SubEventAttendance{})
	// grit:sync
	syncHandler := handlers.NewSyncHandler(db, syncRegistry)
	// v3.31.68 — shared background CSV import status endpoint
	importJobHandler := &handlers.ImportJobHandler{DB: db}
	// v3.31.77 — full-database backups (weekly cron + manual + download)
	backupHandler := &handlers.BackupHandler{DB: db, Storage: svc.Storage}
	divisionHandler := &handlers.DivisionHandler{
		DB: db,
	}
	roleHandler := &handlers.RoleHandler{
		DB: db,
	}
	permissionHandler := &handlers.PermissionHandler{
		DB: db,
	}
	rolePermissionHandler := &handlers.RolePermissionHandler{
		DB:      db,
		Service: &services.RolePermissionService{DB: db},
	}
	organizationSettingHandler := &handlers.OrganizationSettingHandler{
		DB: db,
	}
	eventHandler := &handlers.EventHandler{
		DB: db,
	}
	attendanceHandler := &handlers.AttendanceHandler{
		DB: db,
	}
	permissionRequestHandler := &handlers.PermissionRequestHandler{
		DB: db,
	}
	violationHandler := &handlers.ViolationHandler{
		DB: db,
	}
	recruitmentHandler := &handlers.RecruitmentHandler{
		DB: db,
	}
	recruitmentTargetDivisionHandler := &handlers.RecruitmentTargetDivisionHandler{
		DB: db,
	}
	recruitmentCustomFieldHandler := &handlers.RecruitmentCustomFieldHandler{
		DB: db,
	}
	recruitmentSubmissionHandler := &handlers.RecruitmentSubmissionHandler{
		DB: db,
	}
	letterCategoryHandler := &handlers.LetterCategoryHandler{
		DB: db,
	}
	letterHandler := &handlers.LetterHandler{
		DB: db,
		Letters: &services.LetterService{
			DB:      db,
			Storage: svc.Storage,
		},
	}
	announcementHandler := &handlers.AnnouncementHandler{
		DB:   db,
		Jobs: svc.Jobs,
	}
	announcementAttachmentHandler := &handlers.AnnouncementAttachmentHandler{
		DB: db,
	}
	letterTemplateHandler := &handlers.LetterTemplateHandler{
		DB:      db,
		Letters: &services.LetterService{DB: db, Storage: svc.Storage},
	}
	financeCategoryHandler := &handlers.FinanceCategoryHandler{
		DB: db,
	}
	financeTransactionHandler := &handlers.FinanceTransactionHandler{
		DB: db,
	}
	eventCommitteeSieHandler := &handlers.EventCommitteeSieHandler{
		DB: db,
	}
	eventCommitteeMemberHandler := &handlers.EventCommitteeMemberHandler{
		DB: db,
	}
	eventSubEventHandler := &handlers.EventSubEventHandler{
		DB: db,
	}
	subEventAttendanceHandler := &handlers.SubEventAttendanceHandler{
		DB: db,
	}
	// grit:handlers

	permChecker := services.NewPermissionChecker(db)
	myorgHandler := &handlers.MyOrgHandler{
		DB:                   db,
		OrgSettings:          &services.OrganizationSettingService{DB: db},
		Events:               &services.EventService{DB: db},
		Attendances:          &services.AttendanceService{DB: db},
		PermissionRequests:   &services.PermissionRequestService{DB: db},
		Recruitments:         &services.RecruitmentService{DB: db},
		RecruitmentFields:    &services.RecruitmentCustomFieldService{DB: db},
		RecruitmentSubmitSvc: &services.RecruitmentSubmissionService{DB: db},
		Permissions:          permChecker,
		Uploads:                uploadHandler,
	}
	_ = permChecker

	// Health check
	// /api/health probes every infrastructure dependency the dashboard's
	// System Health page wants to render. Each probe is bounded by a 500ms
	// timeout so a hung dependency doesn't pile up health requests; failing
	// probes mark themselves down and the overall status downgrades to
	// "degraded" rather than failing the endpoint.
	r.GET("/api/health", func(c *gin.Context) {
		type compStatus struct {
			OK         bool   `json:"ok"`
			LatencyMS  int64  `json:"latency_ms,omitempty"`
			Tables     int    `json:"tables,omitempty"`
			QueueKeys  int    `json:"queue_keys,omitempty"`
			Configured bool   `json:"configured,omitempty"`
			Error      string `json:"error,omitempty"`
		}

		// Database ping + table count. We probe with a 500ms deadline so a
		// blocked write loop can't hang the health check.
		dbStatus := compStatus{OK: true}
		dbStart := time.Now()
		if sqlDB, err := db.DB(); err == nil {
			ctx, cancel := context.WithTimeout(c.Request.Context(), 500*time.Millisecond)
			defer cancel()
			if err := sqlDB.PingContext(ctx); err != nil {
				dbStatus.OK = false
				dbStatus.Error = err.Error()
			}
		}
		dbStatus.LatencyMS = time.Since(dbStart).Milliseconds()
		if dbStatus.OK {
			// Best-effort table count — failure is non-fatal and just drops
			// the "tables: N" tooltip on the health card.
			var count int
			db.Raw("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = current_schema()").Scan(&count)
			dbStatus.Tables = count
		}

		// Redis ping. Reuse the same cache client the rest of the app uses
		// rather than opening a new connection — that way "Redis healthy"
		// on the dashboard means the same Redis the cache + jobs use.
		redisStatus := compStatus{}
		if svc.Cache != nil {
			redisStart := time.Now()
			ctx, cancel := context.WithTimeout(c.Request.Context(), 500*time.Millisecond)
			defer cancel()
			if err := svc.Cache.Client().Ping(ctx).Err(); err != nil {
				redisStatus.OK = false
				redisStatus.Error = err.Error()
			} else {
				redisStatus.OK = true
			}
			redisStatus.LatencyMS = time.Since(redisStart).Milliseconds()
		}

		// Background-jobs queue — count active asynq keys as a liveness
		// signal. If asynq isn't wired (Jobs == nil), report unconfigured
		// rather than "down" so the dashboard distinguishes the cases.
		jobsStatus := compStatus{}
		if svc.Jobs != nil && svc.Cache != nil {
			ctx, cancel := context.WithTimeout(c.Request.Context(), 500*time.Millisecond)
			defer cancel()
			n, err := svc.Cache.Client().Eval(ctx,
				"local total = 0\nfor _, k in ipairs(redis.call('keys', 'asynq:*')) do total = total + 1 end\nreturn total",
				[]string{}).Int()
			if err == nil {
				jobsStatus.OK = true
				jobsStatus.QueueKeys = n
			} else {
				// Fall back to a simple ping so a "no keys yet" install still
				// reports OK rather than down.
				if perr := svc.Cache.Client().Ping(ctx).Err(); perr == nil {
					jobsStatus.OK = true
				}
			}
		}

		// Email is "configured" when Resend key is set + non-default. The
		// dashboard treats unconfigured as "—" not "down".
		mailStatus := compStatus{
			Configured: cfg.ResendAPIKey != "" && cfg.ResendAPIKey != "re_your_api_key",
			OK:         cfg.ResendAPIKey != "" && cfg.ResendAPIKey != "re_your_api_key",
		}

		// Overall status — ok if every wired-up component is up. Components
		// that aren't configured (e.g. Redis off in a single-binary dev
		// run) don't drag the overall status down.
		overall := "ok"
		if !dbStatus.OK || (svc.Cache != nil && !redisStatus.OK) {
			overall = "degraded"
		}

		c.JSON(http.StatusOK, gin.H{
			"status":   overall,
			"version":  "0.1.0",
			"database": dbStatus,
			"redis":    redisStatus,
			"api":      compStatus{OK: true},
			"jobs":     jobsStatus,
			"email":    mailStatus,
		})
	})

	// WebSocket: realtime hub. Auth via ?token=<jwt> on the handshake
	// because browsers can't set custom headers on WS upgrade.
	r.GET("/api/ws", realtimeHandler.Connect)

	// Public webhook receiver — no auth on the route itself; each
	// provider's signature verification is the real auth boundary.
	// POST /webhooks/:provider routes to whatever was registered via
	// webhooks.Register(...) at app boot.
	r.POST("/webhooks/:provider", webhookHandler.Receive)


	// Public auth routes
	auth := r.Group("/api/auth")
	{
		auth.POST("/register", authHandler.Register)
		auth.POST("/login", authHandler.Login)
		auth.POST("/refresh", authHandler.Refresh)
		auth.POST("/forgot-password", authHandler.ForgotPassword)
		auth.POST("/reset-password", authHandler.ResetPassword)
	}

	// OAuth2 social login
	oauth := auth.Group("/oauth")
	{
		oauth.GET("/:provider", authHandler.OAuthBegin)
		oauth.GET("/:provider/callback", authHandler.OAuthCallback)
	}

	// TOTP verification (public — uses pending tokens, not JWT)
	auth.POST("/totp/verify", totpHandler.Verify)
	auth.POST("/totp/backup-codes/verify", totpHandler.VerifyBackupCode)

	// Protected routes
	protected := r.Group("/api")
	protected.Use(middleware.Auth(db, authService))
	// Activity logger writes one row per successful authenticated mutation.
	// Records who/what/when/where for audit. Read-only — see admin/activity.
	protected.Use(middleware.ActivityLogger(db))
	{
		protected.GET("/auth/me", authHandler.Me)
		protected.POST("/auth/logout", authHandler.Logout)

		// Two-Factor Authentication (TOTP)
		protected.POST("/auth/totp/setup", totpHandler.Setup)
		protected.POST("/auth/totp/enable", totpHandler.Enable)
		protected.POST("/auth/totp/disable", totpHandler.Disable)
		protected.GET("/auth/totp/status", totpHandler.Status)
		protected.POST("/auth/totp/backup-codes", totpHandler.RegenerateBackupCodes)
		protected.DELETE("/auth/totp/trusted-devices", totpHandler.RevokeTrustedDevices)

		// User routes (authenticated)
		protected.GET("/users/:id", userHandler.GetByID)

		// File uploads
		protected.POST("/uploads", uploadHandler.Create)
		protected.POST("/uploads/presign", uploadHandler.Presign)
		protected.POST("/uploads/complete", uploadHandler.CompleteUpload)
		protected.GET("/uploads", uploadHandler.List)
		protected.GET("/uploads/stats", uploadHandler.Stats)
		protected.GET("/uploads/:id", uploadHandler.GetByID)
		protected.DELETE("/uploads/:id", uploadHandler.Delete)

		// Offline-first sync — desktop clients call these to flush their
		// local outbox and pull server-side updates.
		protected.POST("/sync/push", syncHandler.Push)
		protected.GET("/sync/pull", syncHandler.Pull)

		// AI
		protected.POST("/ai/complete", aiHandler.Complete)
		protected.POST("/ai/chat", aiHandler.Chat)
		protected.POST("/ai/stream", aiHandler.Stream)


		// In-app notification bell — every authenticated user. Pulls
		// from a single Notification table that the SecObs poller
		// writes into when Sentinel/Pulse fires a high-severity event.
		protected.GET("/notifications", notificationHandler.List)
		protected.POST("/notifications/:id/read", notificationHandler.MarkRead)
		protected.POST("/notifications/read-all", notificationHandler.MarkAllRead)

		protected.GET("/push/vapid-public-key", pushHandler.VapidPublicKey)
		protected.POST("/push/subscribe", pushHandler.Subscribe)
		protected.DELETE("/push/subscribe", pushHandler.Unsubscribe)

		// v3.31.40 — per-user dashboard layout customisation.
		protected.GET("/dashboard-layout", dashboardLayoutHandler.Get)
		protected.PUT("/dashboard-layout", dashboardLayoutHandler.Put)

		// v3.30 — tickets. Any authenticated user can open + reply; the
		// handler scopes List/Get visibility to the caller unless they're
		// ADMIN/EDITOR (then they see the full queue).
		protected.POST("/tickets", ticketHandler.Create)
		protected.GET("/tickets", ticketHandler.List)
		protected.GET("/tickets/:id", ticketHandler.Get)
		protected.POST("/tickets/:id/reply", ticketHandler.Reply)
		protected.PATCH("/tickets/:id/close", ticketHandler.Close)
		protected.PATCH("/tickets/:id/reopen", ticketHandler.Reopen)
		protected.PATCH("/tickets/:id/assign", ticketHandler.Assign) // admin-gated inside the handler

		// v3.31.68 — poll a background CSV import's progress/result.
		protected.GET("/imports/:id", importJobHandler.GetByID)

		protected.GET("/divisions", divisionHandler.List)
		protected.GET("/divisions/export", divisionHandler.Export)
		protected.POST("/divisions/import", divisionHandler.Import)
		protected.GET("/divisions/import/template", divisionHandler.Template)
		protected.GET("/divisions/:id", divisionHandler.GetByID)
		protected.POST("/divisions", divisionHandler.Create)
		protected.PUT("/divisions/:id", divisionHandler.Update)
		protected.PATCH("/divisions/:id", divisionHandler.Patch)
		protected.GET("/roles", roleHandler.List)
		protected.GET("/roles/export", roleHandler.Export)
		protected.POST("/roles/import", roleHandler.Import)
		protected.GET("/roles/import/template", roleHandler.Template)
		protected.GET("/roles/:id", roleHandler.GetByID)
		protected.POST("/roles", roleHandler.Create)
		protected.PUT("/roles/:id", roleHandler.Update)
		protected.PATCH("/roles/:id", roleHandler.Patch)
		protected.GET("/permissions", permissionHandler.List)
		protected.GET("/permissions/export", permissionHandler.Export)
		protected.POST("/permissions/import", permissionHandler.Import)
		protected.GET("/permissions/import/template", permissionHandler.Template)
		protected.GET("/permissions/:id", permissionHandler.GetByID)
		protected.POST("/permissions", permissionHandler.Create)
		protected.PUT("/permissions/:id", permissionHandler.Update)
		protected.PATCH("/permissions/:id", permissionHandler.Patch)
		protected.GET("/role_permissions", rolePermissionHandler.List)
		protected.GET("/role_permissions/export", rolePermissionHandler.Export)
		protected.POST("/role_permissions/import", rolePermissionHandler.Import)
		protected.GET("/role_permissions/import/template", rolePermissionHandler.Template)
		protected.GET("/role_permissions/:id", rolePermissionHandler.GetByID)
		protected.POST("/role_permissions", rolePermissionHandler.Create)
		protected.PUT("/role_permissions/:id", rolePermissionHandler.Update)
		protected.PATCH("/role_permissions/:id", rolePermissionHandler.Patch)
		protected.GET("/organization_settings", organizationSettingHandler.List)
		protected.GET("/organization_settings/export", organizationSettingHandler.Export)
		protected.POST("/organization_settings/import", organizationSettingHandler.Import)
		protected.GET("/organization_settings/import/template", organizationSettingHandler.Template)
		protected.GET("/organization_settings/:id", organizationSettingHandler.GetByID)
		protected.POST("/organization_settings", organizationSettingHandler.Create)
		protected.PUT("/organization_settings/:id", organizationSettingHandler.Update)
		protected.PATCH("/organization_settings/:id", organizationSettingHandler.Patch)
		protected.GET("/events", eventHandler.List)
		protected.GET("/events/export", eventHandler.Export)
		protected.POST("/events/import", eventHandler.Import)
		protected.GET("/events/import/template", eventHandler.Template)
		protected.GET("/events/:id", eventHandler.GetByID)
		// Event mutations are registered below with RequirePermission (MyOrg RBAC).
		protected.GET("/attendances", attendanceHandler.List)
		protected.GET("/attendances/export", attendanceHandler.Export)
		protected.POST("/attendances/import", attendanceHandler.Import)
		protected.GET("/attendances/import/template", attendanceHandler.Template)
		protected.GET("/attendances/:id", attendanceHandler.GetByID)
		protected.POST("/attendances", attendanceHandler.Create)
		protected.PUT("/attendances/:id", attendanceHandler.Update)
		protected.PATCH("/attendances/:id", attendanceHandler.Patch)
		protected.GET("/permission_requests", permissionRequestHandler.List)
		protected.GET("/permission_requests/export", permissionRequestHandler.Export)
		protected.POST("/permission_requests/import", permissionRequestHandler.Import)
		protected.GET("/permission_requests/import/template", permissionRequestHandler.Template)
		protected.GET("/permission_requests/:id", permissionRequestHandler.GetByID)
		protected.POST("/permission_requests", permissionRequestHandler.Create)
		protected.PUT("/permission_requests/:id", permissionRequestHandler.Update)
		protected.PATCH("/permission_requests/:id", permissionRequestHandler.Patch)
		protected.GET("/violations", violationHandler.List)
		protected.GET("/violations/export", violationHandler.Export)
		protected.POST("/violations/import", violationHandler.Import)
		protected.GET("/violations/import/template", violationHandler.Template)
		protected.GET("/violations/:id", violationHandler.GetByID)
		protected.POST("/violations", violationHandler.Create)
		protected.PUT("/violations/:id", violationHandler.Update)
		protected.PATCH("/violations/:id", violationHandler.Patch)
		protected.GET("/recruitments", recruitmentHandler.List)
		protected.GET("/recruitments/export", recruitmentHandler.Export)
		protected.POST("/recruitments/import", recruitmentHandler.Import)
		protected.GET("/recruitments/import/template", recruitmentHandler.Template)
		protected.GET("/recruitments/:id", recruitmentHandler.GetByID)
		protected.POST("/recruitments", recruitmentHandler.Create)
		protected.PUT("/recruitments/:id", recruitmentHandler.Update)
		protected.PATCH("/recruitments/:id", recruitmentHandler.Patch)
		protected.GET("/recruitment_target_divisions", recruitmentTargetDivisionHandler.List)
		protected.GET("/recruitment_target_divisions/export", recruitmentTargetDivisionHandler.Export)
		protected.POST("/recruitment_target_divisions/import", recruitmentTargetDivisionHandler.Import)
		protected.GET("/recruitment_target_divisions/import/template", recruitmentTargetDivisionHandler.Template)
		protected.GET("/recruitment_target_divisions/:id", recruitmentTargetDivisionHandler.GetByID)
		protected.POST("/recruitment_target_divisions", recruitmentTargetDivisionHandler.Create)
		protected.PUT("/recruitment_target_divisions/:id", recruitmentTargetDivisionHandler.Update)
		protected.PATCH("/recruitment_target_divisions/:id", recruitmentTargetDivisionHandler.Patch)
		protected.GET("/recruitment_custom_fields", recruitmentCustomFieldHandler.List)
		protected.GET("/recruitment_custom_fields/export", recruitmentCustomFieldHandler.Export)
		protected.POST("/recruitment_custom_fields/import", recruitmentCustomFieldHandler.Import)
		protected.GET("/recruitment_custom_fields/import/template", recruitmentCustomFieldHandler.Template)
		protected.GET("/recruitment_custom_fields/:id", recruitmentCustomFieldHandler.GetByID)
		protected.POST("/recruitment_custom_fields", recruitmentCustomFieldHandler.Create)
		protected.PUT("/recruitment_custom_fields/:id", recruitmentCustomFieldHandler.Update)
		protected.PATCH("/recruitment_custom_fields/:id", recruitmentCustomFieldHandler.Patch)
		protected.GET("/recruitment_submissions", recruitmentSubmissionHandler.List)
		protected.GET("/recruitment_submissions/export", recruitmentSubmissionHandler.Export)
		protected.POST("/recruitment_submissions/import", recruitmentSubmissionHandler.Import)
		protected.GET("/recruitment_submissions/import/template", recruitmentSubmissionHandler.Template)
		protected.GET("/recruitment_submissions/:id", recruitmentSubmissionHandler.GetByID)
		protected.POST("/recruitment_submissions", recruitmentSubmissionHandler.Create)
		protected.PUT("/recruitment_submissions/:id", recruitmentSubmissionHandler.Update)
		protected.PATCH("/recruitment_submissions/:id", recruitmentSubmissionHandler.Patch)
		protected.GET("/letter_categories", letterCategoryHandler.List)
		protected.GET("/letter_categories/export", letterCategoryHandler.Export)
		protected.POST("/letter_categories/import", letterCategoryHandler.Import)
		protected.GET("/letter_categories/import/template", letterCategoryHandler.Template)
		protected.GET("/letter_categories/:id", letterCategoryHandler.GetByID)
		protected.POST("/letter_categories", letterCategoryHandler.Create)
		protected.PUT("/letter_categories/:id", letterCategoryHandler.Update)
		protected.PATCH("/letter_categories/:id", letterCategoryHandler.Patch)
		protected.GET("/letters", letterHandler.List)
		protected.GET("/letters/export", letterHandler.Export)
		protected.POST("/letters/import", letterHandler.Import)
		protected.GET("/letters/import/template", letterHandler.Template)
		protected.POST("/letters/parse-incoming", letterHandler.ParseIncoming)
		protected.GET("/letters/:id", letterHandler.GetByID)
		protected.GET("/letters/:id/download", letterHandler.Download)
		protected.POST("/letters", letterHandler.Create)
		protected.PUT("/letters/:id", letterHandler.Update)
		protected.PATCH("/letters/:id", letterHandler.Patch)
		protected.DELETE("/letters/:id", letterHandler.Delete)
		protected.GET("/announcements", announcementHandler.List)
		protected.GET("/announcements/export", announcementHandler.Export)
		protected.POST("/announcements/import", announcementHandler.Import)
		protected.GET("/announcements/import/template", announcementHandler.Template)
		protected.GET("/announcements/:id", announcementHandler.GetByID)
		protected.POST("/announcements", announcementHandler.Create)
		protected.PUT("/announcements/:id", announcementHandler.Update)
		protected.PATCH("/announcements/:id", announcementHandler.Patch)
		protected.GET("/announcement_attachments", announcementAttachmentHandler.List)
		protected.GET("/announcement_attachments/export", announcementAttachmentHandler.Export)
		protected.POST("/announcement_attachments/import", announcementAttachmentHandler.Import)
		protected.GET("/announcement_attachments/import/template", announcementAttachmentHandler.Template)
		protected.GET("/announcement_attachments/:id", announcementAttachmentHandler.GetByID)
		protected.POST("/announcement_attachments", announcementAttachmentHandler.Create)
		protected.PUT("/announcement_attachments/:id", announcementAttachmentHandler.Update)
		protected.PATCH("/announcement_attachments/:id", announcementAttachmentHandler.Patch)

		// MyOrg authenticated custom endpoints
		protected.GET("/me", myorgHandler.GetMe)
		protected.PUT("/me", myorgHandler.UpdateMe)
		protected.PUT("/me/password", myorgHandler.ChangeMyPassword)
		protected.GET("/me/permissions", myorgHandler.ListMyPermissions)

		// Event CRUD gated by custom App Role permissions
		eventsCreate := protected.Group("/events")
		eventsCreate.Use(middleware.RequirePermission(permChecker, "events.create"))
		eventsCreate.POST("", eventHandler.Create)

		eventsEdit := protected.Group("/events")
		eventsEdit.Use(middleware.RequirePermission(permChecker, "events.edit"))
		eventsEdit.PUT("/:id", eventHandler.Update)
		eventsEdit.PATCH("/:id", eventHandler.Patch)

		eventsDelete := protected.Group("/events")
		eventsDelete.Use(middleware.RequirePermission(permChecker, "events.delete"))
		eventsDelete.DELETE("/:id", eventHandler.Delete)

		eventRecapGroup := protected.Group("/events")
		eventRecapGroup.Use(middleware.RequirePermission(permChecker, "events.view"))
		eventRecapGroup.GET("/:id/recap", myorgHandler.EventRecap)
		eventRecapGroup.GET("/:id/committee", myorgHandler.GetEventCommitteeOverview)
		eventRecapGroup.GET("/:id/sub-events", myorgHandler.ListEventSubEvents)
		eventRecapGroup.GET("/:id/my-sub-events", myorgHandler.ListMyEventSubEvents)

		subEventView := protected.Group("/sub_events")
		subEventView.Use(middleware.RequirePermission(permChecker, "events.sub_events.view"))
		subEventView.GET("/:id/recap", myorgHandler.GetSubEventRecap)
		protected.GET("/sub_events/:id/my-attendance", myorgHandler.GetMySubEventAttendance)

		subEventSubmit := protected.Group("/sub_events")
		subEventSubmit.Use(middleware.RequirePermission(permChecker, "sub_events.attendance.submit"))
		subEventSubmit.POST("/:id/attendance", myorgHandler.SubmitSubEventAttendance)

		subEventManage := protected.Group("/sub_events")
		subEventManage.Use(middleware.RequirePermission(permChecker, "sub_events.attendance.manage"))
		subEventManage.PUT("/:id/attendance/:userId", myorgHandler.MarkSubEventAttendance)

		subEventMinutes := protected.Group("/sub_events")
		subEventMinutes.Use(middleware.RequirePermission(permChecker, "events.sub_events.manage"))
		subEventMinutes.POST("/:id/minutes", myorgHandler.UploadSubEventMinutes)
		// Own attendance lookup — any authenticated member can check whether
		// they already checked in (used to hide the Absen CTA).
		protected.GET("/events/:id/attendance", myorgHandler.GetMyAttendance)
		eventAttendanceGroup := protected.Group("/events")
		eventAttendanceGroup.Use(middleware.RequirePermission(permChecker, "attendance.submit"))
		eventAttendanceGroup.POST("/:id/attendance", myorgHandler.SubmitAttendance)
		permSubmitGroup := protected.Group("")
		permSubmitGroup.Use(middleware.RequirePermission(permChecker, "permission.submit"))
		permSubmitGroup.POST("/permission-requests", myorgHandler.CreateMyPermissionRequest)
		permSubmitGroup.GET("/permission-requests/me", myorgHandler.ListMyPermissionRequests)
		permApproveGroup := protected.Group("/attendance/permission-requests")
		permApproveGroup.Use(middleware.RequirePermission(permChecker, "attendance.approve"))
		permApproveGroup.PUT("/:id", myorgHandler.ReviewPermissionRequest)

		protected.GET("/letter_templates", letterTemplateHandler.List)
		protected.GET("/letter_templates/export", letterTemplateHandler.Export)
		protected.POST("/letter_templates/import", letterTemplateHandler.Import)
		protected.GET("/letter_templates/import/template", letterTemplateHandler.Template)
		protected.GET("/letter_templates/:id", letterTemplateHandler.GetByID)
		protected.GET("/letter_templates/:id/variables", letterTemplateHandler.Variables)
		protected.POST("/letter_templates", letterTemplateHandler.Create)
		protected.PUT("/letter_templates/:id", letterTemplateHandler.Update)
		protected.PATCH("/letter_templates/:id", letterTemplateHandler.Patch)

		financeView := protected.Group("")
		financeView.Use(middleware.RequirePermission(permChecker, "finance.view"))
		{
			financeView.GET("/finance_categories", financeCategoryHandler.List)
			financeView.GET("/finance_categories/export", financeCategoryHandler.Export)
			financeView.GET("/finance_categories/:id", financeCategoryHandler.GetByID)
			financeView.GET("/finance_transactions", financeTransactionHandler.List)
			financeView.GET("/finance_transactions/summary", financeTransactionHandler.Summary)
			financeView.GET("/finance_transactions/dashboard", financeTransactionHandler.Dashboard)
			financeView.GET("/finance_transactions/export", financeTransactionHandler.Export)
			financeView.GET("/finance_transactions/:id", financeTransactionHandler.GetByID)
		}

		financeCreate := protected.Group("")
		financeCreate.Use(middleware.RequireAnyPermission(permChecker, "finance.create", "finance.manage"))
		{
			financeCreate.POST("/finance_transactions", financeTransactionHandler.Create)
			financeCreate.POST("/finance_transactions/import", financeTransactionHandler.Import)
			financeCreate.GET("/finance_transactions/import/template", financeTransactionHandler.Template)
		}

		financeEdit := protected.Group("")
		financeEdit.Use(middleware.RequireAnyPermission(permChecker, "finance.edit", "finance.manage"))
		{
			financeEdit.PUT("/finance_transactions/:id", financeTransactionHandler.Update)
			financeEdit.PATCH("/finance_transactions/:id", financeTransactionHandler.Patch)
		}

		financeDelete := protected.Group("")
		financeDelete.Use(middleware.RequireAnyPermission(permChecker, "finance.delete", "finance.manage"))
		{
			financeDelete.DELETE("/finance_transactions/:id", financeTransactionHandler.Delete)
		}

		financeCategories := protected.Group("")
		financeCategories.Use(middleware.RequireAnyPermission(permChecker, "finance.categories", "finance.manage"))
		{
			financeCategories.POST("/finance_categories", financeCategoryHandler.Create)
			financeCategories.PUT("/finance_categories/:id", financeCategoryHandler.Update)
			financeCategories.PATCH("/finance_categories/:id", financeCategoryHandler.Patch)
			financeCategories.POST("/finance_categories/import", financeCategoryHandler.Import)
			financeCategories.GET("/finance_categories/import/template", financeCategoryHandler.Template)
			financeCategories.DELETE("/finance_categories/:id", financeCategoryHandler.Delete)
		}
		protected.GET("/event_committee_sies", eventCommitteeSieHandler.List)
		protected.GET("/event_committee_sies/export", eventCommitteeSieHandler.Export)
		protected.POST("/event_committee_sies/import", eventCommitteeSieHandler.Import)
		protected.GET("/event_committee_sies/import/template", eventCommitteeSieHandler.Template)
		protected.GET("/event_committee_sies/:id", eventCommitteeSieHandler.GetByID)
		protected.POST("/event_committee_sies", eventCommitteeSieHandler.Create)
		protected.PUT("/event_committee_sies/:id", eventCommitteeSieHandler.Update)
		protected.PATCH("/event_committee_sies/:id", eventCommitteeSieHandler.Patch)
		protected.GET("/event_committee_members", eventCommitteeMemberHandler.List)
		protected.GET("/event_committee_members/export", eventCommitteeMemberHandler.Export)
		protected.POST("/event_committee_members/import", eventCommitteeMemberHandler.Import)
		protected.GET("/event_committee_members/import/template", eventCommitteeMemberHandler.Template)
		protected.GET("/event_committee_members/:id", eventCommitteeMemberHandler.GetByID)
		protected.POST("/event_committee_members", eventCommitteeMemberHandler.Create)
		protected.PUT("/event_committee_members/:id", eventCommitteeMemberHandler.Update)
		protected.PATCH("/event_committee_members/:id", eventCommitteeMemberHandler.Patch)
		protected.GET("/event_sub_events", eventSubEventHandler.List)
		protected.GET("/event_sub_events/export", eventSubEventHandler.Export)
		protected.POST("/event_sub_events/import", eventSubEventHandler.Import)
		protected.GET("/event_sub_events/import/template", eventSubEventHandler.Template)
		protected.GET("/event_sub_events/:id", eventSubEventHandler.GetByID)
		protected.POST("/event_sub_events", eventSubEventHandler.Create)
		protected.PUT("/event_sub_events/:id", eventSubEventHandler.Update)
		protected.PATCH("/event_sub_events/:id", eventSubEventHandler.Patch)
		protected.GET("/sub_event_attendances", subEventAttendanceHandler.List)
		protected.GET("/sub_event_attendances/export", subEventAttendanceHandler.Export)
		protected.POST("/sub_event_attendances/import", subEventAttendanceHandler.Import)
		protected.GET("/sub_event_attendances/import/template", subEventAttendanceHandler.Template)
		protected.GET("/sub_event_attendances/:id", subEventAttendanceHandler.GetByID)
		protected.POST("/sub_event_attendances", subEventAttendanceHandler.Create)
		protected.PUT("/sub_event_attendances/:id", subEventAttendanceHandler.Update)
		protected.PATCH("/sub_event_attendances/:id", subEventAttendanceHandler.Patch)
		// grit:routes:protected
	}

	// Profile routes (any authenticated user)
	profile := protected.Group("/profile")
	{
		profile.GET("", userHandler.GetProfile)
		profile.PUT("", userHandler.UpdateProfile)
		profile.DELETE("", userHandler.DeleteProfile)
	}

	// Admin routes
	admin := r.Group("/api")
	admin.Use(middleware.Auth(db, authService))
	admin.Use(middleware.RequireRole("ADMIN"))
	{
		admin.GET("/users", userHandler.List)
		admin.POST("/users", userHandler.Create)
		admin.PUT("/users/:id", userHandler.Update)
		admin.DELETE("/users/:id", userHandler.Delete)

		// Activity audit log + tamper-evident chain verification
		admin.GET("/admin/activity", activityHandler.List)
		admin.GET("/admin/activity/integrity", activityHandler.VerifyIntegrity)

		// v3.30 — semantic user activity dashboard (action + IP + severity).
		// Separate from /admin/activity above which is the HTTP audit log.
		admin.GET("/user-activity", userActivityHandler.List)
		admin.GET("/user-activity/stats", userActivityHandler.Stats)

		// Webhook receiver admin (review + replay failed events)
		admin.GET("/admin/webhooks", webhookHandler.List)
		admin.POST("/admin/webhooks/:id/replay", webhookHandler.Replay)

		// Feature flags + A/B testing
		admin.GET("/admin/flags", featureFlagHandler.List)
		admin.POST("/admin/flags", featureFlagHandler.Create)
		admin.PUT("/admin/flags/:id", featureFlagHandler.Update)
		admin.DELETE("/admin/flags/:id", featureFlagHandler.Delete)
		admin.GET("/admin/flags/:id/exposures", featureFlagHandler.Exposures)

		// Admin system routes
		admin.GET("/admin/jobs/stats", jobsHandler.Stats)
		admin.GET("/admin/jobs/:status", jobsHandler.ListByStatus)
		admin.POST("/admin/jobs/:id/retry", jobsHandler.Retry)
		admin.DELETE("/admin/jobs/queue/:queue", jobsHandler.ClearQueue)
		admin.GET("/admin/cron/tasks", cronHandler.ListTasks)

		// In-app Security dashboard — aggregates Sentinel APIs into one
		// envelope so the React page does a single round-trip. Operators
		// who want to dig deeper open /sentinel/ui directly.
		admin.GET("/admin/security/summary", securityHandler.Summary)
		// In-app Observability dashboard — same pattern against Pulse.
		// Operators who want a flame graph or the full SLO timeline open
		// /pulse/ui directly.
		admin.GET("/admin/observability/summary", observabilityHandler.Summary)

		// v3.31.20 — public form sharing admin
		admin.GET("/admin/form-shares", formShareHandler.List)
		admin.POST("/admin/form-shares", formShareHandler.Create)
		admin.PATCH("/admin/form-shares/:id", formShareHandler.Update)
		admin.DELETE("/admin/form-shares/:id", formShareHandler.Delete)
		// v3.31.50 — dropdown source + field preview for the New
		// Share / Edit Share modal. Both read-only.
		admin.GET("/admin/form-shares/resources", formShareHandler.Resources)
		admin.GET("/admin/form-shares/resources/:resource/fields", formShareHandler.FieldsPreview)
		// v3.31.25 — audit log of public submissions
		admin.GET("/admin/form-submissions", formShareHandler.ListSubmissions)

		// v3.31.44 — per-resource dashboard stats: Total + 30-day
		// sparkline + Latest N. Dispatched server-side; only resources
		// registered in services/resource_stats_dispatch.go are reachable.
		admin.GET("/admin/dashboard/resource-stats/:resource", resourceStatsHandler.Get)

		// v3.31.47 — Preset Chart builder. Same dispatch boundary;
		// only resources registered in chart_dispatch.go reachable.
		admin.GET("/admin/dashboard/chart/:resource", chartHandler.Get)

		// v3.31.77 — full-database backups. Weekly cron writes them; an
		// operator can also take one on demand (rate-limited to 1/24h) and
		// download it via a short-lived pre-signed URL straight from storage.
		admin.GET("/backups", backupHandler.List)
		admin.POST("/backups/generate", backupHandler.Generate)
		admin.GET("/backups/:id/download", backupHandler.Download)
		// Separate path (not /backups/settings) so it doesn't collide with the
		// /backups/:id wildcard segment in Gin's router.
		admin.GET("/backup-settings", backupHandler.GetSettings)
		admin.PUT("/backup-settings", backupHandler.UpdateSettings)

		admin.DELETE("/divisions/:id", divisionHandler.Delete)
		admin.DELETE("/roles/:id", roleHandler.Delete)
		admin.DELETE("/permissions/:id", permissionHandler.Delete)
		admin.DELETE("/role_permissions/:id", rolePermissionHandler.Delete)
		admin.DELETE("/organization_settings/:id", organizationSettingHandler.Delete)
		// events DELETE moved to permission-gated protected routes (events.delete)
		admin.DELETE("/attendances/:id", attendanceHandler.Delete)
		admin.DELETE("/permission_requests/:id", permissionRequestHandler.Delete)
		admin.DELETE("/violations/:id", violationHandler.Delete)
		admin.DELETE("/recruitments/:id", recruitmentHandler.Delete)
		admin.DELETE("/recruitment_target_divisions/:id", recruitmentTargetDivisionHandler.Delete)
		admin.DELETE("/recruitment_custom_fields/:id", recruitmentCustomFieldHandler.Delete)
		admin.DELETE("/recruitment_submissions/:id", recruitmentSubmissionHandler.Delete)
		admin.DELETE("/letter_categories/:id", letterCategoryHandler.Delete)
		admin.DELETE("/announcements/:id", announcementHandler.Delete)
		admin.DELETE("/announcement_attachments/:id", announcementAttachmentHandler.Delete)
		admin.DELETE("/letter_templates/:id", letterTemplateHandler.Delete)
		// finance mutations: permission-gated in protected routes (finance.create/edit/delete/categories)
		admin.DELETE("/event_committee_sies/:id", eventCommitteeSieHandler.Delete)
		admin.DELETE("/event_committee_members/:id", eventCommitteeMemberHandler.Delete)
		admin.DELETE("/event_sub_events/:id", eventSubEventHandler.Delete)
		admin.DELETE("/sub_event_attendances/:id", subEventAttendanceHandler.Delete)
		// grit:routes:admin
	}

	// Public form-sharing endpoints. NO auth, NO CSRF — Sentinel rate
	// limits each token aggressively. The dispatch service is the
	// security boundary (whitelists which resources are reachable).
	publicForms := r.Group("/api/public/forms")
	{
		publicForms.GET("/:token", formShareHandler.PublicGet)
		publicForms.POST("/:token/submit", formShareHandler.PublicSubmit)
	}

	// Custom role-restricted routes
	// grit:routes:custom

	// Role permission matrix — lets the admin panel grant/revoke many
	// permissions for a role in one request instead of creating
	// RolePermission rows one at a time.
	rolePermissionMatrix := protected.Group("/roles")
	rolePermissionMatrix.Use(middleware.RequirePermission(permChecker, "roles.edit"))
	rolePermissionMatrix.GET("/:id/permissions", rolePermissionHandler.Matrix)
	rolePermissionMatrix.PUT("/:id/permissions", rolePermissionHandler.Sync)

	// MyOrg public branding + recruitment
	r.GET("/api/settings", myorgHandler.GetPublicSettings)
	publicRecruitment := r.Group("/api/public/recruitment")
	{
		publicRecruitment.GET("/:slug", myorgHandler.GetPublicRecruitment)
		publicRecruitment.POST("/:slug/submit", myorgHandler.SubmitPublicRecruitment)
		publicRecruitment.POST("/:slug/upload", myorgHandler.UploadPublicRecruitmentFile)
	}

	return r
}
