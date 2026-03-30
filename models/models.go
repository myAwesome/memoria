package models


type Project struct {
	ID uint `gorm:"primarykey" json:"id"`
	Name                 string      `gorm:"column:name;size:255" json:"name"`
	Data                 string      `gorm:"column:data" json:"data"`
}

func (Project) TableName() string { return "project" }

type Asset struct {
	ID uint `gorm:"primarykey" json:"id"`
	Path                 string      `gorm:"column:path;size:255" json:"path"`
}

func (Asset) TableName() string { return "asset" }

