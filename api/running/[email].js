// Vercel API Route for Running Sessions Tracking
import { Pool } from '@neondatabase/serverless';

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
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  const client = await pool.connect();

  try {
    if (req.method === 'GET') {
      const { rows } = await client.query(
        'SELECT id, distance_km, duration_sec, calories, date, created_at, polyline FROM running_sessions WHERE email = $1 ORDER BY created_at DESC LIMIT 10',
        [email.toLowerCase()]
      );
      return res.status(200).json({ ok: true, running_sessions: rows });
    }

    if (req.method === 'POST') {
      const { email, distance_km, duration_sec, calories, polyline } = req.body;

      if (!email) {
        return res.status(400).json({ ok: false, message: 'Email richiesta' });
      }

      await client.query(
        `INSERT INTO running_sessions (email, distance_km, duration_sec, calories, polyline, date) VALUES ($1, $2, $3, $4, $5, $6)`,
        [email.toLowerCase(), distance_km || 0, duration_sec || 0, calories || 0, polyline || null, Date.now()]
      );

      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.body;
      if (!id) {
        return res.status(400).json({ ok: false, message: 'ID richiesto' });
      }
      await client.query(
        'DELETE FROM running_sessions WHERE id = $1',
        [id]
      );
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  } catch (error) {
    console.error('Running API error:', error);
    return res.status(500).json({ ok: false, message: 'Errore del database' });
  } finally {
    client.release();
    await pool.end();
  }
}