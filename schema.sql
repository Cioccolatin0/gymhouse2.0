-- Database Schema for Gym House Vercel Deployment
-- Run this in Vercel Postgres dashboard or via psql

-- ============================
-- Sync state (for cross-device realtime polling)
-- ============================
CREATE TABLE IF NOT EXISTS sync_state (
  key VARCHAR(50) PRIMARY KEY,
  updated_at BIGINT NOT NULL
);

-- ============================
-- Users table
-- ============================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  emoji VARCHAR(10) DEFAULT '💪',
  color_index INTEGER DEFAULT 0,
  configured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  reset_at TIMESTAMP
);

-- Plans table (diet and workout plans)
CREATE TABLE IF NOT EXISTS plans (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('diet', 'workout')),
  data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(email, kind)
);

-- Sgarri (cheat meals) table
CREATE TABLE IF NOT EXISTS sgarri (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  food TEXT NOT NULL,
  quantity TEXT,
  time VARCHAR(10),
  date VARCHAR(20),
  timestamp BIGINT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  body TEXT,
  date BIGINT NOT NULL
);

-- Videos table
CREATE TABLE IF NOT EXISTS videos (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  title VARCHAR(200) NOT NULL,
  date BIGINT NOT NULL
);

-- Programs table
CREATE TABLE IF NOT EXISTS programs (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  body TEXT,
  date BIGINT NOT NULL
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_plans_email ON plans(email);
CREATE INDEX IF NOT EXISTS idx_sgarri_email ON sgarri(email);
CREATE INDEX IF NOT EXISTS idx_sgarri_timestamp ON sgarri(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_date ON notifications(date DESC);
CREATE INDEX IF NOT EXISTS idx_videos_date ON videos(date DESC);
CREATE INDEX IF NOT EXISTS idx_programs_date ON programs(date DESC);
