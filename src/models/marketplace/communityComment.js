import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const CommunityComment = db.define(
  "CommunityComment",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    post_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Reference to community_posts.id",
    },
    author_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Reference to students.id (author)",
    },
    parent_comment_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Reference to community_comments.id (for nested replies)",
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: "Comment content",
    },
    mentions: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Array of mentioned user IDs",
    },
    status: {
      type: DataTypes.ENUM("published", "deleted"),
      allowNull: false,
      defaultValue: "published",
      comment: "Comment status",
    },
    likes_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of likes",
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
    tableName: "community_comments",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["post_id"],
      },
      {
        fields: ["author_id"],
      },
      {
        fields: ["parent_comment_id"],
      },
      {
        fields: ["created_at"],
      },
    ],
  }
);

