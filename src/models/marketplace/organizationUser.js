import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const OrganizationUser = db.define(
  "OrganizationUser",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    organization_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "FK to organizations table",
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    fname: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    lname: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    mname: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    role: {
      type: DataTypes.ENUM("admin", "tutor", "manager"),
      allowNull: false,
      defaultValue: "tutor",
      comment: "admin = org admin, tutor = can teach, manager = can manage tutors",
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    profile_image: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    specialization: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    qualifications: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    experience_years: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM("active", "inactive", "suspended"),
      allowNull: false,
      defaultValue: "active",
    },
    rating: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
      defaultValue: 0.0,
    },
    total_reviews: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    last_login: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    password_reset_token: {
      type: DataTypes.STRING(255),
      allowNull: true,
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
    tableName: "organization_users",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        unique: true,
        fields: ["email"],
      },
      {
        fields: ["organization_id"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["role"],
      },
    ],
  }
);

