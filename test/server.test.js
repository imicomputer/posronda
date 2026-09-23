// Relay integration test: boots the real server.js on an ephemeral port and
// verifies the wire contract — join, duplicate rejection, broadcast, leave.
// Run: npm test
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 34100 + Math.floor(Math.random() * 500);
let child;

/** Queued listener: no message is ever missed, no hang on races. */
function listen(ws) {
  const q = [];
  let waiter = null;
  ws.on('message', (d) => {
    const m = JSON.parse(d.toString());
    if (waiter) { const r = waiter; waiter = null; r(m); }
    else q.push(m);
  });
  return () => (q.length ? Promise.resolve(q.shift()) : new Promise((r) => { waiter = r; }));
}

function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

/** Skip `n` presence messages (system/users broadcasts). */
async function skip(next, n) {
  for (let i = 0; i < n; i++) await next();
}

before(async () => {
  child = spawn('node', ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  // Wait until the WS endpoint accepts connections (max ~10s).
  const deadline = Date.now() + 10000;
  for (;;) {
    try {
      const ws = await connect();
      ws.close();
      return;
    } catch {
      if (Date.now() > deadline) throw new Error('server did not start in time');
      await new Promise((r) => setTimeout(r, 200));
    }
  }
});

after(() => {
  child?.kill();
});

describe('relay server', () => {
  it('accepts a valid username', async () => {
    const ws = await connect();
    const next = listen(ws);
    ws.send(JSON.stringify({ type: 'join', username: 'alice' }));
    assert.deepEqual(await next(), { type: 'joined', username: 'alice' });
    ws.close();
  });

  it('rejects duplicate usernames (case-insensitive) and keeps the original', async () => {
    const a = await connect();
    const na = listen(a);
    a.send(JSON.stringify({ type: 'join', username: 'alice' }));
    await na(); // joined
    const b = await connect();
    const nb = listen(b);
    b.send(JSON.stringify({ type: 'join', username: 'ALICE' }));
    const err = await nb();
    assert.equal(err.type, 'error');
    assert.match(err.message, /already taken/);
    b.send(JSON.stringify({ type: 'join', username: 'bob' }));
    assert.deepEqual(await nb(), { type: 'joined', username: 'bob' });
    a.close(); b.close();
  });

  it('rejects invalid usernames', async () => {
    const ws = await connect();
    const next = listen(ws);
    ws.send(JSON.stringify({ type: 'join', username: 'x' }));
    const err = await next();
    assert.equal(err.type, 'error');
    ws.close();
  });

  it('relays chat to everyone and to nobody before join', async () => {
    const a = await connect();
    const na = listen(a);
    a.send(JSON.stringify({ type: 'join', username: 'cara' }));
    await na(); await skip(na, 2); // joined + own presence
    const b = await connect();
    const nb = listen(b);
    b.send(JSON.stringify({ type: 'join', username: 'dan' }));
    await nb(); await skip(nb, 2);
    await skip(na, 2); // dan's presence on a

    a.send(JSON.stringify({ type: 'chat', text: 'hello room' }));
    const gotB = await nb();
    assert.equal(gotB.type, 'chat');
    assert.equal(gotB.username, 'cara');
    assert.equal(gotB.text, 'hello room');
    assert.ok(typeof gotB.time === 'number');
    const echoA = await na();
    assert.equal(echoA.type, 'chat'); // sender gets its own message echoed
    a.close(); b.close();
  });

  it('ignores blank chat and chat-before-join', async () => {
    const ws = await connect();
    const next = listen(ws);
    ws.send(JSON.stringify({ type: 'chat', text: 'sneaky' }));
    assert.equal((await next()).type, 'error'); // "Join first."
    ws.send(JSON.stringify({ type: 'join', username: 'erin' }));
    await next(); await skip(next, 2);
    ws.send(JSON.stringify({ type: 'chat', text: '   ' }));
    // No broadcast follows a blank message: race a short timer instead of hanging.
    const winner = await Promise.race([
      next().then((m) => m.type),
      new Promise((r) => setTimeout(() => r('silence'), 400))
    ]);
    assert.equal(winner, 'silence');
    ws.close();
  });

  it('announces leave and updates the user list', async () => {
    const a = await connect();
    const na = listen(a);
    a.send(JSON.stringify({ type: 'join', username: 'fred' }));
    await na(); await skip(na, 2);
    const b = await connect();
    const nb = listen(b);
    b.send(JSON.stringify({ type: 'join', username: 'gina' }));
    await nb(); await skip(nb, 2);
    await skip(na, 2);
    b.close();
    const sys = await na();
    assert.equal(sys.type, 'system');
    assert.match(sys.text, /gina left/);
    const users = await na();
    assert.equal(users.type, 'users');
    assert.ok(users.users.includes('fred'));
    assert.ok(!users.users.includes('gina'));
    a.close();
  });
});
