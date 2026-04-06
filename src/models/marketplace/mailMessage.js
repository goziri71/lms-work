import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const MailMessage = db.define(
  "MailMessage",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    thread_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    tutor_mailbox_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    direction: {
      type: DataTypes.ENUM("sent", "received"),
      allowNull: false,
    },
    from_email: {
      type: DataTypes.STRING(320),
      allowNull: false,
    },
    to_email: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: "Comma-separated or single recipient",
    },
    cc: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    bcc: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    subject: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    body_text: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    body_html: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    /** Provider message id (Gmail id, Graph id) */
    provider_message_id: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    rfc_message_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "Message-ID header",
    },
    in_reply_to: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    references_header: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    /** Gmail internalDate ms */
    internal_date_ms: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    is_read: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "False for unread inbound",
    },
    sent_or_received_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    tableName: "mail_messages",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { fields: ["thread_id"] },
      { fields: ["tutor_mailbox_id"] },
      { fields: ["provider_message_id"] },
      { fields: ["rfc_message_id"] },
      { fields: ["sent_or_received_at"] },
      {
        unique: true,
        fields: ["tutor_mailbox_id", "provider_message_id"],
        name: "uniq_mail_msg_provider",
      },
    ],
  }
);
