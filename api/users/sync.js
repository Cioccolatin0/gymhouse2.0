// Vercel API Route for Users Sync
import { createClient } from '@vercel/postgres';
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

  const client = createClient();

  try {
    await client.connect();

    const { users } = req.body;

    if (!Array.isArray(users)) {
      return res.status(400).json({ ok: false, message: 'Users array required' });
    }

    // Get existing users
    const { rows: existingUsers } = await client.query('SELECT email, password_hash, configured FROM users');
    const byEmail = new Map();
    existingUsers.forEach(u => byEmail.set(u.email, u));

    let changed = false;

    for (const u of users) {
      if (!u || !u.email) continue;

      const existing = byEmail.get(u.email);
      if (!existing) {
        // Create new user
        const salt = u.email.toLowerCase().trim();
        const passwordHash = u.passwordHash || crypto.createHash('sha256').update(salt + ':' + (u.password || 'default')).digest('hex');
        
        await client.query(
          'INSERT INTO users (email, name, password_hash, emoji, color_index, configured, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW())',
          [u.email.toLowerCase(), u.name || 'User', passwordHash, u.emoji || '💪', u.colorIndex || 0, u.configured || false]
        );
        changed = true;
      } else if (u.passwordHash && u.passwordHash !== existing.password_hash) {
        // Update password
        await client.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2', [u.passwordHash, u.email]);
        changed = true;
      } else if ((u.configured || false) && !existing.configured) {
        // Update configured status
        await client.query('UPDATE users SET configured = true, updated_at = NOW() WHERE email = $1', [u.email]);
        changed = true;
      }
    }

    // Get all users after sync
    const { rows: allUsers } = await client.query('SELECT email, name, emoji, color_index, configured, created_at FROM users ORDER BY created_at DESC');

    return res.status(200).json({ ok: true, users: allUsers });
  } catch (error) {
    console.error('Users sync API error:', error);
    return res.status(500).json({ ok: false, message: 'Errore del database' });
  } finally {
    await client.end();
  }
}
