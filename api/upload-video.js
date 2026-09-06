// Vercel API Route for Video Upload (using Vercel Blob)
import { put } from '@vercel/blob';

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
    const { searchParams } = new URL(req.url);
    const filename = searchParams.get('filename');

    if (!filename) {
      return res.status(400).json({ ok: false, message: 'Filename mancante' });
    }

    // Check if BLOB_READ_WRITE_TOKEN is configured
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(500).json({ 
        ok: false, 
        message: 'Vercel Blob non configurato. Imposta BLOB_READ_WRITE_TOKEN nelle Environment Variables.' 
      });
    }

    // Upload to Vercel Blob
    const blob = await put(filename, req.body, {
      access: 'public',
    });

    return res.status(200).json({ ok: true, url: blob.url });
  } catch (error) {
    console.error('Video upload error:', error);
    return res.status(500).json({ ok: false, message: 'Errore upload video: ' + error.message });
  }
}

export const config = {
  api: {
    bodyParser: false, // Disable built-in body parser for file uploads
  },
};
