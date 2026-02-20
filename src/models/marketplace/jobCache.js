import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const JobCache = db.define(
  "JobCache",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    cache_key: {
      type: DataTypes.STRING(500),
      allowNull: false,
      unique: true,
      comment: "Hash of search parameters",
    },
    search_params: {
      type: DataTypes.JSONB,
      allowNull: false,
      comment: "Original search parameters for debugging",
    },
    response_data: {
      type: DataTypes.JSONB,
      allowNull: false,
      comment: "Cached API response",
    },
    total_results: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: "When this cache entry expires",
    },
  },
  {
    tableName: "job_cache",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        unique: true,
        fields: ["cache_key"],
      },
      {
        fields: ["expires_at"],
      },
    ],
  }
);
