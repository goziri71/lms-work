import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";
import { Students } from "../auth/student.js";

export const CoachingParticipant = db.define(
  "CoachingParticipant",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    session_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "coaching_sessions",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    student_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "students",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    invited_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    joined_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    left_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    email_sent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    tableName: "coaching_session_participants",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["session_id"],
      },
      {
        fields: ["student_id"],
      },
      {
        unique: true,
        fields: ["session_id", "student_id"],
        name: "unique_participant",
      },
    ],
  }
);

// Associations
CoachingParticipant.belongsTo(Students, {
  foreignKey: "student_id",
  as: "student",
});

