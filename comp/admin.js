/* Community Wishes – Admin panel */
(function () {
  const { esc, money, art, phase, PHASE_LABEL, soldCount } = CW;
  const S = () => CW.state, st = () => CW.state.settings;
  const root = document.getElementById('root');
  const modal = document.getElementById('modal'), mbody = document.getElementById('mbody');
  let tab = (location.hash || '#dashboard').slice(1);
  const ui = { entComp: 'all', entStatus: 'all', entQ: '', accRange: 'month', accFrom: '', accTo: '', xFormat: 'bank', xRange: 'unexported', xFrom: '', xTo: '', xRows: null, xIds: [] };

  /* ---------- helpers ---------- */
  const fmtDT = ts => ts ? new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–';
  const fmtD = ts => ts ? new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '–';
  const toLocalInput = ts => { if (!ts) return ''; const d = new Date(ts); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
  const toDateInput = ts => toLocalInput(ts).slice(0, 10);
  const fromInput = v => v ? new Date(v).getTime() : null;
  const pill = p => `<span class="pill p-${p}">${PHASE_LABEL[p] || p}</span>`;
  const openModal = html => { mbody.innerHTML = html; modal.classList.add('open'); document.body.style.overflow = 'hidden'; };
  const closeModal = () => { modal.classList.remove('open'); document.body.style.overflow = ''; };
  modal.querySelector('.x').onclick = closeModal;
  modal.addEventListener('mousedown', e => { if (e.target === modal) closeModal(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('open')) closeModal(); });
  function toast(msg, kind = 'ok') {
    const t = document.createElement('div'); t.className = 'msg ' + kind; t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:400;box-shadow:0 10px 30px rgba(0,0,0,.2);max-width:380px';
    document.body.appendChild(t); setTimeout(() => t.remove(), 3500);
  }
  const accountOptions = (sel, type) => S().accounts.filter(a => !type || a.type === type || a.code === sel).map(a => `<option value="${esc(a.code)}" ${a.code === sel ? 'selected' : ''}>${esc(a.code)} – ${esc(a.name)}</option>`).join('');

  /* ---------- auth ---------- */
  function authed() { return CW.isAdmin(); }
  const me = () => CW.currentAdmin();
  /* what each role can open */
  const ACCESS = {
    owner: ['dashboard', 'competitions', 'entries', 'draws', 'instant', 'accounts', 'xero', 'team', 'settings'],
    admin: ['dashboard', 'competitions', 'entries', 'draws', 'instant', 'accounts', 'xero', 'team', 'settings'],
    volunteer: ['dashboard', 'entries', 'draws', 'instant', 'team']
  };
  const can = t => !!me() && ACCESS[me().role].includes(t);
  function login(mode) {
    const noAdmins = !S().admins.length;
    const hashCode = (location.hash.match(/code=([A-Z0-9]+)/i) || [])[1] || '';
    mode = noAdmins ? 'owner' : (mode || (hashCode ? 'signup' : 'login'));
    const T = { owner: ['Create the owner account', 'You\'re the first person here, so you\'ll be the <b>Owner</b> with full access. You can invite the rest of the team afterwards.', 'Create account & enter'],
      login: ['Admin login', 'Log in with your email and password.', 'Log in'],
      signup: ['Join the admin team', 'Ask the owner for the team <b>invite code</b> (Team page). New members join as <b>Volunteers</b>. The owner can change your role.', 'Create my account'] }[mode];
    root.innerHTML = `<div class="login"><div class="cw-panel"><h2 style="font-family:Fraunces,serif;font-size:1.6rem">${T[0]}</h2>
     <p style="color:var(--cw-ink2);margin:0 0 16px">${T[1]}</p>
     ${noAdmins ? '' : `<div class="cw-tabs" style="margin-bottom:16px"><button type="button" data-m="login" aria-pressed="${mode === 'login'}">Log in</button><button type="button" data-m="signup" aria-pressed="${mode === 'signup'}">Sign up</button></div>`}
     <form class="cw-f" id="lf">
      ${mode !== 'login' ? '<label>Your name<input name="name" autocomplete="name" required></label>' : ''}
      <label>Email<input name="email" type="email" autocomplete="email" required></label>
      <label>Password<input type="password" name="p" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" required minlength="${mode === 'login' ? 1 : 6}"></label>
      ${mode !== 'login' ? '<label>Confirm password<input type="password" name="p2" autocomplete="new-password" required></label>' : ''}
      ${mode === 'signup' ? `<label>Invite code<input name="code" required value="${esc(hashCode)}" style="text-transform:uppercase;letter-spacing:.15em"></label>` : ''}
      <div class="cw-err" id="le" role="alert"></div><button class="cw-btn p">${T[2]}</button></form>
     ${mode === 'login' ? '<p style="font-size:.84rem;color:var(--cw-ink2);margin-top:12px">Forgotten your password? Ask the owner to reset it on the Team page.</p>' : ''}
     <p style="font-size:.8rem;color:var(--cw-ink2);margin-top:14px">Demo mode: accounts and data are saved in this browser only.</p></div></div>`;
    root.querySelectorAll('[data-m]').forEach(b => b.onclick = () => login(b.dataset.m));
    document.getElementById('lf').onsubmit = async e => {
      e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); const le = document.getElementById('le');
      try {
        let a;
        if (mode === 'login') a = await CW.checkLogin(d.email, d.p);
        else {
          if (d.p !== d.p2) throw new Error('Passwords do not match.');
          if (mode === 'signup' && (d.code || '').trim().toUpperCase() !== (st().inviteCode || '').toUpperCase()) throw new Error('That invite code isn\'t right. Ask the owner for the current code.');
          a = await CW.createAdmin({ name: d.name, email: d.email, password: d.p, role: mode === 'owner' ? 'owner' : 'volunteer' });
        }
        a.lastLogin = Date.now(); CW.setAdmin(a.id); CW.log('Logged in'); CW.save();
        if (/code=/.test(location.hash)) history.replaceState(null, '', location.pathname + '#dashboard');
        tab = 'dashboard'; boot();
      } catch (err) { le.textContent = err.message; }
    };
  }
  document.getElementById('logout').onclick = e => { e.preventDefault(); CW.log('Logged out'); CW.setAdmin(null); location.hash = ''; location.reload(); };

  /* ---------- shell ---------- */
  const TABS = [
    ['dashboard', '📊', 'Dashboard'], ['competitions', '🏆', 'Competitions'], ['entries', '🎟️', 'Entries & payments'], ['draws', '🎲', 'Draws'], ['instant', '⚡', 'Instant wins'],
    ['sep'], ['accounts', '📒', 'Accounts'], ['xero', '📤', 'Export to Xero'], ['sep'], ['team', '👥', 'Team & admins'], ['settings', '⚙️', 'Settings & publish']
  ];
  function shell() {
    document.getElementById('logout').style.display = '';
    const u = me(); const vis = TABS.filter(t => t[0] === 'sep' || can(t[0])).filter((t, i, arr) => !(t[0] === 'sep' && (i === 0 || arr[i - 1][0] === 'sep')));
    root.innerHTML = `<div class="ad"><aside class="side" id="side"><div style="padding:6px 12px 14px;font-size:.86rem"><b style="color:#fff">${esc(u.name)}</b><br><span class="pill p-soon" style="margin-top:4px">${CW.ROLES[u.role]}</span></div>${vis.map(t => t[0] === 'sep' ? '<div class="sep"></div>' : `<button data-tab="${t[0]}" aria-current="${tab === t[0]}"><span>${t[1]}</span>${t[2]}</button>`).join('')}
      <div class="sep"></div><div class="demo">${st().previewMode ? '🟡 <b>Preview mode on</b> – public pages show a "preview" banner.<br><br>' : ''}💾 Demo storage: data lives in this browser. Back up regularly from Settings.</div></aside>
      <main class="pane" id="pane"></main></div>`;
    root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => go(b.dataset.tab));
    document.getElementById('burg').onclick = () => document.getElementById('side').classList.toggle('open');
  }
  function go(t) { if (!can(t)) t = 'dashboard'; tab = t; history.replaceState(null, '', '#' + t); root.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-current', b.dataset.tab === t)); document.getElementById('side').classList.remove('open'); render(); scrollTo(0, 0); }
  function render() {
    const pane = document.getElementById('pane'); if (!pane) return;
    if (!can(tab)) tab = 'dashboard';
    ({ dashboard, competitions, entries, draws, instant, accounts, xero, team, settings }[tab] || dashboard)(pane);
    if (CW.saveError) pane.insertAdjacentHTML('afterbegin', '<div class="msg bad">⚠️ Browser storage is full – your last change may not be saved. Remove large competition photos or back up and reset old data.</div>');
  }

  /* ================= DASHBOARD ================= */
  function dashboard(p) {
    const comps = S().competitions, ents = S().entries.filter(e => e.status !== 'cancelled');
    const paid = ents.filter(e => e.status === 'paid'), pend = ents.filter(e => e.status === 'pending');
    const live = comps.filter(c => phase(c) === 'live');
    const inc = S().ledger.filter(l => l.type === 'income').reduce((n, l) => n + l.amount, 0), exp = S().ledger.filter(l => l.type === 'expense').reduce((n, l) => n + l.amount, 0);
    const toDraw = comps.filter(c => ['closed', 'soldout'].includes(phase(c)));
    p.innerHTML = `<h1>Dashboard</h1><p class="intro">Everything at a glance for ${esc(st().charity)}.</p>
     <div class="kpis"><div class="kpi hi"><span>Ticket money received</span><b>${money(paid.reduce((n, e) => n + e.amount, 0))}</b></div>
      <div class="kpi"><span>Awaiting payment</span><b>${money(pend.reduce((n, e) => n + e.amount, 0))}</b><small>${pend.length} reservation${pend.length === 1 ? '' : 's'}</small></div>
      <div class="kpi"><span>Live competitions</span><b>${live.length}</b></div>
      <div class="kpi"><span>Tickets sold</span><b>${ents.reduce((n, e) => n + e.tickets.length, 0)}</b></div>
      <div class="kpi"><span>Charity net (accounts)</span><b style="color:${inc - exp >= 0 ? 'var(--cw-ok)' : '#c92a2a'}">${money(inc - exp)}</b></div></div>
     ${toDraw.length ? `<div class="msg warn">🎲 ${toDraw.length} competition${toDraw.length > 1 ? 's are' : ' is'} closed and waiting to be drawn. <a href="#draws" data-go="draws">Go to Draws →</a></div>` : ''}
     ${pend.length ? `<div class="msg info">💷 ${pend.length} reservation${pend.length > 1 ? 's are' : ' is'} waiting for payment. <a href="#entries" data-go="entries">Match payments →</a></div>` : ''}
     <div class="card2"><h2>Competitions ${can('competitions') ? '<button class="cw-btn p sm" data-new>+ New competition</button>' : ''}</h2><div class="tw"><table class="t"><thead><tr><th>Competition</th><th>Status</th><th>Sold</th><th>Paid in</th><th>Closes</th><th>Draw</th></tr></thead><tbody>
      ${comps.length ? comps.map(c => { const e = S().entries.filter(x => x.compId === c.id && x.status === 'paid'); return `<tr><td><b>${esc(c.title)}</b></td><td>${pill(phase(c))}</td><td class="n">${soldCount(c.id)} / ${c.maxTickets}</td><td class="n">${money(e.reduce((n, x) => n + x.amount, 0))}</td><td>${fmtDT(c.endAt)}</td><td>${c.drawMode === 'live' ? '🎥 Live' : '🎲 Auto'}</td></tr>`; }).join('') : '<tr><td colspan="6">No competitions yet.</td></tr>'}
     </tbody></table></div></div>
     <div class="card2"><h2>Latest entries</h2><div class="tw"><table class="t"><thead><tr><th>When</th><th>Ref</th><th>Name</th><th>Competition</th><th>Tickets</th><th>Amount</th><th>Status</th></tr></thead><tbody>
      ${S().entries.slice(0, 8).map(e => `<tr><td>${fmtDT(e.createdAt)}</td><td>${esc(e.ref)}</td><td>${esc(e.name)}</td><td>${esc((CW.comp(e.compId) || {}).title || '–')}</td><td class="n">${e.tickets.length}</td><td class="n">${money(e.amount)}</td><td><span class="pill p-${e.status}">${e.status}</span></td></tr>`).join('') || '<tr><td colspan="7">No entries yet.</td></tr>'}
     </tbody></table></div></div>`;
    p.querySelectorAll('[data-go]').forEach(a => a.onclick = e => { e.preventDefault(); go(a.dataset.go); });
    const nb = p.querySelector('[data-new]'); if (nb) nb.onclick = () => editComp();
  }

  /* ================= COMPETITIONS ================= */
  function competitions(p) {
    const comps = S().competitions;
    p.innerHTML = `<h1>Competitions</h1><p class="intro">Add a competition, then press <b>Start</b> to put it live. Pause, end or restart any time.</p>
     <div class="toolbar"><button class="cw-btn p" data-new>+ New competition</button></div>
     <div id="list">${comps.length ? comps.map(row).join('') : '<div class="card2">No competitions yet. Click <b>+ New competition</b> to add your first one.</div>'}</div>`;
    p.querySelector('[data-new]').onclick = () => editComp();
    p.querySelectorAll('[data-act]').forEach(b => b.onclick = () => compAction(b.dataset.act, b.dataset.id));
  }
  function row(c) {
    const ph = phase(c), sold = soldCount(c.id), paidIn = S().entries.filter(x => x.compId === c.id && x.status === 'paid').reduce((n, x) => n + x.amount, 0);
    const btn = (act, label, cls = 'o') => `<button class="cw-btn ${cls} sm" data-act="${act}" data-id="${c.id}">${label}</button>`;
    let main = '';
    if (c.status === 'draft') main = btn('start', '▶ Start', 'ok');
    else if (c.status === 'paused') main = btn('resume', '▶ Resume', 'ok');
    else if (ph === 'live' || ph === 'soon') main = btn('pause', '⏸ Pause') + btn('end', '⏹ End now');
    else if (c.status === 'ended' || ph === 'closed' || ph === 'soldout') main = btn('reopen', '↺ Reopen') + btn('draw', '🎲 Draw', 'p');
    return `<div class="comprow"><div class="th">${art(c)}</div>
     <div><h3>${esc(c.title)} ${c.featured ? '<span class="pill p-soon">★ Featured</span>' : ''}</h3>
      <div class="m">${pill(ph)}<span>${money(c.price)} / ticket</span><span>${sold}/${c.maxTickets} sold</span><span>${money(paidIn)} paid in</span><span>${c.drawMode === 'live' ? '🎥 Live draw' : '🎲 Auto draw'}</span><span>⚡ ${(c.instantWins || []).length} instant</span><span>Closes ${fmtDT(c.endAt)}</span></div>
      ${c.winner ? `<div class="m" style="margin-top:4px">🏆 Winner #${c.winner.ticket} – ${esc(c.winner.name)}</div>` : ''}</div>
     <div class="acts">${main}${btn('edit', '✎ Edit')}${btn('dup', '⧉ Copy')}<a class="cw-btn o sm" target="_blank" href="competitions.html?id=${encodeURIComponent(c.id)}">View ↗</a>${btn('del', '🗑', 'o')}</div></div>`;
  }
  function compAction(act, id) {
    const c = CW.comp(id); if (!c) return;
    if (act === 'start') { if (!c.startAt || c.startAt > Date.now()) { if (confirm('Start now? (Press Cancel to keep the scheduled start ' + fmtDT(c.startAt) + ')')) c.startAt = Date.now(); } if (c.endAt <= Date.now()) return alert('The closing date is in the past. Edit the competition to set a new closing date first.'); CW.assignInstantWins(c); CW.setStatus(id, 'live'); toast('Competition is live'); }
    if (act === 'resume') { CW.setStatus(id, 'live'); toast('Competition resumed'); }
    if (act === 'pause') { CW.setStatus(id, 'paused'); toast('Competition paused – no new entries'); }
    if (act === 'end') { if (confirm('End this competition now? No more entries will be accepted.')) { c.endAt = Math.min(c.endAt, Date.now()); CW.setStatus(id, 'ended'); toast('Entries closed'); } }
    if (act === 'reopen') { const d = prompt('New closing date & time (DD/MM/YYYY HH:MM):', new Date(Date.now() + 7 * 864e5).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '')); if (!d) return; const m = d.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/); if (!m) return alert('Please use DD/MM/YYYY HH:MM'); c.endAt = new Date(+m[3], m[2] - 1, +m[1], +m[4], +m[5]).getTime(); CW.setStatus(id, 'live'); toast('Competition reopened'); }
    if (act === 'draw') return go('draws');
    if (act === 'edit') return editComp(c);
    if (act === 'dup') { const copy = JSON.parse(JSON.stringify(c)); delete copy.id; copy.title += ' (copy)'; copy.status = 'draft'; copy.winner = null; copy.instantWins = (copy.instantWins || []).map(w => ({ id: CW.uid('w'), prize: w.prize, value: w.value, ticket: null })); copy.startAt = Date.now(); copy.endAt = Date.now() + 7 * 864e5; CW.upsertComp(copy); toast('Copied as draft'); }
    if (act === 'del') { const n = S().entries.filter(e => e.compId === id).length; if (!confirm(`Delete "${c.title}"${n ? ` and its ${n} entries` : ''}? This cannot be undone.`)) return; CW.deleteComp(id); toast('Deleted'); }
    render();
  }

  function editComp(c) {
    const isNew = !c;
    c = c ? JSON.parse(JSON.stringify(c)) : { title: '', subtitle: '', prize: '', prizeValue: '', description: '', image: '', icon: '🎁', theme: 0, price: 1, maxTickets: 500, maxPerPerson: 50, startAt: Date.now(), endAt: Date.now() + 14 * 864e5, drawMode: 'auto', featured: false, question: { q: '', options: ['', '', ''], correct: 0 }, instantWins: [], accountCode: '200' };
    const hasEntries = c.id && S().entries.some(e => e.compId === c.id && e.status !== 'cancelled');
    const icons = ['🎁', '💷', '🧺', '🚐', '📺', '🎮', '✈️', '🏖️', '🎄', '💻', '📱', '🚗', '🍾', '🎟️', '⌚', '🛍️'];
    openModal(`<h2 style="font-family:Fraunces,serif;font-size:1.6rem;margin:0 0 14px">${isNew ? 'New competition' : 'Edit competition'}</h2>
    <form class="cw-f" id="cf">
     <label>Competition title *<input name="title" required value="${esc(c.title)}" placeholder="e.g. Christmas Hamper + £250 Cash"></label>
     <label>Short tagline<input name="subtitle" value="${esc(c.subtitle)}" placeholder="One line shown under the title"></label>
     <div class="two"><label>Prize *<input name="prize" required value="${esc(c.prize)}" placeholder="What the winner gets"></label><label>Prize value (£)<input name="prizeValue" type="number" step="0.01" min="0" value="${esc(c.prizeValue)}"></label></div>
     <label>Description<textarea name="description" rows="3">${esc(c.description)}</textarea></label>
     <div class="card2" style="margin:0"><b>Picture</b><p style="font-size:.85rem;color:var(--cw-ink2);margin:4px 0 10px">Upload a prize photo, or pick an icon and colour.</p>
      <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><div id="prev" style="width:120px;height:90px;border-radius:12px;overflow:hidden;position:relative">${art(c)}</div>
      <div style="display:grid;gap:8px"><input type="file" accept="image/*" id="img"><button type="button" class="cw-btn o sm" id="noimg" ${c.image ? '' : 'hidden'}>Remove photo</button></div></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">${icons.map(i => `<button type="button" class="cw-btn o sm" data-icon="${i}" style="${i === c.icon ? 'background:#fff0f4;border-color:var(--cw-brand)' : ''}">${i}</button>`).join('')}</div>
      <div style="display:flex;gap:6px;margin-top:8px">${CW.THEMES.map((t, i) => `<button type="button" data-theme="${i}" aria-label="Colour ${i + 1}" style="width:34px;height:34px;border-radius:10px;border:${i === c.theme ? '3px solid var(--cw-ink)' : '1px solid #ccc'};background:linear-gradient(135deg,${t[0]},${t[1]});cursor:pointer"></button>`).join('')}</div></div>
     <div class="three"><label>Ticket price (£) *<input name="price" type="number" step="0.01" min="0" required value="${c.price}"></label><label>Total tickets *<input name="maxTickets" type="number" min="${hasEntries ? Math.max(1, ...S().entries.filter(e => e.compId === c.id && e.status !== 'cancelled').flatMap(e => e.tickets)) : 1}" max="100000" required value="${c.maxTickets}"></label><label>Max per person<input name="maxPerPerson" type="number" min="1" value="${c.maxPerPerson}"></label></div>
     <div class="two"><label>Opens<input name="startAt" type="datetime-local" value="${toLocalInput(c.startAt)}"></label><label>Closes (draw time) *<input name="endAt" type="datetime-local" required value="${toLocalInput(c.endAt)}"></label></div>
     <div><b style="font-size:.86rem;color:var(--cw-ink2)">How is the winner drawn?</b><div class="big-choice" style="margin-top:6px">
      <label><input type="radio" name="drawMode" value="auto" ${c.drawMode !== 'live' ? 'checked' : ''}>🎲 <b>Auto draw</b><small>Drawn randomly the moment the timer ends (or sells out).</small></label>
      <label><input type="radio" name="drawMode" value="live" ${c.drawMode === 'live' ? 'checked' : ''}>🎥 <b>Live draw</b><small>A team member draws it on the big-screen live draw page (great for Facebook Live).</small></label></div></div>
     <div class="card2" style="margin:0"><b>Entry question</b> <small style="color:var(--cw-ink2)">(required by law for paid prize competitions – keep it simple but not a give-away)</small>
      <label style="margin-top:8px">Question<input name="q" value="${esc(c.question.q)}" placeholder="e.g. What city is Community Wishes based in?"></label>
      ${[0, 1, 2, 3].map(i => `<div style="display:flex;gap:8px;align-items:center;margin-top:6px"><input type="radio" name="correct" value="${i}" ${+c.question.correct === i ? 'checked' : ''} aria-label="Correct answer" style="width:20px;accent-color:var(--cw-ok)"><input name="opt${i}" value="${esc(c.question.options[i] || '')}" placeholder="Answer ${i + 1}${i === 3 ? ' (optional)' : ''}"></div>`).join('')}
      <small style="color:var(--cw-ink2)">Tick the circle next to the correct answer.</small></div>
     <div class="card2" style="margin:0"><b>⚡ Instant wins</b> <small style="color:var(--cw-ink2)">Leave the ticket number blank to pick one at random (kept secret).</small>
      <div id="iws" style="margin-top:10px"></div><button type="button" class="cw-btn o sm" id="addiw">+ Add instant win</button></div>
     <div class="two"><label>Income account (for accounts/Xero)<select name="accountCode">${accountOptions(c.accountCode, 'income')}</select></label>
      <label class="cw-check" style="align-self:end;padding-bottom:12px"><input type="checkbox" name="featured" ${c.featured ? 'checked' : ''}> ★ Feature on the homepage</label></div>
     <div class="cw-err" id="cfe"></div>
     <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end">
      ${isNew || c.status === 'draft' ? '<button class="cw-btn o" data-save="draft">Save as draft</button><button class="cw-btn ok" data-save="live">Save & start now ▶</button>' : '<button class="cw-btn p" data-save="keep">Save changes</button>'}</div>
    </form>`);
    const f = document.getElementById('cf');
    // instant wins editor
    const iwBox = document.getElementById('iws');
    function drawIW() {
      iwBox.innerHTML = c.instantWins.map((w, i) => `<div class="iwrow"><label>Prize<input data-iw="${i}" data-k="prize" value="${esc(w.prize)}" placeholder="e.g. £20 cash"></label><label>Value £<input data-iw="${i}" data-k="value" type="number" min="0" step="0.01" value="${esc(w.value)}"></label><label>Ticket # ${w.wonBy ? '(won)' : ''}<input data-iw="${i}" data-k="ticket" type="number" min="1" value="${esc(w.ticket || '')}" placeholder="random" ${w.wonBy ? 'disabled' : ''}></label><label>Copies<input data-iw="${i}" data-k="copies" type="number" min="1" max="200" value="1" ${w.id ? 'disabled' : ''}></label><button type="button" class="cw-btn o sm" data-rmiw="${i}" ${w.wonBy ? 'disabled' : ''} aria-label="Remove">✕</button></div>`).join('') || '<p style="font-size:.88rem;color:var(--cw-ink2);margin:0 0 8px">No instant wins.</p>';
      iwBox.querySelectorAll('[data-iw]').forEach(inp => inp.oninput = () => { const w = c.instantWins[+inp.dataset.iw]; w[inp.dataset.k] = inp.dataset.k === 'prize' ? inp.value : (inp.value === '' ? null : +inp.value); });
      iwBox.querySelectorAll('[data-rmiw]').forEach(b => b.onclick = () => { c.instantWins.splice(+b.dataset.rmiw, 1); drawIW(); });
    }
    drawIW();
    document.getElementById('addiw').onclick = () => { c.instantWins.push({ prize: '', value: null, ticket: null }); drawIW(); };
    // picture
    const prev = document.getElementById('prev');
    const refreshArt = () => { prev.innerHTML = art(c); document.getElementById('noimg').hidden = !c.image; };
    f.querySelectorAll('[data-icon]').forEach(b => b.onclick = () => { c.icon = b.dataset.icon; f.querySelectorAll('[data-icon]').forEach(x => x.style.cssText = x === b ? 'background:#fff0f4;border-color:var(--cw-brand)' : ''); refreshArt(); });
    f.querySelectorAll('[data-theme]').forEach(b => b.onclick = () => { c.theme = +b.dataset.theme; f.querySelectorAll('[data-theme]').forEach(x => x.style.border = x === b ? '3px solid var(--cw-ink)' : '1px solid #ccc'); refreshArt(); });
    document.getElementById('noimg').onclick = () => { c.image = ''; refreshArt(); };
    document.getElementById('img').onchange = e => {
      const file = e.target.files[0]; if (!file) return;
      const rd = new FileReader(); rd.onload = () => { const im = new Image(); im.onload = () => { const max = 1100, sc = Math.min(1, max / Math.max(im.width, im.height)); const cv = document.createElement('canvas'); cv.width = Math.round(im.width * sc); cv.height = Math.round(im.height * sc); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); c.image = cv.toDataURL('image/jpeg', .8); refreshArt(); }; im.src = rd.result; }; rd.readAsDataURL(file);
    };
    let saveMode = 'keep';
    f.querySelectorAll('[data-save]').forEach(b => b.onclick = () => saveMode = b.dataset.save);
    f.onsubmit = e => {
      e.preventDefault(); const d = Object.fromEntries(new FormData(f)); const err = document.getElementById('cfe');
      const opts = [0, 1, 2, 3].map(i => (d['opt' + i] || '').trim());
      const out = Object.assign(c, {
        title: d.title.trim(), subtitle: d.subtitle.trim(), prize: d.prize.trim(), prizeValue: +d.prizeValue || 0, description: d.description.trim(),
        price: +d.price, maxTickets: Math.floor(+d.maxTickets), maxPerPerson: Math.floor(+d.maxPerPerson) || Math.floor(+d.maxTickets),
        startAt: fromInput(d.startAt) || Date.now(), endAt: fromInput(d.endAt), drawMode: d.drawMode, featured: !!d.featured, accountCode: d.accountCode,
        question: { q: d.q.trim(), options: opts, correct: +d.correct || 0 }
      });
      if (!out.title || !out.prize) return err.textContent = 'Please add a title and prize.';
      if (!(out.price >= 0) || !(out.maxTickets >= 1)) return err.textContent = 'Check the ticket price and total tickets.';
      if (!out.endAt || out.endAt <= out.startAt) return err.textContent = 'The closing time must be after the opening time.';
      if (out.question.q && (!opts[out.question.correct] || opts.filter(Boolean).length < 2)) return err.textContent = 'Add at least two answers and tick the correct one.';
      if (!out.question.q) { if (!confirm('No entry question set. UK paid prize competitions normally need a skill question. Save anyway?')) return; }
      // expand instant-win copies
      const iws = [];
      for (const w of c.instantWins) {
        if (!w.prize) continue;
        if (w.ticket && (w.ticket < 1 || w.ticket > out.maxTickets)) return err.textContent = `Instant-win ticket #${w.ticket} is outside 1–${out.maxTickets}.`;
        const n = w.id ? 1 : Math.max(1, Math.min(200, +w.copies || 1));
        for (let k = 0; k < n; k++) iws.push({ id: w.id || CW.uid('w'), prize: w.prize, value: +w.value || 0, ticket: k === 0 ? (w.ticket || null) : null, wonBy: w.wonBy || null, wonAt: w.wonAt || null, wonName: w.wonName || null });
      }
      const nums = iws.filter(w => w.ticket).map(w => w.ticket);
      if (new Set(nums).size !== nums.length) return err.textContent = 'Two instant wins share the same ticket number.';
      if (iws.length > out.maxTickets) return err.textContent = 'More instant wins than tickets.';
      out.instantWins = iws;
      if (saveMode === 'live') { out.status = 'live'; if (out.startAt > Date.now()) out.startAt = Date.now(); }
      else if (saveMode === 'draft') out.status = 'draft';
      if (out.endAt <= Date.now() && out.status === 'live') return err.textContent = 'The closing time is in the past.';
      const saved = CW.upsertComp(out);
      CW.assignInstantWins(saved); CW.save();
      if (out.featured) S().competitions.forEach(x => { if (x.id !== saved.id && x.featured) { x.featured = false; x.updatedAt = Date.now(); } });
      CW.save(); closeModal(); toast(saveMode === 'live' ? 'Saved & live!' : 'Saved'); go('competitions');
    };
  }

  /* ================= ENTRIES ================= */
  function entries(p) {
    const comps = S().competitions;
    let list = S().entries.filter(e => (ui.entComp === 'all' || e.compId === ui.entComp) && (ui.entStatus === 'all' || e.status === ui.entStatus));
    const q = ui.entQ.trim().toLowerCase();
    if (q) list = list.filter(e => [e.ref, e.name, e.email, e.phone, e.tickets.join(' ')].join(' ').toLowerCase().includes(q) || e.tickets.includes(+q));
    const pendAmt = list.filter(e => e.status === 'pending').reduce((n, e) => n + e.amount, 0);
    p.innerHTML = `<h1>Entries & payments</h1><p class="intro">When money arrives, find the reference and press <b>Paid</b>. It's added to the accounts automatically.</p>
     <div class="toolbar">
      <select id="fc"><option value="all">All competitions</option>${comps.map(c => `<option value="${c.id}" ${ui.entComp === c.id ? 'selected' : ''}>${esc(c.title)}</option>`).join('')}</select>
      <select id="fs">${[['all', 'All statuses'], ['pending', 'Awaiting payment'], ['paid', 'Paid'], ['cancelled', 'Cancelled']].map(([k, l]) => `<option value="${k}" ${ui.entStatus === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <input id="fq" type="search" placeholder="Search ref, name, email, ticket #" value="${esc(ui.entQ)}" style="flex:1;min-width:200px">
      <button class="cw-btn p sm" id="add">+ Add entry (postal / cash)</button><button class="cw-btn o sm" id="csv">⬇ Export CSV</button><button class="cw-btn o sm" id="rel">Release expired holds</button></div>
     ${pendAmt ? `<div class="msg warn">Showing ${list.filter(e => e.status === 'pending').length} unpaid reservation(s) worth ${money(pendAmt)}.</div>` : ''}
     <div class="card2" style="padding:0"><div class="tw"><table class="t"><thead><tr><th>Ref</th><th>Date</th><th>Name / contact</th><th>Competition</th><th>Tickets</th><th>Answer</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>
     ${list.map(e => { const c = CW.comp(e.compId); return `<tr><td><b>${esc(e.ref)}</b><br><small>${esc(e.method)}</small></td><td>${fmtDT(e.createdAt)}</td><td>${esc(e.name)}<br><small><a href="mailto:${esc(e.email)}">${esc(e.email)}</a> ${esc(e.phone)}</small></td><td>${esc(c ? c.title : '–')}</td>
      <td style="max-width:220px"><div class="cw-chips">${e.tickets.slice(0, 12).map(t => `<span class="cw-chip ${(c && (c.instantWins || []).some(w => w.ticket === t && w.wonBy === e.id)) ? 'w' : ''}">#${t}</span>`).join('')}${e.tickets.length > 12 ? `<span class="cw-chip">+${e.tickets.length - 12}</span>` : ''}</div></td>
      <td>${e.correct ? '✅' : '❌'}</td><td class="n">${money(e.amount)}</td><td><span class="pill p-${e.status}">${e.status === 'pending' ? 'awaiting' : e.status}</span>${e.payMethod && e.status === 'paid' ? `<br><small>${esc(e.payMethod)}</small>` : ''}</td>
      <td><div class="acts">${e.status === 'pending' ? `<button class="cw-btn ok sm" data-paid="${e.id}">✓ Paid</button>` : ''}${e.status === 'paid' && e.amount > 0 ? `<button class="cw-btn o sm" data-unpaid="${e.id}">Undo paid</button>` : ''}${e.status !== 'cancelled' ? `<button class="cw-btn o sm" data-cancel="${e.id}">Cancel</button>` : ''}</div></td></tr>`; }).join('') || '<tr><td colspan="9" style="padding:30px;text-align:center">No entries match.</td></tr>'}
     </tbody></table></div></div>`;
    p.querySelector('#fc').onchange = e => { ui.entComp = e.target.value; render(); };
    p.querySelector('#fs').onchange = e => { ui.entStatus = e.target.value; render(); };
    let tm; p.querySelector('#fq').oninput = e => { clearTimeout(tm); tm = setTimeout(() => { ui.entQ = e.target.value; render(); const i = document.getElementById('fq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); };
    p.querySelector('#add').onclick = addEntry;
    p.querySelector('#rel').onclick = () => { const n = CW.releaseExpired(); toast(n ? `${n} expired reservation(s) released` : `Nothing to release (holds last ${st().holdHours}h)`, n ? 'ok' : 'info'); render(); };
    p.querySelector('#csv').onclick = () => {
      const rows = [['Reference', 'Date', 'Name', 'Email', 'Phone', 'Competition', 'Tickets', 'Ticket numbers', 'Correct answer', 'Amount', 'Status', 'Payment method', 'Paid date', 'Entry method']];
      list.forEach(e => rows.push([e.ref, CW.ukDate(e.createdAt), e.name, e.email, e.phone, (CW.comp(e.compId) || {}).title || '', e.tickets.length, e.tickets.join(' '), e.correct ? 'Yes' : 'No', e.amount.toFixed(2), e.status, e.payMethod || '', e.paidAt ? CW.ukDate(e.paidAt) : '', e.method]));
      CW.download('community-wishes-entries.csv', CW.toCSV(rows));
    };
    p.querySelectorAll('[data-paid]').forEach(b => b.onclick = () => {
      const e = CW.entry(b.dataset.paid);
      openModal(`<h2 style="font-family:Fraunces,serif;margin:0 0 6px">Mark ${esc(e.ref)} as paid</h2><p style="color:var(--cw-ink2)">${esc(e.name)} · ${money(e.amount)}</p>
       <form class="cw-f" id="pf"><label>How was it paid?<select name="m"><option>Bank transfer</option><option>Cash</option><option>Card (in person)</option><option>PayPal</option><option>Cheque</option></select></label>
       <label>Date received<input type="date" name="d" value="${toDateInput(Date.now())}"></label><button class="cw-btn ok">Confirm payment</button></form>`);
      document.getElementById('pf').onsubmit = ev => { ev.preventDefault(); const d = Object.fromEntries(new FormData(ev.target)); CW.markPaid(e.id, d.m); const l = S().ledger.find(x => x.entryId === e.id); if (l && d.d) { l.date = fromInput(d.d + 'T12:00'); e.paidAt = l.date; CW.save(); } closeModal(); toast('Payment recorded & added to accounts'); render(); };
    });
    p.querySelectorAll('[data-unpaid]').forEach(b => b.onclick = () => { if (confirm('Mark as not paid? The accounts entry will be removed (or reversed if already exported).')) { CW.markUnpaid(b.dataset.unpaid); render(); } });
    p.querySelectorAll('[data-cancel]').forEach(b => b.onclick = () => { if (confirm('Cancel this entry and release its ticket numbers?')) { CW.cancelEntry(b.dataset.cancel); render(); } });
  }
  function addEntry() {
    const comps = S().competitions.filter(c => c.status !== 'drawn');
    if (!comps.length) return alert('Create a competition first.');
    openModal(`<h2 style="font-family:Fraunces,serif;margin:0 0 12px">Add an entry</h2>
     <form class="cw-f" id="af">
      <label>Competition<select name="comp">${comps.map(c => `<option value="${c.id}" ${ui.entComp === c.id ? 'selected' : ''}>${esc(c.title)} (${PHASE_LABEL[phase(c)]})</option>`).join('')}</select></label>
      <div class="big-choice"><label><input type="radio" name="type" value="postal" checked>✉️ <b>Free postal entry</b><small>1 ticket, no charge</small></label><label><input type="radio" name="type" value="cash">💷 <b>Paid entry</b><small>Cash / bank – marked as paid now</small></label></div>
      <div class="two"><label>Full name *<input name="name" required></label><label>Email *<input name="email" type="email" required></label></div>
      <div class="two"><label>Phone<input name="phone"></label><label>How many tickets<input name="qty" type="number" min="1" value="1"></label></div>
      <label>Specific ticket numbers (optional)<input name="nums" placeholder="e.g. 7, 21, 150 – leave blank for random"></label>
      <label>Their answer<select name="ans" id="ans"></select></label>
      <label>Payment method (paid entries)<select name="pm"><option>Cash</option><option>Bank transfer</option><option>Card (in person)</option><option>Cheque</option></select></label>
      <div class="cw-err" id="ae"></div><button class="cw-btn p">Add entry</button></form>`);
    const f = document.getElementById('af');
    const setAns = () => { const c = CW.comp(f.comp.value); const ans = document.getElementById('ans'); ans.innerHTML = c.question && c.question.q ? c.question.options.map((o, i) => o ? `<option value="${i}">${esc(o)}${i === +c.question.correct ? ' ✓' : ''}</option>` : '').join('') + '<option value="-1">Wrong / no answer</option>' : '<option value="0">No question</option>'; };
    f.comp.onchange = setAns; setAns();
    f.onsubmit = e => {
      e.preventDefault(); const d = Object.fromEntries(new FormData(f)); const c = CW.comp(d.comp);
      let tickets = (d.nums || '').split(/[\s,]+/).filter(Boolean).map(Number);
      if (tickets.some(n => !Number.isInteger(n))) return document.getElementById('ae').textContent = 'Ticket numbers must be whole numbers.';
      const qty = d.type === 'postal' ? 1 : Math.max(1, +d.qty || 1);
      if (!tickets.length) tickets = CW.luckyDip(c.id, qty); else if (d.type === 'postal') tickets = tickets.slice(0, 1);
      try { const en = CW.createEntry({ compId: c.id, name: d.name, email: d.email, phone: d.phone, tickets, answerIdx: d.ans, method: d.type === 'postal' ? 'postal' : 'admin', paid: d.type !== 'postal', payMethod: d.pm }); closeModal(); toast(`Added ${en.ref}: ticket${en.tickets.length > 1 ? 's' : ''} ${en.tickets.map(t => '#' + t).join(', ')}${en.instantWins.length ? ' – ⚡ INSTANT WIN!' : ''}`); render(); }
      catch (err) { document.getElementById('ae').textContent = err.message; }
    };
  }

  /* ================= DRAWS ================= */
  function draws(p) {
    const comps = S().competitions.filter(c => c.status !== 'draft');
    const order = { closed: 0, soldout: 0, live: 1, paused: 2, soon: 3, drawn: 4 };
    comps.sort((a, b) => (order[phase(a)] ?? 5) - (order[phase(b)] ?? 5));
    p.innerHTML = `<h1>Draws</h1><p class="intro">Auto-draw competitions draw themselves when the timer ends. Live-draw ones wait for you to open the big-screen draw.</p>
     ${comps.map(c => {
      const ph = phase(c), pool = CW.eligible(c.id), ready = ['closed', 'soldout'].includes(ph) || c.status === 'ended';
      const unpaid = S().entries.filter(e => e.compId === c.id && e.status === 'pending').length;
      return `<div class="card2"><h2><span>${esc(c.title)} ${pill(ph)}</span><span style="font-weight:500;font-size:.88rem">${c.drawMode === 'live' ? '🎥 Live draw' : '🎲 Auto draw'} · ${pool.length} eligible ticket${pool.length === 1 ? '' : 's'}</span></h2>
       ${c.winner ? `<div class="cw-winbox"><div class="tk">#${c.winner.ticket}</div><div><b>${esc(c.winner.name)}</b> · ${esc(c.winner.ref)}<br><small>${esc(c.winner.method)} · ${fmtDT(c.winner.at)} · from ${c.winner.poolSize} eligible tickets</small><br>${(() => { const e = CW.entry(c.winner.entryId); return e ? `<small>📧 <a href="mailto:${esc(e.email)}">${esc(e.email)}</a> ${esc(e.phone)}</small>` : ''; })()}</div></div>
        <div class="acts" style="margin-top:12px"><a class="cw-btn o sm" href="draw.html?id=${encodeURIComponent(c.id)}" target="_blank">Show on big screen</a><button class="cw-btn o sm" data-reset="${c.id}">Redraw (winner not contactable)</button></div>`
        : `${unpaid ? `<div class="msg warn">${unpaid} reservation(s) still unpaid – unpaid tickets are not in the draw.</div>` : ''}
        <p style="color:var(--cw-ink2);margin:0 0 12px">${ready ? 'Entries are closed – ready to draw.' : `Closes ${fmtDT(c.endAt)}. You can still draw early if needed.`}</p>
        <div class="acts"><a class="cw-btn p sm" href="draw.html?id=${encodeURIComponent(c.id)}" target="_blank">🎥 Open live draw screen</a><button class="cw-btn dark sm" data-auto="${c.id}" ${pool.length ? '' : 'disabled'}>🎲 Draw automatically now</button><button class="cw-btn o sm" data-manual="${c.id}" ${pool.length ? '' : 'disabled'}>Enter number from physical draw</button></div>`}</div>`;
    }).join('') || '<div class="card2">No competitions yet.</div>'}
     <div class="card2"><h2>Audit log <button class="cw-btn o sm" id="alog">⬇ Download</button></h2><div class="audit">${S().audit.slice(0, 200).map(a => `<div><time>${fmtDT(a.at)}</time><span>${esc(a.msg)}</span></div>`).join('') || 'Nothing yet.'}</div></div>`;
    p.querySelectorAll('[data-auto]').forEach(b => b.onclick = () => { const c = CW.comp(b.dataset.auto); if (!confirm(`Draw the winner of "${c.title}" now? ${phase(c) === 'live' ? 'It is still open – entries will close.' : ''}`)) return; try { if (phase(c) === 'live') { c.endAt = Date.now(); } const w = CW.drawRandom(c.id, 'Auto draw (admin)'); toast(`🏆 Winner: ticket #${w.ticket} – ${w.name}`); } catch (e) { alert(e.message); } render(); });
    p.querySelectorAll('[data-manual]').forEach(b => b.onclick = () => { const n = prompt('Winning ticket number from the physical draw:'); if (!n) return; try { const c = CW.comp(b.dataset.manual); if (phase(c) === 'live') c.endAt = Date.now(); const w = CW.recordWinner(b.dataset.manual, +n, 'Live draw (physical)'); toast(`🏆 Winner: #${w.ticket} – ${w.name}`); } catch (e) { alert(e.message); } render(); });
    p.querySelectorAll('[data-reset]').forEach(b => b.onclick = () => { if (confirm('Clear this winner so you can redraw? The previous result stays in the audit log.')) { CW.resetDraw(b.dataset.reset); render(); } });
    p.querySelector('#alog').onclick = () => CW.download('community-wishes-audit-log.csv', CW.toCSV([['Date', 'Time', 'Event'], ...S().audit.map(a => [CW.ukDate(a.at), new Date(a.at).toLocaleTimeString('en-GB'), a.msg])]));
  }

  /* ================= INSTANT WINS ================= */
  function instant(p) {
    const rows = [];
    S().competitions.forEach(c => (c.instantWins || []).forEach(w => rows.push({ c, w, e: w.wonBy ? CW.entry(w.wonBy) : null })));
    const won = rows.filter(r => r.w.wonBy);
    p.innerHTML = `<h1>Instant wins</h1><p class="intro">Winning ticket numbers are secret to the public. Set them up when you add or edit a competition.</p>
     <div class="kpis"><div class="kpi"><span>Total instant wins</span><b>${rows.length}</b></div><div class="kpi hi"><span>Won</span><b>${won.length}</b></div><div class="kpi"><span>Still to win</span><b>${rows.length - won.length}</b></div><div class="kpi"><span>Value won</span><b>${money(won.reduce((n, r) => n + (+r.w.value || 0), 0))}</b></div></div>
     <div class="card2" style="padding:0"><div class="tw"><table class="t"><thead><tr><th>Competition</th><th>Prize</th><th>Value</th><th>Ticket #</th><th>Status</th><th>Winner</th><th>Paid?</th></tr></thead><tbody>
     ${rows.map(({ c, w, e }) => `<tr><td>${esc(c.title)}</td><td><b>${esc(w.prize)}</b></td><td class="n">${money(w.value)}</td><td class="n">#${w.ticket || '–'}</td><td>${w.wonBy ? '<span class="pill p-drawn">Won</span>' : '<span class="pill p-live">Available</span>'}</td>
      <td>${e ? `${esc(e.name)}<br><small>${esc(e.ref)} · <a href="mailto:${esc(e.email)}">${esc(e.email)}</a></small>` : (w.wonName ? esc(w.wonName) : '–')}</td><td>${e ? (e.status === 'paid' ? '✅ Release prize' : '⏳ Awaiting payment') : '–'}</td></tr>`).join('') || '<tr><td colspan="7" style="padding:30px;text-align:center">No instant wins set up.</td></tr>'}
     </tbody></table></div></div>`;
  }

  /* ================= ACCOUNTS ================= */
  function rangeOf(r, from, to) {
    const d = new Date(), y = d.getFullYear(), m = d.getMonth();
    if (r === 'month') return [new Date(y, m, 1).getTime(), new Date(y, m + 1, 1).getTime()];
    if (r === 'lastmonth') return [new Date(y, m - 1, 1).getTime(), new Date(y, m, 1).getTime()];
    if (r === 'year') { const sy = m >= 3 ? y : y - 1; return [new Date(sy, 3, 1).getTime(), new Date(sy + 1, 3, 1).getTime()]; } // charity year Apr–Mar
    if (r === 'custom') return [from ? fromInput(from + 'T00:00') : 0, to ? fromInput(to + 'T23:59') + 60000 : Infinity];
    return [0, Infinity];
  }
  function accounts(p) {
    const [a, b] = rangeOf(ui.accRange, ui.accFrom, ui.accTo);
    const rows = S().ledger.filter(l => l.date >= a && l.date < b).sort((x, y) => y.date - x.date);
    const inc = rows.filter(l => l.type === 'income').reduce((n, l) => n + l.amount, 0), exp = rows.filter(l => l.type === 'expense').reduce((n, l) => n + l.amount, 0);
    const byAcc = {}; rows.forEach(l => { const k = l.account; byAcc[k] = byAcc[k] || { in: 0, out: 0 }; byAcc[k][l.type === 'income' ? 'in' : 'out'] += l.amount; });
    p.innerHTML = `<h1>Accounts</h1><p class="intro">Ticket payments appear here automatically. Add donations, prize costs and other money in or out below. Click any cell to edit it.</p>
     <div class="toolbar"><select id="ar">${[['month', 'This month'], ['lastmonth', 'Last month'], ['year', 'This financial year (Apr–Mar)'], ['all', 'All time'], ['custom', 'Custom dates']].map(([k, l]) => `<option value="${k}" ${ui.accRange === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      ${ui.accRange === 'custom' ? `<input type="date" id="af1" value="${ui.accFrom}"> to <input type="date" id="af2" value="${ui.accTo}">` : ''}
      <button class="cw-btn ok sm" data-add="income">+ Money in</button><button class="cw-btn bad sm" data-add="expense">+ Money out</button><button class="cw-btn o sm" id="sum">⬇ Summary for accountant</button><button class="cw-btn p sm" data-go="xero">📤 Export to Xero</button></div>
     <div class="kpis"><div class="kpi"><span>Money in</span><b style="color:var(--cw-ok)">${money(inc)}</b></div><div class="kpi"><span>Money out</span><b style="color:#c92a2a">${money(exp)}</b></div><div class="kpi hi"><span>Net</span><b>${money(inc - exp)}</b></div><div class="kpi"><span>Not yet sent to Xero</span><b>${S().ledger.filter(l => !l.exported).length}</b></div></div>
     <div class="card2"><h2>By category</h2><div class="tw"><table class="t"><thead><tr><th>Code</th><th>Category</th><th style="text-align:right">In</th><th style="text-align:right">Out</th></tr></thead><tbody>
      ${Object.keys(byAcc).sort().map(k => `<tr><td>${esc(k)}</td><td>${esc(CW.accountName(k))}</td><td class="n">${byAcc[k].in ? money(byAcc[k].in) : ''}</td><td class="n">${byAcc[k].out ? money(byAcc[k].out) : ''}</td></tr>`).join('') || '<tr><td colspan="4">No transactions in this period.</td></tr>'}</tbody></table></div></div>
     <div class="card2" style="padding:0"><div class="tw"><table class="t grid-ed"><thead><tr><th>Date</th><th>In/Out</th><th>Who</th><th>What for</th><th>Reference</th><th>Category (Xero code)</th><th style="text-align:right">Amount £</th><th>Xero</th><th></th></tr></thead><tbody>
      ${rows.map(l => `<tr data-l="${l.id}"><td><input type="date" data-k="date" value="${toDateInput(l.date)}"></td>
       <td><select data-k="type"><option value="income" ${l.type === 'income' ? 'selected' : ''}>In</option><option value="expense" ${l.type === 'expense' ? 'selected' : ''}>Out</option></select></td>
       <td><input data-k="payee" value="${esc(l.payee)}"></td><td><input data-k="description" value="${esc(l.description)}" style="min-width:200px"></td><td><input data-k="reference" value="${esc(l.reference)}"></td>
       <td><select data-k="account" style="min-width:200px">${accountOptions(l.account)}</select></td><td><input data-k="amount" type="number" step="0.01" min="0" value="${l.amount.toFixed(2)}" style="text-align:right;color:${l.type === 'income' ? 'var(--cw-ok)' : '#c92a2a'}"></td>
       <td>${l.exported ? `<span class="pill p-paid" title="Exported ${fmtD(l.exported)}">Sent</span>` : '<span class="pill p-pending">Not sent</span>'}</td><td><button class="cw-btn o sm" data-del="${l.id}" aria-label="Delete">🗑</button></td></tr>`).join('') || '<tr><td colspan="9" style="padding:30px;text-align:center">No transactions in this period.</td></tr>'}
     </tbody></table></div></div>
     <div class="card2"><h2>Categories (chart of accounts) <button class="cw-btn o sm" id="addacc">+ Add category</button></h2><p style="font-size:.88rem;color:var(--cw-ink2);margin:0 0 10px">Make these codes match the account codes in your Xero organisation (Xero → Accounting → Chart of accounts).</p>
      <div class="tw"><table class="t grid-ed"><thead><tr><th>Code</th><th>Name</th><th>Type</th><th></th></tr></thead><tbody>
      ${S().accounts.map((ac, i) => `<tr><td><input data-ac="${i}" data-k="code" value="${esc(ac.code)}" style="max-width:100px"></td><td><input data-ac="${i}" data-k="name" value="${esc(ac.name)}"></td><td><select data-ac="${i}" data-k="type">${['income', 'expense', 'bank'].map(t => `<option ${ac.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></td><td><button class="cw-btn o sm" data-delac="${i}">🗑</button></td></tr>`).join('')}</tbody></table></div></div>`;
    p.querySelector('#ar').onchange = e => { ui.accRange = e.target.value; render(); };
    const f1 = p.querySelector('#af1'), f2 = p.querySelector('#af2');
    if (f1) { f1.onchange = e => { ui.accFrom = e.target.value; render(); }; f2.onchange = e => { ui.accTo = e.target.value; render(); }; }
    p.querySelector('[data-go]').onclick = () => go('xero');
    p.querySelectorAll('[data-add]').forEach(b => b.onclick = () => addTx(b.dataset.add));
    p.querySelectorAll('tr[data-l] [data-k]').forEach(inp => inp.onchange = () => {
      const id = inp.closest('tr').dataset.l, k = inp.dataset.k; let v = inp.value;
      if (k === 'date') v = fromInput(v + 'T12:00'); if (k === 'amount') v = +v;
      const l = S().ledger.find(x => x.id === id);
      if (l && l.exported && !confirm('This line was already sent to Xero. Changing it here will NOT change Xero. Mark it as "not sent" so it goes in the next export?')) { CW.updateLedger(id, { [k]: v }); }
      else CW.updateLedger(id, { [k]: v, exported: false });
      toast('Saved'); if (k === 'type' || k === 'date') render();
    });
    p.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { const l = S().ledger.find(x => x.id === b.dataset.del); if (confirm(`Delete this line (${money(l.amount)} – ${l.description})?${l.entryId ? ' It is linked to a ticket payment – the entry will stay marked paid.' : ''}`)) { CW.deleteLedger(l.id); render(); } });
    p.querySelectorAll('[data-ac]').forEach(inp => inp.onchange = () => { const ac = S().accounts[+inp.dataset.ac]; const old = ac.code; ac[inp.dataset.k] = inp.value.trim(); if (inp.dataset.k === 'code' && old !== ac.code) { S().ledger.forEach(l => { if (l.account === old) l.account = ac.code; }); S().competitions.forEach(c => { if (c.accountCode === old) c.accountCode = ac.code; }); } CW.save(); toast('Category saved'); });
    p.querySelectorAll('[data-delac]').forEach(b => b.onclick = () => { const ac = S().accounts[+b.dataset.delac]; if (S().ledger.some(l => l.account === ac.code)) return alert('This category is used by transactions – change those first.'); S().accounts.splice(+b.dataset.delac, 1); CW.save(); render(); });
    p.querySelector('#addacc').onclick = () => { S().accounts.push({ code: '', name: 'New category', type: 'expense' }); CW.save(); render(); };
    p.querySelector('#sum').onclick = () => {
      const out = [[`${st().charity} – income & expenditure summary`], [`Period: ${a ? CW.ukDate(a) : 'start'} to ${b === Infinity ? CW.ukDate(Date.now()) : CW.ukDate(b - 1)}`], [], ['Account code', 'Category', 'Type', 'Amount']];
      Object.keys(byAcc).sort().forEach(k => { if (byAcc[k].in) out.push([k, CW.accountName(k), 'Income', byAcc[k].in.toFixed(2)]); if (byAcc[k].out) out.push([k, CW.accountName(k), 'Expenditure', (-byAcc[k].out).toFixed(2)]); });
      out.push([], ['', 'Total income', '', inc.toFixed(2)], ['', 'Total expenditure', '', (-exp).toFixed(2)], ['', 'Net', '', (inc - exp).toFixed(2)], [], ['Date', 'In/Out', 'Who', 'What for', 'Reference', 'Account code', 'Amount']);
      rows.slice().reverse().forEach(l => out.push([CW.ukDate(l.date), l.type === 'income' ? 'In' : 'Out', l.payee, l.description, l.reference, l.account, (l.type === 'income' ? l.amount : -l.amount).toFixed(2)]));
      CW.download('community-wishes-accounts-summary.csv', CW.toCSV(out));
    };
  }
  function addTx(type) {
    openModal(`<h2 style="font-family:Fraunces,serif;margin:0 0 12px">${type === 'income' ? '💷 Money in' : '🧾 Money out'}</h2>
     <form class="cw-f" id="tf"><div class="two"><label>Date<input type="date" name="date" value="${toDateInput(Date.now())}" required></label><label>Amount £<input name="amount" type="number" step="0.01" min="0.01" required></label></div>
      <label>${type === 'income' ? 'Who from' : 'Paid to'}<input name="payee" placeholder="${type === 'income' ? 'e.g. Tesco Community Fund' : 'e.g. Argos'}"></label>
      <label>What for<input name="description" required placeholder="${type === 'income' ? 'e.g. Bucket collection at Fosse Park' : 'e.g. TV for competition prize'}"></label>
      <div class="two"><label>Category<select name="account">${accountOptions(type === 'income' ? '201' : '310', type)}</select></label><label>Reference / receipt no.<input name="reference"></label></div>
      <button class="cw-btn ${type === 'income' ? 'ok' : 'bad'}">Add</button></form>`);
    document.getElementById('tf').onsubmit = e => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); CW.addLedger({ type, date: fromInput(d.date + 'T12:00'), amount: +d.amount, payee: d.payee, description: d.description, account: d.account, reference: d.reference }); closeModal(); toast('Added'); render(); };
  }

  /* ================= XERO EXPORT ================= */
  const XF = {
    bank: { name: 'Bank statement (recommended)', file: 'xero-bank-statement', cols: ['Date', 'Amount', 'Payee', 'Description', 'Reference', 'Account Code', 'Tax Type'], money: ['Amount'], date: ['Date'], req: ['Date', 'Amount'],
      help: 'Every money in/out line, ready to import into the charity bank account in Xero and reconcile. Money out is shown as a minus.', types: ['income', 'expense'] },
    sales: { name: 'Sales invoices (money in)', file: 'xero-sales-invoices', cols: ['ContactName', 'EmailAddress', 'InvoiceNumber', 'Reference', 'InvoiceDate', 'DueDate', 'Description', 'Quantity', 'UnitAmount', 'AccountCode', 'TaxType'], money: ['UnitAmount'], date: ['InvoiceDate', 'DueDate'], req: ['ContactName', 'InvoiceNumber', 'InvoiceDate', 'DueDate', 'Description', 'Quantity', 'UnitAmount', 'AccountCode', 'TaxType'],
      help: 'Each money-in line becomes a Xero sales invoice (Business → Invoices → Import).', types: ['income'],
      full: ['*ContactName', 'EmailAddress', 'POAddressLine1', 'POAddressLine2', 'POAddressLine3', 'POAddressLine4', 'POCity', 'PORegion', 'POPostalCode', 'POCountry', '*InvoiceNumber', 'Reference', '*InvoiceDate', '*DueDate', 'InventoryItemCode', '*Description', '*Quantity', '*UnitAmount', 'Discount', '*AccountCode', '*TaxType', 'TrackingName1', 'TrackingOption1', 'TrackingName2', 'TrackingOption2', 'Currency', 'BrandingTheme'] },
    bills: { name: 'Bills (money out)', file: 'xero-bills', cols: ['ContactName', 'InvoiceNumber', 'InvoiceDate', 'DueDate', 'Description', 'Quantity', 'UnitAmount', 'AccountCode', 'TaxType'], money: ['UnitAmount'], date: ['InvoiceDate', 'DueDate'], req: ['ContactName', 'InvoiceNumber', 'InvoiceDate', 'DueDate', 'Description', 'Quantity', 'UnitAmount', 'AccountCode', 'TaxType'],
      help: 'Each money-out line becomes a Xero bill (Business → Bills to pay → Import).', types: ['expense'],
      full: ['*ContactName', 'EmailAddress', 'POAddressLine1', 'POAddressLine2', 'POAddressLine3', 'POAddressLine4', 'POCity', 'PORegion', 'POPostalCode', 'POCountry', '*InvoiceNumber', '*InvoiceDate', '*DueDate', 'InventoryItemCode', 'Description', '*Quantity', '*UnitAmount', '*AccountCode', '*TaxType', 'TrackingName1', 'TrackingOption1', 'TrackingName2', 'TrackingOption2', 'Currency'] }
  };
  function buildRows() {
    const fmt = XF[ui.xFormat];
    let src = S().ledger.filter(l => fmt.types.includes(l.type));
    if (ui.xRange === 'unexported') src = src.filter(l => !l.exported);
    else { const [a, b] = rangeOf(ui.xRange, ui.xFrom, ui.xTo); src = src.filter(l => l.date >= a && l.date < b); }
    src.sort((x, y) => x.date - y.date);
    ui.xIds = src.map(l => l.id);
    const tax = st().taxType || 'No VAT';
    ui.xRows = src.map((l, i) => {
      const d = CW.ukDate(l.date), e = l.entryId ? CW.entry(l.entryId) : null, payee = l.payee || (l.type === 'income' ? 'Supporter' : 'Supplier');
      const ref = l.reference || `${l.type === 'income' ? 'CW-IN' : 'CW-OUT'}-${toDateInput(l.date).replace(/-/g, '')}-${i + 1}`;
      if (ui.xFormat === 'bank') return { Date: d, Amount: (l.type === 'income' ? l.amount : -l.amount).toFixed(2), Payee: payee, Description: l.description, Reference: l.reference, 'Account Code': l.account, 'Tax Type': tax };
      if (ui.xFormat === 'sales') return { ContactName: payee, EmailAddress: e ? e.email : '', InvoiceNumber: ref, Reference: l.description.slice(0, 255), InvoiceDate: d, DueDate: d, Description: l.description, Quantity: '1', UnitAmount: l.amount.toFixed(2), AccountCode: l.account, TaxType: tax };
      return { ContactName: payee, InvoiceNumber: ref, InvoiceDate: d, DueDate: d, Description: l.description, Quantity: '1', UnitAmount: l.amount.toFixed(2), AccountCode: l.account, TaxType: tax };
    });
  }
  function validate() {
    const fmt = XF[ui.xFormat], issues = [], bad = new Set(), codes = new Set(S().accounts.map(a => a.code));
    const seen = {};
    ui.xRows.forEach((r, i) => {
      fmt.req.forEach(c => { if (!String(r[c] ?? '').trim()) { bad.add(i + ':' + c); issues.push(`Row ${i + 1}: ${c} is empty`); } });
      fmt.date.forEach(c => { if (r[c] && !/^\d{2}\/\d{2}\/\d{4}$/.test(r[c])) { bad.add(i + ':' + c); issues.push(`Row ${i + 1}: ${c} must be DD/MM/YYYY`); } });
      fmt.money.forEach(c => { if (r[c] !== '' && isNaN(+r[c])) { bad.add(i + ':' + c); issues.push(`Row ${i + 1}: ${c} must be a number`); } });
      const ac = r['Account Code'] ?? r.AccountCode; if (ac && !codes.has(ac)) issues.push(`Row ${i + 1}: account code ${ac} is not in your categories list (check it exists in Xero)`);
      if (r.InvoiceNumber) { if (seen[r.InvoiceNumber]) { bad.add(i + ':InvoiceNumber'); issues.push(`Row ${i + 1}: invoice number ${r.InvoiceNumber} is used twice`); } seen[r.InvoiceNumber] = 1; }
    });
    return { issues, bad };
  }
  function xero(p) {
    const fmt = XF[ui.xFormat];
    if (!ui.xRows) buildRows();
    const { issues, bad } = validate();
    const total = ui.xRows.reduce((n, r) => n + (+(r.Amount ?? r.UnitAmount * (r.Quantity || 1)) || 0), 0);
    p.innerHTML = `<h1>Export to Xero</h1><p class="intro">Choose what to export, check and edit every line below, then download a file Xero understands.</p>
     <div class="card2"><div class="toolbar" style="margin:0">
      <label style="font-weight:600;font-size:.9rem">File type <select id="xf">${Object.entries(XF).map(([k, v]) => `<option value="${k}" ${ui.xFormat === k ? 'selected' : ''}>${v.name}</option>`).join('')}</select></label>
      <label style="font-weight:600;font-size:.9rem">Which lines <select id="xr">${[['unexported', 'Everything not yet sent to Xero'], ['month', 'This month'], ['lastmonth', 'Last month'], ['year', 'This financial year'], ['all', 'All time'], ['custom', 'Custom dates']].map(([k, l]) => `<option value="${k}" ${ui.xRange === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      ${ui.xRange === 'custom' ? `<input type="date" id="xf1" value="${ui.xFrom}"> to <input type="date" id="xf2" value="${ui.xTo}">` : ''}
      <button class="cw-btn o sm" id="rebuild">↺ Reload lines from accounts</button></div>
      <p style="font-size:.88rem;color:var(--cw-ink2);margin:10px 0 0">${fmt.help}</p></div>
     ${issues.length ? `<div class="msg bad"><b>Please fix before downloading:</b><br>${issues.slice(0, 8).map(esc).join('<br>')}${issues.length > 8 ? `<br>…and ${issues.length - 8} more` : ''}</div>` : ui.xRows.length ? '<div class="msg ok">✓ All lines look good for Xero.</div>' : ''}
     <div class="card2" style="padding:0"><div style="padding:14px 16px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;align-items:center"><b>${ui.xRows.length} line${ui.xRows.length === 1 ? '' : 's'} · total ${money(total)}</b><span class="acts"><button class="cw-btn o sm" id="addrow">+ Add line</button></span></div>
      <div class="tw"><table class="t grid-ed"><thead><tr><th>#</th>${fmt.cols.map(c => `<th>${c}${fmt.req.includes(c) ? ' *' : ''}</th>`).join('')}<th></th></tr></thead><tbody>
      ${ui.xRows.map((r, i) => `<tr><td>${i + 1}</td>${fmt.cols.map(c => `<td><input data-r="${i}" data-c="${esc(c)}" value="${esc(r[c] ?? '')}" class="${bad.has(i + ':' + c) ? 'bad' : ''}" ${/Account ?Code/.test(c) ? `list="acclist"` : ''} style="${c === 'Description' ? 'min-width:220px' : ''}${fmt.money.includes(c) ? 'text-align:right' : ''}"></td>`).join('')}<td><button class="cw-btn o sm" data-rm="${i}" aria-label="Remove line">✕</button></td></tr>`).join('') || `<tr><td colspan="${fmt.cols.length + 2}" style="padding:30px;text-align:center">No lines to export. ${ui.xRange === 'unexported' ? 'Everything has already been sent – choose a date range to export again.' : ''}</td></tr>`}
      </tbody></table></div></div>
     <datalist id="acclist">${S().accounts.map(a => `<option value="${esc(a.code)}">${esc(a.name)}</option>`).join('')}</datalist>
     <div class="card2"><div class="acts"><button class="cw-btn p" id="dl" ${ui.xRows.length && !issues.some(x => !/not in your categories/.test(x)) ? '' : 'disabled'}>⬇ Download Xero file (.csv)</button>
      <label class="cw-check" style="display:flex;gap:8px;align-items:center;font-size:.9rem"><input type="checkbox" id="mark" checked style="accent-color:var(--cw-brand)"> Mark these lines as "sent to Xero"</label></div></div>
     <div class="card2"><h2>How to import into Xero</h2><ol class="steps">
      ${ui.xFormat === 'bank' ? '<li>In Xero go to <b>Accounting → Bank accounts</b> and choose the charity bank account.</li><li>Click <b>Manage account → Import a statement</b>.</li><li>Choose the downloaded file and click <b>Import</b>.</li><li>When Xero asks you to match columns, set Date, Amount, Payee, Description, Reference, Account Code and Tax Type to the matching columns, and choose date format <b>DD/MM/YYYY</b>.</li><li>Click <b>Complete import</b>. The lines appear ready to reconcile, already coded.</li>'
        : `<li>In Xero go to <b>Business → ${ui.xFormat === 'sales' ? 'Invoices' : 'Bills to pay'}</b>.</li><li>Click <b>Import</b>, then choose the downloaded file.</li><li>Choose <b>Tax rates are: No tax</b> (unless your charity is VAT-registered), then <b>Import</b>.</li><li>Check the drafts and approve them. Then mark them paid against the bank lines when you reconcile.</li>`}
      <li>If Xero says an account code is not found, change it on the <b>Accounts → Categories</b> list here to match your Xero chart of accounts and export again.</li></ol></div>`;
    p.querySelector('#xf').onchange = e => { ui.xFormat = e.target.value; ui.xRows = null; render(); };
    p.querySelector('#xr').onchange = e => { ui.xRange = e.target.value; ui.xRows = null; render(); };
    const x1 = p.querySelector('#xf1'), x2 = p.querySelector('#xf2');
    if (x1) { x1.onchange = e => { ui.xFrom = e.target.value; ui.xRows = null; render(); }; x2.onchange = e => { ui.xTo = e.target.value; ui.xRows = null; render(); }; }
    p.querySelector('#rebuild').onclick = () => { if (confirm('Reload lines from the accounts? Edits you made on this screen will be lost.')) { ui.xRows = null; render(); } };
    p.querySelectorAll('[data-r]').forEach(inp => inp.onchange = () => { ui.xRows[+inp.dataset.r][inp.dataset.c] = inp.value.trim(); render(); });
    p.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { ui.xRows.splice(+b.dataset.rm, 1); ui.xIds.splice(+b.dataset.rm, 1); render(); });
    p.querySelector('#addrow').onclick = () => { const r = {}; fmt.cols.forEach(c => r[c] = ''); fmt.date.forEach(c => r[c] = CW.ukDate(Date.now())); if ('Quantity' in r) r.Quantity = '1'; if ('TaxType' in r) r.TaxType = st().taxType; if ('Tax Type' in r) r['Tax Type'] = st().taxType; ui.xRows.push(r); ui.xIds.push(null); render(); };
    p.querySelector('#dl').onclick = () => {
      let rows;
      if (fmt.full) rows = [fmt.full, ...ui.xRows.map(r => fmt.full.map(h => r[h.replace('*', '')] ?? ''))];
      else rows = [fmt.cols, ...ui.xRows.map(r => fmt.cols.map(c => r[c] ?? ''))];
      CW.download(`${fmt.file}-${toDateInput(Date.now())}.csv`, CW.toCSV(rows));
      if (document.getElementById('mark').checked) { const t = Date.now(); ui.xIds.forEach(id => { const l = id && S().ledger.find(x => x.id === id); if (l) l.exported = t; }); CW.log(`Xero export: ${fmt.name}, ${ui.xRows.length} lines`); CW.save(); }
      toast('Xero file downloaded'); ui.xRows = null; render();
    };
  }

  /* ================= TEAM ================= */
  function team(p) {
    const u = me(), mgr = u.role === 'owner' || u.role === 'admin';
    const link = location.href.split('#')[0] + '#signup?code=' + (st().inviteCode || '');
    const owners = S().admins.filter(a => a.role === 'owner' && a.active).length;
    p.innerHTML = `<h1>Team & admins</h1><p class="intro">Everyone who helps run competitions and accounts gets their own login, so the audit log shows who did what.</p>
     ${mgr ? `<div class="card2"><h2>Invite someone</h2><p style="color:var(--cw-ink2);margin:0 0 12px">Send them the sign-up link, or give them the invite code to enter on the admin sign-up page. They join as a <b>Volunteer</b>. Change their role below.</p>
      <div class="toolbar" style="margin:0"><span style="font:900 1.6rem Cinzel,serif;letter-spacing:.15em;color:var(--cw-brand)">${esc(st().inviteCode || '—')}</span>
      <button class="cw-btn o sm" id="cpl">📋 Copy sign-up link</button><button class="cw-btn o sm" id="newc">↻ New code</button><button class="cw-btn p sm" id="addm">+ Add a team member</button></div>
      <p style="font-size:.84rem;color:var(--cw-ink2);margin:10px 0 0">Demo mode: sign-ups only work in this browser, so for now add people here or sign them up on this computer.</p></div>` : ''}
     <div class="card2"><h2>What each role can do</h2><div class="tw"><table class="t"><thead><tr><th>Role</th><th>Can use</th></tr></thead><tbody>
      <tr><td><b>Owner</b></td><td>Everything, including managing the team and roles</td></tr>
      <tr><td><b>Admin</b></td><td>Everything: competitions, entries, draws, accounts, Xero, settings. Can manage volunteers.</td></tr>
      <tr><td><b>Volunteer</b></td><td>Dashboard, entries & payments, draws, instant wins. <i>No accounts, Xero or settings.</i></td></tr></tbody></table></div></div>
     <div class="card2" style="padding:0"><div class="tw"><table class="t"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Last login</th>${mgr ? '<th>Actions</th>' : ''}</tr></thead><tbody>
      ${S().admins.map(a => {
        const canEdit = mgr && a.id !== u.id && (u.role === 'owner' || a.role === 'volunteer');
        return `<tr><td><b>${esc(a.name)}</b>${a.id === u.id ? ' <small>(you)</small>' : ''}</td><td>${esc(a.email)}</td>
        <td>${canEdit ? `<select data-role="${a.id}">${Object.entries(CW.ROLES).filter(([k]) => u.role === 'owner' || k === 'volunteer' || k === a.role).map(([k, l]) => `<option value="${k}" ${a.role === k ? 'selected' : ''}>${l}</option>`).join('')}</select>` : CW.ROLES[a.role]}</td>
        <td>${a.active ? '<span class="pill p-paid">Active</span>' : '<span class="pill p-cancelled">Switched off</span>'}</td><td>${fmtD(a.createdAt)}</td><td>${a.lastLogin ? fmtDT(a.lastLogin) : 'Never'}</td>
        ${mgr ? `<td><div class="acts">${canEdit ? `<button class="cw-btn o sm" data-reset-pw="${a.id}">Reset password</button><button class="cw-btn o sm" data-toggle="${a.id}">${a.active ? 'Switch off' : 'Switch on'}</button>` : ''}</div></td>` : ''}</tr>`; }).join('')}
     </tbody></table></div></div>`;
    if (!mgr) return;
    p.querySelector('#cpl').onclick = () => { navigator.clipboard && navigator.clipboard.writeText(link); toast('Sign-up link copied'); };
    p.querySelector('#newc').onclick = () => { if (!confirm('Make a new invite code? The old code will stop working.')) return; st().inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase(); CW.log('Invite code changed'); CW.save(); render(); };
    p.querySelector('#addm').onclick = () => {
      openModal(`<h2 style="font-family:Fraunces,serif;margin:0 0 12px">Add a team member</h2><form class="cw-f" id="mf">
       <div class="two"><label>Name<input name="name" required></label><label>Email<input name="email" type="email" required></label></div>
       <div class="two"><label>Temporary password<input name="p" required minlength="6" value="${Math.random().toString(36).slice(2, 10)}"></label>
       <label>Role<select name="role">${Object.entries(CW.ROLES).filter(([k]) => u.role === 'owner' || k === 'volunteer').map(([k, l]) => `<option value="${k}" ${k === 'volunteer' ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
       <p style="font-size:.84rem;color:var(--cw-ink2);margin:0">Give them the temporary password. They can change it under Settings → Change my password.</p>
       <div class="cw-err" id="me"></div><button class="cw-btn p">Add member</button></form>`);
      document.getElementById('mf').onsubmit = async e => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); try { await CW.createAdmin({ name: d.name, email: d.email, password: d.p, role: d.role }); closeModal(); toast(`${d.name} added. Temporary password: ${d.p}`); render(); } catch (err) { document.getElementById('me').textContent = err.message; } };
    };
    p.querySelectorAll('[data-role]').forEach(sel => sel.onchange = () => {
      const a = S().admins.find(x => x.id === sel.dataset.role);
      if (a.role === 'owner' && sel.value !== 'owner' && owners < 2) { alert('There must always be at least one owner.'); return render(); }
      a.role = sel.value; CW.log(`${a.name} is now ${CW.ROLES[a.role]}`); CW.save(); toast('Role updated'); render();
    });
    p.querySelectorAll('[data-reset-pw]').forEach(b => b.onclick = async () => {
      const a = S().admins.find(x => x.id === b.dataset.resetPw); const np = prompt(`New temporary password for ${a.name} (at least 6 characters):`, Math.random().toString(36).slice(2, 10));
      if (!np) return; try { await CW.setPassword(a.id, np); CW.log(`Password reset for ${a.name}`); CW.save(); toast(`Password reset. Give ${a.name}: ${np}`); } catch (err) { alert(err.message); }
    });
    p.querySelectorAll('[data-toggle]').forEach(b => b.onclick = () => {
      const a = S().admins.find(x => x.id === b.dataset.toggle);
      if (a.active && a.role === 'owner' && owners < 2) return alert('You can\'t switch off the only owner.');
      a.active = !a.active; CW.log(`${a.name} ${a.active ? 'switched on' : 'switched off'}`); CW.save(); render();
    });
  }

  /* ================= SETTINGS ================= */
  function settings(p) {
    const s = st();
    p.innerHTML = `<h1>Settings & publish</h1><p class="intro">Charity details, payment instructions, publishing and backups.</p>
     <div class="card2"><h2>Publish competitions to the website</h2>
      <p style="color:var(--cw-ink2);margin:0 0 12px">Competitions you create are saved in <b>this browser</b>. To show them to everyone visiting the site, download the competitions file and upload it to the website's <code>comp/</code> folder on GitHub (replacing <code>competitions.json</code>).</p>
      <div class="acts"><button class="cw-btn p" id="pub">⬇ Download competitions.json</button><a class="cw-btn o" href="https://github.com/jamescdrw/community-wishes-leicester/upload/main/comp" target="_blank" rel="noopener">Open GitHub upload page ↗</a></div>
      <p style="font-size:.84rem;color:var(--cw-ink2);margin-top:10px">Entries, payments and accounts are never included in this file. They stay private in this browser.</p></div>
     <form class="card2 cw-f" id="sf"><h2>Charity & payment details</h2>
      <div class="two"><label>Charity name<input name="charity" value="${esc(s.charity)}"></label><label>Charity number<input name="charityNo" value="${esc(s.charityNo)}"></label></div>
      <div class="two"><label>Contact email<input name="email" value="${esc(s.email)}"></label><label>Contact phone<input name="phone" value="${esc(s.phone)}"></label></div>
      <label>Postal address for free entries<input name="postalAddress" value="${esc(s.postalAddress)}"></label>
      <div class="three"><label>Bank account name<input name="bankName" value="${esc(s.bankName)}"></label><label>Sort code<input name="sortCode" value="${esc(s.sortCode)}"></label><label>Account number<input name="accountNo" value="${esc(s.accountNo)}"></label></div>
      <div class="three"><label>Reference prefix<input name="refPrefix" value="${esc(s.refPrefix)}" maxlength="6"></label><label>Hold unpaid tickets (hours)<input name="holdHours" type="number" min="0" value="${s.holdHours}"></label><label>Xero tax type<input name="taxType" value="${esc(s.taxType)}"></label></div>
      <label class="cw-check"><input type="checkbox" name="previewMode" ${s.previewMode ? 'checked' : ''}> Preview mode (shows "examples only" banner on the public pages)</label>
      <div><button class="cw-btn p">Save settings</button></div></form>
     <form class="card2 cw-f" id="pw"><h2>Change my password</h2><div class="two"><label>New password<input type="password" name="p" minlength="6" required autocomplete="new-password"></label><label>Confirm<input type="password" name="p2" required autocomplete="new-password"></label></div><div><button class="cw-btn o">Change password</button></div></form>
     <div class="card2"><h2>Backup & restore</h2><p style="color:var(--cw-ink2);margin:0 0 12px">Download a full backup (competitions, entries, accounts, logs) to keep safe or to move to another computer.</p>
      <div class="acts"><button class="cw-btn ok" id="bk">⬇ Download full backup</button><label class="cw-btn o" style="cursor:pointer">⬆ Restore from backup<input type="file" id="rs" accept=".json,application/json" hidden></label><button class="cw-btn bad" id="wipe">Delete all data</button></div></div>`;
    p.querySelector('#pub').onclick = () => { CW.download('competitions.json', CW.publishedJSON(), 'application/json'); CW.log('Competitions file downloaded for publishing'); CW.save(); };
    p.querySelector('#sf').onsubmit = e => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); Object.assign(s, d, { previewMode: !!d.previewMode, holdHours: +d.holdHours || 0 }); CW.log('Settings updated'); CW.save(); toast('Settings saved'); shell(); render(); };
    p.querySelector('#pw').onsubmit = async e => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); if (d.p !== d.p2) return alert('Passwords do not match'); try { await CW.setPassword(me().id, d.p); CW.log('Changed own password'); CW.save(); e.target.reset(); toast('Password changed'); } catch (err) { alert(err.message); } };
    p.querySelector('#bk').onclick = () => CW.download(`community-wishes-backup-${toDateInput(Date.now())}.json`, CW.exportAll(), 'application/json');
    p.querySelector('#rs').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { if (!confirm('Replace ALL data in this browser with the backup?')) return; CW.importAll(r.result); toast('Backup restored'); shell(); render(); } catch (err) { alert(err.message); } }; r.readAsText(f); };
    p.querySelector('#wipe').onclick = () => { if (prompt('This deletes every competition, entry and account line in this browser. Type DELETE to confirm.') === 'DELETE') { CW.reset(); CW.setAdmin(null); location.reload(); } };
  }

  /* ---------- boot ---------- */
  function boot() {
    if (!authed()) return login();
    CW.releaseExpired(); CW.runDueAutoDraws();
    shell(); render();
    CW.syncPublished().then(ch => { if (ch) render(); });
    setInterval(() => { const d = CW.runDueAutoDraws(); if (d.length) { toast(`🎲 Auto draw: ${d.length} winner(s) drawn`); render(); } }, 15000);
  }
  CW.onChange(() => { if (authed() && document.getElementById('pane') && !modal.classList.contains('open') && !document.activeElement.matches('input,select,textarea')) render(); });
  boot();
})();
