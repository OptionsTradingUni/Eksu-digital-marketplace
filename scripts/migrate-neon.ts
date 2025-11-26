import { neon } from "@neondatabase/serverless";

const NEON_URL = "postgresql://neondb_owner:npg_4Eswfa6SyHgC@ep-ancient-dust-agz33a36.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require";

async function migrate() {
  const sql = neon(NEON_URL);

  console.log("Starting Neon database migration...");

  const migrations = [
    // Add user_role enum if missing
    `DO $$ BEGIN
      CREATE TYPE user_role AS ENUM ('buyer', 'seller', 'both', 'admin');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,

    // Add product_condition enum if missing
    `DO $$ BEGIN
      CREATE TYPE product_condition AS ENUM ('new', 'like_new', 'good', 'fair');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,

    // Add transaction_type enum if missing
    `DO $$ BEGIN
      CREATE TYPE transaction_type AS ENUM (
        'welcome_bonus', 'referral_bonus', 'login_reward', 'deposit', 'sale', 'purchase',
        'boost_payment', 'featured_payment', 'escrow_hold', 'escrow_release', 'escrow_fee',
        'refund', 'withdrawal', 'agent_commission', 'platform_fee'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,

    // Add escrow_status enum if missing
    `DO $$ BEGIN
      CREATE TYPE escrow_status AS ENUM ('pending', 'held', 'released', 'refunded', 'disputed');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,

    // Add notification_type enum if missing
    `DO $$ BEGIN
      CREATE TYPE notification_type AS ENUM (
        'message', 'sale', 'purchase', 'review', 'follow', 'product_update',
        'announcement', 'dispute', 'verification_approved', 'verification_rejected',
        'escrow_released', 'wallet_credit', 'boost_expired', 'price_alert'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,

    // Add announcement_category enum if missing
    `DO $$ BEGIN
      CREATE TYPE announcement_category AS ENUM ('update', 'feature', 'alert');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,

    // Add announcement_priority enum if missing
    `DO $$ BEGIN
      CREATE TYPE announcement_priority AS ENUM ('low', 'normal', 'high');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,

    // Add missing columns to users table
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(8) UNIQUE`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS nin_verified BOOLEAN DEFAULT false`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS nin_verification_date TIMESTAMP`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS nin_hash VARCHAR UNIQUE`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS nin_vnin VARCHAR`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS nin_confidence_score DECIMAL(5,2)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS instagram_handle VARCHAR`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS tiktok_handle VARCHAR`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS facebook_profile VARCHAR`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_trusted_seller BOOLEAN DEFAULT false`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS trusted_seller_since TIMESTAMP`,

    // Create wallets table if not exists
    `CREATE TABLE IF NOT EXISTS wallets (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id VARCHAR NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      escrow_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      total_earned DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      total_spent DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`,

    // Create transactions table if not exists
    `CREATE TABLE IF NOT EXISTS transactions (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      wallet_id VARCHAR NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
      type transaction_type NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      description TEXT,
      related_product_id VARCHAR REFERENCES products(id) ON DELETE SET NULL,
      related_user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
      status VARCHAR(20) DEFAULT 'completed',
      created_at TIMESTAMP DEFAULT NOW()
    )`,

    // Create referrals table if not exists
    `CREATE TABLE IF NOT EXISTS referrals (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      referrer_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      referred_user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      bonus_amount DECIMAL(10,2),
      bonus_paid BOOLEAN DEFAULT false,
      referred_user_made_purchase BOOLEAN DEFAULT false,
      first_purchase_id VARCHAR,
      bonus_paid_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )`,

    // Create welcome_bonuses table if not exists
    `CREATE TABLE IF NOT EXISTS welcome_bonuses (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id VARCHAR NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      amount DECIMAL(10,2) NOT NULL,
      claimed BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )`,

    // Create login_streaks table if not exists
    `CREATE TABLE IF NOT EXISTS login_streaks (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id VARCHAR NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      current_streak INTEGER DEFAULT 0,
      longest_streak INTEGER DEFAULT 0,
      last_login_date TIMESTAMP,
      total_rewards DECIMAL(10,2) DEFAULT 0.00,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`,

    // Create seller_analytics table if not exists
    `CREATE TABLE IF NOT EXISTS seller_analytics (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      seller_id VARCHAR NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      total_views INTEGER DEFAULT 0,
      total_messages INTEGER DEFAULT 0,
      conversion_rate DECIMAL(5,2) DEFAULT 0.00,
      best_posting_hour INTEGER,
      best_posting_day INTEGER,
      updated_at TIMESTAMP DEFAULT NOW()
    )`,

    // Create saved_searches table if not exists
    `CREATE TABLE IF NOT EXISTS saved_searches (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      query VARCHAR(200) NOT NULL,
      filters JSONB,
      max_price DECIMAL(10,2),
      alert_enabled BOOLEAN DEFAULT true,
      last_alert_sent TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )`,

    // Create draft_products table if not exists
    `CREATE TABLE IF NOT EXISTS draft_products (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      seller_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      data JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`,

    // Create scheduled_posts table if not exists
    `CREATE TABLE IF NOT EXISTS scheduled_posts (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      seller_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_data JSONB NOT NULL,
      scheduled_for TIMESTAMP NOT NULL,
      published BOOLEAN DEFAULT false,
      published_product_id VARCHAR REFERENCES products(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )`,

    // Create boost_requests table if not exists
    `CREATE TABLE IF NOT EXISTS boost_requests (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      product_id VARCHAR NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      seller_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(20) NOT NULL,
      duration INTEGER NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )`,

    // Create disputes table if not exists
    `CREATE TABLE IF NOT EXISTS disputes (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      product_id VARCHAR REFERENCES products(id) ON DELETE SET NULL,
      buyer_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      seller_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      description TEXT NOT NULL,
      evidence TEXT[] DEFAULT ARRAY[]::text[],
      status VARCHAR(20) DEFAULT 'open',
      resolution TEXT,
      resolved_by VARCHAR REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      resolved_at TIMESTAMP
    )`,

    // Create support_tickets table if not exists
    `CREATE TABLE IF NOT EXISTS support_tickets (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject VARCHAR(200) NOT NULL,
      message TEXT NOT NULL,
      category VARCHAR(50),
      priority VARCHAR(20) DEFAULT 'medium',
      attachments TEXT[] DEFAULT ARRAY[]::text[],
      status VARCHAR(20) DEFAULT 'open',
      assigned_to VARCHAR REFERENCES users(id) ON DELETE SET NULL,
      response TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`,

    // Create follows table if not exists
    `CREATE TABLE IF NOT EXISTS follows (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      follower_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      following_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW()
    )`,

    // Create notifications table if not exists
    `CREATE TABLE IF NOT EXISTS notifications (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type notification_type NOT NULL,
      title VARCHAR(200) NOT NULL,
      message TEXT NOT NULL,
      link VARCHAR,
      is_read BOOLEAN DEFAULT false,
      related_user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
      related_product_id VARCHAR REFERENCES products(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )`,

    // Create announcements table if not exists
    `CREATE TABLE IF NOT EXISTS announcements (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      author_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(200) NOT NULL,
      content TEXT NOT NULL,
      category announcement_category NOT NULL DEFAULT 'update',
      priority announcement_priority NOT NULL DEFAULT 'normal',
      is_pinned BOOLEAN DEFAULT false,
      is_published BOOLEAN DEFAULT true,
      views INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`,

    // Create escrow_transactions table if not exists
    `CREATE TABLE IF NOT EXISTS escrow_transactions (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      buyer_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      seller_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id VARCHAR REFERENCES products(id) ON DELETE SET NULL,
      hostel_id VARCHAR,
      amount DECIMAL(10,2) NOT NULL,
      platform_fee DECIMAL(10,2) NOT NULL,
      status escrow_status NOT NULL DEFAULT 'pending',
      hold_duration INTEGER DEFAULT 7,
      released_at TIMESTAMP,
      dispute_id VARCHAR,
      buyer_confirmed BOOLEAN DEFAULT false,
      seller_confirmed BOOLEAN DEFAULT false,
      auto_release_date TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`,

    // Create search_history table if not exists
    `CREATE TABLE IF NOT EXISTS search_history (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
      query VARCHAR(200) NOT NULL,
      filters JSONB,
      result_count INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    )`,

    // Create cart_items table if not exists
    `CREATE TABLE IF NOT EXISTS cart_items (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id VARCHAR NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`,
  ];

  let successCount = 0;
  let errorCount = 0;

  for (const migration of migrations) {
    try {
      await sql(migration);
      successCount++;
      console.log(`✓ Migration ${successCount} completed`);
    } catch (error: any) {
      if (error.message?.includes("already exists") || error.message?.includes("duplicate")) {
        console.log(`⊘ Skipped (already exists): ${migration.slice(0, 50)}...`);
        successCount++;
      } else {
        console.error(`✗ Error: ${error.message}`);
        console.error(`  Query: ${migration.slice(0, 100)}...`);
        errorCount++;
      }
    }
  }

  console.log(`\n✓ Migration complete: ${successCount} successful, ${errorCount} errors`);
}

migrate().catch(console.error);
