/**
 * Migration: Add Invoice System
 * Creates invoices table for tracking all purchases and subscriptions
 */

import dotenv from "dotenv";
import { connectDB } from "../src/database/database.js";
import { QueryTypes } from "sequelize";
import { db } from "../src/database/database.js";

dotenv.config();

async function addInvoices() {
  try {
    const connected = await connectDB();
    if (!connected) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }

    console.log("✅ LMS Database connection established successfully.");
    console.log("📦 Starting migration: Invoice System");
    console.log(`Database dialect: ${db.getDialect()}\n`);

    // Step 1: Create invoices table
    console.log("🔍 Step 1: Creating 'invoices' table...");

    const [invoicesExists] = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'invoices'
      ) as exists;`,
      { type: QueryTypes.SELECT }
    );

    if (invoicesExists.exists) {
      console.log("   ⏭️  'invoices' table already exists. Skipping...");
    } else {
      await db.query(`
        CREATE TABLE invoices (
          id SERIAL PRIMARY KEY,
          invoice_number VARCHAR(50) NOT NULL UNIQUE,
          student_id INTEGER NOT NULL,
          product_type VARCHAR(20) NOT NULL CHECK (product_type IN ('course', 'ebook', 'digital_download', 'community', 'membership', 'coaching_session', 'coaching_hours')),
          product_id INTEGER NOT NULL,
          product_name VARCHAR(255) NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 1,
          unit_price DECIMAL(10, 2) NOT NULL,
          subtotal DECIMAL(10, 2) NOT NULL,
          tax_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.0,
          discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.0,
          total_amount DECIMAL(10, 2) NOT NULL,
          currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
          payment_method VARCHAR(50),
          payment_reference VARCHAR(255),
          payment_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
          invoice_status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (invoice_status IN ('draft', 'sent', 'paid', 'cancelled')),
          issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          due_date TIMESTAMP,
          paid_at TIMESTAMP,
          pdf_url TEXT,
          notes TEXT,
          billing_address JSONB,
          tutor_id INTEGER,
          tutor_type VARCHAR(20) CHECK (tutor_type IN ('sole_tutor', 'organization')),
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_invoices_student 
            FOREIGN KEY (student_id) 
            REFERENCES students(id) 
            ON DELETE CASCADE
        );
      `);

      // Create indexes
      await db.query(`
        CREATE INDEX idx_invoices_invoice_number ON invoices(invoice_number);
        CREATE INDEX idx_invoices_student ON invoices(student_id);
        CREATE INDEX idx_invoices_product ON invoices(product_type, product_id);
        CREATE INDEX idx_invoices_payment_status ON invoices(payment_status);
        CREATE INDEX idx_invoices_invoice_status ON invoices(invoice_status);
        CREATE INDEX idx_invoices_issued_at ON invoices(issued_at);
        CREATE INDEX idx_invoices_tutor ON invoices(tutor_id, tutor_type);
      `);

      console.log("   ✅ 'invoices' table created successfully.");
    }

    console.log("\n✅ Migration completed successfully!");
    console.log("\n📝 Next steps:");
    console.log("   1. Update Invoice model to include all fields");
    console.log("   2. Install PDF generation library (PDFKit)");
    console.log("   3. Create invoice generation service");
    console.log("   4. Create invoice routes (list, download, send email)");
    console.log("   5. Integrate invoice generation into purchase flows\n");

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

addInvoices();
