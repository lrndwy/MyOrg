package jobs

import (
	"context"
	"log"
	"time"

	"github.com/hibiken/asynq"
	"gorm.io/gorm"

	"myorg/apps/api/internal/models"
)

const TypeEventStatusTransition = "events:status_transition"

// HandleEventStatusTransition moves events upcoming→ongoing→finished based on time.
func HandleEventStatusTransition(db *gorm.DB) func(context.Context, *asynq.Task) error {
	return func(ctx context.Context, _ *asynq.Task) error {
		now := time.Now()

		res := db.WithContext(ctx).Model(&models.Event{}).
			Where("status = ? AND start_time IS NOT NULL AND start_time <= ?", "upcoming", now).
			Update("status", "ongoing")
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected > 0 {
			log.Printf("events:status_transition — %d upcoming → ongoing", res.RowsAffected)
		}

		res = db.WithContext(ctx).Model(&models.Event{}).
			Where("status = ? AND end_time IS NOT NULL AND end_time <= ?", "ongoing", now).
			Update("status", "finished")
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected > 0 {
			log.Printf("events:status_transition — %d ongoing → finished", res.RowsAffected)
		}

		res = db.WithContext(ctx).Model(&models.EventSubEvent{}).
			Where("status = ? AND start_time IS NOT NULL AND start_time <= ?", "upcoming", now).
			Update("status", "ongoing")
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected > 0 {
			log.Printf("sub_events:status_transition — %d upcoming → ongoing", res.RowsAffected)
		}

		res = db.WithContext(ctx).Model(&models.EventSubEvent{}).
			Where("status = ? AND end_time IS NOT NULL AND end_time <= ?", "ongoing", now).
			Update("status", "finished")
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected > 0 {
			log.Printf("sub_events:status_transition — %d ongoing → finished", res.RowsAffected)
		}
		return nil
	}
}
