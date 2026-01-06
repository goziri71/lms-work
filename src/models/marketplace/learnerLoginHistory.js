import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const LearnerLoginHistory = db.define(
  "LearnerLoginHistory",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    student_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Student/learner ID",
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: false,
      comment: "IP address used for login",
    },
    location_country: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Country from IP geolocation",
    },
    location_city: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "City from IP geolocation",
    },
    location_region: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Region/state from IP geolocation",
    },
    location_latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
      comment: "Latitude from IP geolocation",
    },
    location_longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
      comment: "Longitude from IP geolocation",
    },
    device_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Device type (mobile, desktop, tablet)",
    },
    browser: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Browser name and version",
    },
    operating_system: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Operating system",
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Full user agent string",
    },
    login_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: "Login timestamp",
    },
    logout_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Logout timestamp (if tracked)",
    },
    session_duration_seconds: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Session duration in seconds",
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "Whether session is still active",
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Additional login metadata",
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "learner_login_history",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
    indexes: [
      {
        fields: ["student_id"],
        name: "idx_learner_login_student",
      },
      {
        fields: ["ip_address"],
        name: "idx_learner_login_ip",
      },
      {
        fields: ["login_at"],
        name: "idx_learner_login_time",
      },
      {
        fields: ["is_active"],
        name: "idx_learner_login_active",
      },
      {
        fields: ["location_country"],
        name: "idx_learner_login_country",
      },
    ],
  }
);

