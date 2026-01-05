import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const CommunityPost = db.define(
  "CommunityPost",
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
    author_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Reference to students.id (author)",
    },
    title: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: "Post title",
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: "Post content",
    },
    content_type: {
      type: DataTypes.ENUM("text", "rich_text", "link"),
      allowNull: false,
      defaultValue: "text",
      comment: "Type of content",
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Post category",
    },
    tags: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Post tags",
    },
    status: {
      type: DataTypes.ENUM("published", "pinned", "archived", "deleted"),
      allowNull: false,
      defaultValue: "published",
      comment: "Post status",
    },
    views: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of views",
    },
    likes_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of likes",
    },
    comments_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of comments",
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
    tableName: "community_posts",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["community_id"],
      },
      {
        fields: ["author_id"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["created_at"],
      },
    ],
  }
);

