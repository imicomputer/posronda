<script>
  import { onMount, tick } from 'svelte';
  import Swal from 'sweetalert2';
  import { validUsername, sanitizeChat } from '../lib/protocol.js';
  import { colorOf, fmtTime as time, typingText, pruneTyping } from './lib/ui.js';
  import {
    getStoredUsername, setStoredUsername,
    openHistoryDB, loadHistory, saveMessage, clearHistory, wipeLocalData
  } from './lib/store.js';

  let ws;
  let me = '';
  let connected = false;
  let users = [];
  let messages = []; // { kind: 'chat'|'system', username, text, time, mine }
  let draft = '';
  let box; // scroll container
  let historyDb = null; // IndexedDB handle; null when storage unavailable
  let typing = {}; // username -> timestamp (in-memory only, never persisted)
  let lastTypingSent = 0;
  let stopTypingTimer;
  let menuOpen = false;
  let connGen = 0; // invalidates stale socket handlers (logout starts fresh)
  let reconnectTimer;

  $: typingLine = typingText(Object.keys(typing).filter((n) => n !== me));

  const wsUrl = () =>
    `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;

  const scrollDown = async () => {
    await tick();
    if (box) box.scrollTop = box.scrollHeight;
  };

  function connect() {
    // In `npm run dev`, frontend is on :5173 and WS is proxied; fallback for safety:
    const url = location.port === '5173' ? 'ws://localhost:3000/ws' : wsUrl();
    const gen = ++connGen;
    ws = new WebSocket(url);

    ws.onopen = () => { connected = true; autoJoin(); };
    ws.onclose = () => {
      if (gen !== connGen) return; // superseded (e.g. logout opened a newer socket)
      connected = false;
      messages = [...messages, { kind: 'system', text: 'Disconnected — retrying…' }];
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, 2000);
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
        if (m.username && m.username !== me && typing[m.username]) {
          const { [m.username]: _dropped, ...rest } = typing;
          typing = rest;
        }
      } else if (m.type === 'typing') {
        if (m.username && m.username !== me) {
          if (m.typing) typing = { ...typing, [m.username]: m.time || Date.now() };
          else {
            const { [m.username]: _dropped, ...rest } = typing;
            typing = rest;
          }
        }
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
    sendTyping(false);
    lastTypingSent = 0;
  }

  // --- Typing indicator (ephemeral, never persisted) ---

  function sendTyping(value) {
    if (!ws || ws.readyState !== 1 || !me) return;
    ws.send(JSON.stringify({ type: 'typing', typing: value }));
  }

  function handleInput() {
    if (!me) return;
    if (draft.trim()) {
      const now = Date.now();
      if (now - lastTypingSent > 2000) {
        sendTyping(true);
        lastTypingSent = now;
      }
      clearTimeout(stopTypingTimer);
      stopTypingTimer = setTimeout(() => sendTyping(false), 3000);
    } else {
      clearTimeout(stopTypingTimer);
      sendTyping(false);
      lastTypingSent = 0;
    }
  }

  function pruneTick() {
    const pruned = pruneTyping(typing);
    if (Object.keys(pruned).length !== Object.keys(typing).length) typing = pruned;
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

  // --- Log out: erase username + history, free the name, start over ---

  async function logout() {
    menuOpen = false;
    if (!me) return;
    const { isConfirmed } = await Swal.fire({
      title: 'Log out?',
      text: 'This erases your username and all chat history on this device.',
      showCancelButton: true,
      confirmButtonText: 'Log out',
      cancelButtonText: 'Stay',
      customClass: { popup: 'swal-glass' }
    });
    if (!isConfirmed) return;
    sendTyping(false); // best-effort: clear our indicator for others
    clearTimeout(stopTypingTimer);
    clearTimeout(reconnectTimer); // no stale auto-reconnect after we go fresh
    connGen++; // invalidate the old socket's handlers before dropping it
    try { ws?.close(); } catch { /* already closed */ }
    await wipeLocalData(undefined, historyDb).catch(() => {});
    me = '';
    users = [];
    messages = [];
    draft = '';
    typing = {};
    lastTypingSent = 0;
    connect(); // fresh socket → no remembered name → join popup
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
    setInterval(pruneTick, 2000);
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
    <div class="me-bar">
      <span class="me-name">You are <b>{me}</b> · {users.join(', ')}</span>
      <div class="menu">
        <button class="link" on:click={() => (menuOpen = !menuOpen)}>☰</button>
        {#if menuOpen}
          <div class="menu-items">
            <button class="menu-item" on:click={() => { menuOpen = false; clearLocal(); }}>Clear history</button>
            <button class="menu-item danger" on:click={logout}>Log out</button>
          </div>
        {/if}
      </div>
    </div>
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

  {#if typingLine}
    <div class="typing">{typingLine}</div>
  {/if}
  <form class="composer" on:submit|preventDefault={send}>
    <input
      placeholder={me ? `Message as ${me}…` : 'Joining…'}
      bind:value={draft}
      on:input={handleInput}
      on:blur={() => sendTyping(false)}
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
  .me-bar { padding: 8px 20px; font-size: 13px; background: #f3f0ff; color: #5b5bd6; border-bottom: 1px solid #e9e4ff; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .me-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .menu { position: relative; flex-shrink: 0; }
  .menu-items { position: absolute; right: 0; top: 100%; background: #fff; border: 1px solid #e9e4ff; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,.12); display: flex; flex-direction: column; min-width: 140px; z-index: 10; padding: 4px; }
  .menu-item { background: none; border: none; text-align: left; padding: 8px 14px; font-size: 13px; color: #5b5bd6; cursor: pointer; border-radius: 8px; }
  .menu-item:hover { background: #f3f0ff; }
  .menu-item.danger { color: #dc2626; }
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
  .typing { padding: 6px 20px 0; font-size: 12px; color: #777; background: #fff; font-style: italic; }
  input { flex: 1; border: 2px solid #e5e0ff; border-radius: 999px; padding: 12px 18px; font-size: 15px; outline: none; }
  input:focus { border-color: #764ba2; }
  button { border: none; border-radius: 999px; padding: 0 24px; font-size: 15px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #667eea, #764ba2); cursor: pointer; }
  button:disabled { opacity: .4; cursor: default; }
  .link { background: none; border: none; color: #5b5bd6; text-decoration: underline; cursor: pointer; font-size: 12px; padding: 0 0 0 8px; }
  :global(.swal-glass) { border-radius: 20px !important; }
</style>
