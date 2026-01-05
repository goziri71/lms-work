/**
 * Migration script for One-on-One Coaching and Communities
 * 
 * This script:
 * 1. Adds one-on-one coaching fields to coaching_sessions table
 * 2. Creates coaching_scheduling_messages table
 * 3. Creates all community-related tables
 * 4. Updates tutor_subscriptions table to add community_member_limit column
 */

import { db } from "../src/database/database.js";
import { connectDB } from "../src/database/database.js";

async function migrateOneOnOneCoachingAndCommunities() {
  try {
    console.log("📦 Starting migration: One-on-One Coaching & Communities");
    console.log(`Database dialect: ${db.getDialect()}`);

    // Step 1: Add one-on-one coaching fields to coaching_sessions
    console.log("\n🔍 Step 1: Adding one-on-one coaching fields to coaching_sessions...");
    try {
      await db.query(`
        ALTER TABLE coaching_sessions
        ADD COLUMN IF NOT EXISTS session_type VARCHAR(50) DEFAULT 'group' 
          CHECK (session_type IN ('group', 'one_on_one'));
      `);
      console.log("✅ Added session_type column");

      await db.query(`
        ALTER TABLE coaching_sessions
        ADD COLUMN IF NOT EXISTS scheduling_status VARCHAR(50)
          CHECK (scheduling_status IN ('awaiting_purchase', 'awaiting_scheduling', 'scheduled', 'completed', 'cancelled'));
      `);
      console.log("✅ Added scheduling_status column");

      await db.query(`
        ALTER TABLE coaching_sessions
        ADD COLUMN IF NOT EXISTS agreed_start_time TIMESTAMP;
      `);
      console.log("✅ Added agreed_start_time column");

      await db.query(`
        ALTER TABLE coaching_sessions
        ADD COLUMN IF NOT EXISTS agreed_end_time TIMESTAMP;
      `);
      console.log("✅ Added agreed_end_time column");

      await db.query(`
        ALTER TABLE coaching_sessions
        ADD COLUMN IF NOT EXISTS scheduling_deadline TIMESTAMP;
      `);
      console.log("✅ Added scheduling_deadline column");
    } catch (error) {
      if (error.message.includes("already exists") || error.message.includes("duplicate")) {
        console.log("⚠️  Some columns may already exist, continuing...");
      } else {
        throw error;
      }
    }

    // Step 2: Create coaching_scheduling_messages table
    console.log("\n🔍 Step 2: Creating coaching_scheduling_messages table...");
    const [messagesTableExists] = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'coaching_scheduling_messages'
      )
    `);

    if (!messagesTableExists[0].exists) {
      await db.query(`
        CREATE TABLE coaching_scheduling_messages (
          id SERIAL PRIMARY KEY,
          session_id INTEGER NOT NULL REFERENCES coaching_sessions(id) ON DELETE CASCADE,
          sender_id INTEGER NOT NULL,
          sender_type VARCHAR(50) NOT NULL CHECK (sender_type IN ('tutor', 'learner')),
          message TEXT,
          message_type VARCHAR(50) NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'time_proposal')),
          proposed_start_time TIMESTAMP,
          proposed_end_time TIMESTAMP,
          status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
          read_at TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.query(`
        CREATE INDEX idx_coaching_scheduling_messages_session_id 
        ON coaching_scheduling_messages(session_id)
      `);

      await db.query(`
        CREATE INDEX idx_coaching_scheduling_messages_sender 
        ON coaching_scheduling_messages(sender_id, sender_type)
      `);

      await db.query(`
        CREATE INDEX idx_coaching_scheduling_messages_created_at 
        ON coaching_scheduling_messages(created_at)
      `);

      await db.query(`
        CREATE INDEX idx_coaching_scheduling_messages_status 
        ON coaching_scheduling_messages(status)
      `);

      console.log("✅ Created coaching_scheduling_messages table");
    } else {
      console.log("⚠️  coaching_scheduling_messages table already exists");
    }

    // Step 3: Add currency field to sole_tutors and organizations (if not exists)
    console.log("\n🔍 Step 3: Adding currency field to tutor tables...");
    try {
      await db.query(`
        ALTER TABLE sole_tutors 
        ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'NGN';
      `);
      console.log("✅ Added currency column to sole_tutors");
    } catch (error) {
      if (error.message.includes("already exists") || error.message.includes("duplicate")) {
        console.log("⚠️  currency column may already exist in sole_tutors");
      } else if (error.message.includes("does not exist")) {
        console.log("⚠️  sole_tutors table does not exist, skipping");
      } else {
        throw error;
      }
    }

    try {
      await db.query(`
        ALTER TABLE organizations 
        ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'NGN';
      `);
      console.log("✅ Added currency column to organizations");
    } catch (error) {
      if (error.message.includes("already exists") || error.message.includes("duplicate")) {
        console.log("⚠️  currency column may already exist in organizations");
      } else if (error.message.includes("does not exist")) {
        console.log("⚠️  organizations table does not exist, skipping");
      } else {
        throw error;
      }
    }

    // Step 4: Add community_member_limit to tutor_subscriptions
    console.log("\n🔍 Step 4: Adding community_member_limit to tutor_subscriptions...");
    try {
      await db.query(`
        ALTER TABLE tutor_subscriptions
        ADD COLUMN IF NOT EXISTS community_member_limit INTEGER;
      `);
      console.log("✅ Added community_member_limit column");
    } catch (error) {
      if (error.message.includes("already exists") || error.message.includes("duplicate")) {
        console.log("⚠️  community_member_limit column may already exist");
      } else {
        throw error;
      }
    }

    // Step 5: Create communities table
    console.log("\n🔍 Step 5: Creating communities table...");
    const [communitiesTableExists] = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'communities'
      )
    `);

    if (!communitiesTableExists[0].exists) {
      await db.query(`
        CREATE TABLE communities (
          id SERIAL PRIMARY KEY,
          tutor_id INTEGER NOT NULL,
          tutor_type VARCHAR(50) NOT NULL CHECK (tutor_type IN ('sole_tutor', 'organization')),
          name VARCHAR(255) NOT NULL,
          description TEXT,
          category VARCHAR(50) CHECK (category IN ('Business', 'Tech', 'Art', 'Logistics', 'Ebooks', 'Podcast', 'Videos', 'Music', 'Articles', 'Code', '2D/3D Files')),
          image_url TEXT,
          icon_url TEXT,
          price DECIMAL(10, 2) NOT NULL,
          currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
          pricing_type VARCHAR(50) NOT NULL DEFAULT 'subscription' CHECK (pricing_type IN ('subscription')),
          trial_days INTEGER DEFAULT 0,
          member_limit INTEGER,
          auto_approve BOOLEAN NOT NULL DEFAULT true,
          who_can_post VARCHAR(50) NOT NULL DEFAULT 'members' CHECK (who_can_post IN ('members', 'tutor_only', 'moderators')),
          moderation_enabled BOOLEAN NOT NULL DEFAULT false,
          file_sharing_enabled BOOLEAN NOT NULL DEFAULT true,
          live_sessions_enabled BOOLEAN NOT NULL DEFAULT true,
          visibility VARCHAR(50) NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
          status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
          member_count INTEGER NOT NULL DEFAULT 0,
          post_count INTEGER NOT NULL DEFAULT 0,
          commission_rate DECIMAL(5, 2) DEFAULT 15.0,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.query(`
        CREATE INDEX idx_communities_tutor ON communities(tutor_id, tutor_type)
      `);

      await db.query(`
        CREATE INDEX idx_communities_status ON communities(status)
      `);

      await db.query(`
        CREATE INDEX idx_communities_visibility ON communities(visibility)
      `);

      await db.query(`
        CREATE INDEX idx_communities_category ON communities(category)
      `);

      console.log("✅ Created communities table");
    } else {
      console.log("⚠️  communities table already exists");
    }

    // Step 6: Create community_members table
    console.log("\n🔍 Step 6: Creating community_members table...");
    const [membersTableExists] = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'community_members'
      )
    `);

    if (!membersTableExists[0].exists) {
      await db.query(`
        CREATE TABLE community_members (
          id SERIAL PRIMARY KEY,
          community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
          student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          role VARCHAR(50) NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'moderator', 'admin')),
          status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'left')),
          subscription_status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (subscription_status IN ('active', 'expired', 'cancelled')),
          subscription_start_date TIMESTAMP,
          subscription_end_date TIMESTAMP,
          next_billing_date TIMESTAMP,
          joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          last_active_at TIMESTAMP,
          access_blocked_at TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_community_member UNIQUE (community_id, student_id)
        )
      `);

      await db.query(`
        CREATE INDEX idx_community_members_community_id ON community_members(community_id)
      `);

      await db.query(`
        CREATE INDEX idx_community_members_student_id ON community_members(student_id)
      `);

      await db.query(`
        CREATE INDEX idx_community_members_subscription_status ON community_members(subscription_status)
      `);

      await db.query(`
        CREATE INDEX idx_community_members_status ON community_members(status)
      `);

      console.log("✅ Created community_members table");
    } else {
      console.log("⚠️  community_members table already exists");
    }

    // Step 7: Create community_subscriptions table
    console.log("\n🔍 Step 7: Creating community_subscriptions table...");
    const [subscriptionsTableExists] = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'community_subscriptions'
      )
    `);

    if (!subscriptionsTableExists[0].exists) {
      await db.query(`
        CREATE TABLE community_subscriptions (
          id SERIAL PRIMARY KEY,
          community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
          student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          price DECIMAL(10, 2) NOT NULL,
          currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
          status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
          start_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          end_date TIMESTAMP,
          next_billing_date TIMESTAMP NOT NULL,
          auto_renew BOOLEAN NOT NULL DEFAULT true,
          cancelled_at TIMESTAMP,
          cancellation_reason TEXT,
          payment_reference VARCHAR(255),
          email_sent_7days BOOLEAN DEFAULT false,
          email_sent_3days BOOLEAN DEFAULT false,
          email_sent_1day BOOLEAN DEFAULT false,
          email_sent_expired BOOLEAN DEFAULT false,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create partial unique index for active subscriptions
      await db.query(`
        CREATE UNIQUE INDEX unique_active_community_subscription 
        ON community_subscriptions(community_id, student_id) 
        WHERE status = 'active'
      `);

      await db.query(`
        CREATE INDEX idx_community_subscriptions_community_id ON community_subscriptions(community_id)
      `);

      await db.query(`
        CREATE INDEX idx_community_subscriptions_student_id ON community_subscriptions(student_id)
      `);

      await db.query(`
        CREATE INDEX idx_community_subscriptions_status ON community_subscriptions(status)
      `);

      await db.query(`
        CREATE INDEX idx_community_subscriptions_next_billing_date ON community_subscriptions(next_billing_date)
      `);

      console.log("✅ Created community_subscriptions table");
    } else {
      console.log("⚠️  community_subscriptions table already exists");
    }

    // Step 8: Create community_posts table
    console.log("\n🔍 Step 8: Creating community_posts table...");
    const [postsTableExists] = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'community_posts'
      )
    `);

    if (!postsTableExists[0].exists) {
      await db.query(`
        CREATE TABLE community_posts (
          id SERIAL PRIMARY KEY,
          community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
          author_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          title VARCHAR(500),
          content TEXT NOT NULL,
          content_type VARCHAR(50) NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'rich_text', 'link')),
          category VARCHAR(100),
          tags JSONB,
          status VARCHAR(50) NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'pinned', 'archived', 'deleted')),
          views INTEGER NOT NULL DEFAULT 0,
          likes_count INTEGER NOT NULL DEFAULT 0,
          comments_count INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.query(`
        CREATE INDEX idx_community_posts_community_id ON community_posts(community_id)
      `);

      await db.query(`
        CREATE INDEX idx_community_posts_author_id ON community_posts(author_id)
      `);

      await db.query(`
        CREATE INDEX idx_community_posts_status ON community_posts(status)
      `);

      await db.query(`
        CREATE INDEX idx_community_posts_created_at ON community_posts(created_at)
      `);

      console.log("✅ Created community_posts table");
    } else {
      console.log("⚠️  community_posts table already exists");
    }

    // Step 9: Create community_comments table
    console.log("\n🔍 Step 9: Creating community_comments table...");
    const [commentsTableExists] = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'community_comments'
      )
    `);

    if (!commentsTableExists[0].exists) {
      await db.query(`
        CREATE TABLE community_comments (
          id SERIAL PRIMARY KEY,
          post_id INTEGER NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
          author_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          parent_comment_id INTEGER REFERENCES community_comments(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'deleted')),
          likes_count INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.query(`
        CREATE INDEX idx_community_comments_post_id ON community_comments(post_id)
      `);

      await db.query(`
        CREATE INDEX idx_community_comments_author_id ON community_comments(author_id)
      `);

      await db.query(`
        CREATE INDEX idx_community_comments_parent_comment_id ON community_comments(parent_comment_id)
      `);

      await db.query(`
        CREATE INDEX idx_community_comments_created_at ON community_comments(created_at)
      `);

      console.log("✅ Created community_comments table");
    } else {
      console.log("⚠️  community_comments table already exists");
    }

    // Step 10: Create community_files table
    console.log("\n🔍 Step 10: Creating community_files table...");
    const [filesTableExists] = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'community_files'
      )
    `);

    if (!filesTableExists[0].exists) {
      await db.query(`
        CREATE TABLE community_files (
          id SERIAL PRIMARY KEY,
          community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
          uploaded_by INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          file_name VARCHAR(255) NOT NULL,
          file_url TEXT NOT NULL,
          file_type VARCHAR(50),
          file_size INTEGER,
          description TEXT,
          category VARCHAR(100),
          download_count INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.query(`
        CREATE INDEX idx_community_files_community_id ON community_files(community_id)
      `);

      await db.query(`
        CREATE INDEX idx_community_files_uploaded_by ON community_files(uploaded_by)
      `);

      await db.query(`
        CREATE INDEX idx_community_files_category ON community_files(category)
      `);

      console.log("✅ Created community_files table");
    } else {
      console.log("⚠️  community_files table already exists");
    }

    // Step 11: Create community_purchases table
    console.log("\n🔍 Step 11: Creating community_purchases table...");
    const [purchasesTableExists] = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'community_purchases'
      )
    `);

    if (!purchasesTableExists[0].exists) {
      await db.query(`
        CREATE TABLE community_purchases (
          id SERIAL PRIMARY KEY,
          community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
          student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          amount DECIMAL(10, 2) NOT NULL,
          currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
          commission_rate DECIMAL(5, 2) NOT NULL DEFAULT 15.0,
          wsp_commission DECIMAL(10, 2) NOT NULL,
          tutor_earnings DECIMAL(10, 2) NOT NULL,
          payment_reference VARCHAR(255),
          payment_method VARCHAR(50) DEFAULT 'wallet',
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.query(`
        CREATE INDEX idx_community_purchases_community_id ON community_purchases(community_id)
      `);

      await db.query(`
        CREATE INDEX idx_community_purchases_student_id ON community_purchases(student_id)
      `);

      await db.query(`
        CREATE INDEX idx_community_purchases_payment_reference ON community_purchases(payment_reference)
      `);

      await db.query(`
        CREATE INDEX idx_community_purchases_created_at ON community_purchases(created_at)
      `);

      console.log("✅ Created community_purchases table");
    } else {
      console.log("⚠️  community_purchases table already exists");
    }

    // Step 12: Create community_audio_sessions table
    console.log("\n🔍 Step 12: Creating community_audio_sessions table...");
    const [audioSessionsTableExists] = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'community_audio_sessions'
      )
    `);

    if (!audioSessionsTableExists[0].exists) {
      await db.query(`
        CREATE TABLE community_audio_sessions (
          id SERIAL PRIMARY KEY,
          community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
          created_by INTEGER NOT NULL,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          stream_call_id VARCHAR(255) UNIQUE,
          view_link TEXT,
          scheduled_start_time TIMESTAMP,
          scheduled_end_time TIMESTAMP,
          status VARCHAR(50) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'ended', 'cancelled')),
          actual_start_time TIMESTAMP,
          actual_end_time TIMESTAMP,
          participant_count INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.query(`
        CREATE INDEX idx_community_audio_sessions_community_id ON community_audio_sessions(community_id)
      `);

      await db.query(`
        CREATE INDEX idx_community_audio_sessions_created_by ON community_audio_sessions(created_by)
      `);

      await db.query(`
        CREATE INDEX idx_community_audio_sessions_status ON community_audio_sessions(status)
      `);

      await db.query(`
        CREATE INDEX idx_community_audio_sessions_scheduled_start_time ON community_audio_sessions(scheduled_start_time)
      `);

      console.log("✅ Created community_audio_sessions table");
    } else {
      console.log("⚠️  community_audio_sessions table already exists");
    }

    console.log("\n✅ Migration completed successfully!");
    console.log("\n📋 Summary:");
    console.log("   - Added one-on-one coaching fields to coaching_sessions");
    console.log("   - Created coaching_scheduling_messages table");
    console.log("   - Added currency field to sole_tutors and organizations");
    console.log("   - Added community_member_limit to tutor_subscriptions");
    console.log("   - Created all community-related tables");
    console.log("\n🎉 All tables are ready for use!");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    console.error("Error details:", error.message);
    process.exit(1);
  }
}

// Run migration
connectDB().then((success) => {
  if (success) {
    migrateOneOnOneCoachingAndCommunities();
  } else {
    console.error("❌ Failed to connect to database");
    process.exit(1);
  }
});

