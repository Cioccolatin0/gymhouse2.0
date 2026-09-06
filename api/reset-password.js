// Vercel API Route for Password Reset
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

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  const client = await pool.connect();

  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ ok: false, message: 'Email e nuova password richiesti' });
    }

    if (newPassword.length < 4) {
      return res.status(400).json({ ok: false, message: 'Password troppo corta (min 4 caratteri)' });
    }

    const existingUser = await client.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    
    if (existingUser.rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Utente non trovato' });
    }

    const salt = email.toLowerCase().trim();
    const passwordHash = crypto.createHash('sha256').update(salt + ':' + newPassword).digest('hex');

    await client.query(
      'UPDATE users SET password_hash = $1, reset_at = NOW(), updated_at = NOW() WHERE email = $2',
      [passwordHash, email.toLowerCase()]
    );

    const { rows: allUsers } = await client.query('SELECT email, name, emoji, color_index, configured, created_at FROM users ORDER BY created_at DESC');

    return res.status(200).json({ ok: true, users: allUsers });
  } catch (error) {
    console.error('Reset password API error:', error);
    return res.status(500).json({ ok: false, message: 'Errore del database' });
  } finally {
    client.release();
    await pool.end();
  }
}
