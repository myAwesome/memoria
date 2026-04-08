package routes

import (
	"fmt"
	"image"
	_ "image/gif"
	"image/jpeg"
	_ "image/png"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"memoria/models"
)

const thumbnailMaxSize = 480

func createThumbnail(srcPath string, uploadDir string) (string, error) {
	f, err := os.Open(srcPath)
	if err != nil {
		return "", err
	}
	defer f.Close()

	src, _, err := image.Decode(f)
	if err != nil {
		return "", err
	}

	b := src.Bounds()
	srcW := b.Dx()
	srcH := b.Dy()
	if srcW <= 0 || srcH <= 0 {
		return "", fmt.Errorf("invalid image size")
	}

	scale := 1.0
	if srcW > thumbnailMaxSize || srcH > thumbnailMaxSize {
		scale = math.Min(float64(thumbnailMaxSize)/float64(srcW), float64(thumbnailMaxSize)/float64(srcH))
	}
	dstW := int(math.Round(float64(srcW) * scale))
	dstH := int(math.Round(float64(srcH) * scale))
	if dstW < 1 {
		dstW = 1
	}
	if dstH < 1 {
		dstH = 1
	}

	dst := image.NewRGBA(image.Rect(0, 0, dstW, dstH))
	for y := 0; y < dstH; y++ {
		srcY := b.Min.Y + (y*srcH)/dstH
		for x := 0; x < dstW; x++ {
			srcX := b.Min.X + (x*srcW)/dstW
			dst.Set(x, y, src.At(srcX, srcY))
		}
	}

	thumbDir := filepath.Join(uploadDir, "thumbs")
	if err := os.MkdirAll(thumbDir, 0755); err != nil {
		return "", err
	}
	thumbFilename := fmt.Sprintf("%d_thumb.jpg", time.Now().UnixNano())
	thumbPath := filepath.Join(thumbDir, thumbFilename)
	out, err := os.Create(thumbPath)
	if err != nil {
		return "", err
	}
	defer out.Close()

	if err := jpeg.Encode(out, dst, &jpeg.Options{Quality: 82}); err != nil {
		return "", err
	}

	return "/uploads/thumbs/" + thumbFilename, nil
}

// RegisterRoutes wires all CRUD routes onto r.
func RegisterRoutes(r *gin.Engine, db *gorm.DB, uploadDir string) {
	api := r.Group("/api")
	api.GET("/project", listProject(db))
	api.GET("/project/:id", getProject(db))
	api.POST("/project", createProject(db))
	api.PUT("/project/:id", updateProject(db))
	api.DELETE("/project/batch", batchDeleteProject(db))
	api.DELETE("/project/:id", deleteProject(db))
	api.GET("/asset", listAsset(db))
	api.GET("/asset/:id", getAsset(db))
	api.POST("/asset", createAsset(db))
	api.POST("/asset/upload", uploadAsset(db, uploadDir))
	api.PUT("/asset/:id", updateAsset(db))
	api.DELETE("/asset/batch", batchDeleteAsset(db))
	api.DELETE("/asset/:id", deleteAsset(db))
	r.Static("/uploads", uploadDir)
}

func listProject(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
		if page < 1 {
			page = 1
		}
		if limit < 1 || limit > 100 {
			limit = 20
		}
		offset := (page - 1) * limit
		sortBy := c.DefaultQuery("sort_by", "id")
		sortDir := c.DefaultQuery("sort_dir", "desc")
		allowedProject := map[string]bool{"id": true, "name": true, "data": true, "cover_asset_id": true, "created_at": true, "updated_at": true}
		if !allowedProject[sortBy] {
			sortBy = "id"
		}
		if sortDir != "asc" && sortDir != "desc" {
			sortDir = "desc"
		}
		query := db.Model(&models.Project{})
		if q := c.Query("q"); q != "" {
			like := "%" + strings.ReplaceAll(q, "%", "\\%") + "%"
			query = query.Where("name LIKE ? OR data LIKE ?", like, like)
		}
		if v := c.Query("name"); v != "" {
			query = query.Where("name = ?", v)
		}
		if v := c.Query("data"); v != "" {
			query = query.Where("data = ?", v)
		}
		if v := c.Query("cover_asset_id"); v != "" {
			query = query.Where("cover_asset_id = ?", v)
		}
		var total int64
		query.Count(&total)
		var rows []models.Project
		if err := query.Order(sortBy + " " + sortDir).Offset(offset).Limit(limit).Find(&rows).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": rows, "total": total, "page": page, "limit": limit})
	}
}

func getProject(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
			return
		}
		var row models.Project
		if err := db.First(&row, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusOK, row)
	}
}

func createProject(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var row models.Project
		if err := c.ShouldBindJSON(&row); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if err := db.Create(&row).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, row)
	}
}

func updateProject(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
			return
		}
		var row models.Project
		if err := db.First(&row, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		if err := c.ShouldBindJSON(&row); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if err := db.Save(&row).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, row)
	}
}

func deleteProject(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
			return
		}
		if err := db.Delete(&models.Project{}, id).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.Status(http.StatusNoContent)
	}
}

func batchDeleteProject(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			IDs []uint `json:"ids"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if len(body.IDs) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ids required"})
			return
		}
		if err := db.Delete(&models.Project{}, body.IDs).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.Status(http.StatusNoContent)
	}
}

func listAsset(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
		if page < 1 {
			page = 1
		}
		if limit < 1 || limit > 100 {
			limit = 20
		}
		offset := (page - 1) * limit
		sortBy := c.DefaultQuery("sort_by", "id")
		sortDir := c.DefaultQuery("sort_dir", "desc")
		allowedAsset := map[string]bool{"id": true, "path": true, "thumbnail_path": true, "filename": true, "original_name": true, "size": true, "mime_type": true, "created_at": true}
		if !allowedAsset[sortBy] {
			sortBy = "id"
		}
		if sortDir != "asc" && sortDir != "desc" {
			sortDir = "desc"
		}
		query := db.Model(&models.Asset{})
		if q := c.Query("q"); q != "" {
			like := "%" + strings.ReplaceAll(q, "%", "\\%") + "%"
			query = query.Where("original_name LIKE ? OR filename LIKE ? OR path LIKE ?", like, like, like)
		}
		if v := c.Query("path"); v != "" {
			query = query.Where("path = ?", v)
		}
		if v := c.Query("mime_type"); v != "" {
			query = query.Where("mime_type = ?", v)
		}
		var total int64
		query.Count(&total)
		var rows []models.Asset
		if err := query.Order(sortBy + " " + sortDir).Offset(offset).Limit(limit).Find(&rows).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": rows, "total": total, "page": page, "limit": limit})
	}
}

func getAsset(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
			return
		}
		var row models.Asset
		if err := db.First(&row, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusOK, row)
	}
}

func createAsset(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var row models.Asset
		if err := c.ShouldBindJSON(&row); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if err := db.Create(&row).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, row)
	}
}

func uploadAsset(db *gorm.DB, uploadDir string) gin.HandlerFunc {
	return func(c *gin.Context) {
		file, err := c.FormFile("file")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "file required"})
			return
		}

		ext := filepath.Ext(file.Filename)
		filename := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)
		dst := filepath.Join(uploadDir, filename)

		if err := c.SaveUploadedFile(file, dst); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		mimeType := file.Header.Get("Content-Type")
		if mimeType == "" {
			mimeType = "application/octet-stream"
		}

		row := models.Asset{
			Path:          "/uploads/" + filename,
			ThumbnailPath: "",
			Filename:      filename,
			OriginalName:  file.Filename,
			Size:          file.Size,
			MimeType:      mimeType,
		}
		if strings.HasPrefix(strings.ToLower(mimeType), "image/") {
			if thumbnailPath, thumbErr := createThumbnail(dst, uploadDir); thumbErr == nil {
				row.ThumbnailPath = thumbnailPath
			}
		}

		if err := db.Create(&row).Error; err != nil {
			os.Remove(dst)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, row)
	}
}

func updateAsset(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
			return
		}
		var row models.Asset
		if err := db.First(&row, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		if err := c.ShouldBindJSON(&row); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if err := db.Save(&row).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, row)
	}
}

func deleteAsset(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
			return
		}
		if err := db.Delete(&models.Asset{}, id).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.Status(http.StatusNoContent)
	}
}

func batchDeleteAsset(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			IDs []uint `json:"ids"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if len(body.IDs) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ids required"})
			return
		}
		if err := db.Delete(&models.Asset{}, body.IDs).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.Status(http.StatusNoContent)
	}
}
