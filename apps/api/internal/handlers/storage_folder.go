package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"myorg/apps/api/internal/models"
)

func (h *UploadHandler) requireStorageManage(c *gin.Context) (models.User, bool) {
	user, ok := h.requireStorageView(c)
	if !ok {
		return models.User{}, false
	}
	if !h.canManageStorage(c, user) {
		c.JSON(http.StatusForbidden, gin.H{
			"error": gin.H{"code": "FORBIDDEN", "message": "Membutuhkan permission storage.manage"},
		})
		return models.User{}, false
	}
	return user, true
}

func normalizeFolderParentID(raw string) *string {
	raw = strings.TrimSpace(raw)
	if raw == "" || raw == "root" || raw == "null" {
		return nil
	}
	return &raw
}

func (h *UploadHandler) folderByID(id string) (*models.StorageFolder, error) {
	var folder models.StorageFolder
	if err := h.DB.First(&folder, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &folder, nil
}

func (h *UploadHandler) collectDescendantFolderIDs(rootID string) ([]string, error) {
	ids := []string{rootID}
	queue := []string{rootID}
	for len(queue) > 0 {
		parentID := queue[0]
		queue = queue[1:]
		var children []models.StorageFolder
		if err := h.DB.Where("parent_id = ?", parentID).Find(&children).Error; err != nil {
			return nil, err
		}
		for _, child := range children {
			ids = append(ids, child.ID)
			queue = append(queue, child.ID)
		}
	}
	return ids, nil
}

func (h *UploadHandler) folderWouldCreateCycle(folderID string, newParentID *string) bool {
	if newParentID == nil || *newParentID == "" {
		return false
	}
	if folderID == *newParentID {
		return true
	}
	descendants, err := h.collectDescendantFolderIDs(folderID)
	if err != nil {
		return true
	}
	for _, id := range descendants {
		if id == *newParentID {
			return true
		}
	}
	return false
}

// ListFolders returns folders at a given parent (root when parent_id is empty).
func (h *UploadHandler) ListFolders(c *gin.Context) {
	if _, ok := h.requireStorageManage(c); !ok {
		return
	}

	parentID := normalizeFolderParentID(c.Query("parent_id"))
	query := h.DB.Model(&models.StorageFolder{})
	if parentID == nil {
		query = query.Where("parent_id IS NULL")
	} else {
		if _, err := h.folderByID(*parentID); err != nil {
			c.JSON(http.StatusNotFound, gin.H{
				"error": gin.H{"code": "NOT_FOUND", "message": "Folder induk tidak ditemukan"},
			})
			return
		}
		query = query.Where("parent_id = ?", *parentID)
	}

	var folders []models.StorageFolder
	if err := query.Order("name ASC").Find(&folders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "INTERNAL_ERROR", "message": "Gagal memuat folder"},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": folders})
}

// CreateFolder creates a new virtual folder.
func (h *UploadHandler) CreateFolder(c *gin.Context) {
	user, ok := h.requireStorageManage(c)
	if !ok {
		return
	}

	var req struct {
		Name     string  `json:"name" binding:"required"`
		ParentID *string `json:"parent_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()},
		})
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{"code": "VALIDATION_ERROR", "message": "Nama folder wajib diisi"},
		})
		return
	}

	parentID := req.ParentID
	if parentID != nil && strings.TrimSpace(*parentID) == "" {
		parentID = nil
	}
	if parentID != nil {
		if _, err := h.folderByID(*parentID); err != nil {
			c.JSON(http.StatusNotFound, gin.H{
				"error": gin.H{"code": "NOT_FOUND", "message": "Folder induk tidak ditemukan"},
			})
			return
		}
	}

	folder := models.StorageFolder{
		ID:       uuid.New().String(),
		Name:     name,
		ParentID: parentID,
		UserID:   user.ID,
	}
	if err := h.DB.Create(&folder).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "INTERNAL_ERROR", "message": "Gagal membuat folder"},
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": folder, "message": "Folder berhasil dibuat"})
}

// UpdateFolder renames or moves a folder.
func (h *UploadHandler) UpdateFolder(c *gin.Context) {
	if _, ok := h.requireStorageManage(c); !ok {
		return
	}

	id := c.Param("id")
	folder, err := h.folderByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{"code": "NOT_FOUND", "message": "Folder tidak ditemukan"},
		})
		return
	}

	var req struct {
		Name     *string `json:"name"`
		ParentID *string `json:"parent_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()},
		})
		return
	}

	updates := map[string]interface{}{}
	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)
		if name == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": gin.H{"code": "VALIDATION_ERROR", "message": "Nama folder tidak boleh kosong"},
			})
			return
		}
		updates["name"] = name
	}
	if req.ParentID != nil {
		parentID := normalizeFolderParentID(*req.ParentID)
		if parentID != nil {
			if _, err := h.folderByID(*parentID); err != nil {
				c.JSON(http.StatusNotFound, gin.H{
					"error": gin.H{"code": "NOT_FOUND", "message": "Folder induk tidak ditemukan"},
				})
				return
			}
		}
		if h.folderWouldCreateCycle(folder.ID, parentID) {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": gin.H{"code": "INVALID_MOVE", "message": "Folder tidak boleh dipindah ke dalam dirinya sendiri"},
			})
			return
		}
		updates["parent_id"] = parentID
	}

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{"code": "VALIDATION_ERROR", "message": "Tidak ada perubahan"},
		})
		return
	}

	if err := h.DB.Model(folder).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "INTERNAL_ERROR", "message": "Gagal memperbarui folder"},
		})
		return
	}

	if err := h.DB.First(folder, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "INTERNAL_ERROR", "message": "Gagal memuat folder"},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": folder, "message": "Folder diperbarui"})
}

// FolderBreadcrumb returns the path from root to the folder.
func (h *UploadHandler) FolderBreadcrumb(c *gin.Context) {
	if _, ok := h.requireStorageManage(c); !ok {
		return
	}

	id := c.Param("id")
	if id == "" || id == "root" {
		c.JSON(http.StatusOK, gin.H{"data": []models.StorageFolder{}})
		return
	}

	type crumb struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	crumbs := []crumb{}
	currentID := id
	for currentID != "" {
		folder, err := h.folderByID(currentID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{
				"error": gin.H{"code": "NOT_FOUND", "message": "Folder tidak ditemukan"},
			})
			return
		}
		crumbs = append([]crumb{{ID: folder.ID, Name: folder.Name}}, crumbs...)
		if folder.ParentID == nil {
			break
		}
		currentID = *folder.ParentID
	}

	c.JSON(http.StatusOK, gin.H{"data": crumbs})
}

func (h *UploadHandler) deleteUploadRecord(c *gin.Context, upload *models.Upload) error {
	if h.Storage != nil {
		ctx := c.Request.Context()
		_ = h.Storage.Delete(ctx, upload.Path)
		if upload.ThumbnailURL != "" {
			thumbKey := strings.Replace(upload.Path, "uploads/", "thumbnails/", 1)
			_ = h.Storage.Delete(ctx, thumbKey)
		}
	}
	return h.DB.Delete(upload).Error
}

// DeleteFolder removes a folder and all nested content (Google Drive style).
func (h *UploadHandler) DeleteFolder(c *gin.Context) {
	if _, ok := h.requireStorageManage(c); !ok {
		return
	}

	id := c.Param("id")
	if _, err := h.folderByID(id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{"code": "NOT_FOUND", "message": "Folder tidak ditemukan"},
		})
		return
	}

	folderIDs, err := h.collectDescendantFolderIDs(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "INTERNAL_ERROR", "message": "Gagal menghapus folder"},
		})
		return
	}

	var uploads []models.Upload
	if err := h.DB.Where("folder_id IN ?", folderIDs).Find(&uploads).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "INTERNAL_ERROR", "message": "Gagal menghapus isi folder"},
		})
		return
	}
	for i := range uploads {
		if err := h.deleteUploadRecord(c, &uploads[i]); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": gin.H{"code": "INTERNAL_ERROR", "message": "Gagal menghapus file dalam folder"},
			})
			return
		}
	}

	if err := h.DB.Where("id IN ?", folderIDs).Delete(&models.StorageFolder{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "INTERNAL_ERROR", "message": "Gagal menghapus folder"},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Folder dan isinya berhasil dihapus",
		"data": gin.H{
			"folders_deleted": len(folderIDs),
			"files_deleted":   len(uploads),
		},
	})
}

// MoveUpload moves an upload into a folder (or root when folder_id is null).
func (h *UploadHandler) MoveUpload(c *gin.Context) {
	if _, ok := h.requireStorageManage(c); !ok {
		return
	}

	id := c.Param("id")
	var upload models.Upload
	if err := h.DB.First(&upload, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{"code": "NOT_FOUND", "message": "Upload not found"},
		})
		return
	}

	var req struct {
		FolderID *string `json:"folder_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{"code": "VALIDATION_ERROR", "message": err.Error()},
		})
		return
	}

	folderID := req.FolderID
	if folderID != nil && strings.TrimSpace(*folderID) == "" {
		folderID = nil
	}
	if folderID != nil {
		if _, err := h.folderByID(*folderID); err != nil {
			c.JSON(http.StatusNotFound, gin.H{
				"error": gin.H{"code": "NOT_FOUND", "message": "Folder tujuan tidak ditemukan"},
			})
			return
		}
	}

	if err := h.DB.Model(&upload).Update("folder_id", folderID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{"code": "INTERNAL_ERROR", "message": "Gagal memindahkan file"},
		})
		return
	}
	upload.FolderID = folderID

	c.JSON(http.StatusOK, gin.H{"data": upload, "message": "File dipindahkan"})
}
