import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const CommunityReaction = db.define(
  "CommunityReaction",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    post_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Reference to community_posts.id (null if reacting to comment)",
    },
    comment_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Reference to community_comments.id (null if reacting to post)",
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Reference to students.id (user who reacted)",
    },
    user_type: {
      type: DataTypes.ENUM("student", "tutor"),
      allowNull: false,
      defaultValue: "student",
      comment: "Type of user who reacted",
    },
    emoji: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: "Emoji reaction (e.g., '👍', '❤️', '😂')",
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "community_reactions",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
    indexes: [
      {
        fields: ["post_id"],
      },
      {
        fields: ["comment_id"],
      },
      {
        fields: ["user_id", "user_type"],
      },
      {
        unique: true,
        fields: ["post_id", "comment_id", "user_id", "user_type", "emoji"],
        name: "unique_reaction",
      },
    ],
  }
);

// Associations are defined in src/models/associations.js

