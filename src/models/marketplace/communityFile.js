import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const CommunityFile = db.define(
  "CommunityFile",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    community_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Reference to communities.id",
    },
    uploaded_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Reference to students.id (uploader)",
    },
    file_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: "Original file name",
    },
    file_url: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: "File URL in storage",
    },
    file_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "File MIME type",
    },
    file_size: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "File size in bytes",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "File description",
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "File category",
    },
    download_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of downloads",
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "community_files",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["community_id"],
      },
      {
        fields: ["uploaded_by"],
      },
      {
        fields: ["category"],
      },
    ],
  }
);

