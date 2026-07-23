package main

import (
	"flag"
	"fmt"
	"log"
	"time"

	"myorg/apps/api/internal/backup"
	"myorg/apps/api/internal/config"
	"myorg/apps/api/internal/database"
	"myorg/apps/api/internal/models"
	"myorg/apps/api/internal/storage"
)

// Replays a backup archive into the configured database. Runs migrations first
// (the archive carries data, not schema), then executes dump.sql in one
// transaction: every row lands, or none does. Uploaded files in files/ are
// restored to object storage when configured.
func main() {
	migrate := flag.Bool("migrate", true, "Run migrations before restoring")
	fresh := flag.Bool("fresh", true, "Truncate all tables before restoring (recommended)")
	flag.Parse()

	if flag.NArg() < 1 {
		log.Fatal("usage: restore [--migrate=false] [--fresh=false] <backup.zip>")
	}
	path := flag.Arg(0)

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}
	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	var st *storage.Storage
	if cfg.Storage.Endpoint != "" && cfg.Storage.Bucket != "" {
		s, err := storage.New(cfg.Storage)
		if err != nil {
			log.Printf("Warning: object storage unavailable, files will not be restored: %v", err)
		} else {
			st = s
		}
	}

	if *migrate {
		fmt.Println("Running migrations...")
		if err := models.Migrate(db); err != nil {
			log.Fatalf("Migration failed: %v", err)
		}
	}

	fmt.Printf("Restoring %s ...\n", path)
	man, err := backup.Restore(db, st, path, backup.RestoreOptions{
		ClearExisting: *fresh,
	})
	if err != nil {
		log.Fatalf("Restore failed: %v", err)
	}

	fmt.Printf("Restored %d tables, %d rows, %d files (archive generated %s)\n",
		len(man.Tables), man.TotalRows, man.FileCount, man.GeneratedAt.Format(time.RFC3339))
}
