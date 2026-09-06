// Vercel API Route for YouTube Channel ID
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

  try {
    const { handle } = req.body;
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
      return res.status(200).json({ ok: false, message: "Chiave YouTube non configurata" });
    }

    if (!handle) {
      return res.status(400).json({ ok: false, message: 'Handle mancante' });
    }

    const url = `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url);

    if (!response.ok) {
      return res.status(200).json({ ok: false, message: `Errore YouTube (${response.status})` });
    }

    const data = await response.json();
    const id = data.items?.[0]?.id || null;

    return res.status(200).json({ ok: true, channelId: id });
  } catch (error) {
    console.error('YouTube channel API error:', error);
    return res.status(500).json({ ok: false, message: 'Errore di rete: ' + error.message });
  }
}
