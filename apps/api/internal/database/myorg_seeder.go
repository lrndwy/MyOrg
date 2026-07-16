package database

import (
	"fmt"
	"log"

	"myorg/apps/api/internal/models"
	"gorm.io/gorm"
)

// SeedMyOrg seeds permissions, Admin app-role, org settings, letter categories, and a demo division.
func SeedMyOrg(db *gorm.DB) error {
	if err := seedPermissions(db); err != nil {
		return fmt.Errorf("permissions: %w", err)
	}
	adminRoleID, err := seedAdminAppRole(db)
	if err != nil {
		return fmt.Errorf("admin role: %w", err)
	}
	if err := seedOrganizationSetting(db); err != nil {
		return fmt.Errorf("org settings: %w", err)
	}
	if err := seedLetterCategories(db); err != nil {
		return fmt.Errorf("letter categories: %w", err)
	}
	divisionID, err := seedDemoDivision(db)
	if err != nil {
		return fmt.Errorf("division: %w", err)
	}
	if err := linkAdminUser(db, adminRoleID, divisionID); err != nil {
		return fmt.Errorf("link admin: %w", err)
	}
	return nil
}

func seedPermissions(db *gorm.DB) error {
	perms := []models.Permission{
		{Code: "settings.manage", Module: "settings", Description: "Manage organization settings"},
		{Code: "users.view", Module: "users", Description: "View users"},
		{Code: "users.create", Module: "users", Description: "Create users"},
		{Code: "users.edit", Module: "users", Description: "Edit users"},
		{Code: "users.delete", Module: "users", Description: "Delete users"},
		{Code: "users.import", Module: "users", Description: "Import users"},
		{Code: "roles.view", Module: "roles", Description: "View roles"},
		{Code: "roles.create", Module: "roles", Description: "Create roles"},
		{Code: "roles.edit", Module: "roles", Description: "Edit roles"},
		{Code: "roles.delete", Module: "roles", Description: "Delete roles"},
		{Code: "events.view", Module: "events", Description: "View events"},
		{Code: "events.create", Module: "events", Description: "Create events"},
		{Code: "events.edit", Module: "events", Description: "Edit events"},
		{Code: "events.delete", Module: "events", Description: "Delete events"},
		{Code: "attendance.submit", Module: "attendance", Description: "Submit attendance"},
		{Code: "attendance.approve", Module: "attendance", Description: "Approve permission requests"},
		{Code: "divisions.view", Module: "divisions", Description: "View divisions"},
		{Code: "divisions.create", Module: "divisions", Description: "Create divisions"},
		{Code: "divisions.edit", Module: "divisions", Description: "Edit divisions"},
		{Code: "divisions.delete", Module: "divisions", Description: "Delete divisions"},
		{Code: "permission.submit", Module: "permission", Description: "Submit leave/permission requests"},
		{Code: "violations.view", Module: "violations", Description: "View violations"},
		{Code: "violations.manage", Module: "violations", Description: "Manage violations/SP"},
		{Code: "recruitment.manage", Module: "recruitment", Description: "Manage open recruitment"},
		{Code: "letters.view", Module: "letters", Description: "View letters"},
		{Code: "letters.manage", Module: "letters", Description: "Manage letters"},
		{Code: "announcement.create", Module: "announcement", Description: "Create announcements"},
	}

	for _, p := range perms {
		var count int64
		db.Model(&models.Permission{}).Where("code = ?", p.Code).Count(&count)
		if count > 0 {
			continue
		}
		if err := db.Create(&p).Error; err != nil {
			return err
		}
		log.Printf("Seeded permission: %s", p.Code)
	}
	return nil
}

func seedAdminAppRole(db *gorm.DB) (string, error) {
	var role models.Role
	err := db.Where("name = ?", "Admin").First(&role).Error
	if err == gorm.ErrRecordNotFound {
		role = models.Role{
			Name:        "Admin",
			Description: "System administrator with all permissions",
			IsSystem:    true,
		}
		if err := db.Create(&role).Error; err != nil {
			return "", err
		}
		log.Println("Seeded App Role: Admin")
	} else if err != nil {
		return "", err
	}

	var perms []models.Permission
	if err := db.Find(&perms).Error; err != nil {
		return "", err
	}
	for _, p := range perms {
		var count int64
		db.Model(&models.RolePermission{}).Where("role_id = ? AND permission_id = ?", role.ID, p.ID).Count(&count)
		if count > 0 {
			continue
		}
		rp := models.RolePermission{RoleID: role.ID, PermissionID: p.ID}
		if err := db.Create(&rp).Error; err != nil {
			return "", err
		}
	}
	return role.ID, nil
}

func seedOrganizationSetting(db *gorm.DB) error {
	var count int64
	db.Model(&models.OrganizationSetting{}).Count(&count)
	if count > 0 {
		return nil
	}
	s := models.OrganizationSetting{
		WebName:                      "MyOrg System",
		Theme:                        "default",
		AllowSelfRegister:            false,
		AllowCrossDivisionEventsView: false,
	}
	if err := db.Create(&s).Error; err != nil {
		return err
	}
	log.Println("Seeded OrganizationSetting singleton")
	return nil
}

func seedLetterCategories(db *gorm.DB) error {
	cats := []models.LetterCategory{
		{Name: "Undangan", Code: "UND", StartNumber: 1, CurrentNumber: 0, NumberFormatTemplate: "{number}/{code}/{month_roman}/{year}"},
		{Name: "Surat Keputusan", Code: "SK", StartNumber: 1, CurrentNumber: 0, NumberFormatTemplate: "{number}/{code}/{month_roman}/{year}"},
	}
	for _, c := range cats {
		var count int64
		db.Model(&models.LetterCategory{}).Where("code = ?", c.Code).Count(&count)
		if count > 0 {
			continue
		}
		if err := db.Create(&c).Error; err != nil {
			return err
		}
		log.Printf("Seeded letter category: %s", c.Code)
	}
	return nil
}

func seedDemoDivision(db *gorm.DB) (string, error) {
	var div models.Division
	err := db.Where("name = ?", "Umum").First(&div).Error
	if err == gorm.ErrRecordNotFound {
		div = models.Division{Name: "Umum", Description: "Divisi umum / general"}
		if err := db.Create(&div).Error; err != nil {
			return "", err
		}
		log.Println("Seeded division: Umum")
	} else if err != nil {
		return "", err
	}
	return div.ID, nil
}

func linkAdminUser(db *gorm.DB, appRoleID, divisionID string) error {
	var user models.User
	if err := db.Where("email = ?", "admin@example.com").First(&user).Error; err != nil {
		log.Println("Admin user not found yet — skip linking AppRole/Division")
		return nil
	}
	updates := map[string]interface{}{
		"username":    "admin",
		"full_name":   "Admin User",
		"app_role_id": appRoleID,
		"division_id": divisionID,
		"status":      "active",
	}
	return db.Model(&user).Updates(updates).Error
}
