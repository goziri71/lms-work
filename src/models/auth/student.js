import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const Students = db.define(
  "Student",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    fname: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    mname: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    lname: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    gender: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    dob: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    address: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    state_origin: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    lcda: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    country: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      // OPTIMIZATION: Add index for faster email lookups
      indexes: [
        {
          unique: true,
          fields: ["email"],
        },
      ],
    },
    file: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    admin_status: {
      type: DataTypes.STRING,
      allowNull: true,
      // OPTIMIZATION: Add index for status filtering
      indexes: [
        {
          fields: ["admin_status"],
        },
      ],
    },
    g_status: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    matric_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    wallet: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    level: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    application_code: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    token: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    a_status: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    program_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    facaulty_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    study_mode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    teller_no: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    wallet_balance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    account_no: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    account_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    bank: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    currency: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    certificate_file: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Certificate file URL from Supabase",
    },
    birth_certificate: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Birth certificate URL from Supabase",
    },
    ref_letter: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Reference letter URL from Supabase",
    },
    valid_id: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Valid ID URL from Supabase",
    },
    resume_cv: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Resume/CV URL from Supabase",
    },
    other_file: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Other file URL from Supabase",
    },
    profile_image: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Profile picture URL from Supabase",
    },
    school: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    school1: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    school1_date: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    school_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    school2: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    school2_date: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    application_fee: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    referral_code: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    designated_institute: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    foreign_student: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "students",
    timestamps: false,
    freezeTableName: true,
    // OPTIMIZATION: Add composite index for email + admin_status
    indexes: [
      {
        fields: ["email", "admin_status"],
      },
    ],
  }
);
