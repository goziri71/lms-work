import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const WpuAdmin = db.define(
  "WpuAdmin",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    fname: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    lname: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    mname: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    role: {
      type: DataTypes.ENUM("super_admin", "wpu_admin", "wsp_admin"),
      allowNull: false,
      defaultValue: "wpu_admin",
      comment: "super_admin = full control, wpu_admin = assistant (wsp_admin is legacy)",
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    permissions: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "Granular permissions",
      defaultValue: {
        students: { view: true, create: false, edit: false, delete: false },
        staff: { view: true, create: false, edit: false, delete: false },
        courses: { view: true, create: true, edit: true, delete: false },
        content: { modules: true, units: true, quizzes: true, exams: true },
        system: { settings: false, analytics: true, logs: false },
      },
    },
    status: {
      type: DataTypes.ENUM("active", "inactive", "suspended"),
      allowNull: false,
      defaultValue: "active",
    },
    last_login: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    password_reset_token: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    token: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "For password reset or other tokens",
    },
    profile_image: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    two_factor_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "2FA for super admins",
    },
    two_factor_secret: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Which admin created this admin",
    },
  },
  {
    tableName: "wsp_admins", // Keep table name for backward compatibility
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        unique: true,
        fields: ["email"],
      },
      {
        fields: ["role"],
      },
      {
        fields: ["status"],
      },
    ],
  }
);

// Backward compatibility export
export const WspAdmin = WpuAdmin;

