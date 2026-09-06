// Vercel API Route for Diet/Workout Plans
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
        'SELECT kind, data, created_at FROM plans WHERE email = $1 ORDER BY created_at DESC',
        [email.toLowerCase()]
      );

      const diet = rows.find(r => r.kind === 'diet')?.data || null;
      const workout = rows.find(r => r.kind === 'workout')?.data || null;

      return res.status(200).json({ ok: true, diet, workout });
    }

    if (req.method === 'POST') {
      const { kind, data } = req.body;

      if (kind !== 'diet' && kind !== 'workout') {
        return res.status(400).json({ ok: false, message: 'kind non valido' });
      }

      // Upsert plan
      await client.query(
        `INSERT INTO plans (email, kind, data, created_at) 
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (email, kind) 
         DO UPDATE SET data = $3, created_at = NOW()`,
        [email.toLowerCase(), kind, JSON.stringify(data)]
      );

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  } catch (error) {
    console.error('Plans API error:', error);
    return res.status(500).json({ ok: false, message: 'Errore del database' });
  } finally {
    await client.end();
  }
}
