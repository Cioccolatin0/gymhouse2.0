// Vercel API Route for Sgarro (Cheat Meals) Tracking
import { createClient } from '@vercel/postgres';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Key');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { email } = req.query;
  const client = createClient();

  try {
    await client.connect();

    if (req.method === 'GET') {
      const { rows } = await client.query(
        'SELECT food, quantity, time, date, timestamp FROM sgarri WHERE email = $1 ORDER BY timestamp DESC LIMIT 30',
        [email.toLowerCase()]
      );

      return res.status(200).json({ ok: true, sgarri: rows });
    }

    if (req.method === 'POST') {
      const { sgarro } = req.body;

      if (!sgarro) {
        return res.status(400).json({ ok: false, message: 'sgarro mancante' });
      }

      await client.query(
        'INSERT INTO sgarri (email, food, quantity, time, date, timestamp) VALUES ($1, $2, $3, $4, $5, $6)',
        [email.toLowerCase(), sgarro.food, sgarro.quantity, sgarro.time, sgarro.date, sgarro.timestamp || Date.now()]
      );

      // Keep only last 30
      await client.query(
        'DELETE FROM sgarri WHERE email = $1 AND id NOT IN (SELECT id FROM sgarri WHERE email = $1 ORDER BY timestamp DESC LIMIT 30)',
        [email.toLowerCase()]
      );

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  } catch (error) {
    console.error('Sgarro API error:', error);
    return res.status(500).json({ ok: false, message: 'Errore del database' });
  } finally {
    await client.end();
  }
}
