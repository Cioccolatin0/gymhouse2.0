// Vercel API Route for Login
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

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ ok: false, message: 'Email e password richiesti' });
    }

    const { rows } = await client.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);

    if (rows.length === 0) {
      return res.status(200).json({ ok: false, message: 'Questo indirizzo email non risulta registrato' });
    }

    const user = rows[0];
    const salt = email.toLowerCase().trim();
    const passwordHash = crypto.createHash('sha256').update(salt + ':' + password).digest('hex');

    if (passwordHash !== user.password_hash) {
      return res.status(200).json({ ok: false, message: 'Password errata' });
    }

    // Return user data without password
    const { password_hash, ...safeUser } = user;
    return res.status(200).json({ ok: true, user: safeUser });
  } catch (error) {
    console.error('Login API error:', error);
    return res.status(500).json({ ok: false, message: 'Errore del database' });
  } finally {
    await client.end();
  }
}
