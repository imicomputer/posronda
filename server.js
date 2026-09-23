// Simple relay chat server: NO message storage, just forwards to the room.
// - Serves ./dist (Vite build) over HTTP
// - WebSocket endpoint at /ws, single room, unique usernames
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { validUsername, normalizeName, isTaken, sanitizeChat } from './lib/protocol.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, 'dist');
const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

// ws -> username | null (null = not joined yet)
const clients = new Map();

const taken = (name) => isTaken([...clients.values()], name);

const userList = () => [...clients.values()].filter(Boolean);

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const ws of clients.keys()) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(DIST, urlPath === '/' ? 'index.html' : urlPath.slice(1));

  // SPA fallback: serve index.html if file missing (only if dist exists)
  if (!file.startsWith(DIST)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(DIST, 'index.html');
  }
  if (!fs.existsSync(file)) {
    // dev mode: no dist built yet, Vite serves the frontend on :5173
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Relay server running (WS at /ws). Start frontend with: npm run dev:client');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  clients.set(ws, null);

  ws.on('message', (raw) => {
    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      return;
    }

    // 1) Join: validate + enforce unique name
    if (data.type === 'join') {
      const name = normalizeName(data.username);
      if (!validUsername(name)) {
        ws.send(JSON.stringify({ type: 'error', message: 'Use 2–20 letters, numbers, _ or -.' }));
        return;
      }
      if (taken(name)) {
        ws.send(JSON.stringify({ type: 'error', message: `“${name}” is already taken — pick another.` }));
        return;
      }
      clients.set(ws, name);
      ws.send(JSON.stringify({ type: 'joined', username: name }));
      broadcast({ type: 'system', text: `${name} joined` });
      broadcast({ type: 'users', users: userList() });
      return;
    }

    // 2) Chat: relay only, never stored
    if (data.type === 'chat') {
      const username = clients.get(ws);
      if (!username) {
        ws.send(JSON.stringify({ type: 'error', message: 'Join first.' }));
        return;
      }
      const text = sanitizeChat(data.text);
      if (!text) return;
      broadcast({ type: 'chat', username, text, time: Date.now() });
      return;
    }
  });

  ws.on('close', () => {
    const name = clients.get(ws);
    clients.delete(ws);
    if (name) {
      broadcast({ type: 'system', text: `${name} left` });
      broadcast({ type: 'users', users: userList() });
    }
  });
});

server.listen(PORT, () => console.log(`Relay chat on :${PORT} (WS /ws)`));
