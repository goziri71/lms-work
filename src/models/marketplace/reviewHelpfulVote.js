/**
 * Review Helpful Vote Model
 * Tracks which students found which reviews helpful
 */

import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const ReviewHelpfulVote = db.define(
  "ReviewHelpfulVote",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    review_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "ID of the product review",
    },
    student_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "ID of student who marked the review as helpful",
    },
    is_helpful: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "Whether the student found the review helpful (true) or not helpful (false)",
    },
  },
  {
    tableName: "review_helpful_votes",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["review_id"],
      },
      {
        fields: ["student_id"],
      },
      {
        unique: true,
        fields: ["review_id", "student_id"],
        name: "unique_review_student_vote",
        comment: "One vote per student per review",
      },
    ],
  }
);
