import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const MailThread = db.define(
  "MailThread",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tutor_mailbox_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    tutor_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    tutor_type: {
      type: DataTypes.ENUM("sole_tutor", "organization"),
      allowNull: false,
    },
    /** Gmail threadId, Graph conversationId, etc. */
    external_thread_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    subject: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    learner_student_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Optional link to enrolled learner",
    },
    last_message_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    unread_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    snippet: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
  },
  {
    tableName: "mail_threads",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { fields: ["tutor_mailbox_id"] },
      { fields: ["tutor_id", "tutor_type"] },
      {
        unique: true,
        fields: ["tutor_mailbox_id", "external_thread_id"],
        name: "uniq_mailbox_gmail_thread",
      },
      { fields: ["last_message_at"] },
      { fields: ["learner_student_id"] },
    ],
  }
);
