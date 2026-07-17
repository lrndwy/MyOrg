package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"regexp"
	"strings"
	"unicode/utf8"

	webpush "github.com/SherClockHolmes/webpush-go"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"myorg/apps/api/internal/models"
)

// PushService manages Web Push subscriptions and outbound sends.
type PushService struct {
	DB             *gorm.DB
	VAPIDPublicKey string
	VAPIDPrivateKey string
	VAPIDSubject   string // mailto: or https: contact
	WebAppURL      string // base URL for deep links in notifications
}

// PushSubscribeInput is the browser PushSubscription JSON shape.
type PushSubscribeInput struct {
	Endpoint string `json:"endpoint" binding:"required"`
	Keys     struct {
		P256dh string `json:"p256dh" binding:"required"`
		Auth   string `json:"auth" binding:"required"`
	} `json:"keys" binding:"required"`
}

// UpsertSubscription stores or refreshes a push subscription for the user.
func (s *PushService) UpsertSubscription(userID string, in PushSubscribeInput, userAgent string) error {
	if userID == "" || strings.TrimSpace(in.Endpoint) == "" {
		return fmt.Errorf("user_id and endpoint are required")
	}
	endpoint := strings.TrimSpace(in.Endpoint)
	var existing models.PushSubscription
	err := s.DB.Unscoped().Where("endpoint = ?", endpoint).First(&existing).Error
	if err == nil {
		existing.UserID = userID
		existing.P256dh = strings.TrimSpace(in.Keys.P256dh)
		existing.Auth = strings.TrimSpace(in.Keys.Auth)
		existing.UserAgent = truncate(userAgent, 500)
		existing.DeletedAt = gorm.DeletedAt{}
		return s.DB.Unscoped().Save(&existing).Error
	}
	if err != gorm.ErrRecordNotFound {
		return err
	}
	row := models.PushSubscription{
		UserID:    userID,
		Endpoint:  endpoint,
		P256dh:    strings.TrimSpace(in.Keys.P256dh),
		Auth:      strings.TrimSpace(in.Keys.Auth),
		UserAgent: truncate(userAgent, 500),
	}
	return s.DB.Create(&row).Error
}

// DeleteSubscription removes a subscription by endpoint for the given user.
func (s *PushService) DeleteSubscription(userID, endpoint string) error {
	res := s.DB.Where("user_id = ? AND endpoint = ?", userID, endpoint).Delete(&models.PushSubscription{})
	if res.Error != nil {
		return res.Error
	}
	return nil
}

// NotifyAnnouncement creates in-app Notification rows for target users and
// sends Web Push to their registered browsers.
func (s *PushService) NotifyAnnouncement(ctx context.Context, announcementID string) error {
	var ann models.Announcement
	if err := s.DB.First(&ann, "id = ?", announcementID).Error; err != nil {
		return fmt.Errorf("announcement not found: %w", err)
	}

	userIDs, err := s.resolveAnnouncementRecipients(&ann)
	if err != nil {
		return err
	}
	if len(userIDs) == 0 {
		log.Printf("push: announcement %s has no recipients", announcementID)
		return nil
	}

	title := "Pengumuman: " + ann.Title
	body := stripHTMLToPlain(ann.Content, 160)
	link := "/announcements"
	if s.WebAppURL != "" {
		link = strings.TrimRight(s.WebAppURL, "/") + "/announcements"
	}

	// In-app notifications (web/admin bell via GET /api/notifications).
	notifs := make([]models.Notification, 0, len(userIDs))
	for _, uid := range userIDs {
		dedup := fmt.Sprintf("announcement:%s:%s", announcementID, uid)
		notifs = append(notifs, models.Notification{
			UserID:   uid,
			Source:   "announcement",
			Severity: "info",
			Title:    title,
			Body:     body,
			Link:     link,
			Dedup:    dedup,
			Count:    1,
		})
	}
	// Ignore duplicate key collisions if job retries.
	if err := s.DB.Clauses(clause.OnConflict{DoNothing: true}).CreateInBatches(notifs, 100).Error; err != nil {
		log.Printf("push: in-app notifications for %s: %v", announcementID, err)
	}

	if s.VAPIDPublicKey == "" || s.VAPIDPrivateKey == "" {
		log.Printf("push: VAPID keys not configured — skipped web push for announcement %s", announcementID)
		return nil
	}

	var subs []models.PushSubscription
	if err := s.DB.Where("user_id IN ?", userIDs).Find(&subs).Error; err != nil {
		return fmt.Errorf("loading push subscriptions: %w", err)
	}
	if len(subs) == 0 {
		log.Printf("push: no browser subscriptions for announcement %s (%d users)", announcementID, len(userIDs))
		return nil
	}

	payload, err := json.Marshal(map[string]string{
		"title":           title,
		"body":            body,
		"url":             "/announcements",
		"announcement_id": announcementID,
	})
	if err != nil {
		return err
	}

	subject := s.VAPIDSubject
	if subject == "" {
		subject = "mailto:noreply@localhost"
	}

	sent := 0
	for i := range subs {
		sub := &subs[i]
		if err := ctx.Err(); err != nil {
			return err
		}
		wpSub := &webpush.Subscription{
			Endpoint: sub.Endpoint,
			Keys: webpush.Keys{
				P256dh: sub.P256dh,
				Auth:   sub.Auth,
			},
		}
		resp, err := webpush.SendNotification(payload, wpSub, &webpush.Options{
			Subscriber:      subject,
			VAPIDPublicKey:  s.VAPIDPublicKey,
			VAPIDPrivateKey: s.VAPIDPrivateKey,
			TTL:             60 * 60 * 24,
			Urgency:         webpush.UrgencyNormal,
		})
		if err != nil {
			log.Printf("push: send to %s failed: %v", truncate(sub.Endpoint, 64), err)
			continue
		}
		status := resp.StatusCode
		_ = resp.Body.Close()
		// Gone / Not Found → drop stale subscription
		if status == 404 || status == 410 {
			_ = s.DB.Where("id = ?", sub.ID).Delete(&models.PushSubscription{})
			continue
		}
		if status >= 200 && status < 300 {
			sent++
		} else {
			log.Printf("push: unexpected status %d for %s", status, truncate(sub.Endpoint, 64))
		}
	}
	log.Printf("push: announcement %s — in-app %d users, web-push sent %d/%d",
		announcementID, len(userIDs), sent, len(subs))
	return nil
}

func (s *PushService) resolveAnnouncementRecipients(ann *models.Announcement) ([]string, error) {
	q := s.DB.Model(&models.User{}).Where("status = ? AND active = ?", "active", true)
	switch strings.ToLower(strings.TrimSpace(ann.TargetType)) {
	case "division":
		if ann.TargetDivisionID == nil || *ann.TargetDivisionID == "" {
			return nil, fmt.Errorf("target_division_id missing")
		}
		q = q.Where("division_id = ?", *ann.TargetDivisionID)
	case "all", "":
		// all active users
	default:
		// Unknown target — treat as all for safety of delivery intent
		log.Printf("push: unknown target_type %q — notifying all users", ann.TargetType)
	}

	var ids []string
	if err := q.Pluck("id", &ids).Error; err != nil {
		return nil, fmt.Errorf("resolving recipients: %w", err)
	}
	return ids, nil
}

var htmlTagRe = regexp.MustCompile(`(?s)<[^>]*>`)
var spaceRe = regexp.MustCompile(`\s+`)

func stripHTMLToPlain(html string, maxRunes int) string {
	plain := htmlTagRe.ReplaceAllString(html, " ")
	plain = strings.ReplaceAll(plain, "&nbsp;", " ")
	plain = strings.ReplaceAll(plain, "&amp;", "&")
	plain = strings.ReplaceAll(plain, "&lt;", "<")
	plain = strings.ReplaceAll(plain, "&gt;", ">")
	plain = strings.ReplaceAll(plain, "&quot;", "\"")
	plain = spaceRe.ReplaceAllString(plain, " ")
	plain = strings.TrimSpace(plain)
	if plain == "" {
		return "Ada pengumuman baru."
	}
	if maxRunes > 0 && utf8.RuneCountInString(plain) > maxRunes {
		runes := []rune(plain)
		plain = string(runes[:maxRunes-1]) + "…"
	}
	return plain
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}
