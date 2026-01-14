/**
 * Migration: Add Product Reviews System
 * Creates product_reviews and review_helpful_votes tables
 */

import dotenv from "dotenv";
import { connectDB } from "../src/database/database.js";
import { QueryTypes } from "sequelize";
import { db } from "../src/database/database.js";

dotenv.config();

async function addProductReviews() {
  try {
    const connected = await connectDB();
    if (!connected) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }

    console.log("✅ LMS Database connection established successfully.");
    console.log("📦 Starting migration: Product Reviews System");
    console.log(`Database dialect: ${db.getDialect()}\n`);

    const dialect = db.getDialect();

    // Step 1: Create product_reviews table
    console.log("🔍 Step 1: Creating 'product_reviews' table...");

    const [reviewsExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'product_reviews'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (reviewsExists.exists) {
      console.log("   ⏭️  'product_reviews' table already exists. Skipping...");
    } else {
      await db.query(`
        CREATE TABLE product_reviews (
          id SERIAL PRIMARY KEY,
          student_id INTEGER NOT NULL,
          product_type VARCHAR(20) NOT NULL CHECK (product_type IN ('course', 'ebook', 'digital_download', 'community', 'membership')),
          product_id INTEGER NOT NULL,
          rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
          title VARCHAR(200),
          comment TEXT,
          helpful_count INTEGER NOT NULL DEFAULT 0,
          status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'hidden')),
          is_verified_purchase BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_student_product_review UNIQUE (student_id, product_type, product_id)
        );
      `);

      // Create indexes
      await db.query(`
        CREATE INDEX idx_product_reviews_product ON product_reviews(product_type, product_id);
        CREATE INDEX idx_product_reviews_student ON product_reviews(student_id);
        CREATE INDEX idx_product_reviews_status ON product_reviews(status);
        CREATE INDEX idx_product_reviews_rating ON product_reviews(rating);
        CREATE INDEX idx_product_reviews_helpful ON product_reviews(helpful_count);
      `);

      console.log("   ✅ 'product_reviews' table created successfully.");
    }

    // Step 2: Create review_helpful_votes table
    console.log("\n🔍 Step 2: Creating 'review_helpful_votes' table...");

    const [votesExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'review_helpful_votes'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (votesExists.exists) {
      console.log("   ⏭️  'review_helpful_votes' table already exists. Skipping...");
    } else {
      await db.query(`
        CREATE TABLE review_helpful_votes (
          id SERIAL PRIMARY KEY,
          review_id INTEGER NOT NULL,
          student_id INTEGER NOT NULL,
          is_helpful BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_review_student_vote UNIQUE (review_id, student_id),
          CONSTRAINT fk_review_helpful_votes_review 
            FOREIGN KEY (review_id) 
            REFERENCES product_reviews(id) 
            ON DELETE CASCADE
        );
      `);

      // Create indexes
      await db.query(`
        CREATE INDEX idx_review_helpful_votes_review ON review_helpful_votes(review_id);
        CREATE INDEX idx_review_helpful_votes_student ON review_helpful_votes(student_id);
      `);

      console.log("   ✅ 'review_helpful_votes' table created successfully.");
    }

    console.log("\n✅ Migration completed successfully!");
    console.log("\n📝 Next steps:");
    console.log("   1. Update models index to export ProductReview and ReviewHelpfulVote");
    console.log("   2. Create review controller with create, get, and helpful vote endpoints");
    console.log("   3. Add review aggregation logic to product endpoints");
    console.log("   4. Create review routes\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    console.error("Error details:", {
      message: error.message,
      name: error.name,
      stack: error.stack,
    });
    process.exit(1);
  }
}

addProductReviews();
