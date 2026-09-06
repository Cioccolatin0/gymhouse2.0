// Vercel API Route for Users Management
// Uses Neon Postgres (formerly Vercel Postgres)
import { Pool } from '@neondatabase/serverless';
import crypto from 'crypto';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Key');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  const client = await pool.connect();
  
  try {
    if (req.method === 'GET') {
      // Get all users
      const { rows } = await client.query('SELECT email, name, emoji, color_index, configured, created_at FROM users ORDER BY created_at DESC');
      return res.status(200).json({ ok: true, users: rows });
    }

    if (req.method === 'POST') {
      const { email, name, password, emoji, colorIndex } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ ok: false, message: 'Email e password richiesti' });
      }

      // Check if user exists
      const existingUser = await client.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
      
      if (existingUser.rows.length > 0) {
        return res.status(400).json({ ok: false, message: 'Utente già esistente' });
      }

      // Hash password
      const salt = email.toLowerCase().trim();
      const passwordHash = crypto.createHash('sha256').update(salt + ':' + password).digest('hex');

      // Create user
      const { rows } = await client.query(
        'INSERT INTO users (email, name, password_hash, emoji, color_index, configured, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING email, name, emoji, color_index, configured, created_at',
        [email.toLowerCase(), name, passwordHash, emoji || '💪', colorIndex || 0, false]
      );

      return res.status(200).json({ ok: true, user: rows[0] });
    }

    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  } catch (error) {
    console.error('Users API error:', error);
    return res.status(500).json({ ok: false, message: 'Errore del database' });
  } finally {
    client.release();
    await pool.end();
  }
}
