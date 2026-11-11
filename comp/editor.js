/* Community Wishes – visual website editor (homepage, admin only, ?edit=1) */
(function () {
  if (!window.CW || !CW.isAdmin()) return;
  let mode = 'text', current = null;
  const history = [];
  const SKIP = '#cw-edit-ui, #competitions, #cw-annc, .lb, script, style, canvas';

  const css = document.createElement('style');
  css.textContent = `
  body.cw-editing [data-cw-hover]{outline:2px dashed #f5c451!important;outline-offset:3px;cursor:text}
  body.cw-editing.cw-pic [data-cw-hover]{outline:3px solid #3ddc84!important;cursor:copy}
  body.cw-editing [contenteditable=true]{outline:3px solid #c0264f!important;outline-offset:3px;background:rgba(255,255,255,.08)}
  body.cw-editing .rv{opacity:1!important;transform:none!important}
  #cw-edit-ui{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:10000;display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;
    background:#0a1226;color:#fff;padding:10px 12px;border-radius:20px;box-shadow:0 20px 50px -10px rgba(0,0,0,.7);border:1px solid rgba(245,196,81,.5);font:600 .88rem Inter,sans-serif;max-width:calc(100% - 20px)}
  #cw-edit-ui button,#cw-edit-ui a{border:0;border-radius:12px;padding:9px 14px;font:700 .86rem Inter,sans-serif;cursor:pointer;background:rgba(255,255,255,.1);color:#fff;text-decoration:none}
  #cw-edit-ui button[aria-pressed=true]{background:#f5c451;color:#3b2500}
  #cw-edit-ui .hint{color:#c7cfdd;font-weight:500;padding:0 6px}
  #cw-edit-pop{position:absolute;z-index:10001;background:#fff;color:#0d1628;border-radius:14px;padding:10px;box-shadow:0 14px 40px rgba(0,0,0,.35);display:flex;gap:6px;align-items:center;font:600 .82rem Inter,sans-serif}
  #cw-edit-pop input{font:500 .86rem Inter;padding:7px 9px;border:1px solid #d9d1c3;border-radius:9px;width:260px;max-width:50vw}
  #cw-edit-pop button{border:0;border-radius:9px;padding:8px 12px;font:700 .82rem Inter;cursor:pointer;background:#0a1226;color:#fff}
  #cw-edit-toast{position:fixed;top:90px;left:50%;transform:translateX(-50%);z-index:10002;background:#1f9d55;color:#fff;padding:10px 18px;border-radius:999px;font:700 .88rem Inter;box-shadow:0 10px 30px rgba(0,0,0,.3)}`;
  document.head.appendChild(css);
  document.body.classList.add('cw-editing');

  const ui = document.createElement('div'); ui.id = 'cw-edit-ui';
  ui.innerHTML = `<span>✏️ <b>Editing website</b></span>
    <button data-mode="text" aria-pressed="true">Aa Text & links</button><button data-mode="pic" aria-pressed="false">📷 Pictures</button>
    <span class="hint" id="cw-hint">Click any text to change it.</span>
    <button id="cw-undo" disabled>↶ Undo</button><a href="admin.html#website">⚙️ More options</a><a href="./" id="cw-done" style="background:#c0264f">✓ Done</a>`;
  document.body.appendChild(ui);
  const hint = ui.querySelector('#cw-hint'), undoBtn = ui.querySelector('#cw-undo');
  ui.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => {
    mode = b.dataset.mode; ui.querySelectorAll('[data-mode]').forEach(x => x.setAttribute('aria-pressed', x === b));
    document.body.classList.toggle('cw-pic', mode === 'pic');
    hint.textContent = mode === 'pic' ? 'Click any photo or background to replace it.' : 'Click any text to change it.';
  });
  function toast(t) { const d = document.createElement('div'); d.id = 'cw-edit-toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 1800); }
  function remember(path) { history.push({ path, prev: CW.state.site.overrides[path] ? JSON.parse(JSON.stringify(CW.state.site.overrides[path])) : null }); undoBtn.disabled = false; }
  undoBtn.onclick = () => {
    const h = history.pop(); if (!h) return;
    if (h.prev) { CW.state.site.overrides[h.path] = h.prev; CW.siteChanged(); } else CW.clearOverride(h.path);
    toast('Undone – reloading…'); setTimeout(() => location.reload(), 500);
  };

  /* find the element to edit */
  function textTarget(t) {
    for (let el = t; el && el !== document.body; el = el.parentElement) {
      if (el.closest(SKIP)) return null;
      if ([...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && !el.querySelector('img,svg,canvas,input,select,textarea')) return el;
    }
    return null;
  }
  function picTarget(t) {
    for (let el = t; el && el !== document.body; el = el.parentElement) {
      if (el.closest(SKIP)) return null;
      if (el.tagName === 'IMG') return el;
      const child = el.querySelector(':scope > .bg, :scope > .bgc, :scope > .bgp, :scope > img');
      if (child) return child;
      const bi = getComputedStyle(el).backgroundImage;
      if (bi && bi.includes('url(')) return el;
    }
    return null;
  }
  let hov = null;
  document.addEventListener('mouseover', e => {
    if (current) return;
    const el = mode === 'pic' ? picTarget(e.target) : textTarget(e.target);
    if (hov && hov !== el) hov.removeAttribute('data-cw-hover');
    if (el) { el.setAttribute('data-cw-hover', ''); hov = el; }
  });

  document.addEventListener('click', e => {
    if (e.target.closest('#cw-edit-ui, #cw-edit-pop')) return;
    if (current && current.contains(e.target)) { e.preventDefault(); return; }
    const el = mode === 'pic' ? picTarget(e.target) : textTarget(e.target);
    if (!el) return;
    e.preventDefault(); e.stopPropagation();
    if (current) finish();
    mode === 'pic' ? pickPicture(el) : editText(el);
  }, true);

  function editText(el) {
    current = el; el.removeAttribute('data-cw-hover');
    const before = el.textContent; el.setAttribute('contenteditable', 'true'); el.focus();
    const r = document.createRange(); r.selectNodeContents(el); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    const link = el.closest('a');
    const pop = document.createElement('div'); pop.id = 'cw-edit-pop';
    pop.innerHTML = `${link ? `🔗 <input id="cw-href" value="${CW.esc(link.getAttribute('href') || '')}" placeholder="https://…">` : ''}<button id="cw-save">Save ✓</button><button id="cw-cancel" style="background:#eee;color:#333">Cancel</button>`;
    document.body.appendChild(pop);
    const box = el.getBoundingClientRect(); pop.style.top = (scrollY + box.bottom + 10) + 'px'; pop.style.left = Math.max(8, Math.min(scrollX + box.left, innerWidth - pop.offsetWidth - 8)) + 'px';
    const done = save => {
      el.removeAttribute('contenteditable'); pop.remove(); current = null;
      if (!save) { el.textContent = before; return; }
      const text = el.textContent.replace(/\s+/g, ' ').trim(); el.textContent = text;
      const path = CW.elPath(el); const patch = {};
      if (text !== before.replace(/\s+/g, ' ').trim()) patch.text = text;
      if (link) { const h = pop.querySelector('#cw-href').value.trim(); if (h && h !== link.getAttribute('href')) { link.setAttribute('href', h); remember(CW.elPath(link)); CW.setOverride(CW.elPath(link), { href: h }); } }
      if (Object.keys(patch).length) { remember(path); CW.setOverride(path, patch); }
      toast('Saved ✓');
    };
    finish = () => done(true);
    pop.querySelector('#cw-save').onclick = () => done(true);
    pop.querySelector('#cw-cancel').onclick = () => done(false);
    el.onkeydown = ev => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); done(true); } if (ev.key === 'Escape') done(false); };
  }
  let finish = () => {};

  function pickPicture(el) {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = () => {
      const f = inp.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => { const im = new Image(); im.onload = () => {
        const max = 1500, sc = Math.min(1, max / Math.max(im.width, im.height)); const cv = document.createElement('canvas');
        cv.width = Math.round(im.width * sc); cv.height = Math.round(im.height * sc); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
        const src = cv.toDataURL('image/jpeg', .72); const path = CW.elPath(el);
        remember(path); CW.setOverride(path, { src });
        if (CW.saveError) { alert('Browser storage is full – that picture could not be saved. Try a smaller picture or remove some other picture changes.'); CW.clearOverride(path); return; }
        if (el.tagName === 'IMG') el.src = src; else el.style.backgroundImage = `url("${src}")`;
        toast('Picture changed ✓');
      }; im.src = rd.result; };
      rd.readAsDataURL(f);
    };
    inp.click();
  }
})();
