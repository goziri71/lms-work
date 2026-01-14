import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const Community = db.define(
  "Community",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tutor_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "ID of tutor (sole_tutor or organization)",
    },
    tutor_type: {
      type: DataTypes.ENUM("sole_tutor", "organization"),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: "Community name",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Community description",
    },
    category: {
      type: DataTypes.ENUM(
        "Business & Management",
        "Technology & Data",
        "Engineering & Physical Science",
        "Health & Medicine",
        "Arts & Humanities",
        "Personal Development & Education",
        "Religious and Faith",
        "Social and Impact"
      ),
      allowNull: true,
      comment: "Community category",
    },
    image_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Community cover image URL",
    },
    icon_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Community icon/logo URL",
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Monthly subscription price",
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "NGN",
      comment: "Currency for subscription",
    },
    pricing_type: {
      type: DataTypes.ENUM("subscription"),
      allowNull: false,
      defaultValue: "subscription",
      comment: "Pricing type (only subscription for now)",
    },
    trial_days: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      comment: "Free trial period in days",
    },
    member_limit: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Maximum members allowed (null = unlimited, controlled by tutor)",
    },
    auto_approve: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "Auto-approve new members",
    },
    who_can_post: {
      type: DataTypes.ENUM("members", "tutor_only", "moderators"),
      allowNull: false,
      defaultValue: "members",
      comment: "Who can create posts",
    },
    moderation_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Enable content moderation",
    },
    file_sharing_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "Enable file sharing",
    },
    live_sessions_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "Enable live audio sessions",
    },
    visibility: {
      type: DataTypes.ENUM("public", "private"),
      allowNull: false,
      defaultValue: "public",
      comment: "Community visibility",
    },
    status: {
      type: DataTypes.ENUM("draft", "published", "archived"),
      allowNull: false,
      defaultValue: "draft",
      comment: "Community status",
    },
    member_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Current number of members",
    },
    post_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Total number of posts",
    },
    commission_rate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      defaultValue: 15.0,
      comment: "WPU commission rate for community subscriptions",
    },
    slug: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
      comment: "URL-friendly slug for public product link",
    },
    intro_video_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "URL of intro video (optional - can be uploaded or embedded from YouTube/Vimeo)",
    },
    intro_video_thumbnail_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Thumbnail image URL for intro video",
    },
    is_featured: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether product is featured",
    },
    featured_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When product was featured",
    },
    popularity_score: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
      comment: "Calculated popularity score (sales + reviews + views)",
    },
    sales_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of subscriptions/purchases",
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
    tableName: "communities",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["tutor_id", "tutor_type"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["visibility"],
      },
      {
        fields: ["category"],
      },
      {
        fields: ["slug"],
      },
    ],
  }
);

