package middleware

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// CSRF implements double-submit-cookie protection (OWASP Top 10:2025
// A01-adjacent). Use on cookie-authenticated routes. SPA + JWT in
// Authorization header doesn't need this — only cookie sessions do.
//
// Wire it like:
//
//	cookieRoutes := r.Group("/")
//	cookieRoutes.Use(middleware.CSRF())
//	cookieRoutes.POST("/api/auth/oauth/google/callback", h.OAuthCallback)
//
// The middleware sets a "grit_csrf" cookie on safe requests; unsafe
// methods (POST/PUT/PATCH/DELETE) must echo it via the X-CSRF-Token
// header. SameSite=Strict on the cookie is a second layer of defence.
func CSRF() gin.HandlerFunc {
	const (
		cookieName = "grit_csrf"
		headerName = "X-CSRF-Token"
	)
	return func(c *gin.Context) {
		method := strings.ToUpper(c.Request.Method)
		if method == http.MethodGet || method == http.MethodHead || method == http.MethodOptions {
			// Safe method — issue or refresh the token cookie if missing.
			if existing, err := c.Cookie(cookieName); err != nil || existing == "" {
				token, gerr := newCSRFToken()
				if gerr == nil {
					c.SetSameSite(http.SameSiteStrictMode)
					c.SetCookie(cookieName, token, 86400, "/", "", c.Request.TLS != nil, false)
				}
			}
			c.Next()
			return
		}

		// Unsafe method — require matching header + cookie.
		headerToken := c.GetHeader(headerName)
		if !csrfHeaderMatchesCookie(c, headerToken) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": gin.H{
					"code":    "CSRF_INVALID",
					"message": "CSRF token missing or invalid",
				},
			})
			return
		}
		c.Next()
	}
}

func newCSRFToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", errors.New("generating CSRF token")
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

const csrfCookieName = "grit_csrf"

// csrfHeaderMatchesCookie reports whether headerToken matches any grit_csrf
// cookie on the request. Browsers may send duplicate names after migrating
// to AUTH_COOKIE_DOMAIN (host-only + parent-domain); net/http Cookie()
// returns only the first, which can disagree with the token the SPA read.
func csrfHeaderMatchesCookie(c *gin.Context, headerToken string) bool {
	if headerToken == "" {
		return false
	}
	for _, cookie := range c.Request.Cookies() {
		if cookie.Name != csrfCookieName {
			continue
		}
		if subtle.ConstantTimeCompare([]byte(cookie.Value), []byte(headerToken)) == 1 {
			return true
		}
	}
	return false
}

// IssueCSRFCookie writes the double-submit CSRF cookie. When force is false
// and a token already exists, the existing value is returned unchanged.
// Call with force=true after login/refresh so cross-subdomain SPAs can mutate
// immediately without waiting for a safe-method round-trip.
func IssueCSRFCookie(c *gin.Context, cookieDomain string, force bool) (string, error) {
	if !force {
		if existing, err := c.Cookie(csrfCookieName); err == nil && existing != "" {
			return existing, nil
		}
	}
	token, err := newCSRFToken()
	if err != nil {
		return "", err
	}
	c.SetSameSite(http.SameSiteLaxMode)
	secure := c.Request.TLS != nil || strings.EqualFold(c.GetHeader("X-Forwarded-Proto"), "https")
	// Drop a legacy host-only grit_csrf so cross-subdomain SPAs don't end up
	// with two cookies and a header/cookie mismatch on the next mutation.
	if cookieDomain != "" {
		c.SetCookie(csrfCookieName, "", -1, "/", "", secure, false)
	}
	c.SetCookie(csrfCookieName, token, 86400, "/", cookieDomain, secure, false)
	return token, nil
}

// AutoCSRF is the global, default-on CSRF guard. It only enforces CSRF
// when the request carries the grit_access auth cookie — i.e., a browser
// client that the API previously authenticated via cookies. Native
// mobile / desktop clients use Authorization: Bearer (which the browser
// never auto-sends across origins), so they're immune to CSRF and pass
// through with no header required.
//
// Pair this with the cookie helpers in services/auth.go (SetAuthCookies /
// ClearAuthCookies). Together they close OWASP A01 + A05 for cookie auth
// without forcing every route to opt in.
//
// Behaviour:
//
//   - GET/HEAD/OPTIONS                    → issue grit_csrf cookie if missing.
//   - POST/PUT/PATCH/DELETE with cookie   → require matching X-CSRF-Token.
//   - POST/PUT/PATCH/DELETE bearer-only   → no-op (header auth is CSRF-safe).
//   - Login / register / refresh routes   → skipped (they MINT the cookie).
func AutoCSRF(cookieDomain string) gin.HandlerFunc {
	const (
		csrfCookie   = "grit_csrf"
		csrfHeader   = "X-CSRF-Token"
		accessCookie = "grit_access"
	)
	// Routes that bootstrap the session (login etc.) can't have a CSRF
	// cookie yet — exempt them so users can sign in on the first try.
	bootstrap := map[string]bool{
		"/api/auth/login":           true,
		"/api/auth/register":        true,
		"/api/auth/refresh":         true,
		"/api/auth/forgot-password": true,
		"/api/auth/reset-password":  true,
		"/api/auth/totp/verify":     true,
		"/api/auth/totp/backup-codes/verify": true,
	}
	return func(c *gin.Context) {
		method := strings.ToUpper(c.Request.Method)
		path := c.Request.URL.Path

		// Issue / refresh the CSRF cookie on safe methods. We do this even
		// for unauthenticated visitors so SPA bootstrap code can read the
		// token from a sibling /api/auth/csrf call without a chicken-and-egg.
		if method == http.MethodGet || method == http.MethodHead || method == http.MethodOptions {
			_, _ = IssueCSRFCookie(c, cookieDomain, false)
			c.Next()
			return
		}

		// Bootstrap auth endpoints are exempt — they create the session.
		if bootstrap[path] {
			c.Next()
			return
		}

		// Bearer-authenticated request → CSRF-immune. A request that carries
		// an "Authorization: Bearer" header authenticates explicitly, not via
		// ambient cookies, so it can't be forged cross-site. We check this
		// BEFORE the cookie check because native clients (React Native fetch,
		// OkHttp) transparently store and resend the grit_access cookie set at
		// login — that stray cookie must not trip CSRF on a bearer mutation.
		if authz := c.GetHeader("Authorization"); strings.HasPrefix(authz, "Bearer ") {
			c.Next()
			return
		}

		// State-changing method. If the client did NOT authenticate via
		// cookie, this is a bearer flow (or anonymous) — neither needs CSRF.
		accessVal, _ := c.Cookie(accessCookie)
		if accessVal == "" {
			c.Next()
			return
		}

		// Cookie-authenticated mutation: require the double-submit token.
		headerToken := c.GetHeader(csrfHeader)
		if !csrfHeaderMatchesCookie(c, headerToken) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": gin.H{
					"code":    "CSRF_INVALID",
					"message": "CSRF token missing or invalid",
				},
			})
			return
		}
		c.Next()
	}
}
