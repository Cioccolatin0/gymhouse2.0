// Vercel API Route for Online Users (Stateless Stub)
// Note: Real-time WebSocket-based online tracking only works locally with server.js
// On Vercel serverless, this returns empty/last-known state via polling fallback

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

  // Stateless: return empty array (serverless can't maintain WS connections)
  // Frontend gracefully handles empty online list
  return res.status(200).json({
    ok: true,
    online: [],
    total: 0
  });
}
