package handlers

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"myorg/apps/api/internal/backup"
	"myorg/apps/api/internal/models"
	"myorg/apps/api/internal/storage"
)

const (
	// manualBackupWindow rate-limits on-demand backups. The weekly cron bypasses it.
	manualBackupWindow = 24 * time.Hour
	// downloadURLTTL: long enough for a slow phone, short enough that a leaked
	// link stops working before anyone can use it.
	downloadURLTTL = 15 * time.Minute
	// backupTimeout bounds a single run so a hung upload can't wedge the worker.
	backupTimeout = 30 * time.Minute
	// restoreMaxUpload caps uploaded backup archives (2 GB, includes DB + files).
	restoreMaxUpload = 2 << 30
)

var restoreGate sync.Mutex

// BackupHandler serves the full-database backup index.
type BackupHandler struct {
	DB      *gorm.DB
	Storage *storage.Storage
}

func (h *BackupHandler) svc() *backup.Service {
	return &backup.Service{DB: h.DB, Storage: h.Storage}
}

// List returns backups newest-first. Poll it while one is RUNNING.
func (h *BackupHandler) List(c *gin.Context) {
	var items []models.Backup
	if err := h.DB.Order("created_at desc").Limit(50).Find(&items).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "INTERNAL_ERROR", "message": "Failed to list backups"},
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

// Generate starts a manual backup in the background and returns the RUNNING row
// immediately — a full dump can take a while. Poll List until it flips to READY.
func (h *BackupHandler) Generate(c *gin.Context) {
	if h.Storage == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": gin.H{"code": "STORAGE_UNAVAILABLE", "message": "Object storage is not configured"},
		})
		return
	}

	limited, err := h.svc().ManualRateLimited(manualBackupWindow)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "INTERNAL_ERROR", "message": "Failed to check rate limit"},
		})
		return
	}
	if limited {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error": gin.H{"code": "RATE_LIMITED", "message": "A manual backup was already taken in the last 24 hours"},
		})
		return
	}

	rec, err := h.svc().Start("MANUAL")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "INTERNAL_ERROR", "message": "Failed to start backup"},
		})
		return
	}

	go func(r models.Backup) {
		ctx, cancel := context.WithTimeout(context.Background(), backupTimeout)
		defer cancel()
		_ = h.svc().Run(ctx, &r)
	}(*rec)

	c.JSON(http.StatusAccepted, gin.H{"data": rec, "message": "Backup started"})
}

// Export streams a fresh full-database backup ZIP directly to the client.
// Does not require object storage — useful for one-off downloads.
func (h *BackupHandler) Export(c *gin.Context) {
	filename := "myorg-backup-" + time.Now().UTC().Format("2006-01-02-150405") + ".zip"
	c.Header("Content-Type", "application/zip")
	c.Header("Content-Disposition", `attachment; filename="`+filename+`"`)

	ctx, cancel := context.WithTimeout(c.Request.Context(), backupTimeout)
	defer cancel()

	man, err := h.svc().ArchiveTo(ctx, c.Writer)
	if err != nil {
		// Headers may already be sent — log only; client sees truncated zip.
		_ = man
		return
	}
}

// RestoreUpload replays an uploaded backup ZIP into the database.
func (h *BackupHandler) RestoreUpload(c *gin.Context) {
	if c.PostForm("confirm") != "true" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{"code": "CONFIRMATION_REQUIRED", "message": "Set confirm=true to replace all database data"},
		})
		return
	}

	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, restoreMaxUpload)
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{"code": "INVALID_FILE", "message": "Upload a backup .zip file"},
		})
		return
	}
	defer file.Close()

	if !strings.HasSuffix(strings.ToLower(header.Filename), ".zip") {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{"code": "INVALID_FILE", "message": "Backup archive must be a .zip file"},
		})
		return
	}

	tmp, err := os.CreateTemp("", "myorg-restore-*.zip")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "INTERNAL_ERROR", "message": "Failed to prepare restore"},
		})
		return
	}
	tmpPath := tmp.Name()
	defer os.Remove(tmpPath)

	if _, err := io.Copy(tmp, file); err != nil {
		tmp.Close()
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "INTERNAL_ERROR", "message": "Failed to read uploaded archive"},
		})
		return
	}
	if err := tmp.Close(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "INTERNAL_ERROR", "message": "Failed to finalize uploaded archive"},
		})
		return
	}

	man, err := h.runRestore(c, tmpPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "RESTORE_FAILED", "message": err.Error()},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":    man,
		"message": fmt.Sprintf("Database restored (%d files)", man.FileCount),
	})
}

// RestoreByID replays a stored backup archive from object storage.
func (h *BackupHandler) RestoreByID(c *gin.Context) {
	var req struct {
		Confirm bool `json:"confirm"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || !req.Confirm {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{"code": "CONFIRMATION_REQUIRED", "message": "Send {\"confirm\": true} to replace all database data"},
		})
		return
	}

	if h.Storage == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": gin.H{"code": "STORAGE_UNAVAILABLE", "message": "Object storage is not configured"},
		})
		return
	}

	var b models.Backup
	if err := h.DB.First(&b, "id = ?", c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{"code": "NOT_FOUND", "message": "Backup not found"},
		})
		return
	}
	if b.Status != "READY" || b.StorageKey == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{"code": "NOT_AVAILABLE", "message": "This backup is not available for restore"},
		})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), backupTimeout)
	defer cancel()

	reader, err := h.Storage.Download(ctx, b.StorageKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "INTERNAL_ERROR", "message": "Failed to download backup archive"},
		})
		return
	}
	defer reader.Close()

	tmp, err := os.CreateTemp("", "myorg-restore-*.zip")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "INTERNAL_ERROR", "message": "Failed to prepare restore"},
		})
		return
	}
	tmpPath := tmp.Name()
	defer os.Remove(tmpPath)

	if _, err := io.Copy(tmp, reader); err != nil {
		tmp.Close()
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "INTERNAL_ERROR", "message": "Failed to save backup archive"},
		})
		return
	}
	if err := tmp.Close(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "INTERNAL_ERROR", "message": "Failed to finalize backup archive"},
		})
		return
	}

	man, err := h.runRestore(c, tmpPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "RESTORE_FAILED", "message": err.Error()},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":    man,
		"message": fmt.Sprintf("Database restored from backup %s (%d files)", b.ID, man.FileCount),
	})
}

func (h *BackupHandler) runRestore(c *gin.Context, zipPath string) (backup.Manifest, error) {
	var man backup.Manifest

	restoreGate.Lock()
	defer restoreGate.Unlock()

	ctx, cancel := context.WithTimeout(c.Request.Context(), backupTimeout)
	defer cancel()

	done := make(chan error, 1)
	go func() {
		if err := models.Migrate(h.DB); err != nil {
			done <- err
			return
		}
		var restoreErr error
		man, restoreErr = backup.Restore(h.DB, h.Storage, zipPath, backup.RestoreOptions{
			ClearExisting: true,
		})
		done <- restoreErr
	}()

	select {
	case err := <-done:
		return man, err
	case <-ctx.Done():
		return man, ctx.Err()
	}
}

// Download mints a short-lived pre-signed URL so the client pulls the archive
// straight from object storage — no proxying a multi-hundred-MB file through the API.
func (h *BackupHandler) Download(c *gin.Context) {
	if h.Storage == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": gin.H{"code": "STORAGE_UNAVAILABLE", "message": "Object storage is not configured"},
		})
		return
	}

	var b models.Backup
	if err := h.DB.First(&b, "id = ?", c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{"code": "NOT_FOUND", "message": "Backup not found"},
		})
		return
	}
	if b.Status != "READY" || b.StorageKey == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{"code": "NOT_AVAILABLE", "message": "This backup is not available for download"},
		})
		return
	}

	url, err := h.Storage.GetSignedURL(c.Request.Context(), b.StorageKey, downloadURLTTL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "INTERNAL_ERROR", "message": "Failed to sign download URL"},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{"url": url, "expires_in": int(downloadURLTTL.Seconds())},
	})
}

// GetSettings returns the automatic-backup schedule (frequency, time, enabled).
func (h *BackupHandler) GetSettings(c *gin.Context) {
	sc, err := h.svc().GetSchedule()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "INTERNAL_ERROR", "message": "Failed to load backup schedule"},
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": sc})
}

// UpdateSettings changes the automatic-backup schedule. The scheduler picks up
// the new period on its next tick — no restart needed.
func (h *BackupHandler) UpdateSettings(c *gin.Context) {
	var req struct {
		Frequency string `json:"frequency"`
		Time      string `json:"time"`
		Enabled   bool   `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"code": "INVALID_BODY", "message": err.Error()}})
		return
	}
	sc, err := h.svc().SaveSchedule(req.Frequency, req.Time, req.Enabled)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"code": "INVALID_SCHEDULE", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": sc, "message": "Backup schedule updated"})
}
