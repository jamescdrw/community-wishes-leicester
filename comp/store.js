/* Community Wishes – Competitions data layer
 * Demo mode: all data lives in this browser (localStorage).
 * Competition definitions can be "published" as comp/competitions.json so every visitor sees them.
 */
(function () {
  const KEY = 'cw_comp_v1';
  const PUB_URL = (document.currentScript && document.currentScript.src ? document.currentScript.src.replace(/store\.js.*$/, '') : 'comp/') + 'competitions.json';

  const DEFAULT_ACCOUNTS = [
    { code: '090', name: 'Charity bank account', type: 'bank' },
    { code: '200', name: 'Competition ticket income', type: 'income' },
    { code: '201', name: 'Donations', type: 'income' },
    { code: '202', name: 'Fundraising events income', type: 'income' },
    { code: '203', name: 'Caravan income', type: 'income' },
    { code: '204', name: 'Grants', type: 'income' },
    { code: '260', name: 'Other income', type: 'income' },
    { code: '310', name: 'Competition prizes', type: 'expense' },
    { code: '311', name: 'Wishes granted', type: 'expense' },
    { code: '320', name: 'Event costs', type: 'expense' },
    { code: '330', name: 'Caravan costs', type: 'expense' },
    { code: '404', name: 'Bank & payment fees', type: 'expense' },
    { code: '412', name: 'Marketing & printing', type: 'expense' },
    { code: '429', name: 'General expenses', type: 'expense' },
    { code: '461', name: 'Postage', type: 'expense' }
  ];

  const DEFAULT_SETTINGS = {
    charity: 'Community Wishes (Leicester)',
    charityNo: '1196244',
    email: 'gez.communitywishes@gmail.com',
    phone: '07805 575955',
    bankName: 'Community Wishes (Leicester)',
    sortCode: '00-00-00',
    accountNo: '00000000',
    refPrefix: 'CW',
    postalAddress: 'Community Wishes (Leicester), [Postal address], Leicester',
    previewMode: true,
    adminHash: null,
    holdHours: 48,
    taxType: 'No VAT'
  };

  const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const now = () => Date.now();
  const clone = o => JSON.parse(JSON.stringify(o));

  function blankSite() { return { overrides: {}, theme: {}, hidden: {}, banner: { on: false, text: '', link: '' }, comp: { heading: '', intro: '' }, updatedAt: 0 }; }
  function blank() {
    return { v: 1, settings: clone(DEFAULT_SETTINGS), accounts: clone(DEFAULT_ACCOUNTS), competitions: [], entries: [], ledger: [], audit: [], admins: [], members: [], donations: [], site: blankSite(), pubLoaded: 0 };
  }

  let S;
  function load() {
    try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
    if (!S || S.v !== 1) S = blank();
    S.settings = Object.assign(clone(DEFAULT_SETTINGS), S.settings || {});
    if (!S.accounts || !S.accounts.length) S.accounts = clone(DEFAULT_ACCOUNTS);
    ['competitions', 'entries', 'ledger', 'audit', 'admins', 'members', 'donations'].forEach(k => { if (!Array.isArray(S[k])) S[k] = []; });
    S.site = Object.assign(blankSite(), S.site || {});
  }
  let saveErr = null;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); saveErr = null; }
    catch (e) { saveErr = e; console.warn('[CW] save failed', e); }
    listeners.forEach(f => { try { f(); } catch (e) {} });
  }
  const listeners = [];
  addEventListener('storage', e => { if (e.key === KEY) { load(); listeners.forEach(f => f()); } });

  function log(msg) { const a = currentAdmin(); S.audit.unshift({ at: now(), msg: a ? `[${a.name}] ${msg}` : msg }); S.audit = S.audit.slice(0, 500); }

  /* ---------- random (unbiased, crypto) ---------- */
  function randInt(n) { // 0..n-1
    const max = Math.floor(0xffffffff / n) * n; const a = new Uint32Array(1);
    do { crypto.getRandomValues(a); } while (a[0] >= max);
    return a[0] % n;
  }

  /* ---------- published competitions ---------- */
  async function syncPublished() {
    try {
      const r = await fetch(PUB_URL + '?t=' + Math.floor(now() / 60000), { cache: 'no-store' });
      if (!r.ok) return false;
      const pub = await r.json();
      let changed = false;
      (pub.competitions || []).forEach(pc => {
        const i = S.competitions.findIndex(c => c.id === pc.id);
        if (i < 0) { S.competitions.push(pc); changed = true; }
        else if ((pc.updatedAt || 0) > (S.competitions[i].updatedAt || 0)) {
          // keep local draw/instant-win results if newer locally
          const local = S.competitions[i];
          const merged = Object.assign({}, pc);
          if (local.winner && !pc.winner) merged.winner = local.winner;
          merged.instantWins = (pc.instantWins || []).map(iw => { const l = (local.instantWins || []).find(x => x.id === iw.id); return l && l.wonBy && !iw.wonBy ? Object.assign({}, iw, { wonBy: l.wonBy, wonAt: l.wonAt, wonName: l.wonName }) : iw; });
          S.competitions[i] = merged; changed = true;
        }
      });
      if (pub.site && (pub.site.updatedAt || 0) > (S.site.updatedAt || 0)) { S.site = Object.assign(blankSite(), pub.site); changed = true; applySiteGlobal(); }
      if (pub.settings && !S.pubLoaded) { ['charity', 'charityNo', 'email', 'phone', 'bankName', 'sortCode', 'accountNo', 'refPrefix', 'postalAddress', 'previewMode', 'holdHours'].forEach(k => { if (k in pub.settings) S.settings[k] = pub.settings[k]; }); changed = true; }
      S.pubLoaded = now();
      if (changed) save();
      return changed;
    } catch (e) { return false; }
  }
  function publishedJSON() {
    const pubSettings = {};
    ['charity', 'charityNo', 'email', 'phone', 'bankName', 'sortCode', 'accountNo', 'refPrefix', 'postalAddress', 'previewMode', 'holdHours'].forEach(k => pubSettings[k] = S.settings[k]);
    return JSON.stringify({ publishedAt: new Date().toISOString(), settings: pubSettings, site: S.site, competitions: S.competitions.filter(c => c.status !== 'draft') }, null, 1);
  }

  /* ---------- competitions ---------- */
  function comp(id) { return S.competitions.find(c => c.id === id); }
  function takenTickets(id) {
    const set = new Set();
    S.entries.forEach(e => { if (e.compId === id && e.status !== 'cancelled') e.tickets.forEach(t => set.add(t)); });
    return set;
  }
  function soldCount(id) { return takenTickets(id).size; }
  function phase(c) { // public-facing phase
    if (!c) return 'missing';
    if (c.status === 'drawn') return 'drawn';
    if (c.status === 'draft') return 'draft';
    if (c.status === 'paused') return 'paused';
    if (c.status === 'ended') return 'closed';
    const t = now();
    if (c.startAt && t < c.startAt) return 'soon';
    if (c.endAt && t >= c.endAt) return 'closed';
    if (soldCount(c.id) >= c.maxTickets) return 'soldout';
    return 'live';
  }
  const PHASE_LABEL = { live: 'Live now', soon: 'Coming soon', paused: 'Paused', closed: 'Entries closed', soldout: 'Sold out', drawn: 'Winner drawn', draft: 'Draft' };

  function upsertComp(data) {
    const t = now();
    if (data.id && comp(data.id)) {
      const c = comp(data.id); Object.assign(c, data, { updatedAt: t }); log('Competition updated: ' + c.title); save(); return c;
    }
    const c = Object.assign({
      id: uid('c'), title: 'New competition', subtitle: '', description: '', prize: '', prizeValue: 0, image: '', icon: '🎁', theme: 0,
      price: 1, maxTickets: 500, maxPerPerson: 50, startAt: t, endAt: t + 7 * 864e5, status: 'draft', drawMode: 'auto', featured: false,
      question: { q: '', options: ['', '', ''], correct: 0 }, instantWins: [], winner: null, accountCode: '200', createdAt: t
    }, data, { updatedAt: t });
    if (!c.id) c.id = uid('c');
    S.competitions.unshift(c); log('Competition created: ' + c.title); save(); return c;
  }
  function deleteComp(id) {
    const c = comp(id); if (!c) return;
    S.competitions = S.competitions.filter(x => x.id !== id);
    S.entries = S.entries.filter(e => e.compId !== id);
    S.ledger = S.ledger.filter(l => l.compId !== id || l.exported);
    log('Competition deleted: ' + c.title); save();
  }
  function setStatus(id, status) { const c = comp(id); if (!c) return; c.status = status; c.updatedAt = now(); log(`Competition ${c.title} → ${status}`); save(); }

  /* Assign instant-win ticket numbers at random among unsold tickets */
  function assignInstantWins(c) {
    const taken = takenTickets(c.id); const used = new Set(c.instantWins.filter(w => w.ticket).map(w => w.ticket));
    c.instantWins.forEach(w => {
      if (w.ticket && w.ticket <= c.maxTickets) return;
      let n, guard = 0;
      do { n = randInt(c.maxTickets) + 1; guard++; } while ((used.has(n) || taken.has(n)) && guard < 10000);
      w.ticket = n; used.add(n);
    });
  }

  /* ---------- entries ---------- */
  function nextRef() {
    const n = S.entries.length + 1001;
    return (S.settings.refPrefix || 'CW') + '-' + n.toString().padStart(5, '0') + '-' + Math.random().toString(36).slice(2, 5).toUpperCase();
  }
  function luckyDip(id, qty) {
    const c = comp(id); const taken = takenTickets(id); const free = [];
    for (let i = 1; i <= c.maxTickets; i++) if (!taken.has(i)) free.push(i);
    const out = [];
    for (let i = 0; i < qty && free.length; i++) out.push(free.splice(randInt(free.length), 1)[0]);
    return out.sort((a, b) => a - b);
  }
  function ticketsForPerson(id, email) {
    email = (email || '').trim().toLowerCase();
    return S.entries.filter(e => e.compId === id && e.status !== 'cancelled' && e.email.toLowerCase() === email).reduce((n, e) => n + e.tickets.length, 0);
  }
  /* method: online | postal | admin */
  function createEntry({ compId, name, email, phone, tickets, answerIdx, method = 'online', paid = false, payMethod = '' }) {
    const c = comp(compId); if (!c) throw new Error('Competition not found');
    if (method === 'online' && phase(c) !== 'live') throw new Error('This competition is not open for entries.');
    if (!name || !email) throw new Error('Please enter your name and email.');
    if (!tickets || !tickets.length) throw new Error('Please choose at least one ticket.');
    const taken = takenTickets(compId);
    const clash = tickets.filter(t => taken.has(t));
    if (clash.length) throw new Error('Sorry, ticket ' + clash.join(', ') + ' has just been taken. Please choose again.');
    if (tickets.some(t => t < 1 || t > c.maxTickets)) throw new Error('Invalid ticket number.');
    if (method === 'online' && c.maxPerPerson && ticketsForPerson(compId, email) + tickets.length > c.maxPerPerson)
      throw new Error(`Maximum ${c.maxPerPerson} tickets per person for this competition.`);
    const correct = c.question && c.question.q ? Number(answerIdx) === Number(c.question.correct) : true;
    const isFree = method === 'postal';
    const e = {
      id: uid('e'), ref: nextRef(), compId, name: name.trim(), email: email.trim(), phone: (phone || '').trim(),
      tickets: tickets.slice().sort((a, b) => a - b), answerIdx: Number(answerIdx), correct, method, memberId: (currentMember() || {}).id || null,
      amount: isFree ? 0 : +(tickets.length * c.price).toFixed(2),
      status: (paid || isFree) ? 'paid' : 'pending', paidAt: (paid || isFree) ? now() : null, payMethod: isFree ? 'Free postal entry' : payMethod, createdAt: now(), instantWins: []
    };
    // instant wins
    if (correct) (c.instantWins || []).forEach(w => {
      if (!w.wonBy && e.tickets.includes(w.ticket)) { w.wonBy = e.id; w.wonAt = now(); w.wonName = e.name; e.instantWins.push(w.id); }
    });
    S.entries.unshift(e);
    if (e.status === 'paid' && e.amount > 0) ledgerFromEntry(e);
    log(`Entry ${e.ref}: ${e.name} – ${e.tickets.length} ticket(s) on ${c.title} (${method})`);
    c.updatedAt = c.updatedAt; save();
    return e;
  }
  function entry(id) { return S.entries.find(e => e.id === id); }
  function markPaid(id, payMethod = 'Bank transfer') {
    const e = entry(id); if (!e || e.status === 'paid') return;
    e.status = 'paid'; e.paidAt = now(); e.payMethod = payMethod;
    if (e.amount > 0) ledgerFromEntry(e);
    log(`Payment received ${e.ref} £${e.amount.toFixed(2)} (${payMethod})`); save();
  }
  function markUnpaid(id) {
    const e = entry(id); if (!e || e.status !== 'paid') return;
    e.status = 'pending'; e.paidAt = null; removeEntryLedger(e); log(`Payment reversed ${e.ref}`); save();
  }
  function cancelEntry(id) {
    const e = entry(id); if (!e) return;
    removeEntryLedger(e);
    const c = comp(e.compId);
    if (c) (c.instantWins || []).forEach(w => { if (w.wonBy === e.id) { w.wonBy = null; w.wonAt = null; w.wonName = null; } });
    e.status = 'cancelled'; log(`Entry cancelled ${e.ref} – tickets released`); save();
  }
  function releaseExpired() {
    const h = Number(S.settings.holdHours) || 0; if (!h) return 0;
    let n = 0; const cut = now() - h * 3600e3;
    S.entries.forEach(e => { if (e.status === 'pending' && e.method === 'online' && e.createdAt < cut) { cancelEntry(e.id); n++; } });
    return n;
  }

  /* ---------- draws ---------- */
  function eligible(id) {
    const out = [];
    S.entries.forEach(e => { if (e.compId === id && e.status === 'paid' && e.correct) e.tickets.forEach(t => out.push({ ticket: t, entry: e })); });
    return out.sort((a, b) => a.ticket - b.ticket);
  }
  function recordWinner(id, ticket, method) {
    const c = comp(id); const pool = eligible(id); const hit = pool.find(p => p.ticket === Number(ticket));
    if (!hit) throw new Error('Ticket ' + ticket + ' is not an eligible (paid, correct-answer) ticket.');
    c.winner = { ticket: hit.ticket, entryId: hit.entry.id, name: hit.entry.name, ref: hit.entry.ref, at: now(), method, poolSize: pool.length };
    c.status = 'drawn'; c.updatedAt = now();
    log(`WINNER ${c.title}: ticket #${hit.ticket} – ${hit.entry.name} (${method}, ${pool.length} eligible tickets)`); save();
    return c.winner;
  }
  function drawRandom(id, method = 'Auto draw') {
    const pool = eligible(id);
    if (!pool.length) throw new Error('No eligible paid tickets with a correct answer.');
    return recordWinner(id, pool[randInt(pool.length)].ticket, method);
  }
  function runDueAutoDraws() {
    const done = [];
    S.competitions.forEach(c => {
      if (c.drawMode !== 'auto' || c.status === 'drawn' || c.status === 'draft' || c.status === 'paused') return;
      const p = phase(c);
      if ((p === 'closed' || p === 'soldout') && eligible(c.id).length) { try { done.push(drawRandom(c.id, 'Auto draw (scheduled)')); } catch (e) {} }
    });
    return done;
  }
  function resetDraw(id) { const c = comp(id); if (!c) return; log(`Draw reset for ${c.title} (previous winner #${c.winner && c.winner.ticket})`); c.winner = null; c.status = 'ended'; c.updatedAt = now(); save(); }

  /* ---------- accounts ---------- */
  function ledgerFromEntry(e) {
    const c = comp(e.compId);
    S.ledger.unshift({
      id: uid('l'), date: e.paidAt || now(), type: 'income', amount: e.amount, payee: e.name,
      description: `${e.tickets.length} ticket(s) – ${c ? c.title : 'Competition'}`, reference: e.ref,
      account: (c && c.accountCode) || '200', source: 'tickets', entryId: e.id, compId: e.compId, exported: false
    });
  }
  function removeEntryLedger(e) {
    const l = S.ledger.find(x => x.entryId === e.id && !x.reversal);
    if (!l) return;
    if (!l.exported) S.ledger = S.ledger.filter(x => x !== l);
    else S.ledger.unshift(Object.assign({}, l, { id: uid('l'), date: now(), amount: l.amount, type: 'expense', description: 'Refund/reversal: ' + l.description, reversal: true, exported: false, account: l.account }));
  }
  function addLedger(row) {
    const l = Object.assign({ id: uid('l'), date: now(), type: 'income', amount: 0, payee: '', description: '', reference: '', account: '260', source: 'manual', exported: false }, row);
    l.amount = Math.abs(+l.amount || 0); S.ledger.unshift(l); log(`Accounts: ${l.type} £${l.amount.toFixed(2)} – ${l.description}`); save(); return l;
  }
  function updateLedger(id, patch) { const l = S.ledger.find(x => x.id === id); if (!l) return; Object.assign(l, patch); if ('amount' in patch) l.amount = Math.abs(+l.amount || 0); save(); }
  function deleteLedger(id) { S.ledger = S.ledger.filter(x => x.id !== id); save(); }
  function accountName(code) { const a = S.accounts.find(a => a.code === code); return a ? a.name : code; }

  /* ---------- CSV helpers ---------- */
  function csvCell(v) { v = v == null ? '' : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function toCSV(rows) { return rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n'; }
  function ukDate(ts) { const d = new Date(ts); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear(); }
  function download(name, text, type = 'text/csv') {
    const b = new Blob([text], { type: type + ';charset=utf-8' }); const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* ---------- formatting ---------- */
  const money = n => '£' + (Number(n) || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const THEMES = [
    ['#c0264f', '#f5c451'], ['#0f6e8c', '#7ee0c3'], ['#5b2bb5', '#ff8fd0'], ['#0a1226', '#f5c451'], ['#d9480f', '#ffd43b'], ['#1b7a3a', '#c3f584']
  ];
  function art(c, big) { // generated prize artwork when no photo uploaded
    if (c.image) return `<img src="${esc(c.image)}" alt="${esc(c.prize || c.title)}" loading="lazy">`;
    const t = THEMES[c.theme % THEMES.length] || THEMES[0];
    return `<div class="cw-art" style="--a:${t[0]};--b:${t[1]}"><span>${esc(c.icon || '🎁')}</span>${big ? '<i></i><i></i><i></i>' : ''}</div>`;
  }
  function countdownParts(ms) {
    ms = Math.max(0, ms); const s = Math.floor(ms / 1000);
    return { d: Math.floor(s / 86400), h: Math.floor(s % 86400 / 3600), m: Math.floor(s % 3600 / 60), s: s % 60 };
  }

  async function sha256(t) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }

  /* ---------- website editor (colours, banner, text/picture overrides) ---------- */
  function siteChanged() { S.site.updatedAt = now(); save(); applySiteGlobal(); }
  function applySiteGlobal() {
    if (!document.head) return;
    const t = S.site.theme || {};
    let st = document.getElementById('cw-site-theme');
    if (!st) { st = document.createElement('style'); st.id = 'cw-site-theme'; document.head.appendChild(st); }
    const v = [];
    if (t.brand) v.push(`--brand:${t.brand};--cw-brand:${t.brand}`);
    if (t.gold) v.push(`--gold:${t.gold};--cw-gold:${t.gold}`);
    if (t.navy) v.push(`--navy:${t.navy};--cw-navy:${t.navy}`);
    st.textContent = v.length ? `:root{${v.join(';')}}` + (t.brand ? `.btn-p,.cw-btn.p{background:${t.brand}!important;animation:none!important}` : '') : '';
    const b = S.site.banner || {};
    let el = document.getElementById('cw-annc');
    if (b.on && b.text) {
      if (!el) { el = document.createElement('div'); el.id = 'cw-annc'; (document.body || document.documentElement).appendChild(el); }
      el.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:90;max-width:calc(100% - 32px);display:flex;gap:12px;align-items:center;padding:12px 14px 12px 20px;border-radius:999px;background:var(--cw-navy,#0a1226);color:#fff;font:600 .92rem Inter,sans-serif;box-shadow:0 18px 40px -12px rgba(0,0,0,.6);border:1px solid rgba(245,196,81,.5)';
      el.innerHTML = `<span>📣 ${esc(b.text)}</span>${b.link ? `<a href="${esc(b.link)}" style="color:#f5c451;font-weight:700;white-space:nowrap">Find out more →</a>` : ''}<button aria-label="Close" style="background:rgba(255,255,255,.12);border:0;color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;flex:none">✕</button>`;
      el.querySelector('button').onclick = () => { el.remove(); try { sessionStorage.setItem('cw_annc_x', b.text); } catch (e) {} };
      try { if (sessionStorage.getItem('cw_annc_x') === b.text) el.remove(); } catch (e) {}
    } else if (el) el.remove();
  }
  /* path of an element relative to the nearest ancestor with an id */
  function elPath(el) {
    const parts = [];
    while (el && el !== document.body) {
      if (el.id && !/^cw-/.test(el.id)) { parts.unshift('#' + CSS.escape(el.id)); return parts.join(' > '); }
      const i = [...el.parentElement.children].indexOf(el) + 1; parts.unshift(`:nth-child(${i})`); el = el.parentElement;
    }
    return 'body > ' + parts.join(' > ');
  }
  function applyOverrides() {
    const o = S.site.overrides || {};
    Object.entries(o).forEach(([path, v]) => {
      let el; try { el = document.querySelector(path); } catch (e) { return; }
      if (!el) return;
      if ('text' in v) el.textContent = v.text;
      if (v.href) el.setAttribute('href', v.href);
      if (v.src) { if (el.tagName === 'IMG') el.src = v.src; else el.style.backgroundImage = `url("${v.src}")`; }
    });
    Object.entries(S.site.hidden || {}).forEach(([id, h]) => { const el = document.getElementById(id); if (el) el.style.display = h ? 'none' : ''; });
    document.querySelectorAll('#menu a[href^="#"]').forEach(a => { const id = a.getAttribute('href').slice(1); if (id && S.site.hidden[id]) a.parentElement.style.display = 'none'; });
  }
  function setOverride(path, patch) { S.site.overrides[path] = Object.assign(S.site.overrides[path] || {}, patch, { at: now() }); siteChanged(); }
  function clearOverride(path) { delete S.site.overrides[path]; siteChanged(); }

  /* ---------- members & donations (demo: stored in this browser) ---------- */
  function currentMember() {
    try {
      if (!(+localStorage.getItem('cw_member_until') > now())) return null;
      const id = localStorage.getItem('cw_member_id');
      return (S.members || []).find(m => m.id === id) || null;
    } catch (e) { return null; }
  }
  function setMember(id) { try { if (id) { localStorage.setItem('cw_member_until', String(now() + 30 * 864e5)); localStorage.setItem('cw_member_id', id); } else { localStorage.removeItem('cw_member_until'); localStorage.removeItem('cw_member_id'); } } catch (e) {} }
  async function joinMember(d) {
    const name = (d.name || '').trim(), email = (d.email || '').trim().toLowerCase();
    if (!name) throw new Error('Please enter your name.');
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Please enter a valid email.');
    if ((d.password || '').length < 6) throw new Error('Password must be at least 6 characters.');
    if (!d.over18) throw new Error('You must be 18 or over to join.');
    if (S.members.some(m => m.email === email)) throw new Error('You already have an account. Please log in.');
    const salt = uid('s');
    const m = { id: uid('m'), name, email, phone: (d.phone || '').trim(), address: (d.address || '').trim(), postcode: (d.postcode || '').trim().toUpperCase(),
      salt, hash: await sha256(salt + ':' + d.password), marketing: !!d.marketing, giftAid: null, createdAt: now(), lastLogin: now() };
    S.members.push(m); log(`New member joined: ${name}`); save(); setMember(m.id); return m;
  }
  async function loginMember(email, password) {
    email = (email || '').trim().toLowerCase();
    const m = S.members.find(x => x.email === email);
    if (!m || m.hash !== await sha256(m.salt + ':' + password)) throw new Error('Email or password is incorrect.');
    m.lastLogin = now(); save(); setMember(m.id); return m;
  }
  async function memberPassword(id, password) {
    if ((password || '').length < 6) throw new Error('Password must be at least 6 characters.');
    const m = S.members.find(x => x.id === id); if (!m) return;
    m.salt = uid('s'); m.hash = await sha256(m.salt + ':' + password); save();
  }
  function updateMember(id, patch) { const m = S.members.find(x => x.id === id); if (!m) return; Object.assign(m, patch); save(); return m; }
  function memberEntries(m) { return S.entries.filter(e => e.memberId === m.id || e.email.toLowerCase() === m.email); }
  function memberDonations(m) { return S.donations.filter(d => d.memberId === m.id || d.email.toLowerCase() === m.email); }

  function createDonation(d) {
    const amount = Math.round((+d.amount || 0) * 100) / 100;
    if (!(amount >= 1)) throw new Error('Please choose an amount of at least £1.');
    if (!d.name || !/^\S+@\S+\.\S+$/.test(d.email || '')) throw new Error('Please enter your name and a valid email.');
    if (d.giftAid && (!d.address || !d.postcode)) throw new Error('For Gift Aid we need your home address and postcode.');
    const m = currentMember();
    const don = { id: uid('d'), ref: (S.settings.refPrefix || 'CW') + '-DON-' + (S.donations.length + 1001) + '-' + Math.random().toString(36).slice(2, 5).toUpperCase(),
      memberId: m ? m.id : null, name: d.name.trim(), email: d.email.trim(), phone: (d.phone || '').trim(), amount, frequency: d.frequency === 'monthly' ? 'monthly' : 'one-off',
      giftAid: !!d.giftAid, address: (d.address || '').trim(), postcode: (d.postcode || '').trim().toUpperCase(), message: (d.message || '').trim(),
      status: 'pledged', createdAt: now(), receivedAt: null, payMethod: '' };
    S.donations.unshift(don);
    if (m && d.giftAid && !m.giftAid) m.giftAid = { declaredAt: now(), address: don.address, postcode: don.postcode };
    log(`Donation pledged ${don.ref}: £${amount.toFixed(2)} ${don.frequency}${don.giftAid ? ' + Gift Aid' : ''} – ${don.name}`); save(); return don;
  }
  function donationReceived(id, payMethod = 'Bank transfer', date = now()) {
    const d = S.donations.find(x => x.id === id); if (!d || d.status === 'received') return;
    d.status = 'received'; d.receivedAt = date; d.payMethod = payMethod;
    S.ledger.unshift({ id: uid('l'), date, type: 'income', amount: d.amount, payee: d.name, description: `Donation${d.frequency === 'monthly' ? ' (monthly)' : ''}${d.giftAid ? ' – Gift Aid declared' : ''}`,
      reference: d.ref, account: '201', source: 'donations', donationId: d.id, exported: false });
    log(`Donation received ${d.ref} £${d.amount.toFixed(2)} (${payMethod})`); save();
  }
  function donationUndo(id) {
    const d = S.donations.find(x => x.id === id); if (!d || d.status !== 'received') return;
    const l = S.ledger.find(x => x.donationId === d.id);
    if (l && !l.exported) S.ledger = S.ledger.filter(x => x !== l);
    else if (l) S.ledger.unshift(Object.assign({}, l, { id: uid('l'), date: now(), type: 'expense', description: 'Reversal: ' + l.description, reversal: true, exported: false }));
    d.status = 'pledged'; d.receivedAt = null; log(`Donation ${d.ref} marked not received`); save();
  }
  function donationCancel(id) { const d = S.donations.find(x => x.id === id); if (!d) return; if (d.status === 'received') donationUndo(id); d.status = 'cancelled'; log(`Donation ${d.ref} cancelled`); save(); }

  /* ---------- admin accounts (demo: stored in this browser) ---------- */
  const ROLES = { owner: 'Owner', admin: 'Admin', volunteer: 'Volunteer' };
  function currentAdmin() {
    try {
      if (!(+localStorage.getItem('cw_admin_until') > now())) return null;
      const id = localStorage.getItem('cw_admin_id');
      return (S.admins || []).find(a => a.id === id && a.active) || null;
    } catch (e) { return null; }
  }
  async function createAdmin({ name, email, password, role = 'volunteer', demo = false }) {
    name = (name || '').trim(); email = (email || '').trim().toLowerCase();
    if (!name) throw new Error('Please enter a name.');
    if (!demo && !/^\S+@\S+\.\S+$/.test(email)) throw new Error('Please enter a valid email.');
    if ((password || '').length < 6) throw new Error('Password must be at least 6 characters.');
    if (S.admins.some(a => a.email === email)) throw new Error('An account with that email already exists.');
    const salt = uid('s');
    const a = { id: uid('a'), name, email, role, salt, hash: await sha256(salt + ':' + password), active: true, createdAt: now(), lastLogin: null };
    S.admins.push(a);
    if (!S.settings.inviteCode) S.settings.inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();
    log(`Admin account created: ${name} (${ROLES[role]})`); save(); return a;
  }
  async function checkLogin(email, password) {
    email = (email || '').trim().toLowerCase();
    const a = S.admins.find(x => x.email === email);
    if (!a || a.hash !== await sha256(a.salt + ':' + password)) throw new Error('Email or password is incorrect.');
    if (!a.active) throw new Error('This account has been switched off. Ask the owner to turn it back on.');
    a.lastLogin = now(); save(); return a;
  }
  async function setPassword(id, password) {
    if ((password || '').length < 6) throw new Error('Password must be at least 6 characters.');
    const a = S.admins.find(x => x.id === id); if (!a) return;
    a.salt = uid('s'); a.hash = await sha256(a.salt + ':' + password); save();
  }

  load();

  function labelAccountLinks() { const m = currentMember(); document.querySelectorAll('[data-acct]').forEach(a => a.textContent = m ? '👤 ' + m.name.split(' ')[0] : 'Log in'); }
  const onReady = () => { labelAccountLinks(); applySiteGlobal(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady); else setTimeout(onReady);

  window.CW = {
    get state() { return S; }, save, load, log, onChange: f => listeners.push(f), get saveError() { return saveErr; },
    syncPublished, publishedJSON, comp, takenTickets, soldCount, phase, PHASE_LABEL, upsertComp, deleteComp, setStatus, assignInstantWins,
    luckyDip, createEntry, entry, markPaid, markUnpaid, cancelEntry, releaseExpired, ticketsForPerson,
    eligible, recordWinner, drawRandom, runDueAutoDraws, resetDraw, randInt,
    addLedger, updateLedger, deleteLedger, accountName,
    toCSV, ukDate, download, money, esc, art, countdownParts, sha256, uid, THEMES,
    isAdmin() { return !!currentAdmin(); },
    applySiteGlobal, applyOverrides, elPath, setOverride, clearOverride, siteChanged, blankSite,
    currentMember, setMember, joinMember, loginMember, memberPassword, updateMember, memberEntries, memberDonations,
    createDonation, donationReceived, donationUndo, donationCancel,
    currentAdmin, createAdmin, checkLogin, setPassword, ROLES,
    setAdmin(id) { try { if (id) { localStorage.setItem('cw_admin_until', String(Date.now() + 8 * 3600e3)); localStorage.setItem('cw_admin_id', id); } else { localStorage.removeItem('cw_admin_until'); localStorage.removeItem('cw_admin_id'); } } catch (e) {} },
    reset() { localStorage.removeItem(KEY); load(); save(); },
    importAll(json) { const d = JSON.parse(json); if (d.v !== 1) throw new Error('Not a Community Wishes backup file'); S = d; save(); },
    exportAll() { return JSON.stringify(S, null, 1); }
  };
})();
