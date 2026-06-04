import { db } from "../src/database/database.js";
import { QueryTypes } from "sequelize";

/**
 * Creates tables for ticketed events (tutor event ticket sales).
 * Run: node scripts/migrate-create-event-ticket-tables.js
 */

async function tableExists(tableName) {
  const result = await db.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = :tableName
    ) AS exists;`,
    { type: QueryTypes.SELECT, replacements: { tableName } }
  );
  return !!result?.[0]?.exists;
}

async function run() {
  console.log("🎫 Event ticket tables migration\n");

  if (await tableExists("ticketed_events")) {
    console.log("⚠️  ticketed_events already exists — skipping");
  } else {
    await db.query(`
      CREATE TABLE ticketed_events (
        id SERIAL PRIMARY KEY,
        owner_type VARCHAR(50) NOT NULL CHECK (owner_type IN ('sole_tutor', 'organization')),
        owner_id INTEGER NOT NULL,
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        format VARCHAR(20) NOT NULL DEFAULT 'online' CHECK (format IN ('online', 'in_person', 'hybrid')),
        timezone VARCHAR(64) NOT NULL DEFAULT 'Africa/Lagos',
        starts_at TIMESTAMP NOT NULL,
        ends_at TIMESTAMP NOT NULL,
        doors_open_at TIMESTAMP,
        venue_name VARCHAR(255),
        address_line1 VARCHAR(500),
        city VARCHAR(120),
        region VARCHAR(120),
        country VARCHAR(10),
        latitude DECIMAL(10, 7),
        longitude DECIMAL(10, 7),
        online_url TEXT,
        cover_image_url TEXT,
        category VARCHAR(120),
        status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'sold_out', 'cancelled', 'completed')),
        refund_policy VARCHAR(64) DEFAULT 'none',
        refund_policy_text TEXT,
        max_attendees INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await db.query(`CREATE INDEX idx_ticketed_events_owner ON ticketed_events (owner_type, owner_id);`);
    await db.query(`CREATE INDEX idx_ticketed_events_status ON ticketed_events (status);`);
    await db.query(`CREATE INDEX idx_ticketed_events_starts_at ON ticketed_events (starts_at);`);
    console.log("✅ ticketed_events");
  }

  if (await tableExists("event_ticket_tiers")) {
    console.log("⚠️  event_ticket_tiers already exists — skipping");
  } else {
    await db.query(`
      CREATE TABLE event_ticket_tiers (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES ticketed_events(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL DEFAULT 0,
        currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
        quantity_total INTEGER NOT NULL DEFAULT 0,
        quantity_sold INTEGER NOT NULL DEFAULT 0,
        quantity_reserved INTEGER NOT NULL DEFAULT 0,
        max_per_order INTEGER NOT NULL DEFAULT 4,
        sales_start TIMESTAMP,
        sales_end TIMESTAMP,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_hidden BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await db.query(`CREATE INDEX idx_event_ticket_tiers_event ON event_ticket_tiers (event_id);`);
    console.log("✅ event_ticket_tiers");
  }

  if (await tableExists("event_ticket_orders")) {
    console.log("⚠️  event_ticket_orders already exists — skipping");
  } else {
    await db.query(`
      CREATE TABLE event_ticket_orders (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES ticketed_events(id) ON DELETE CASCADE,
        student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
        buyer_email VARCHAR(255) NOT NULL,
        buyer_name VARCHAR(255) NOT NULL,
        buyer_phone VARCHAR(32),
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
        total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
        ticket_count INTEGER NOT NULL DEFAULT 0,
        line_items JSONB NOT NULL DEFAULT '[]',
        payment_method VARCHAR(32),
        transaction_ref VARCHAR(255) UNIQUE,
        flutterwave_transaction_id VARCHAR(100),
        access_token VARCHAR(128) UNIQUE,
        idempotency_key VARCHAR(64) UNIQUE,
        reservation_expires_at TIMESTAMP,
        commission_rate DECIMAL(5, 2),
        platform_fee DECIMAL(10, 2),
        tutor_earnings DECIMAL(10, 2),
        paid_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await db.query(`CREATE INDEX idx_event_ticket_orders_event ON event_ticket_orders (event_id);`);
    await db.query(`CREATE INDEX idx_event_ticket_orders_student ON event_ticket_orders (student_id);`);
    await db.query(`CREATE INDEX idx_event_ticket_orders_email ON event_ticket_orders (buyer_email);`);
    await db.query(`CREATE INDEX idx_event_ticket_orders_status ON event_ticket_orders (status);`);
    console.log("✅ event_ticket_orders");
  }

  if (await tableExists("event_tickets")) {
    console.log("⚠️  event_tickets already exists — skipping");
  } else {
    await db.query(`
      CREATE TABLE event_tickets (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES event_ticket_orders(id) ON DELETE CASCADE,
        event_id INTEGER NOT NULL REFERENCES ticketed_events(id) ON DELETE CASCADE,
        tier_id INTEGER NOT NULL REFERENCES event_ticket_tiers(id) ON DELETE CASCADE,
        ticket_code VARCHAR(32) NOT NULL UNIQUE,
        holder_name VARCHAR(255) NOT NULL,
        holder_email VARCHAR(255) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'used', 'cancelled')),
        checked_in_at TIMESTAMP,
        checked_in_by INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await db.query(`CREATE INDEX idx_event_tickets_order ON event_tickets (order_id);`);
    await db.query(`CREATE INDEX idx_event_tickets_event ON event_tickets (event_id);`);
    console.log("✅ event_tickets");
  }

  console.log("\n✅ Migration complete");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
