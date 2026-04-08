package models

import "time"

type Project struct {
	ID           uint      `gorm:"primarykey" json:"id"`
	Name         string    `gorm:"column:name;size:255" json:"name"`
	Data         string    `gorm:"column:data" json:"data"`
	CoverAssetID *uint     `gorm:"column:cover_asset_id" json:"cover_asset_id"`
	CreatedAt    time.Time `gorm:"column:created_at;autoCreateTime" json:"created_at"`
	UpdatedAt    time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updated_at"`
}

func (Project) TableName() string { return "project" }

type Asset struct {
	ID            uint      `gorm:"primarykey" json:"id"`
	Path          string    `gorm:"column:path;size:255" json:"path"`
	ThumbnailPath string    `gorm:"column:thumbnail_path;size:255" json:"thumbnail_path"`
	Filename      string    `gorm:"column:filename;size:255" json:"filename"`
	OriginalName  string    `gorm:"column:original_name;size:255" json:"original_name"`
	Size          int64     `gorm:"column:size" json:"size"`
	MimeType      string    `gorm:"column:mime_type;size:127" json:"mime_type"`
	CreatedAt     time.Time `gorm:"column:created_at;autoCreateTime" json:"created_at"`
}

func (Asset) TableName() string { return "asset" }
