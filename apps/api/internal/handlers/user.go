package handlers

import (
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"myorg/apps/api/internal/models"
	"myorg/apps/api/internal/services"
)

func emptyToNil(s *string) *string {
	if s == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*s)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

// UserHandler handles user management endpoints.
type UserHandler struct {
	DB *gorm.DB
	// AuthService is used by DeleteProfile to clear the HttpOnly auth
	// cookies as part of the soft-delete response. Optional — if nil,
	// the cookies just won't be cleared and the client's next request
	// will 401 normally.
	AuthService *services.AuthService
}

// Create creates a new user (admin only).
func (h *UserHandler) Create(c *gin.Context) {
	var req struct {
		FirstName  string  `json:"first_name" binding:"required"`
		LastName   string  `json:"last_name" binding:"required"`
		Email      string  `json:"email" binding:"required,email"`
		Password   string  `json:"password" binding:"required,min=6"`
		Role       string  `json:"role"` // Grit base role: ADMIN|EDITOR|USER
		Avatar     string  `json:"avatar"`
		JobTitle   string  `json:"job_title"`
		Active     *bool   `json:"active"`
		Username   string  `json:"username" binding:"required,min=3"`
		FullName   string  `json:"full_name"`
		Hometown   string  `json:"hometown"`
		Phone      string  `json:"phone"`
		DivisionID *string `json:"division_id"`
		AppRoleID  *string `json:"app_role_id"`
		Status     string  `json:"status"`
		BirthDate  *string `json:"birth_date"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": err.Error(),
			},
		})
		return
	}

	var existing models.User
	if err := h.DB.Where("email = ?", req.Email).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{
			"error": gin.H{
				"code":    "EMAIL_EXISTS",
				"message": "A user with this email already exists",
			},
		})
		return
	}
	if err := h.DB.Where("username = ?", req.Username).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{
			"error": gin.H{
				"code":    "USERNAME_EXISTS",
				"message": "A user with this username already exists",
			},
		})
		return
	}

	fullName := strings.TrimSpace(req.FullName)
	if fullName == "" {
		fullName = strings.TrimSpace(req.FirstName + " " + req.LastName)
	}
	username := strings.TrimSpace(req.Username)
	status := req.Status
	if status == "" {
		status = "active"
	}

	user := models.User{
		FirstName:  req.FirstName,
		LastName:   req.LastName,
		Email:      req.Email,
		Password:   req.Password,
		Role:       req.Role,
		Avatar:     req.Avatar,
		JobTitle:   req.JobTitle,
		Active:     true,
		Username:   &username,
		FullName:   fullName,
		Hometown:   req.Hometown,
		Phone:      req.Phone,
		DivisionID: emptyToNil(req.DivisionID),
		AppRoleID:  emptyToNil(req.AppRoleID),
		Status:     status,
	}

	if req.Active != nil {
		user.Active = *req.Active
	}
	if user.Role == "" {
		user.Role = models.RoleUser
	}
	if req.BirthDate != nil && *req.BirthDate != "" {
		if t, err := time.Parse("2006-01-02", *req.BirthDate); err == nil {
			user.BirthDate = &t
		}
	}

	if err := h.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to create user: " + err.Error(),
			},
		})
		return
	}

	h.DB.Preload("Division").Preload("AppRole").Where("id = ?", user.ID).First(&user)

	c.JSON(http.StatusCreated, gin.H{
		"data":    user,
		"message": "User created successfully",
	})
}

// List returns a paginated list of users.
func (h *UserHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	search := c.Query("search")
	sortBy := c.DefaultQuery("sort_by", "created_at")
	sortOrder := c.DefaultQuery("sort_order", "desc")

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	// Validate sort order
	if sortOrder != "asc" && sortOrder != "desc" {
		sortOrder = "desc"
	}

	// Validate sort column
	allowedSorts := map[string]bool{
		"id": true, "first_name": true, "last_name": true, "email": true, "role": true, "created_at": true,
	}
	if !allowedSorts[sortBy] {
		sortBy = "created_at"
	}

	query := h.DB.Model(&models.User{}).Preload("Division").Preload("AppRole")

	// Search
	if search != "" {
		query = query.Where("first_name ILIKE ? OR last_name ILIKE ? OR email ILIKE ? OR username ILIKE ? OR full_name ILIKE ?", "%"+search+"%", "%"+search+"%", "%"+search+"%", "%"+search+"%", "%"+search+"%")
	}

	// Count total
	var total int64
	query.Count(&total)

	// Fetch paginated results
	var users []models.User
	offset := (page - 1) * pageSize
	if err := query.Order(sortBy + " " + sortOrder).Offset(offset).Limit(pageSize).Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to fetch users",
			},
		})
		return
	}

	pages := int(math.Ceil(float64(total) / float64(pageSize)))

	c.JSON(http.StatusOK, gin.H{
		"data": users,
		"meta": gin.H{
			"total":     total,
			"page":      page,
			"page_size": pageSize,
			"pages":     pages,
		},
	})
}

// GetByID returns a single user by ID.
func (h *UserHandler) GetByID(c *gin.Context) {
	id := c.Param("id")

	var user models.User
	if err := h.DB.Preload("Division").Preload("AppRole").Where("id = ?", id).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "User not found",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": user,
	})
}

// Update modifies an existing user.
func (h *UserHandler) Update(c *gin.Context) {
	id := c.Param("id")

	var user models.User
	if err := h.DB.Where("id = ?", id).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "User not found",
			},
		})
		return
	}

	var req struct {
		FirstName  string  `json:"first_name"`
		LastName   string  `json:"last_name"`
		Email      string  `json:"email"`
		Password   string  `json:"password"`
		Role       string  `json:"role"`
		Avatar     string  `json:"avatar"`
		JobTitle   string  `json:"job_title"`
		Bio        string  `json:"bio"`
		Active     *bool   `json:"active"`
		Username   *string `json:"username"`
		FullName   *string `json:"full_name"`
		Hometown   *string `json:"hometown"`
		Phone      *string `json:"phone"`
		DivisionID *string `json:"division_id"`
		AppRoleID  *string `json:"app_role_id"`
		Status     *string `json:"status"`
		BirthDate  *string `json:"birth_date"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": err.Error(),
			},
		})
		return
	}

	updates := map[string]interface{}{}
	if req.FirstName != "" {
		updates["first_name"] = req.FirstName
	}
	if req.LastName != "" {
		updates["last_name"] = req.LastName
	}
	if req.Email != "" {
		updates["email"] = req.Email
	}
	if req.Password != "" {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": gin.H{
					"code":    "INTERNAL_ERROR",
					"message": "Failed to hash password",
				},
			})
			return
		}
		updates["password"] = string(hashedPassword)
	}
	if req.Role != "" {
		updates["role"] = req.Role
	}
	if req.Avatar != "" {
		updates["avatar"] = req.Avatar
	}
	if req.JobTitle != "" {
		updates["job_title"] = req.JobTitle
	}
	if req.Bio != "" {
		updates["bio"] = req.Bio
	}
	if req.Active != nil {
		updates["active"] = *req.Active
	}
	if req.Username != nil {
		u := strings.TrimSpace(*req.Username)
		if u == "" {
			updates["username"] = nil
		} else {
			var clash models.User
			if err := h.DB.Where("username = ? AND id <> ?", u, id).First(&clash).Error; err == nil {
				c.JSON(http.StatusConflict, gin.H{
					"error": gin.H{"code": "USERNAME_EXISTS", "message": "Username already taken"},
				})
				return
			}
			updates["username"] = u
		}
	}
	if req.FullName != nil {
		updates["full_name"] = strings.TrimSpace(*req.FullName)
	}
	if req.Hometown != nil {
		updates["hometown"] = *req.Hometown
	}
	if req.Phone != nil {
		updates["phone"] = *req.Phone
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if req.DivisionID != nil {
		updates["division_id"] = emptyToNil(req.DivisionID)
	}
	if req.AppRoleID != nil {
		updates["app_role_id"] = emptyToNil(req.AppRoleID)
	}
	if req.BirthDate != nil {
		if *req.BirthDate == "" {
			updates["birth_date"] = nil
		} else if t, err := time.Parse("2006-01-02", *req.BirthDate); err == nil {
			updates["birth_date"] = t
		}
	}

	if err := h.DB.Model(&user).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to update user: " + err.Error(),
			},
		})
		return
	}

	h.DB.Preload("Division").Preload("AppRole").Where("id = ?", id).First(&user)

	c.JSON(http.StatusOK, gin.H{
		"data":    user,
		"message": "User updated successfully",
	})
}

// Delete soft-deletes a user.
func (h *UserHandler) Delete(c *gin.Context) {
	id := c.Param("id")

	var user models.User
	if err := h.DB.Where("id = ?", id).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "User not found",
			},
		})
		return
	}

	if err := h.DB.Delete(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to delete user",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "User deleted successfully",
	})
}

// GetProfile returns the currently authenticated user's profile.
func (h *UserHandler) GetProfile(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var user models.User
	if err := h.DB.Where("id = ?", userID).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "User not found",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": user,
	})
}

// UpdateProfile updates the currently authenticated user's profile.
func (h *UserHandler) UpdateProfile(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var user models.User
	if err := h.DB.Where("id = ?", userID).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "User not found",
			},
		})
		return
	}

	var req struct {
		FirstName string  `json:"first_name"`
		LastName  string  `json:"last_name"`
		Email     string  `json:"email"`
		Password  string  `json:"password"`
		Avatar    string  `json:"avatar"`
		FullName  *string `json:"full_name"`
		Hometown  *string `json:"hometown"`
		Phone     *string `json:"phone"`
		BirthDate *string `json:"birth_date"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"error": gin.H{
				"code":    "VALIDATION_ERROR",
				"message": err.Error(),
			},
		})
		return
	}

	updates := map[string]interface{}{}
	if req.FirstName != "" {
		updates["first_name"] = req.FirstName
	}
	if req.LastName != "" {
		updates["last_name"] = req.LastName
	}
	if req.Email != "" {
		updates["email"] = req.Email
	}
	if req.Password != "" {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": gin.H{
					"code":    "INTERNAL_ERROR",
					"message": "Failed to hash password",
				},
			})
			return
		}
		updates["password"] = string(hashedPassword)
	}
	if req.Avatar != "" {
		updates["avatar"] = req.Avatar
	}
	if req.FullName != nil {
		updates["full_name"] = strings.TrimSpace(*req.FullName)
	}
	if req.Hometown != nil {
		updates["hometown"] = strings.TrimSpace(*req.Hometown)
	}
	if req.Phone != nil {
		updates["phone"] = strings.TrimSpace(*req.Phone)
	}
	if req.BirthDate != nil {
		if *req.BirthDate == "" {
			updates["birth_date"] = nil
		} else if t, err := time.Parse("2006-01-02", *req.BirthDate); err == nil {
			updates["birth_date"] = t
		}
	}

	if err := h.DB.Model(&user).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to update profile",
			},
		})
		return
	}

	h.DB.Where("id = ?", userID).First(&user)

	c.JSON(http.StatusOK, gin.H{
		"data":    user,
		"message": "Profile updated successfully",
	})
}

// DeleteProfile soft-deletes the currently authenticated user's account.
func (h *UserHandler) DeleteProfile(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var user models.User
	if err := h.DB.Where("id = ?", userID).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "User not found",
			},
		})
		return
	}

	if err := h.DB.Delete(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "Failed to delete account",
			},
		})
		return
	}

	// Soft-delete leaves the JWT valid in theory; the auth middleware
	// would still 401 on the next request because the user row is
	// excluded by the default scope. We still expire the HttpOnly auth
	// cookies on the way out so the next /api/* call from this browser
	// doesn't even attempt — saves a round trip and a confusing 401 in
	// the dev console.
	if h.AuthService != nil {
		h.AuthService.ClearAuthCookies(c)
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Account deleted successfully",
	})
}
