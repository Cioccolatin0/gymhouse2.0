const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer, WebSocket } = require('ws');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const START_PORT = parseInt(process.env.PORT, 10) || 3000;

const ADMIN_EMAIL = 'emobtemo@gmail.com';
const GEMINI_MODEL = 'gemini-3-flash-preview';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4v': 'video/mp4',
  '.ogg': 'video/ogg',
  '.mp3': 'audio/mpeg',
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t'
};

const UPLOAD_DIR = path.join(ROOT, 'uploads');
const VIDEO_EXT = ['.mp4', '.webm', '.mov', '.m4v', '.ogg', '.m3u8'];

// ---------- DB (file JSON) ----------
function loadDb() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DB_FILE)) return { users: [], lastNotify: null, lastVideo: null, lastProgram: null, keys: { gemini: '', youtube: '', setAt: null }, plans: {}, sgarri: {} };
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const db = JSON.parse(raw);
    db.users = Array.isArray(db.users) ? db.users : [];
    return db;
  } catch (e) {
    return { users: [], lastNotify: null, lastVideo: null, lastProgram: null, keys: { gemini: '', youtube: '', setAt: null }, plans: {}, sgarri: {} };
  }
}

function saveDb(db) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error('DB write error:', e.message);
  }
}

function hashPassword(pw, email) {
  const salt = String(email || '').toLowerCase().trim();
  return crypto.createHash('sha256').update(salt + ':' + pw).digest('hex');
}

// ---------- Presence (WebSocket) ----------
const sockets = new Map(); // ws -> { email }

function onlineUsers() {
  const seen = new Map();
  sockets.forEach((u) => {
    if (u && u.email && !seen.has(u.email)) seen.set(u.email, u);
  });
  return Array.from(seen.values());
}

function broadcast(obj) {
  sockets.forEach((info, ws) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify(obj)); } catch (e) {}
    }
  });
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, 'http://localhost:' + (server.address() ? server.address().port : START_PORT));
  const urlPath = decodeURIComponent(parsedUrl.pathname);

  // ---------- API ----------
  if (urlPath.startsWith('/api/')) {
    const db = loadDb();

    // Chiavi centrali (solo admin)
    if (urlPath === '/api/keys' && req.method === 'GET') {
      const k = db.keys || {};
      writeJson(res, 200, { ok: true, hasGemini: !!(k.gemini), hasYoutube: !!(k.youtube), setAt: k.setAt || null });
      return;
    }
    if (urlPath === '/api/keys' && req.method === 'POST') {
      readBody(req, (body) => {
        const email = String(body.email || '').toLowerCase().trim();
        if (email !== ADMIN_EMAIL) { writeJson(res, 403, { ok: false, message: "Solo l'amministratore può impostare le chiavi." }); return; }
        db.keys = { gemini: String(body.gemini || '').trim(), youtube: String(body.youtube || '').trim(), setAt: Date.now() };
        saveDb(db);
        writeJson(res, 200, { ok: true });
      });
      return;
    }

    // Proxy Gemini (la chiave resta sul server)
    if (urlPath === '/api/gemini' && req.method === 'POST') {
      readBody(req, async (body) => {
        const key = (db.keys && db.keys.gemini) || '';
        if (!key) { writeJson(res, 200, { ok: false, message: "La chiave AI non è configurata dall'amministratore." }); return; }
        const prompt = String(body.prompt || '');
        if (!prompt) { writeJson(res, 400, { ok: false, message: 'Prompt mancante.' }); return; }
        try {
          const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`;
          const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            systemInstruction: { parts: [{ text: 'Sei il Personal Trainer e Nutrizionista della Gym House. Rispondi in italiano con tono professionale, strutturato e senza markdown grezzo.' }] }
          };
          const r = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          if (!r.ok) {
            let msg = 'Errore Gemini (' + r.status + ')';
            try { const e = await r.json(); if (e && e.error && e.error.message) msg = e.error.message; } catch (e2) {}
            writeJson(res, 200, { ok: false, message: msg });
            return;
          }
          const d = await r.json();
          const text = d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts && d.candidates[0].content.parts[0] && d.candidates[0].content.parts[0].text;
          if (!text) { writeJson(res, 200, { ok: false, message: 'Gemini non ha restituito contenuti.' }); return; }
          writeJson(res, 200, { ok: true, text });
        } catch (e) {
          writeJson(res, 200, { ok: false, message: 'Errore di rete verso Gemini: ' + e.message });
        }
      });
      return;
    }

    // Proxy YouTube (la chiave resta sul server)
    if (urlPath === '/api/youtube/channel' && req.method === 'POST') {
      readBody(req, async (body) => {
        const key = (db.keys && db.keys.youtube) || '';
        if (!key) { writeJson(res, 200, { ok: false, message: "La chiave YouTube non è configurata dall'amministratore." }); return; }
        const handle = String(body.handle || '').trim();
        try {
          const url = `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${encodeURIComponent(key)}`;
          const r = await fetch(url);
          if (!r.ok) { writeJson(res, 200, { ok: false, message: 'Errore YouTube (' + r.status + ')' }); return; }
          const d = await r.json();
          const id = d.items && d.items[0] && d.items[0].id;
          writeJson(res, 200, { ok: true, channelId: id || null });
        } catch (e) {
          writeJson(res, 200, { ok: false, message: 'Errore di rete: ' + e.message });
        }
      });
      return;
    }
    if (urlPath === '/api/youtube/search' && req.method === 'POST') {
      readBody(req, async (body) => {
        const key = (db.keys && db.keys.youtube) || '';
        if (!key) { writeJson(res, 200, { ok: false, message: "La chiave YouTube non è configurata dall'amministratore." }); return; }
        const q = String(body.q || '');
        const channelId = String(body.channelId || '');
        if (!q) { writeJson(res, 400, { ok: false, message: 'Query mancante.' }); return; }
        try {
          const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&type=video&videoEmbeddable=true&safeSearch=strict&q=${encodeURIComponent(q)}&key=${encodeURIComponent(key)}` + (channelId ? `&channelId=${encodeURIComponent(channelId)}` : '');
          const r = await fetch(url);
          if (!r.ok) { writeJson(res, 200, { ok: false, message: 'Errore YouTube (' + r.status + ')' }); return; }
          const d = await r.json();
          const item = d.items && d.items[0];
          writeJson(res, 200, { ok: true, id: (item && item.id && item.id.videoId) || null, title: (item && item.snippet && item.snippet.title) || null });
        } catch (e) {
          writeJson(res, 200, { ok: false, message: 'Errore di rete: ' + e.message });
        }
      });
      return;
    }

    // Piani salvati per utente
    if (urlPath.indexOf('/api/plans/') === 0) {
      const email = decodeURIComponent(urlPath.slice('/api/plans/'.length)).toLowerCase().trim();
      db.plans = db.plans || {};
      db.plans[email] = db.plans[email] || {};
      if (req.method === 'GET') {
        writeJson(res, 200, { ok: true, diet: db.plans[email].diet || null, workout: db.plans[email].workout || null });
        return;
      }
      if (req.method === 'POST') {
        readBody(req, (body) => {
          const kind = String(body.kind || '');
          if (kind !== 'diet' && kind !== 'workout') { writeJson(res, 400, { ok: false, message: 'kind non valido.' }); return; }
          db.plans[email][kind] = body.data || null;
          saveDb(db);
          writeJson(res, 200, { ok: true });
        });
        return;
      }
    }

    // Sgarri (cheat meals) per utente
    if (urlPath.indexOf('/api/sgarro/') === 0) {
      const email = decodeURIComponent(urlPath.slice('/api/sgarro/'.length)).toLowerCase().trim();
      db.sgarri = db.sgarri || {};
      db.sgarri[email] = db.sgarri[email] || [];
      if (req.method === 'GET') {
        writeJson(res, 200, { ok: true, sgarri: db.sgarri[email] || [] });
        return;
      }
      if (req.method === 'POST') {
        readBody(req, (body) => {
          const sgarro = body.sgarro || null;
          if (!sgarro) { writeJson(res, 400, { ok: false, message: 'sgarro mancante.' }); return; }
          db.sgarri[email].unshift(sgarro);
          // Keep only last 30
          if (db.sgarri[email].length > 30) db.sgarri[email] = db.sgarri[email].slice(0, 30);
          saveDb(db);
          writeJson(res, 200, { ok: true });
        });
        return;
      }
    }

    if (urlPath === '/api/users' && req.method === 'GET') {
      writeJson(res, 200, { ok: true, users: db.users, lastNotify: db.lastNotify, lastVideo: db.lastVideo, lastProgram: db.lastProgram });
      return;
    }
    if (urlPath === '/api/users/sync' && req.method === 'POST') {
      readBody(req, (body) => {
        const incoming = (body && Array.isArray(body.users)) ? body.users : [];
        const byEmail = new Map();
        db.users.forEach(u => byEmail.set(u.email, u));
        let changed = false;
        incoming.forEach((u) => {
          if (!u || !u.email) return;
          const existing = byEmail.get(u.email);
          if (!existing) { byEmail.set(u.email, { created: Date.now(), ...u }); changed = true; }
          else if (u.passwordHash && u.passwordHash !== existing.passwordHash) {
            byEmail.set(u.email, { ...existing, passwordHash: u.passwordHash, updated: Date.now() }); changed = true;
          } else if ((u.configured || false) && existing.configured !== true) {
            byEmail.set(u.email, { ...existing, ...u, created: existing.created }); changed = true;
          }
        });
        if (changed) { db.users = Array.from(byEmail.values()); saveDb(db); }
        writeJson(res, 200, { ok: true, users: db.users, lastNotify: db.lastNotify, lastVideo: db.lastVideo, lastProgram: db.lastProgram });
      });
      return;
    }
    if (urlPath === '/api/login' && req.method === 'POST') {
      readBody(req, (body) => {
        const email = String(body.email || '').toLowerCase().trim();
        const pass = String(body.password || '');
        const user = db.users.find(u => u.email === email);
        if (!user) { writeJson(res, 200, { ok: false, message: 'Questo indirizzo email non risulta registrato.' }); return; }
        if (hashPassword(pass, email) !== user.passwordHash) { writeJson(res, 200, { ok: false, message: 'Password errata.' }); return; }
        writeJson(res, 200, { ok: true, user: sanitizeUser(user) });
      });
      return;
    }
    if (urlPath === '/api/reset-password' && req.method === 'POST') {
      readBody(req, (body) => {
        const email = String(body.email || '').toLowerCase().trim();
        const pass = String(body.newPassword || '');
        if (pass.length < 4) { writeJson(res, 400, { ok: false, message: 'Password troppo corta (min 4 caratteri).' }); return; }
        const user = db.users.find(u => u.email === email);
        if (!user) { writeJson(res, 404, { ok: false, message: 'Utente non trovato.' }); return; }
        user.passwordHash = hashPassword(pass, email);
        user.resetAt = Date.now();
        saveDb(db);
        writeJson(res, 200, { ok: true, users: db.users });
      });
      return;
    }
    if (urlPath === '/api/online' && req.method === 'GET') {
      writeJson(res, 200, { ok: true, online: onlineUsers(), total: uniqueOnlineCount() });
      return;
    }
    if (urlPath === '/api/notify' && req.method === 'POST') {
      readBody(req, (body) => {
        const title = String(body.title || 'Notifica Gym House').slice(0, 80);
        const msg = String(body.body || '').slice(0, 500);
        db.lastNotify = { title, body: msg, date: Date.now() };
        saveDb(db);
        broadcast({ type: 'notify', title, body: msg });
        writeJson(res, 200, { ok: true });
      });
      return;
    }
    if (urlPath === '/api/program' && req.method === 'POST') {
      readBody(req, (body) => {
        const title = String(body.title || 'Programmazione Gym House').slice(0, 80);
        const msg = String(body.body || '').slice(0, 2000);
        db.lastProgram = { title, body: msg, date: Date.now() };
        saveDb(db);
        broadcast({ type: 'program', title, body: msg });
        writeJson(res, 200, { ok: true });
      });
      return;
    }
    if (urlPath === '/api/upload-video' && req.method === 'POST') {
      handleVideoUpload(req, res, db);
      return;
    }
    if (urlPath === '/api/broadcast-video' && req.method === 'POST') {
      readBody(req, (body) => {
        let url = String(body.url || '').trim();
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
        const title = String(body.title || 'Video Gym House').slice(0, 120);
        db.lastVideo = { url, title, date: Date.now() };
        saveDb(db);
        broadcast({ type: 'video', url, title });
        writeJson(res, 200, { ok: true });
      });
      return;
    }
    writeJson(res, 404, { ok: false, message: 'API non trovata: ' + urlPath });
    return;
  }

  // ---------- Static ----------
  let filePath = urlPath;
  if (urlPath === '/' || urlPath === '/index.html' || urlPath === '/checkin') {
    filePath = '/index.html';
  }
  const full = path.join(ROOT, filePath);

  fs.access(full, fs.constants.F_OK, (err) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 - file non trovato: ' + urlPath);
      return;
    }
    const ext = path.extname(full).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';
    const cacheControl = (ext === '.html' || ext === '.webmanifest' || ext === '.js')
      ? 'no-cache, max-age=0'
      : 'public, max-age=86400';

    if (VIDEO_EXT.includes(ext)) {
      fs.stat(full, (serr, stat) => {
        if (serr) {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('500 - errore di lettura');
          return;
        }
        const range = req.headers.range;
        if (range) {
          const m = /bytes=(\d+)-(\d*)/.exec(range);
          if (m) {
            const start = parseInt(m[1], 10);
            const end = m[2] ? parseInt(m[2], 10) : stat.size - 1;
            if (!isNaN(start) && start < stat.size && end >= start) {
              res.writeHead(206, {
                'Content-Type': contentType,
                'Accept-Ranges': 'bytes',
                'Content-Range': 'bytes ' + start + '-' + end + '/' + stat.size,
                'Content-Length': end - start + 1,
                'Cache-Control': 'public, max-age=86400'
              });
              fs.createReadStream(full, { start, end }).pipe(res);
              return;
            }
          }
        }
        res.writeHead(200, {
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
          'Content-Length': stat.size,
          'Cache-Control': cacheControl
        });
        fs.createReadStream(full).pipe(res);
      });
      return;
    }

    fs.readFile(full, (ferr, data) => {
      if (ferr) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500 - errore di lettura');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': cacheControl });
      res.end(data);
    });
  });
});

function sanitizeUser(u) {
  return {
    email: u.email, name: u.name, emoji: u.emoji, colorIndex: u.colorIndex,
    credential: u.credential || null, configured: !!u.configured, createdAt: u.createdAt || u.created
  };
}

function writeJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function readBody(req, cb) {
  let data = '';
  req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
  req.on('end', () => {
    try { cb(JSON.parse(data || '{}')); }
    catch (e) { cb({}); }
  });
  req.on('error', () => cb({}));
}

function splitMultipart(buf, boundary) {
  const parts = [];
  let idx = 0;
  while (true) {
    const start = buf.indexOf(boundary, idx);
    if (start === -1) break;
    const next = buf.indexOf(boundary, start + boundary.length);
    if (next === -1) break;
    parts.push(buf.subarray(start + boundary.length + 2, next));
    idx = next;
  }
  return parts;
}

function handleVideoUpload(req, res, db) {
  const ctype = String(req.headers['content-type'] || '');
  const bm = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(ctype);
  if (!bm) { writeJson(res, 400, { ok: false, message: 'Content-Type multipart mancante.' }); return; }
  const boundary = '--' + (bm[1] || bm[2]);
  const chunks = [];
  let size = 0;
  req.on('data', (c) => { chunks.push(c); size += c.length; if (size > 300e6) req.destroy(); });
  req.on('error', () => {});
  req.on('end', () => {
    const buf = Buffer.concat(chunks);
    let title = '';
    let filename = '';
    let content = null;
    splitMultipart(buf, Buffer.from(boundary, 'utf8')).forEach((part) => {
      const headEnd = part.indexOf('\r\n\r\n');
      if (headEnd === -1) return;
      const headers = part.slice(0, headEnd).toString('utf8');
      if (!/content-disposition:\s*form-data;/i.test(headers)) return;
      const data = part.subarray(headEnd + 4, part.length > 2 ? part.length - 2 : part.length);
      if (/name="title"/i.test(headers)) {
        title = data.toString('utf8').replace(/\r?\n/g, '').trim().slice(0, 120);
      }
      if (/name="file"/i.test(headers) || /filename="/i.test(headers)) {
        const fm = /filename="([^"]+)"/.exec(headers);
        if (fm) filename = fm[1].replace(/[/\\]/g, '_').slice(0, 80);
        if (data.length) content = data;
      }
    });
    if (!content || !content.length || !filename) {
      writeJson(res, 400, { ok: false, message: 'Nessun file video ricevuto.' });
      return;
    }
    let ext = path.extname(filename).toLowerCase();
    if (!ext) ext = '.mp4';
    const safeName = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext;
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOAD_DIR, safeName), content);
    const url = '/uploads/' + safeName;
    const finalTitle = title || filename.replace(/\.[^.]+$/, '');
    db.lastVideo = { url, title: finalTitle, date: Date.now() };
    saveDb(db);
    broadcast({ type: 'video', url, title: finalTitle });
    writeJson(res, 200, { ok: true, url, title: finalTitle });
  });
}

function uniqueOnlineCount() {
  const s = new Set();
  sockets.forEach((u) => { if (u && u.email) s.add(u.email); });
  return s.size;
}

// ---------- WebSocket ----------
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  let email = null;
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg && msg.type === 'hello') {
        email = String(msg.email || '').toLowerCase().trim() || null;
        const name = String(msg.name || '').slice(0, 30);
        const emoji = String(msg.emoji || '💪');
        const colorIndex = Number(msg.colorIndex) || 0;
        if (email) {
          sockets.set(ws, { email, name, emoji, colorIndex, since: Date.now(), lastSeen: Date.now() });
          const payload = { type: 'online', online: onlineUsers(), total: uniqueOnlineCount() };
          sockets.forEach((info, w) => { if (w && w.readyState === WebSocket.OPEN) { try { w.send(JSON.stringify(payload)); } catch (e) {} } });
        }
      } else if (msg && msg.type === 'ping' && email) {
        const u = sockets.get(ws);
        if (u) { u.lastSeen = Date.now(); }
      }
    } catch (e) {}
  });
  ws.on('close', () => {
    sockets.delete(ws);
    const payload = { type: 'online', online: onlineUsers(), total: uniqueOnlineCount() };
    sockets.forEach((info, w) => { if (w && w.readyState === WebSocket.OPEN) { try { w.send(JSON.stringify(payload)); } catch (e) {} } });
  });
  ws.on('error', () => {});
});

// Ping sweep (rimuove connessioni morte)
setInterval(() => {
  sockets.forEach((info, ws) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try { ws.ping(); } catch (e) {}
    }
  });
}, 25000);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    const next = server.address() ? server.address().port + 1 : START_PORT + 1;
    if (next > START_PORT + 20) {
      console.error('Nessuna porta libera tra ' + START_PORT + ' e ' + (START_PORT + 20));
      process.exit(1);
    }
    server.close();
    server.listen(next, () => {
      console.log(`\n  Gym House 2.0 avviato! (porta ${next})`);
      console.log(`  Apri: http://localhost:${next}\n`);
    });
  } else {
    console.error(err);
    process.exit(1);
  }
});

server.listen(START_PORT, () => {
  console.log(`\n  Gym House 2.0 avviato! (porta ${START_PORT})`);
  console.log(`  Apri: http://localhost:${START_PORT}\n`);
});