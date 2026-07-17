// Command vapidgen prints a fresh Web Push VAPID key pair for .env.
//
//	cd apps/api && go run ./cmd/vapidgen
package main

import (
	"fmt"
	"os"

	webpush "github.com/SherClockHolmes/webpush-go"
)

func main() {
	priv, pub, err := webpush.GenerateVAPIDKeys()
	if err != nil {
		fmt.Fprintf(os.Stderr, "generate VAPID keys: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("# Paste into project root .env (and rebuild web so NEXT_PUBLIC_* if mirrored)")
	fmt.Printf("VAPID_PUBLIC_KEY=%s\n", pub)
	fmt.Printf("VAPID_PRIVATE_KEY=%s\n", priv)
	fmt.Println("VAPID_SUBJECT=mailto:noreply@yourdomain.com")
	fmt.Println("# Also set on the web app build:")
	fmt.Printf("NEXT_PUBLIC_VAPID_PUBLIC_KEY=%s\n", pub)
}
