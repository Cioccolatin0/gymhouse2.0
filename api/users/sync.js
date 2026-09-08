// Vercel API Route for Users Sync
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
    const { users } = req.body;

    if (!Array.isArray(users)) {
      return res.status(400).json({ ok: false, message: 'Users array required' });
    }

    // Get existing users
    const { rows: existingUsers } = await client.query('SELECT email, name, emoji, color_index, password_hash, configured, credential FROM users');
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
          'INSERT INTO users (email, name, password_hash, emoji, color_index, configured, credential, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())',
          [u.email.toLowerCase(), u.name || 'User', passwordHash, u.emoji || '💪', u.colorIndex ?? 0, u.configured || false, u.credential || null]
        );
        changed = true;
      } else {
        // Update existing user: check all mutable fields and force updated_at=NOW() if anything changed
        let needsUpdate = false;
        const newName = (u.name || 'User').slice(0, 100);
        const newEmoji = (u.emoji || '💪').slice(0, 10);
        const newColor = u.colorIndex ?? 0;
        const newConfigured = u.configured ? true : false;
        const newPass = u.passwordHash || u.password_hash || null;
        const newCred = u.credential || null;

        if (newName !== existing.name) needsUpdate = true;
        if (newEmoji !== existing.emoji) needsUpdate = true;
        if (Number(newColor) !== Number(existing.color_index)) needsUpdate = true;
        if (newConfigured !== (existing.configured ? true : false)) needsUpdate = true;
        if (newPass && newPass !== existing.password_hash) needsUpdate = true;
        if (newCred && newCred !== existing.credential) needsUpdate = true;

        if (needsUpdate) {
          if (newPass) {
            await client.query(
              'UPDATE users SET name=$1, emoji=$2, color_index=$3, configured=$4, password_hash=$5, credential=$6, updated_at=NOW() WHERE email=$7',
              [newName, newEmoji, newColor, newConfigured, newPass, newCred, u.email.toLowerCase()]
            );
          } else {
            await client.query(
              'UPDATE users SET name=$1, emoji=$2, color_index=$3, configured=$4, credential=$5, updated_at=NOW() WHERE email=$6',
              [newName, newEmoji, newColor, newConfigured, newCred, u.email.toLowerCase()]
            );
          }
          changed = true;
        }
      }
    }

    // Get all users after sync
    const { rows: allUsers } = await client.query('SELECT email, name, emoji, color_index, configured, credential, password_hash, created_at FROM users ORDER BY created_at DESC');
    const normalized = allUsers.map(r => ({
      email: r.email,
      name: r.name,
      emoji: r.emoji,
      colorIndex: r.color_index,
      color_index: r.color_index,
      configured: r.configured,
      credential: r.credential,
      passwordHash: r.password_hash,
      password_hash: r.password_hash,
      created_at: r.created_at
    }));

    return res.status(200).json({ ok: true, users: normalized });
  } catch (error) {
    console.error('Users sync API error:', error);
    return res.status(500).json({ ok: false, message: 'Errore del database' });
  } finally {
    client.release();
    await pool.end();
  }
}
