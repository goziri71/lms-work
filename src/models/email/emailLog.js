import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";
import { Students } from "../auth/student.js";
import { Staff } from "../auth/staff.js";

export const EmailLog = db.define(
  "EmailLog",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "ID of the user (student or staff) who received the email",
    },
    user_type: {
      type: DataTypes.ENUM("student", "staff", "other"),
      allowNull: false,
      defaultValue: "student",
      comment: "Type of user who received the email",
    },
    recipient_email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true,
      },
    },
    recipient_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    email_type: {
      type: DataTypes.ENUM(
        "welcome",
        "password_reset",
        "email_verification",
        "course_enrollment",
        "exam_reminder",
        "exam_published",
        "grade_notification",
        "quiz_deadline",
        "announcement",
        "other"
      ),
      allowNull: false,
      comment: "Type/category of email sent",
    },
    subject: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("pending", "sent", "failed", "bounced"),
      allowNull: false,
      defaultValue: "pending",
    },
    zepto_message_id: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Message ID returned by ZeptoMail API",
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Error message if email failed to send",
    },
    sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Additional metadata (course_id, exam_id, etc.)",
    },
  },
  {
    tableName: "email_logs",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["user_id", "user_type"],
      },
      {
        fields: ["recipient_email"],
      },
      {
        fields: ["email_type"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["created_at"],
      },
    ],
    hooks: {
      // Before creating, auto-populate recipient_email and recipient_name from user table
      beforeCreate: async (emailLog) => {
        // Only fetch if user_id is provided and recipient_email/name are not already set
        if (emailLog.user_id && (!emailLog.recipient_email || !emailLog.recipient_name)) {
          try {
            if (emailLog.user_type === "student") {
              const student = await Students.findByPk(emailLog.user_id);
              if (student) {
                if (!emailLog.recipient_email) {
                  emailLog.recipient_email = student.email;
                }
                if (!emailLog.recipient_name) {
                  emailLog.recipient_name = `${student.fname} ${student.lname}`.trim();
                }
              }
            } else if (emailLog.user_type === "staff") {
              const staff = await Staff.findByPk(emailLog.user_id);
              if (staff) {
                if (!emailLog.recipient_email) {
                  emailLog.recipient_email = staff.email;
                }
                if (!emailLog.recipient_name) {
                  emailLog.recipient_name = `${staff.fname} ${staff.lname}`.trim();
                }
              }
            }
          } catch (error) {
            console.error("Error auto-populating email log user info:", error);
            // Don't throw - allow creation to proceed with provided values
          }
        }
      },
      // Before updating, also auto-populate if user_id changes
      beforeUpdate: async (emailLog) => {
        if (emailLog.user_id && emailLog.changed("user_id")) {
          try {
            if (emailLog.user_type === "student") {
              const student = await Students.findByPk(emailLog.user_id);
              if (student) {
                if (!emailLog.recipient_email) {
                  emailLog.recipient_email = student.email;
                }
                if (!emailLog.recipient_name) {
                  emailLog.recipient_name = `${student.fname} ${student.lname}`.trim();
                }
              }
            } else if (emailLog.user_type === "staff") {
              const staff = await Staff.findByPk(emailLog.user_id);
              if (staff) {
                if (!emailLog.recipient_email) {
                  emailLog.recipient_email = staff.email;
                }
                if (!emailLog.recipient_name) {
                  emailLog.recipient_name = `${staff.fname} ${staff.lname}`.trim();
                }
              }
            }
          } catch (error) {
            console.error("Error auto-populating email log user info:", error);
          }
        }
      },
    },
  }
);

/**
 * Helper method to create EmailLog with automatic user info fetching
 * @param {Object} options - Email log options
 * @param {number} options.user_id - User ID (student or staff)
 * @param {string} options.user_type - User type ('student' or 'staff')
 * @param {string} options.email_type - Type of email
 * @param {string} options.subject - Email subject
 * @param {string} options.status - Email status ('pending', 'sent', 'failed', 'bounced')
 * @param {string} [options.recipient_email] - Optional: Override email (will fetch from user if not provided)
 * @param {string} [options.recipient_name] - Optional: Override name (will fetch from user if not provided)
 * @param {string} [options.error_message] - Error message if failed
 * @param {Date} [options.sent_at] - Sent timestamp
 * @param {Object} [options.metadata] - Additional metadata
 * @returns {Promise<EmailLog>} Created email log
 */
EmailLog.createForUser = async function(options) {
  const { user_id, user_type, recipient_email, recipient_name, ...rest } = options;
  
  // If user_id is provided but email/name are not, fetch from user table
  if (user_id && (!recipient_email || !recipient_name)) {
    try {
      if (user_type === "student") {
        const student = await Students.findByPk(user_id);
        if (student) {
          return await EmailLog.create({
            user_id,
            user_type,
            recipient_email: recipient_email || student.email,
            recipient_name: recipient_name || `${student.fname} ${student.lname}`.trim(),
            ...rest,
          });
        }
      } else if (user_type === "staff") {
        const staff = await Staff.findByPk(user_id);
        if (staff) {
          return await EmailLog.create({
            user_id,
            user_type,
            recipient_email: recipient_email || staff.email,
            recipient_name: recipient_name || `${staff.fname} ${staff.lname}`.trim(),
            ...rest,
          });
        }
      }
    } catch (error) {
      console.error("Error fetching user info for email log:", error);
      throw error;
    }
  }
  
  // If user_id not provided or fetch failed, create with provided values
  return await EmailLog.create({
    user_id,
    user_type,
    recipient_email,
    recipient_name,
    ...rest,
  });
};

