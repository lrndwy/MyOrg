package services

import (
	"fmt"
	"time"

	"gorm.io/gorm"

	"myorg/apps/api/internal/models"
)

// EventCommitteeService handles kepanitiaan business logic.
type EventCommitteeService struct {
	DB *gorm.DB
}

type CommitteeOverview struct {
	Event       models.Event              `json:"event"`
	Sies        []CommitteeSieWithMembers `json:"sies"`
	SubEvents   []models.EventSubEvent    `json:"sub_events"`
	MemberCount int                       `json:"member_count"`
}

type CommitteeSieWithMembers struct {
	models.EventCommitteeSie
	Members []models.EventCommitteeMember `json:"members"`
}

type SubEventRecapSummary struct {
	Present int `json:"present"`
	Absent  int `json:"absent"`
	Other   int `json:"other"`
}

type SubEventRecap struct {
	SubEvent    models.EventSubEvent        `json:"sub_event"`
	Summary     SubEventRecapSummary        `json:"summary"`
	Attendances []models.SubEventAttendance `json:"attendances"`
	Expected    []models.User               `json:"expected_participants"`
}

func (s *EventCommitteeService) requireCommitteeEvent(eventID string) (*models.Event, error) {
	var event models.Event
	if err := s.DB.First(&event, "id = ?", eventID).Error; err != nil {
		return nil, fmt.Errorf("event not found: %w", err)
	}
	if event.EventType != "kepanitiaan" {
		return nil, fmt.Errorf("event is not a kepanitiaan event")
	}
	return &event, nil
}

func (s *EventCommitteeService) isCommitteeMember(eventID, userID string) (bool, error) {
	var count int64
	err := s.DB.Model(&models.EventCommitteeMember{}).
		Joins("JOIN event_committee_sies ON event_committee_sies.id = event_committee_members.sie_id").
		Where("event_committee_sies.event_id = ? AND event_committee_members.user_id = ?", eventID, userID).
		Count(&count).Error
	return count > 0, err
}

// GetOverview returns committee structure for an event.
func (s *EventCommitteeService) GetOverview(eventID string) (*CommitteeOverview, error) {
	event, err := s.requireCommitteeEvent(eventID)
	if err != nil {
		return nil, err
	}

	var sies []models.EventCommitteeSie
	if err := s.DB.Where("event_id = ?", eventID).Order("order_index asc, created_at asc").Find(&sies).Error; err != nil {
		return nil, err
	}

	siesWithMembers := make([]CommitteeSieWithMembers, 0, len(sies))
	memberCount := 0
	for _, sie := range sies {
		var members []models.EventCommitteeMember
		s.DB.Preload("User").Where("sie_id = ?", sie.ID).Order("created_at asc").Find(&members)
		memberCount += len(members)
		siesWithMembers = append(siesWithMembers, CommitteeSieWithMembers{
			EventCommitteeSie: sie,
			Members:           members,
		})
	}

	var subEvents []models.EventSubEvent
	s.DB.Preload("Sie").Preload("KetuaPelaksana").
		Where("event_id = ?", eventID).
		Order("start_time asc, created_at desc").
		Find(&subEvents)

	return &CommitteeOverview{
		Event:       *event,
		Sies:        siesWithMembers,
		SubEvents:   subEvents,
		MemberCount: memberCount,
	}, nil
}

// ValidateSubEvent validates sub-event before create/update.
func (s *EventCommitteeService) ValidateSubEvent(item *models.EventSubEvent) error {
	if _, err := s.requireCommitteeEvent(item.EventID); err != nil {
		return err
	}
	if item.KetuaPelaksanaID == "" {
		return fmt.Errorf("ketua pelaksana is required")
	}
	ok, err := s.isCommitteeMember(item.EventID, item.KetuaPelaksanaID)
	if err != nil {
		return err
	}
	if !ok {
		return fmt.Errorf("ketua pelaksana must be a committee member of this event")
	}
	if item.AttendanceMode != "selfie" && item.AttendanceMode != "manual" {
		return fmt.Errorf("attendance_mode must be selfie or manual")
	}
	if item.SieID != "" {
		var sie models.EventCommitteeSie
		if err := s.DB.Where("id = ? AND event_id = ?", item.SieID, item.EventID).First(&sie).Error; err != nil {
			return fmt.Errorf("sie not found for this event")
		}
	}
	if item.Status == "" {
		item.Status = "upcoming"
	}
	return nil
}

// ExpectedParticipants returns users who should attend a sub-event.
func (s *EventCommitteeService) ExpectedParticipants(subEvent *models.EventSubEvent) ([]models.User, error) {
	query := s.DB.Model(&models.User{}).
		Joins("JOIN event_committee_members ON event_committee_members.user_id = users.id").
		Joins("JOIN event_committee_sies ON event_committee_sies.id = event_committee_members.sie_id").
		Where("event_committee_sies.event_id = ?", subEvent.EventID)

	if subEvent.SieID != "" {
		query = query.Where("event_committee_sies.id = ?", subEvent.SieID)
	}

	var users []models.User
	if err := query.Distinct("users.*").Find(&users).Error; err != nil {
		return nil, err
	}
	return users, nil
}

func (s *EventCommitteeService) isExpectedParticipant(subEventID, userID string) (bool, error) {
	var subEvent models.EventSubEvent
	if err := s.DB.First(&subEvent, "id = ?", subEventID).Error; err != nil {
		return false, err
	}
	participants, err := s.ExpectedParticipants(&subEvent)
	if err != nil {
		return false, err
	}
	for _, u := range participants {
		if u.ID == userID {
			return true, nil
		}
	}
	return false, nil
}

// CanManageSubEventAttendance checks ketua pelaksana or global permission holder.
func (s *EventCommitteeService) CanManageSubEventAttendance(subEventID, actorID string, hasGlobalPerm bool) (bool, error) {
	if hasGlobalPerm {
		return true, nil
	}
	var subEvent models.EventSubEvent
	if err := s.DB.First(&subEvent, "id = ?", subEventID).Error; err != nil {
		return false, err
	}
	return subEvent.KetuaPelaksanaID == actorID, nil
}

// SubmitSubEventAttendance records selfie attendance.
func (s *EventCommitteeService) SubmitSubEventAttendance(subEventID, userID, selfieURL, signatureURL string) (*models.SubEventAttendance, error) {
	var subEvent models.EventSubEvent
	if err := s.DB.First(&subEvent, "id = ?", subEventID).Error; err != nil {
		return nil, fmt.Errorf("sub event not found: %w", err)
	}
	if subEvent.AttendanceMode != "selfie" {
		return nil, fmt.Errorf("this sub event uses manual attendance")
	}
	if subEvent.Status != "ongoing" {
		return nil, fmt.Errorf("attendance only allowed when sub event is ongoing (current: %s)", subEvent.Status)
	}
	ok, err := s.isExpectedParticipant(subEventID, userID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, fmt.Errorf("you are not an expected participant for this sub event")
	}

	var existing models.SubEventAttendance
	if err := s.DB.Where("sub_event_id = ? AND user_id = ?", subEventID, userID).First(&existing).Error; err == nil {
		return nil, fmt.Errorf("you have already submitted attendance for this sub event")
	} else if err != gorm.ErrRecordNotFound {
		return nil, err
	}

	now := time.Now()
	item := &models.SubEventAttendance{
		SubEventID:   subEventID,
		UserID:       userID,
		Status:       "present",
		SelfieUrl:    selfieURL,
		SignatureUrl: signatureURL,
		CheckedInAt:  &now,
	}
	if err := s.DB.Create(item).Error; err != nil {
		return nil, err
	}
	s.DB.Preload("User").First(item, "id = ?", item.ID)
	return item, nil
}

// MarkSubEventAttendance manually marks attendance for a user.
func (s *EventCommitteeService) MarkSubEventAttendance(subEventID, targetUserID, actorID, status string, hasGlobalPerm bool) (*models.SubEventAttendance, error) {
	can, err := s.CanManageSubEventAttendance(subEventID, actorID, hasGlobalPerm)
	if err != nil {
		return nil, err
	}
	if !can {
		return nil, fmt.Errorf("not authorized to manage attendance for this sub event")
	}

	var subEvent models.EventSubEvent
	if err := s.DB.First(&subEvent, "id = ?", subEventID).Error; err != nil {
		return nil, fmt.Errorf("sub event not found: %w", err)
	}
	if subEvent.AttendanceMode != "manual" {
		return nil, fmt.Errorf("this sub event uses selfie attendance")
	}
	if status != "present" && status != "absent" {
		return nil, fmt.Errorf("status must be present or absent")
	}

	ok, err := s.isExpectedParticipant(subEventID, targetUserID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, fmt.Errorf("user is not an expected participant for this sub event")
	}

	now := time.Now()
	var item models.SubEventAttendance
	err = s.DB.Where("sub_event_id = ? AND user_id = ?", subEventID, targetUserID).First(&item).Error
	if err == gorm.ErrRecordNotFound {
		item = models.SubEventAttendance{
			SubEventID: subEventID,
			UserID:     targetUserID,
		}
	} else if err != nil {
		return nil, err
	}

	item.Status = status
	item.CheckedInAt = &now
	item.MarkedByID = &actorID

	if item.ID == "" {
		if err := s.DB.Create(&item).Error; err != nil {
			return nil, err
		}
	} else {
		if err := s.DB.Save(&item).Error; err != nil {
			return nil, err
		}
	}
	s.DB.Preload("User").Preload("MarkedBy").First(&item, "id = ?", item.ID)
	return &item, nil
}

// GetSubEventRecap returns attendance recap for a sub-event.
func (s *EventCommitteeService) GetSubEventRecap(subEventID string) (*SubEventRecap, error) {
	var subEvent models.EventSubEvent
	if err := s.DB.Preload("Sie").Preload("KetuaPelaksana").Preload("Event").
		First(&subEvent, "id = ?", subEventID).Error; err != nil {
		return nil, fmt.Errorf("sub event not found: %w", err)
	}

	expected, _ := s.ExpectedParticipants(&subEvent)

	var attendances []models.SubEventAttendance
	s.DB.Preload("User").Preload("MarkedBy").
		Where("sub_event_id = ?", subEventID).
		Order("created_at asc").
		Find(&attendances)

	summary := SubEventRecapSummary{}
	for _, a := range attendances {
		switch a.Status {
		case "present":
			summary.Present++
		case "absent":
			summary.Absent++
		default:
			summary.Other++
		}
	}

	return &SubEventRecap{
		SubEvent:    subEvent,
		Summary:     summary,
		Attendances: attendances,
		Expected:    expected,
	}, nil
}

// UploadSubEventMinutes sets minutes URL after authorization check.
func (s *EventCommitteeService) UploadSubEventMinutes(subEventID, actorID, minutesURL string, hasGlobalPerm bool) (*models.EventSubEvent, error) {
	can, err := s.CanManageSubEventAttendance(subEventID, actorID, hasGlobalPerm)
	if err != nil {
		return nil, err
	}
	if !can {
		return nil, fmt.Errorf("not authorized to upload minutes for this sub event")
	}
	var subEvent models.EventSubEvent
	if err := s.DB.First(&subEvent, "id = ?", subEventID).Error; err != nil {
		return nil, err
	}
	subEvent.MinutesUrl = minutesURL
	if err := s.DB.Save(&subEvent).Error; err != nil {
		return nil, err
	}
	return &subEvent, nil
}

// ListSubEventsForEvent lists sub-events with optional sie filter.
func (s *EventCommitteeService) ListSubEventsForEvent(eventID, sieID string) ([]models.EventSubEvent, error) {
	if _, err := s.requireCommitteeEvent(eventID); err != nil {
		return nil, err
	}
	query := s.DB.Preload("Sie").Preload("KetuaPelaksana").Where("event_id = ?", eventID)
	if sieID != "" {
		query = query.Where("sie_id = ?", sieID)
	}
	var items []models.EventSubEvent
	if err := query.Order("start_time asc, created_at desc").Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

// ListSubEventsForUser returns sub-events visible to a committee member.
func (s *EventCommitteeService) ListSubEventsForUser(eventID, userID string) ([]models.EventSubEvent, error) {
	if _, err := s.requireCommitteeEvent(eventID); err != nil {
		return nil, err
	}

	var sieIDs []string
	s.DB.Model(&models.EventCommitteeMember{}).
		Joins("JOIN event_committee_sies ON event_committee_sies.id = event_committee_members.sie_id").
		Where("event_committee_sies.event_id = ? AND event_committee_members.user_id = ?", eventID, userID).
		Pluck("event_committee_sies.id", &sieIDs)

	query := s.DB.Preload("Sie").Preload("KetuaPelaksana").Where("event_id = ?", eventID)
	if len(sieIDs) > 0 {
		query = query.Where("(sie_id IN ? OR ketua_pelaksana_id = ? OR sie_id IS NULL OR sie_id = '')", sieIDs, userID)
	} else {
		query = query.Where("ketua_pelaksana_id = ?", userID)
	}

	var items []models.EventSubEvent
	if err := query.Order("start_time asc").Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}
