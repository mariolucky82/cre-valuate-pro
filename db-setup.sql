-- PostgreSQL schema for CRE Valuate Pro
-- Run this on your PostgreSQL database to replace in-memory user store

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  paid BOOLEAN DEFAULT false,
  logo_key VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id VARCHAR(255) UNIQUE,
  stripe_subscription_id VARCHAR(255) UNIQUE,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pdfs_generated (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255),
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX idx_pdfs_user_id ON pdfs_generated(user_id);

-- Insert test user (same as in-memory demo)
INSERT INTO users (email, password_hash, paid) VALUES (
  'test@example.com',
  '$2b$10$zxc...' -- You'll need to generate actual bcrypt hash
);

-- Commands to use in Node.js:
/*
// Get user by email
SELECT * FROM users WHERE email = $1;

// Update paid status
UPDATE users SET paid = true WHERE id = $1;

// Store logo key
UPDATE users SET logo_key = $1 WHERE id = $2;

// Store Stripe customer
INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_subscription_id)
VALUES ($1, $2, $3);

// Check subscription status
SELECT * FROM subscriptions WHERE user_id = $1;
*/
