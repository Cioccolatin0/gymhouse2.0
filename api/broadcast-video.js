// Vercel API Route for Broadcast Video
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

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  const client = await pool.connect();

  try {
    const { url, title } = req.body;

    if (!url) {
      return res.status(400).json({ ok: false, message: 'URL mancante' });
    }

    let videoUrl = String(url).trim();
    if (!/^https?:\/\//i.test(videoUrl)) videoUrl = 'https://' + videoUrl;

    await client.query(
      'INSERT INTO videos (url, title, date) VALUES ($1, $2, $3)',
      [videoUrl, title?.slice(0, 120) || 'Video Gym House', Date.now()]
    );

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Broadcast video API error:', error);
    return res.status(500).json({ ok: false, message: 'Errore del database' });
  } finally {
    client.release();
    await pool.end();
  }
}
