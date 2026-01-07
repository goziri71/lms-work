import { db } from "../../database/database.js";
import { DataTypes } from "sequelize";

export const DigitalDownloads = db.define(
  "DigitalDownloads",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    author: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    pages: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "For ebooks/articles - number of pages",
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    currency: {
      type: DataTypes.STRING(5),
      allowNull: false,
      defaultValue: "NGN",
    },
    file_url: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: "URL of the main file in Supabase storage",
    },
    file_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "File extension/type (e.g., 'PDF', 'MP4', 'MP3', 'ZIP')",
    },
    file_size: {
      type: DataTypes.BIGINT,
      allowNull: true,
      comment: "File size in bytes",
    },
    cover_image: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "URL of the cover/preview image",
    },
    preview_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "URL of preview file (for videos/audio - trailer/preview clip)",
    },
    category: {
      type: DataTypes.ENUM(
        "Business & Management",
        "Technology & Data",
        "Engineering & Physical Science",
        "Health & Medicine",
        "Arts & Humanities",
        "Personal Development & Education"
      ),
      allowNull: false,
      comment: "Product category (required)",
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      comment: "Searchable tags",
    },
    product_type: {
      type: DataTypes.ENUM("ebook", "podcast", "video", "music", "art", "article", "code", "2d_3d_files"),
      allowNull: false,
      defaultValue: "ebook",
      comment: "Type of digital product",
    },
    owner_type: {
      type: DataTypes.ENUM("sole_tutor", "organization"),
      allowNull: false,
      comment: "Type of owner (sole_tutor or organization)",
    },
    owner_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "ID of owner (sole_tutor.id or organization.id)",
    },
    status: {
      type: DataTypes.ENUM("draft", "published"),
      allowNull: false,
      defaultValue: "draft",
      comment: "Publication status",
    },
    sales_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Number of times this product has been purchased",
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Duration in seconds (for audio/video)",
    },
    dimensions: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Dimensions for images/art (e.g., '1920x1080')",
    },
    resolution: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Resolution for videos (e.g., '1080p', '4K')",
    },
    streaming_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether streaming is enabled (for videos/podcasts/music)",
    },
    download_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "Whether download is enabled",
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
    tableName: "digital_downloads",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    freezeTableName: true,
    indexes: [
      {
        fields: ["owner_type", "owner_id"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["category"],
      },
      {
        fields: ["product_type"],
      },
    ],
  }
);

