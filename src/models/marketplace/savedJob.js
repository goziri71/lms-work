import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const SavedJob = db.define(
  "SavedJob",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    student_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "students",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    job_hash_id: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: "External job identifier from the API response",
    },
    title: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    employer: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    location: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    job_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "External application URL",
    },
    job_data: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Snapshot of job details at time of save",
    },
  },
  {
    tableName: "saved_jobs",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        unique: true,
        fields: ["student_id", "job_hash_id"],
        name: "unique_saved_job",
      },
      {
        fields: ["student_id"],
      },
    ],
  }
);
