/**
 * Migration: Organization KYC (business / CAC verification)
 *
 * Run: node scripts/migrate-add-organization-kyc.js
 */

import dotenv from "dotenv";
import { db } from "../src/database/database.js";
import { QueryTypes } from "sequelize";

dotenv.config({ debug: false });

async function tableExists(tableName) {
  const [row] = await db.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = :tableName
    ) AS exists;`,
    { type: QueryTypes.SELECT, replacements: { tableName } }
  );
  return !!row?.exists;
}

async function run() {
  try {
    await db.authenticate();
    console.log("✅ LMS Database connection established successfully.");
    console.log("📦 Organization KYC migration\n");

    if (await tableExists("organization_kyc")) {
      console.log("⏭️  organization_kyc already exists");
    } else {
      await db.query(`
        CREATE TABLE organization_kyc (
          id SERIAL PRIMARY KEY,
          organization_id INTEGER NOT NULL UNIQUE
            REFERENCES organizations(id) ON DELETE CASCADE,
          business_name VARCHAR(255),
          trading_name VARCHAR(255),
          business_type VARCHAR(40)
            CHECK (business_type IN (
              'limited_company', 'business_name', 'ngo',
              'partnership', 'sole_proprietorship', 'other'
            )),
          cac_number VARCHAR(100),
          tin VARCHAR(100),
          date_of_incorporation DATE,
          registered_address TEXT,
          operating_address TEXT,
          business_email VARCHAR(255),
          business_phone VARCHAR(32),
          nature_of_business TEXT,
          directors JSONB,
          cac_certificate_url TEXT,
          cac_status_report_url TEXT,
          memorandum_articles_url TEXT,
          proof_of_address_url TEXT,
          tax_document_url TEXT,
          authorized_rep_id_url TEXT,
          additional_documents JSONB,
          status VARCHAR(30) NOT NULL DEFAULT 'pending'
            CHECK (status IN (
              'pending', 'under_review', 'approved',
              'rejected', 'requires_resubmission'
            )),
          submitted_at TIMESTAMP,
          reviewed_at TIMESTAMP,
          reviewed_by INTEGER,
          rejection_reason TEXT,
          resubmission_notes TEXT,
          notes TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await db.query(`
        CREATE UNIQUE INDEX idx_organization_kyc_org_id ON organization_kyc(organization_id);
        CREATE INDEX idx_organization_kyc_status ON organization_kyc(status);
        CREATE INDEX idx_organization_kyc_cac ON organization_kyc(cac_number);
        CREATE INDEX idx_organization_kyc_submitted ON organization_kyc(submitted_at);
      `);

      console.log("✅ Created organization_kyc");
    }

    console.log("\n✅ Migration complete");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  }
}

run();
