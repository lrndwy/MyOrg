package database

import (
	"fmt"
	"log"
	"os"

	"myorg/apps/api/internal/models"
	"gorm.io/gorm"
)

// SeedUsers creates the default admin account plus a few demo accounts.
// Edit the slices below to change who gets seeded.
func SeedUsers(db *gorm.DB) error {
	if err := seedAdminUser(db); err != nil {
		return fmt.Errorf("seeding admin user: %w", err)
	}
	if err := seedDemoUsers(db); err != nil {
		return fmt.Errorf("seeding demo users: %w", err)
	}
	return nil
}

// userExistsByEmail reports whether a user with the email already exists
// (including soft-deleted rows). Restores soft-deleted users so re-seed is safe.
func userExistsByEmail(db *gorm.DB, email string) (bool, error) {
	var u models.User
	err := db.Unscoped().Where("email = ?", email).First(&u).Error
	if err == gorm.ErrRecordNotFound {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if u.DeletedAt.Valid {
		if err := db.Unscoped().Model(&u).Updates(map[string]any{
			"deleted_at": nil,
			"status":     "active",
		}).Error; err != nil {
			return true, err
		}
	}
	return true, nil
}

// seedAdminUser creates the default admin account.
func seedAdminUser(db *gorm.DB) error {
	exists, err := userExistsByEmail(db, "admin@example.com")
	if err != nil {
		return err
	}
	if exists {
		log.Println("Admin user already exists, skipping...")
		return nil
	}

	// Password resolution: SEED_ADMIN_PASSWORD wins so a real deployment can
	// seed a strong credential. Otherwise fall back to the docs default
	// "admin123" — but ONLY outside production, so the weak dev password can
	// never slip into a prod database unnoticed.
	password := os.Getenv("SEED_ADMIN_PASSWORD")
	if password == "" {
		if os.Getenv("APP_ENV") == "production" {
			return fmt.Errorf("refusing to seed the default admin in production: set SEED_ADMIN_PASSWORD to a strong password, or run the seeder with a non-production APP_ENV")
		}
		password = "admin123"
	}

	adminUser := "admin"
	admin := models.User{
		FirstName: "Admin",
		LastName:  "User",
		FullName:  "Admin User",
		Username:  &adminUser,
		Email:     "admin@example.com",
		Password:  password,
		Role:      "ADMIN",
		Active:    true,
		Status:    "active",
	}

	if err := db.Create(&admin).Error; err != nil {
		return fmt.Errorf("creating admin user: %w", err)
	}

	if os.Getenv("SEED_ADMIN_PASSWORD") != "" {
		log.Println("Created admin user: admin@example.com (password from SEED_ADMIN_PASSWORD)")
	} else {
		log.Println("Created admin user: admin@example.com / admin123 (dev default — change before production)")
	}
	return nil
}

// seedDemoUsers creates sample user accounts for development.
// All demo users share the password "admin123" — the same as the admin
// seed — so the Concepts course / first-look lesson works without
// remembering a second password.
func seedDemoUsers(db *gorm.DB) error {
	// Demo users are dev fixtures sharing a weak password — never seed them
	// into a production database.
	if os.Getenv("APP_ENV") == "production" {
		log.Println("Skipping demo users in production")
		return nil
	}
	users := []models.User{
		{FirstName: "Jane", LastName: "Cooper", Email: "jane@example.com", Password: "admin123", Role: "EDITOR", Active: true, Status: "active"},
		{FirstName: "Robert", LastName: "Fox", Email: "robert@example.com", Password: "admin123", Role: "USER", Active: true, Status: "active"},
		{FirstName: "Emily", LastName: "Davis", Email: "emily@example.com", Password: "admin123", Role: "USER", Active: true, Status: "active"},
		{FirstName: "Michael", LastName: "Chen", Email: "michael@example.com", Password: "admin123", Role: "USER", Active: false, Status: "active"},
	}

	for _, u := range users {
		exists, err := userExistsByEmail(db, u.Email)
		if err != nil {
			return fmt.Errorf("checking user %s: %w", u.Email, err)
		}
		if exists {
			continue
		}

		if err := db.Create(&u).Error; err != nil {
			return fmt.Errorf("creating user %s: %w", u.Email, err)
		}
		log.Printf("Created user: %s / admin123", u.Email)
	}

	return nil
}
