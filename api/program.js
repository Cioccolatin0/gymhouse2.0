// Vercel API Route for Programs
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

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  const client = createClient();

  try {
    await client.connect();

    const { title, body } = req.body;

    if (!title) {
      return res.status(400).json({ ok: false, message: 'Titolo mancante' });
    }

    await client.query(
      'INSERT INTO programs (title, body, date) VALUES ($1, $2, $3)',
      [title.slice(0, 80), body?.slice(0, 2000) || '', Date.now()]
    );

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Program API error:', error);
    return res.status(500).json({ ok: false, message: 'Errore del database' });
  } finally {
    await client.end();
  }
}
