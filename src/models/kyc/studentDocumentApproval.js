import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const StudentDocumentApproval = db.define(
  "StudentDocumentApproval",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    student_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    document_type: {
      type: DataTypes.ENUM(
        "profile_image",
        "birth_certificate",
        "ref_letter",
        "valid_id",
        "resume_cv",
        "certificate_file",
        "other_file"
      ),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("pending", "approved", "rejected"),
      allowNull: false,
      defaultValue: "pending",
    },
    rejection_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Reason for rejection (if status is rejected)",
    },
    reviewed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Admin ID who reviewed the document",
    },
    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    file_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: "URL of the uploaded document",
    },
  },
  {
    tableName: "student_document_approvals",
    freezeTableName: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

