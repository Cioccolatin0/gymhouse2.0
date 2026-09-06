// Vercel API Route for API Keys Management
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Key');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'emobtemo@gmail.com';

  if (req.method === 'GET') {
    // Check if keys are configured (without exposing them)
    const hasGemini = !!process.env.GEMINI_API_KEY;
    const hasYoutube = !!process.env.YOUTUBE_API_KEY;
    return res.status(200).json({ 
      ok: true, 
      hasGemini, 
      hasYoutube, 
      setAt: process.env.KEYS_SET_AT || null 
    });
  }

  if (req.method === 'POST') {
    const { email, gemini, youtube } = req.body;

    if (email !== ADMIN_EMAIL) {
      return res.status(403).json({ ok: false, message: "Solo l'amministratore può impostare le chiavi" });
    }

    // In production, these should be stored in Vercel Environment Variables
    // For now, we'll return a message that keys need to be set in env vars
    return res.status(200).json({ 
      ok: true, 
      message: "Le chiavi devono essere configurate nelle Environment Variables di Vercel (GEMINI_API_KEY, YOUTUBE_API_KEY)" 
    });
  }

  return res.status(405).json({ ok: false, message: 'Method not allowed' });
}
