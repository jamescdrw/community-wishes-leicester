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

  function blank() {
    return { v: 1, settings: clone(DEFAULT_SETTINGS), accounts: clone(DEFAULT_ACCOUNTS), competitions: [], entries: [], ledger: [], audit: [], pubLoaded: 0 };
  }

  let S;
  function load() {
    try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
    if (!S || S.v !== 1) S = blank();
    S.settings = Object.assign(clone(DEFAULT_SETTINGS), S.settings || {});
    if (!S.accounts || !S.accounts.length) S.accounts = clone(DEFAULT_ACCOUNTS);
    ['competitions', 'entries', 'ledger', 'audit'].forEach(k => { if (!Array.isArray(S[k])) S[k] = []; });
  }
  let saveErr = null;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); saveErr = null; }
    catch (e) { saveErr = e; console.warn('[CW] save failed', e); }
    listeners.forEach(f => { try { f(); } catch (e) {} });
  }
  const listeners = [];
  addEventListener('storage', e => { if (e.key === KEY) { load(); listeners.forEach(f => f()); } });

  function log(msg) { S.audit.unshift({ at: now(), msg }); S.audit = S.audit.slice(0, 500); }

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
      if (pub.settings && !S.pubLoaded) { ['charity', 'charityNo', 'email', 'phone', 'bankName', 'sortCode', 'accountNo', 'refPrefix', 'postalAddress', 'previewMode', 'holdHours'].forEach(k => { if (k in pub.settings) S.settings[k] = pub.settings[k]; }); changed = true; }
      S.pubLoaded = now();
      if (changed) save();
      return changed;
    } catch (e) { return false; }
  }
  function publishedJSON() {
    const pubSettings = {};
    ['charity', 'charityNo', 'email', 'phone', 'bankName', 'sortCode', 'accountNo', 'refPrefix', 'postalAddress', 'previewMode', 'holdHours'].forEach(k => pubSettings[k] = S.settings[k]);
    return JSON.stringify({ publishedAt: new Date().toISOString(), settings: pubSettings, competitions: S.competitions.filter(c => c.status !== 'draft') }, null, 1);
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
      tickets: tickets.slice().sort((a, b) => a - b), answerIdx: Number(answerIdx), correct, method,
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

  load();

  window.CW = {
    get state() { return S; }, save, load, log, onChange: f => listeners.push(f), get saveError() { return saveErr; },
    syncPublished, publishedJSON, comp, takenTickets, soldCount, phase, PHASE_LABEL, upsertComp, deleteComp, setStatus, assignInstantWins,
    luckyDip, createEntry, entry, markPaid, markUnpaid, cancelEntry, releaseExpired, ticketsForPerson,
    eligible, recordWinner, drawRandom, runDueAutoDraws, resetDraw, randInt,
    addLedger, updateLedger, deleteLedger, accountName,
    toCSV, ukDate, download, money, esc, art, countdownParts, sha256, uid, THEMES,
    isAdmin() { try { return +localStorage.getItem('cw_admin_until') > Date.now(); } catch (e) { return false; } },
    setAdmin(on) { try { on ? localStorage.setItem('cw_admin_until', String(Date.now() + 8 * 3600e3)) : localStorage.removeItem('cw_admin_until'); } catch (e) {} },
    reset() { localStorage.removeItem(KEY); load(); save(); },
    importAll(json) { const d = JSON.parse(json); if (d.v !== 1) throw new Error('Not a Community Wishes backup file'); S = d; save(); },
    exportAll() { return JSON.stringify(S, null, 1); }
  };
})();
