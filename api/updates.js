// Vercel API Route for Real-time Updates (Polling)
import { Pool } from '@neondatabase/serverless';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Key');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  const client = await pool.connect();

  try {
    // Get latest notifications, videos, and programs
    const { rows: notifies } = await client.query(
      'SELECT title, body, date FROM notifications ORDER BY date DESC LIMIT 1'
    );
    
    const { rows: videos } = await client.query(
      'SELECT url, title, date FROM videos ORDER BY date DESC LIMIT 1'
    );
    
    const { rows: programs } = await client.query(
      'SELECT title, body, date FROM programs ORDER BY date DESC LIMIT 1'
    );

    // Cross-device data change detection: return MAX timestamps for users/plans/sgarri
    // so frontend knows if it needs to refetch lists from another device
    const { rows: maxUsersRows } = await client.query(
      "SELECT COALESCE(EXTRACT(EPOCH FROM MAX(updated_at)) * 1000, 0) AS ts FROM users"
    );
    const { rows: maxPlansRows } = await client.query(
      "SELECT COALESCE(EXTRACT(EPOCH FROM MAX(created_at)) * 1000, 0) AS ts FROM plans"
    );
    const { rows: maxSgarriRows } = await client.query(
      'SELECT COALESCE(MAX(timestamp), 0) AS ts FROM sgarri'
    );

    return res.status(200).json({
      ok: true,
      lastNotify: notifies[0] || null,
      lastVideo: videos[0] || null,
      lastProgram: programs[0] || null,
      dataVersion: {
        users: Math.floor(maxUsersRows[0]?.ts || 0),
        plans: Math.floor(maxPlansRows[0]?.ts || 0),
        sgarri: Math.floor(maxSgarriRows[0]?.ts || 0)
      }
    });
  } catch (error) {
    console.error('Updates API error:', error);
    return res.status(500).json({ ok: false, message: 'Errore del database' });
  } finally {
    client.release();
    await pool.end();
  }
}
