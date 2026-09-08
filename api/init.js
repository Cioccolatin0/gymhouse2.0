// Vercel API Route: Initializes the Neon Postgres schema (idempotent)
// Call once (GET) to create all tables if not present.
import { Pool } from '@neondatabase/serverless';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sync_state (
  key VARCHAR(50) PRIMARY KEY,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  emoji VARCHAR(10) DEFAULT '💪',
  color_index INTEGER DEFAULT 0,
  configured BOOLEAN DEFAULT FALSE,
  credential TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  reset_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS plans (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('diet', 'workout')),
  data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(email, kind)
);

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

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  body TEXT,
  date BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS videos (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  title VARCHAR(200) NOT NULL,
  date BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS programs (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  body TEXT,
  date BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_plans_email ON plans(email);
CREATE INDEX IF NOT EXISTS idx_sgarri_email ON sgarri(email);
CREATE INDEX IF NOT EXISTS idx_sgarri_timestamp ON sgarri(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_date ON notifications(date DESC);
CREATE INDEX IF NOT EXISTS idx_videos_date ON videos(date DESC);
CREATE INDEX IF NOT EXISTS idx_programs_date ON programs(date DESC);

CREATE TABLE IF NOT EXISTS running_sessions (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  distance_km DECIMAL(5,2) DEFAULT 0,
  duration_sec INTEGER DEFAULT 0,
  polyline TEXT,
  calories INTEGER DEFAULT 0,
  date BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  const cs = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!cs) {
    return res.status(500).json({ ok: false, message: 'POSTGRES_URL non configurata. Imposta le env vars su Vercel (Production, Preview, Development).' });
  }

  const pool = new Pool({ connectionString: cs });

  try {
    await pool.query(SCHEMA);
    // Verify users table works
    await pool.query('SELECT 1 FROM users LIMIT 1');
    return res.status(200).json({ ok: true, message: 'Schema inizializzato con successo. Tabelle create/verificate.' });
  } catch (error) {
    console.error('Init DB error:', error);
    return res.status(500).json({ ok: false, message: 'Errore inizializzazione: ' + error.message });
  } finally {
    await pool.end();
  }
}
