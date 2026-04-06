/**
 * WPU / Pinnacle legacy book catalog (migrated from MySQL `uploads` dump).
 * PDFs are served from a static base URL + `file` (filename).
 */

import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";
import { Config } from "../../config/config.js";

export const WpuBookUpload = db.define(
  "WpuBookUpload",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    file: {
      type: DataTypes.STRING(600),
      allowNull: true,
      comment: "PDF filename on static host",
    },
    title: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    size: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    uploaded_at: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "uploaded_at",
      comment: "Original `date` from WPU dump",
    },
    student_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    faculty_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    program_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    book_no: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Course / book code (e.g. CSC101)",
    },
    type: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    course_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    course_level: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    course_semester: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
  },
  {
    tableName: "wpu_book_uploads",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { fields: ["book_no"] },
      { fields: ["course_level"] },
      { fields: ["course_semester"] },
      { fields: ["type"] },
    ],
  }
);

/**
 * Full URL to open the PDF (base URL + encoded filename).
 */
export function buildWpuBookPdfUrl(filename) {
  if (!filename || !String(filename).trim()) return null;
  const base = String(Config.wpuBooksBaseUrl).replace(/\/+$/, "");
  const name = String(filename).trim();
  return `${base}/${encodeURIComponent(name)}`;
}

WpuBookUpload.prototype.getPdfUrl = function getPdfUrl() {
  return buildWpuBookPdfUrl(this.file);
};
