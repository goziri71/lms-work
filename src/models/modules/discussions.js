import { dbLibrary } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const Discussions = dbLibrary.define(
  "discussions",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    course_id: { type: DataTypes.INTEGER, allowNull: false },
    academic_year: { type: DataTypes.STRING, allowNull: false },
    semester: { type: DataTypes.STRING, allowNull: false },
    created_by_staff_id: { type: DataTypes.INTEGER, allowNull: false },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  { tableName: "discussions", timestamps: false, freezeTableName: true }
);

export const DiscussionMessages = dbLibrary.define(
  "discussion_messages",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    discussion_id: { type: DataTypes.INTEGER, allowNull: false },
    sender_type: { type: DataTypes.STRING, allowNull: false },
    sender_id: { type: DataTypes.INTEGER, allowNull: false },
    message_text: { type: DataTypes.TEXT, allowNull: false },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  { tableName: "discussion_messages", timestamps: false, freezeTableName: true }
);
