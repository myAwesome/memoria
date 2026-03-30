package routes

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"memoria/models"
)

// RegisterRoutes wires all CRUD routes onto r.
func RegisterRoutes(r gin.IRouter, db *gorm.DB) {
	r.GET("/project", listProject(db))
	r.GET("/project/:id", getProject(db))
	r.POST("/project", createProject(db))
	r.PUT("/project/:id", updateProject(db))
	r.DELETE("/project/batch", batchDeleteProject(db))
	r.DELETE("/project/:id", deleteProject(db))
	r.GET("/asset", listAsset(db))
	r.GET("/asset/:id", getAsset(db))
	r.POST("/asset", createAsset(db))
	r.PUT("/asset/:id", updateAsset(db))
	r.DELETE("/asset/batch", batchDeleteAsset(db))
	r.DELETE("/asset/:id", deleteAsset(db))
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
		allowedProject := map[string]bool{ "id": true, "name": true, "data": true,  }
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
		allowedAsset := map[string]bool{ "id": true, "path": true,  }
		if !allowedAsset[sortBy] {
			sortBy = "id"
		}
		if sortDir != "asc" && sortDir != "desc" {
			sortDir = "desc"
		}
		query := db.Model(&models.Asset{})
		if q := c.Query("q"); q != "" {
			like := "%" + strings.ReplaceAll(q, "%", "\\%") + "%"
			query = query.Where("path LIKE ?", like)
		}
		if v := c.Query("path"); v != "" {
			query = query.Where("path = ?", v)
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

