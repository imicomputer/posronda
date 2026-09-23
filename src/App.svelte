<script>
  import { onMount, tick } from 'svelte';
  import Swal from 'sweetalert2';
  import { validUsername, sanitizeChat } from '../lib/protocol.js';
  import { colorOf, fmtTime as time } from './lib/ui.js';
  import {
    getStoredUsername, setStoredUsername,
    openHistoryDB, loadHistory, saveMessage, clearHistory
  } from './lib/store.js';

  let ws;
  let me = '';
  let connected = false;
  let users = [];
  let messages = []; // { kind: 'chat'|'system', username, text, time, mine }
  let draft = '';
  let box; // scroll container
  let historyDb = null; // IndexedDB handle; null when storage unavailable

  const wsUrl = () =>
    `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;

  const scrollDown = async () => {
    await tick();
    if (box) box.scrollTop = box.scrollHeight;
  };

  function connect() {
    // In `npm run dev`, frontend is on :5173 and WS is proxied; fallback for safety:
    const url = location.port === '5173' ? 'ws://localhost:3000/ws' : wsUrl();
    ws = new WebSocket(url);

    ws.onopen = () => { connected = true; autoJoin(); };
    ws.onclose = () => {
      connected = false;
      messages = [...messages, { kind: 'system', text: 'Disconnected — retrying…' }];
      setTimeout(connect, 2000);
    };
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.type === 'joined') {
        me = m.username;
        setStoredUsername(me);
        refreshMine();
        Swal.close();
      } else if (m.type === 'error' && !me) {
        askName(m.message); // name taken / invalid → ask again
      } else if (m.type === 'chat') {
        const msg = { kind: 'chat', ...m, mine: m.username === me };
        messages = [...messages, msg];
        persist(msg);
        scrollDown();
      } else if (m.type === 'system') {
        const msg = { kind: 'system', text: m.text };
        messages = [...messages, msg];
        persist(msg);
        scrollDown();
      } else if (m.type === 'users') {
        users = m.users;
      }
    };
  }

  async function askName(error = '') {
    const { value } = await Swal.fire({
      title: 'Welcome to PosRonda',
      text: error || 'Pick a username to join the room',
      input: 'text',
      inputPlaceholder: 'e.g. svelte_fan',
      allowOutsideClick: false,
      allowEscapeKey: false,
      confirmButtonText: 'Join chat',
      inputValidator: (v) =>
        validUsername(v) ? undefined : 'Use 2–20 letters, numbers, _ or -',
      customClass: { popup: 'swal-glass' }
    });
    if (value) ws.send(JSON.stringify({ type: 'join', username: value.trim() }));
  }

  function send() {
    const text = sanitizeChat(draft);
    if (!text || !ws || ws.readyState !== 1 || !me) return;
    ws.send(JSON.stringify({ type: 'chat', text }));
    draft = '';
  }

  // --- Local persistence (server stores nothing) ---

  function persist(msg) {
    if (historyDb) saveMessage(historyDb, msg).catch(() => {});
  }

  function refreshMine() {
    messages = messages.map((m) => (m.kind === 'chat' ? { ...m, mine: m.username === me } : m));
  }

  function autoJoin() {
    // Returning user? Rejoin silently with the remembered name.
    // If it is taken now, the server errors and we fall back to the popup.
    const saved = getStoredUsername();
    if (saved && validUsername(saved)) ws.send(JSON.stringify({ type: 'join', username: saved }));
    else askName();
  }

  async function clearLocal() {
    if (historyDb) await clearHistory(historyDb).catch(() => {});
    messages = [];
  }

  async function init() {
    try {
      historyDb = await openHistoryDB();
      const saved = await loadHistory(historyDb);
      if (saved.length) {
        messages = saved;
        messages = [
          ...messages,
          { kind: 'system', text: `Restored ${saved.length} messages from this browser` }
        ];
        scrollDown();
      }
    } catch {
      historyDb = null; // e.g. private mode: chat works, history just won't persist
    }
    connect();
  }

  onMount(init);
</script>

<main class="card">
  <header>
    <div class="brand">
      <span class="logo">💬</span>
      <div>
        <h1>PosRonda</h1>
        <p>one room · no history · {connected ? 'live' : 'connecting…'}</p>
      </div>
    </div>
    <div class="presence" title={users.join(', ')}>
      <span class="dot" class:on={connected}></span>
      {users.length} online
    </div>
  </header>

  {#if me}
    <div class="me-bar">You are <b>{me}</b> · {users.join(', ')} <button class="link" on:click={clearLocal}>clear history</button></div>
  {/if}

  <div class="messages" bind:this={box}>
    {#each messages as m}
      {#if m.kind === 'system'}
        <div class="system">{m.text}</div>
      {:else}
        <div class="row" class:mine={m.mine}>
          {#if !m.mine}<span class="avatar" style="background:{colorOf(m.username)}">{m.username[0].toUpperCase()}</span>{/if}
          <div class="bubble" class:mine={m.mine}>
            {#if !m.mine}<div class="who">{m.username}</div>{/if}
            <div class="text">{m.text}</div>
            <div class="when">{time(m.time)}</div>
          </div>
        </div>
      {/if}
    {:else}
      <div class="empty">No messages yet — say hi! 👋<br /><small>Relayed only — history lives in this browser, never on the server.</small></div>
    {/each}
  </div>

  <form class="composer" on:submit|preventDefault={send}>
    <input
      placeholder={me ? `Message as ${me}…` : 'Joining…'}
      bind:value={draft}
      maxlength="500"
      disabled={!me}
      autocomplete="off"
    />
    <button type="submit" disabled={!me || !draft.trim()}>Send ➤</button>
  </form>
</main>

<style>
  .card {
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(12px);
    border-radius: 24px;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.3);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    height: min(78vh, 640px);
  }
  header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 16px 20px;
    background: linear-gradient(90deg, #667eea, #764ba2);
    color: white;
  }
  .brand { display: flex; gap: 12px; align-items: center; }
  .logo { font-size: 32px; }
  h1 { margin: 0; font-size: 20px; }
  p { margin: 2px 0 0; opacity: 0.85; font-size: 12px; }
  .presence { background: rgba(255,255,255,.2); padding: 6px 12px; border-radius: 999px; font-size: 13px; display: flex; gap: 8px; align-items: center; }
  .dot { width: 9px; height: 9px; border-radius: 50%; background: #ffb3b3; }
  .dot.on { background: #4ade80; box-shadow: 0 0 8px #4ade80; }
  .me-bar { padding: 8px 20px; font-size: 13px; background: #f3f0ff; color: #5b5bd6; border-bottom: 1px solid #e9e4ff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .messages { flex: 1; overflow-y: auto; padding: 18px; display: flex; flex-direction: column; gap: 10px; background: #fafaff; }
  .empty { text-align: center; color: #888; margin: auto; line-height: 1.6; }
  .system { align-self: center; font-size: 12px; color: #777; background: #eeeefc; padding: 4px 14px; border-radius: 999px; }
  .row { display: flex; gap: 8px; align-items: flex-end; }
  .row.mine { justify-content: flex-end; }
  .avatar { width: 30px; height: 30px; border-radius: 50%; color: #fff; display: grid; place-items: center; font-weight: 700; font-size: 14px; flex-shrink: 0; }
  .bubble { max-width: 70%; padding: 10px 14px; border-radius: 16px 16px 16px 4px; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
  .bubble.mine { background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; border-radius: 16px 16px 4px 16px; }
  .who { font-size: 12px; font-weight: 700; color: #667eea; margin-bottom: 2px; }
  .text { word-break: break-word; font-size: 15px; }
  .when { font-size: 10px; opacity: .6; text-align: right; margin-top: 4px; }
  .composer { display: flex; gap: 10px; padding: 14px; background: #fff; border-top: 1px solid #eee; }
  input { flex: 1; border: 2px solid #e5e0ff; border-radius: 999px; padding: 12px 18px; font-size: 15px; outline: none; }
  input:focus { border-color: #764ba2; }
  button { border: none; border-radius: 999px; padding: 0 24px; font-size: 15px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #667eea, #764ba2); cursor: pointer; }
  button:disabled { opacity: .4; cursor: default; }
  .link { background: none; border: none; color: #5b5bd6; text-decoration: underline; cursor: pointer; font-size: 12px; padding: 0 0 0 8px; }
  :global(.swal-glass) { border-radius: 20px !important; }
</style>
