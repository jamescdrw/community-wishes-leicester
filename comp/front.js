/* Injects the Competitions showcase into the Community Wishes homepage */
(function () {
  const { esc, money, art, phase, PHASE_LABEL, soldCount, countdownParts } = CW;

  // nav link
  const menu = document.getElementById('menu');
  if (menu && !menu.querySelector('.cw-navlink')) {
    const li = document.createElement('li');
    li.innerHTML = '<a class="cw-navlink" href="#competitions" style="color:#f5c451;font-weight:700">★ Competitions</a>';
    menu.insertBefore(li, menu.firstChild);
    li.querySelector('a').addEventListener('click', () => { menu.classList.remove('open'); });
  }
  // member account link + real donate page
  if (menu && !menu.querySelector('[data-acct]')) {
    const li = document.createElement('li'); li.innerHTML = '<a href="account.html" data-acct>Log in</a>';
    const last = menu.lastElementChild; menu.insertBefore(li, last);
    const m = CW.currentMember(); li.firstChild.textContent = m ? '👤 ' + m.name.split(' ')[0] : 'Log in';
  }
  document.querySelectorAll('.donate-link').forEach(a => {
    const amt = (a.textContent.match(/£(\d+)/) || [])[1];
    a.href = 'donate.html' + (amt ? '?amount=' + amt : ''); a.removeAttribute('target');
  });
  // hero CTA
  const cta = document.querySelector('.hero .cta');
  if (cta && !cta.querySelector('.cw-herobtn')) {
    const a = document.createElement('a'); a.className = 'btn btn-g cw-herobtn'; a.href = '#competitions'; a.textContent = '★ Win prizes';
    a.style.cssText = 'border-color:rgba(245,196,81,.7);color:#ffe9a8';
    cta.appendChild(a);
  }
  // footer link
  const fl = document.querySelector('footer .fgrid ul');
  if (fl) { const li = document.createElement('li'); li.innerHTML = '<a href="competitions.html">Competitions</a>'; fl.insertBefore(li, fl.firstChild); }

  const sec = document.createElement('section');
  sec.id = 'competitions'; sec.className = 'cw-show';
  const hero = document.querySelector('.hero');
  (hero && hero.parentNode) ? hero.parentNode.insertBefore(sec, hero.nextSibling) : document.querySelector('main').prepend(sec);

  function visible() {
    return CW.state.competitions.filter(c => !['draft'].includes(c.status));
  }
  function order(list) {
    const rank = { live: 0, soon: 1, soldout: 2, closed: 3, paused: 4, drawn: 5 };
    return list.slice().sort((a, b) => (rank[phase(a)] - rank[phase(b)]) || (b.featured - a.featured) || ((a.endAt || 0) - (b.endAt || 0)));
  }

  function card(c) {
    const p = phase(c), sold = soldCount(c.id), pct = Math.min(100, Math.round(sold / c.maxTickets * 100));
    const iwLeft = (c.instantWins || []).filter(w => !w.wonBy).length;
    return `<a class="cw-card rv" href="competitions.html?id=${encodeURIComponent(c.id)}">
      <div class="pic">${art(c)}<div class="tag"><span class="cw-tag ${p === 'live' ? 'live' : ''}">${PHASE_LABEL[p]}</span>${iwLeft ? `<span class="cw-tag iw">⚡ ${iwLeft} instant win${iwLeft > 1 ? 's' : ''}</span>` : ''}</div></div>
      <div class="ci"><h4>${esc(c.title)}</h4>
       ${p === 'drawn' && c.winner ? `<div style="color:#ffe9a8">🏆 Won by ${esc(c.winner.name.split(' ')[0])} – ticket #${c.winner.ticket}</div>` : `<div class="cw-bar"><i style="width:${pct}%"></i></div><div class="cw-barl" style="margin-top:0"><span>${sold} / ${c.maxTickets} sold</span><span data-cd-short="${c.endAt}"></span></div>`}
       <div class="meta"><span>Prize worth ${money(c.prizeValue)}</span><b>${money(c.price)}</b></div></div></a>`;
  }

  function render() {
    const all = order(visible());
    const feat = all.find(c => c.featured && ['live', 'soon'].includes(phase(c))) || all.find(c => phase(c) === 'live') || all[0];
    const rest = all.filter(c => c !== feat).slice(0, 6);
    const live = all.filter(c => phase(c) === 'live');
    const prizePot = live.reduce((n, c) => n + (+c.prizeValue || 0) + (c.instantWins || []).filter(w => !w.wonBy).reduce((m, w) => m + (+w.value || 0), 0), 0);
    const iwCount = live.reduce((n, c) => n + (c.instantWins || []).filter(w => !w.wonBy).length, 0);
    const winners = [];
    all.forEach(c => {
      if (c.winner) winners.push(`🏆 <b>${esc(c.winner.name.split(' ')[0])}</b> won ${esc(c.prize || c.title)} with ticket #${c.winner.ticket}`);
      (c.instantWins || []).forEach(w => { if (w.wonBy) winners.push(`⚡ <b>${esc((w.wonName || 'A supporter').split(' ')[0])}</b> instantly won ${esc(w.prize)}`); });
    });
    const tick = winners.length ? winners : ['Every ticket helps grant a wish for someone in Leicester', 'Prize competitions with a free entry route – see terms', 'Instant wins revealed the moment you enter', 'Draws streamed live or drawn automatically & fairly'];

    if (!feat) {
      sec.innerHTML = `<div class="wrap"><div class="head rv"><span class="eyebrow">Competitions</span><h2 class="t">Win prizes. <em>Grant wishes.</em></h2><p>New competitions are coming soon. Every ticket helps us grant wishes across Leicester.</p></div></div>`;
      observe(); return;
    }
    const fp = phase(feat), fsold = soldCount(feat.id), fpct = Math.min(100, Math.round(fsold / feat.maxTickets * 100));
    const fiw = (feat.instantWins || []).filter(w => !w.wonBy).length;
    sec.innerHTML = `<div class="wrap">
     <div class="head rv"><span class="eyebrow">Charity competitions</span><h2 class="t">${CW.state.site.comp.heading ? esc(CW.state.site.comp.heading) : 'Win prizes. <em>Grant wishes.</em>'}</h2>
      <p>${CW.state.site.comp.intro ? esc(CW.state.site.comp.intro) : 'Enter our charity competitions for the chance to win incredible prizes – and every single ticket helps us grant wishes for people in Leicester facing hardship, illness or disability.'}</p>
      ${CW.state.settings.previewMode ? '<span class="cw-preview">Preview – competitions shown are examples</span>' : ''}</div>
     <div class="cw-stats rv"><div><b>${live.length}</b><span>Live competitions</span></div><div><b>${money(prizePot).replace('.00', '')}</b><span>In prizes</span></div><div><b>${iwCount}</b><span>Instant wins</span></div></div>
     <div class="cw-feat rv rv-s">
      <div class="pic">${art(feat, true)}<div class="tag" style="display:flex;gap:6px;flex-wrap:wrap"><span class="cw-tag ${fp === 'live' ? 'live' : ''}">${feat.featured ? '★ Featured · ' : ''}${PHASE_LABEL[fp]}</span>${fiw ? `<span class="cw-tag iw">⚡ ${fiw} instant wins</span>` : ''}</div></div>
      <div class="body">
       <span class="val">PRIZE WORTH ${money(feat.prizeValue)}</span>
       <h3>${esc(feat.title)}</h3>
       ${feat.subtitle ? `<p class="d">${esc(feat.subtitle)}</p>` : ''}
       ${fp === 'drawn' && feat.winner ? `<div class="cw-tag" style="align-self:flex-start;font-size:.9rem">🏆 Winner: ${esc(feat.winner.name.split(' ')[0])} · ticket #${feat.winner.ticket}</div>` :
         `<div><div style="font-size:.78rem;letter-spacing:.16em;text-transform:uppercase;color:#aab4c6;margin-bottom:8px">${fp === 'soon' ? 'Opens in' : 'Draw in'}</div><div class="cw-cd" data-cd="${fp === 'soon' ? feat.startAt : feat.endAt}"></div></div>
          <div><div class="cw-bar"><i style="width:${fpct}%"></i></div><div class="cw-barl"><span>${fsold} sold</span><span>${feat.maxTickets - fsold} left of ${feat.maxTickets}</span></div></div>`}
       <div class="cw-row" style="justify-content:space-between;margin-top:6px">
        <div class="cw-price"><b>${money(feat.price)}</b><span>per ticket</span></div>
        <a class="btn btn-w" href="competitions.html?id=${encodeURIComponent(feat.id)}">${fp === 'live' ? 'Enter now →' : 'View competition →'}</a>
       </div>
       <div style="font-size:.84rem;color:#aab4c6">${feat.drawMode === 'live' ? '🎥 Drawn live by our team' : '🎲 Drawn automatically when the timer ends'} · Max ${feat.maxPerPerson} per person</div>
      </div>
     </div>
     ${rest.length ? `<div class="cw-grid">${rest.map(card).join('')}</div>` : ''}
     <div style="text-align:center;margin-top:34px"><a class="btn btn-g" href="competitions.html">See all competitions</a></div>
     <div class="cw-steps">
      <div class="rv"><b>1</b><h5>Pick a competition</h5><p>Choose your prize and how many tickets you'd like.</p></div>
      <div class="rv" style="--dl:.08s"><b>2</b><h5>Answer the question</h5><p>Answer our simple question correctly to qualify.</p></div>
      <div class="rv" style="--dl:.16s"><b>3</b><h5>Instant wins</h5><p>Matched an instant-win number? You'll see it straight away.</p></div>
      <div class="rv" style="--dl:.24s"><b>4</b><h5>The draw</h5><p>Drawn automatically or live on Facebook. Every ticket grants wishes.</p></div>
     </div>
     <div class="cw-ticker rv"><strong>${winners.length ? 'Winners' : 'Good to know'}</strong><div class="tr"><div>${[...tick, ...tick].map(t => `<span>${t}</span>`).join('')}</div></div></div>
     <p class="cw-note">Free entry route available – <a href="terms.html">see competition terms</a>. 18+ only. Registered charity ${esc(CW.state.settings.charityNo)}.</p>
    </div>`;
    observe(); tickCd();
  }

  function observe() {
    sec.querySelectorAll('.rv').forEach(el => {
      if (!('IntersectionObserver' in window)) return el.classList.add('in');
      const io = new IntersectionObserver(e => e.forEach(x => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }), { threshold: .1 });
      io.observe(el);
    });
  }
  function tickCd() {
    sec.querySelectorAll('[data-cd]').forEach(el => {
      const t = countdownParts(+el.dataset.cd - Date.now());
      el.innerHTML = [['d', 'Days'], ['h', 'Hours'], ['m', 'Mins'], ['s', 'Secs']].map(([k, l]) => `<div><b>${String(t[k]).padStart(2, '0')}</b><small>${l}</small></div>`).join('');
    });
    sec.querySelectorAll('[data-cd-short]').forEach(el => {
      const ms = +el.dataset.cdShort - Date.now(); if (ms <= 0) { el.textContent = 'Closed'; return; }
      const t = countdownParts(ms); el.textContent = t.d ? `${t.d}d ${t.h}h left` : `${t.h}h ${t.m}m ${t.s}s left`;
    });
  }
  setInterval(tickCd, 1000);

  CW.runDueAutoDraws();
  render();
  CW.applyOverrides(); CW.applySiteGlobal();
  if (/[?&]edit=1/.test(location.search) && CW.isAdmin()) { const sc = document.createElement('script'); sc.src = 'comp/editor.js?v=' + Date.now(); document.body.appendChild(sc); }
  CW.syncPublished().then(ch => { if (ch) { CW.runDueAutoDraws(); render(); CW.applyOverrides(); } });
  CW.onChange(render);
})();
