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
	if err := seedBendaharaAppRole(db); err != nil {
		return fmt.Errorf("bendahara role: %w", err)
	}
	if err := seedOrganizationSetting(db); err != nil {
		return fmt.Errorf("org settings: %w", err)
	}
	if err := seedLetterCategories(db); err != nil {
		return fmt.Errorf("letter categories: %w", err)
	}
	if err := seedFinanceCategories(db); err != nil {
		return fmt.Errorf("finance categories: %w", err)
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
		{Code: "finance.view", Module: "finance", Description: "Lihat laporan keuangan, transaksi, dan dashboard"},
		{Code: "finance.create", Module: "finance", Description: "Catat pemasukan dan pengeluaran"},
		{Code: "finance.edit", Module: "finance", Description: "Ubah transaksi keuangan"},
		{Code: "finance.delete", Module: "finance", Description: "Hapus transaksi keuangan"},
		{Code: "finance.categories", Module: "finance", Description: "Kelola kategori pemasukan/pengeluaran"},
		{Code: "finance.manage", Module: "finance", Description: "Akses penuh modul keuangan (semua aksi tulis)"},
		{Code: "storage.view", Module: "storage", Description: "Akses penyimpanan cloud (file sendiri)"},
		{Code: "storage.upload", Module: "storage", Description: "Upload ke penyimpanan cloud"},
		{Code: "storage.delete", Module: "storage", Description: "Hapus file sendiri di penyimpanan cloud"},
		{Code: "storage.manage", Module: "storage", Description: "Kelola semua file organisasi di cloud storage"},
	}

	for _, p := range perms {
		var existing models.Permission
		err := db.Unscoped().Where("code = ?", p.Code).First(&existing).Error
		if err == nil {
			_ = db.Unscoped().Model(&existing).Updates(map[string]any{
				"module":      p.Module,
				"description": p.Description,
				"deleted_at":  nil,
			})
			continue
		}
		if err != gorm.ErrRecordNotFound {
			return err
		}
		if err := db.Create(&p).Error; err != nil {
			return err
		}
		log.Printf("Seeded permission: %s", p.Code)
	}
	return nil
}

func seedAdminAppRole(db *gorm.DB) (string, error) {
	role, err := ensureSystemRole(db, "Admin", "System administrator with all permissions")
	if err != nil {
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

// ensureSystemRole finds or creates a system role by name. Uses Unscoped so a
// previously soft-deleted row is restored instead of hitting idx_roles_name.
func ensureSystemRole(db *gorm.DB, name, description string) (models.Role, error) {
	var role models.Role
	err := db.Unscoped().Where("name = ?", name).First(&role).Error
	if err == nil {
		updates := map[string]any{
			"description": description,
			"is_system":   true,
			"deleted_at":  nil,
		}
		if err := db.Unscoped().Model(&role).Updates(updates).Error; err != nil {
			return role, err
		}
		return role, nil
	}
	if err != gorm.ErrRecordNotFound {
		return role, err
	}

	role = models.Role{
		Name:        name,
		Description: description,
		IsSystem:    true,
	}
	if err := db.Create(&role).Error; err != nil {
		return role, err
	}
	log.Printf("Seeded App Role: %s", name)
	return role, nil
}

func seedBendaharaAppRole(db *gorm.DB) error {
	role, err := ensureSystemRole(db, "Bendahara", "Bendahara organisasi — catat dan pantau keuangan")
	if err != nil {
		return err
	}

	codes := []string{
		"finance.view",
		"finance.create",
		"finance.edit",
		"finance.delete",
		"finance.categories",
		"finance.manage",
	}
	var perms []models.Permission
	if err := db.Where("code IN ?", codes).Find(&perms).Error; err != nil {
		return err
	}
	for _, p := range perms {
		var count int64
		db.Model(&models.RolePermission{}).Where("role_id = ? AND permission_id = ?", role.ID, p.ID).Count(&count)
		if count > 0 {
			continue
		}
		rp := models.RolePermission{RoleID: role.ID, PermissionID: p.ID}
		if err := db.Create(&rp).Error; err != nil {
			return err
		}
	}
	return nil
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
		{Name: "Surat Masuk", Code: "SM-IN", StartNumber: 0, CurrentNumber: 0, NumberFormatTemplate: "{number}"},
	}
	for _, c := range cats {
		if err := ensureLetterCategory(db, c); err != nil {
			return err
		}
	}
	return nil
}

func ensureLetterCategory(db *gorm.DB, cat models.LetterCategory) error {
	var existing models.LetterCategory
	err := db.Unscoped().Where("code = ?", cat.Code).First(&existing).Error
	if err == nil {
		return db.Unscoped().Model(&existing).Updates(map[string]any{
			"name":                   cat.Name,
			"number_format_template": cat.NumberFormatTemplate,
			"deleted_at":             nil,
		}).Error
	}
	if err != gorm.ErrRecordNotFound {
		return err
	}
	if err := db.Create(&cat).Error; err != nil {
		return err
	}
	log.Printf("Seeded letter category: %s", cat.Code)
	return nil
}

func seedFinanceCategories(db *gorm.DB) error {
	cats := []models.FinanceCategory{
		{Name: "Iuran Anggota", Type: "income", Description: "Pemasukan dari iuran rutin anggota"},
		{Name: "Donasi", Type: "income", Description: "Pemasukan donasi/sponsorship"},
		{Name: "Pemasukan Lainnya", Type: "income", Description: "Pemasukan di luar kategori utama"},
		{Name: "Operasional", Type: "expense", Description: "Biaya operasional kegiatan"},
		{Name: "Konsumsi", Type: "expense", Description: "Biaya makan/minum kegiatan"},
		{Name: "Transport", Type: "expense", Description: "Biaya transportasi"},
		{Name: "Pengeluaran Lainnya", Type: "expense", Description: "Pengeluaran di luar kategori utama"},
	}
	for _, c := range cats {
		if err := ensureFinanceCategory(db, c); err != nil {
			return err
		}
	}
	return nil
}

func ensureFinanceCategory(db *gorm.DB, cat models.FinanceCategory) error {
	var existing models.FinanceCategory
	err := db.Unscoped().Where("name = ? AND type = ?", cat.Name, cat.Type).First(&existing).Error
	if err == nil {
		return db.Unscoped().Model(&existing).Updates(map[string]any{
			"description": cat.Description,
			"deleted_at":  nil,
		}).Error
	}
	if err != gorm.ErrRecordNotFound {
		return err
	}
	if err := db.Create(&cat).Error; err != nil {
		return err
	}
	log.Printf("Seeded finance category: %s (%s)", cat.Name, cat.Type)
	return nil
}

func seedDemoDivision(db *gorm.DB) (string, error) {
	div, err := ensureDivision(db, "Umum", "Divisi umum / general")
	if err != nil {
		return "", err
	}
	return div.ID, nil
}

func ensureDivision(db *gorm.DB, name, description string) (models.Division, error) {
	var div models.Division
	err := db.Unscoped().Where("name = ?", name).First(&div).Error
	if err == nil {
		if err := db.Unscoped().Model(&div).Updates(map[string]any{
			"description": description,
			"deleted_at":  nil,
		}).Error; err != nil {
			return div, err
		}
		return div, nil
	}
	if err != gorm.ErrRecordNotFound {
		return div, err
	}
	div = models.Division{Name: name, Description: description}
	if err := db.Create(&div).Error; err != nil {
		return div, err
	}
	log.Printf("Seeded division: %s", name)
	return div, nil
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
