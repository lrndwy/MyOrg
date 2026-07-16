package services

import (
	"fmt"
	"math"
	"time"

	"gorm.io/gorm"

	"myorg/apps/api/internal/models"
)

// PermissionRequestService handles business logic for permission_requests.
type PermissionRequestService struct {
	DB *gorm.DB
}

// PermissionRequestListParams holds pagination and filter parameters.
type PermissionRequestListParams struct {
	Page      int
	PageSize  int
	Search    string
	SortBy    string
	SortOrder string
}

// List returns a paginated list of permission_requests.
func (s *PermissionRequestService) List(params PermissionRequestListParams) ([]models.PermissionRequest, int64, int, error) {
	if params.Page < 1 {
		params.Page = 1
	}
	if params.PageSize < 1 || params.PageSize > 100 {
		params.PageSize = 20
	}
	if params.SortOrder != "asc" && params.SortOrder != "desc" {
		params.SortOrder = "desc"
	}
	// SortBy is interpolated into ORDER BY below, so it MUST be whitelisted
	// against real columns — never trust a client-supplied sort column.
	sortablePermissionRequest := map[string]bool{"id": true, "created_at": true, "updated_at": true, "event_id": true, "user_id": true, "reason": true, "proof_url": true, "status": true, "reviewed_by_id": true, "review_note": true, "reviewed_at": true}
	if !sortablePermissionRequest[params.SortBy] {
		params.SortBy = "created_at"
	}

	query := s.DB.Model(&models.PermissionRequest{})

	if params.Search != "" {
		query = query.Where("event ILIKE ? OR user ILIKE ? OR reason ILIKE ? OR proof_url ILIKE ? OR status ILIKE ? OR reviewed_by ILIKE ? OR review_note ILIKE ?", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%", "%"+params.Search+"%")
	}

	var total int64
	query.Count(&total)

	var items []models.PermissionRequest
	offset := (params.Page - 1) * params.PageSize
	if err := query.Order(params.SortBy + " " + params.SortOrder).Offset(offset).Limit(params.PageSize).Find(&items).Error; err != nil {
		return nil, 0, 0, fmt.Errorf("fetching permission_requests: %w", err)
	}

	pages := int(math.Ceil(float64(total) / float64(params.PageSize)))
	return items, total, pages, nil
}

// GetByID returns a single permissionrequest by ID.
func (s *PermissionRequestService) GetByID(id string) (*models.PermissionRequest, error) {
	var item models.PermissionRequest
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("permissionrequest not found: %w", err)
	}
	return &item, nil
}

// Create creates a new permissionrequest for a user who has not yet
// attended and does not already have a pending/approved request.
func (s *PermissionRequestService) Create(item *models.PermissionRequest) error {
	if item.Status == "" {
		item.Status = "pending"
	}

	var attendance models.Attendance
	if err := s.DB.Where("event_id = ? AND user_id = ?", item.EventID, item.UserID).First(&attendance).Error; err == nil {
		return fmt.Errorf("you have already submitted attendance for this event; permission request is not allowed")
	} else if err != gorm.ErrRecordNotFound {
		return fmt.Errorf("checking existing attendance: %w", err)
	}

	var activePerm models.PermissionRequest
	if err := s.DB.Where(
		"event_id = ? AND user_id = ? AND status IN ?",
		item.EventID, item.UserID, []string{"pending", "approved"},
	).First(&activePerm).Error; err == nil {
		return fmt.Errorf("you already have a %s permission request for this event", activePerm.Status)
	} else if err != gorm.ErrRecordNotFound {
		return fmt.Errorf("checking existing permission: %w", err)
	}

	if err := s.DB.Create(item).Error; err != nil {
		return fmt.Errorf("creating permissionrequest: %w", err)
	}
	return nil
}

// Review updates a permission request and syncs attendance status in one transaction.
func (s *PermissionRequestService) Review(id string, action string, reviewerID string, note string) (*models.PermissionRequest, error) {
	var item models.PermissionRequest
	err := s.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.First(&item, "id = ?", id).Error; err != nil {
			return fmt.Errorf("permissionrequest not found: %w", err)
		}
		if item.Status != "pending" {
			return fmt.Errorf("permission request already reviewed")
		}

		now := time.Now()
		status := "rejected"
		attendanceStatus := "absent"
		if action == "approve" {
			status = "approved"
			attendanceStatus = "permitted"
		}

		item.Status = status
		item.ReviewedByID = &reviewerID
		item.ReviewNote = note
		item.ReviewedAt = &now
		if err := tx.Save(&item).Error; err != nil {
			return err
		}

		var att models.Attendance
		err := tx.Where("event_id = ? AND user_id = ?", item.EventID, item.UserID).First(&att).Error
		if err == gorm.ErrRecordNotFound {
			att = models.Attendance{
				EventID: item.EventID,
				UserID:  item.UserID,
				Status:  attendanceStatus,
			}
			return tx.Create(&att).Error
		}
		if err != nil {
			return err
		}
		return tx.Model(&att).Update("status", attendanceStatus).Error
	})
	if err != nil {
		return nil, err
	}
	return &item, nil
}

// Update modifies an existing permissionrequest. Two queries: First() loads
// the row + verifies existence; Updates() persists the diff. The
// loaded struct is mutated by Updates() so we can return it directly
// without a third refetch.
func (s *PermissionRequestService) Update(id string, updates map[string]interface{}) (*models.PermissionRequest, error) {
	var item models.PermissionRequest
	if err := s.DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("permissionrequest not found: %w", err)
	}

	if err := s.DB.Model(&item).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("updating permissionrequest: %w", err)
	}

	return &item, nil
}

// Delete soft-deletes a permissionrequest. One query — we don't need to load
// the row first; GORM's Delete is atomic and rows-affected tells us
// whether it existed.
func (s *PermissionRequestService) Delete(id string) error {
	res := s.DB.Where("id = ?", id).Delete(&models.PermissionRequest{})
	if res.Error != nil {
		return fmt.Errorf("deleting permissionrequest: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return fmt.Errorf("permissionrequest not found")
	}
	return nil
}
